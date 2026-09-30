import { TILE, ANIM } from './config.js';
import { ROOMS, START } from './rooms.js';
import { Room } from './room.js';
import { SOLID, ONE_WAY, BREAK } from './tileTypes.js';
import { ITEMS, xpToNext, spellDamage } from './items.js';
import { ELEMENTS } from './data/elements.js';
import { Projectile, overlap } from './enemies.js';
import { Boss, BOSSES } from './boss.js';
import { computeMods, abilitiesOf } from './stats.js';
import { rollItem } from './loot.js';
import { ZONES } from './zones.js';

const SAVE_KEY = 'agilancer-nights-save-v3';

// What enemy projectiles are made of, for armor resistances.
const PROJ_ELEMENT = { fire: 'fire', orb: 'dark', wisp: 'dark', beam: 'dark', bolt: 'poison', web: 'poison', blob: 'poison', ring: 'ice', star: 'fire', feather: 'thunder' };

export function newState() {
  return {
    room: START.room,
    x: START.x * TILE + TILE / 2,  // bottom-centre of the player, room px (respawn point)
    y: START.y * TILE,
    inventory: { spirit_bolt: 1 }, // item id -> count
    equip: { spell: 'spirit_bolt' },
    relics: [],                    // passive relics found, in order
    vessels: { hp: 0, mp: 0 },
    flags: {},                     // opened doors, defeated bosses, broken walls
    collected: {},                 // pedestal pickups and chests
    visited: {},                   // rooms seen, for the map
    level: 1,
    xp: 0,
    kills: 0,
    time: 0,
  };
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && ROOMS[s.room]) return { ...newState(), ...s };
  } catch (e) { /* no storage (private mode) or bad data */ }
  return null;
}

export class World {
  constructor(player, camera) {
    this.player = player;
    this.camera = camera;
    this.state = loadState() || newState();
    this.messages = [];
    this.popups = [];
    this.projectiles = [];
    this.particles = [];
    this.drops = [];
    this.fade = 1;
    this.flash = 0;
    this.shake = 0;
    this.respawnTimer = 0;
    this.deathTimer = 0;
    this.doorNagTimer = 0;
    this.banner = null;
    this.onChange = null;
    this.castFired = false;
    this.ending = null;
    this.echoUsed = false;
    player.canCast = () => this.canCast();
    this.refreshPlayer(true);
    this.enter(this.state.room, this.state.x, this.state.y);
  }

  get playerDead() { return this.deathTimer > 0; }
  get zone() { return ZONES[this.room.zone] || ZONES[0]; }
  get boss() { return this.room.enemies.find((e) => e.boss && !e.remove) || null; }

  save() {
    this.state.level = this.player.level;
    this.state.xp = this.player.xp;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    this.state = newState();
    this.ending = null;
    this.refreshPlayer(true);
    this.enter(this.state.room, this.state.x, this.state.y);
    this.onChange?.();
  }

  // Recompute stats, abilities and equipped weapons from the state.
  refreshPlayer(refill = false) {
    const p = this.player, st = this.state;
    p.level = st.level;
    p.xp = st.xp;
    p.mods = computeMods(st);
    p.abilities = abilitiesOf(st);
    p.maxHp = p.mods.maxHpTotal;
    p.maxMp = p.mods.maxMpTotal;
    if (refill) { p.hp = p.maxHp; p.mp = p.maxMp; }
    p.hp = Math.min(p.hp, p.maxHp);
    p.mp = Math.min(p.mp, p.maxMp);
    p.weapon = ITEMS[st.equip.rightHand] || null;
    p.weaponL = ITEMS[st.equip.leftHand] || null;
  }

  enter(id, bx, by) {
    this.room = new Room(id, ROOMS[id], this.state);
    const bossDef = ROOMS[id].boss;
    if (bossDef && !this.state.flags[`boss_${bossDef.id}`]) {
      this.room.enemies.push(new Boss({ boss: bossDef.id, x: bossDef.x, y: bossDef.y, m: this.room.zoneDef?.mult || 1 }));
      this.room.seal();
      this.bossIntro = { name: BOSSES[bossDef.id].name, t: 0 };
    }
    this.player.spawnAt(bx, by);
    this.player.onMover = null;
    this.projectiles = [];
    this.particles = [];
    this.drops = [];
    this.popups = [];
    this.entry = { x: bx, y: by };
    this.lastSafe = null;
    this.echoUsed = false;
    const st = this.state;
    st.room = id; st.x = bx; st.y = by;
    st.visited[id] = 1;
    this.camera.follow(this.player, this.room, true);
    this.fade = Math.max(this.fade, 0.6);
    this.banner = { text: this.room.name, sub: this.room.zoneName, t: 0 };
  }

  message(text, time = 2.5) { this.messages = [{ text, t: 0, time }]; }
  popup(x, y, text, color, big) { this.popups.push({ x, y, text, color, t: 0, big }); }
  count(id) { return this.state.inventory[id] || 0; }
  has(id) { return this.count(id) > 0 || this.state.relics.includes(id); }

  // Add an item (relics and vessels take effect immediately).
  giveItem(id, quiet = false) {
    const it = ITEMS[id];
    if (!it) return;
    if (it.type === 'relic') {
      if (!this.state.relics.includes(id)) this.state.relics.push(id);
      if (!quiet) this.message(`${it.name}!  ${it.desc}`, 5);
    } else if (it.type === 'vessel') {
      this.state.vessels[id === 'life_vessel' ? 'hp' : 'mp']++;
      if (!quiet) this.message(`${it.name}!  ${it.desc}`, 3);
    } else {
      this.state.inventory[id] = this.count(id) + 1;
      if (!quiet) this.message(`Obtained ${it.name}${it.type === 'weapon' || it.type === 'head' || it.type === 'body' || it.type === 'charm' ? '  (equip it from the MENU)' : ''}`, 3);
    }
    this.refreshPlayer(it.type === 'vessel');
    this.onChange?.();
  }

  removeItem(id) {
    const n = this.count(id) - 1;
    if (n > 0) this.state.inventory[id] = n; else delete this.state.inventory[id];
    for (const k of Object.keys(this.state.equip)) if (this.state.equip[k] === id && this.equippedCount(id) > this.count(id)) delete this.state.equip[k];
    this.refreshPlayer();
    this.onChange?.();
  }

  equippedCount(id) { return Object.values(this.state.equip).filter((v) => v === id).length; }

  // Put an item in a slot (null empties it). The same weapon can go in both
  // hands only if you own two.
  equip(slotId, itemId) {
    const eq = this.state.equip;
    if (itemId) {
      const it = ITEMS[itemId];
      const want = { rightHand: 'weapon', leftHand: 'weapon', spell: 'spell', head: 'head', body: 'body', charm1: 'charm', charm2: 'charm', charm3: 'charm' }[slotId];
      if (!it || it.type !== want || !this.count(itemId)) return false;
      const others = Object.entries(eq).filter(([k, v]) => v === itemId && k !== slotId);
      if (others.length >= this.count(itemId)) delete eq[others[0][0]];
      eq[slotId] = itemId;
    } else {
      delete eq[slotId];
    }
    this.refreshPlayer();
    this.save();
    this.onChange?.();
    return true;
  }

  get spell() { return ITEMS[this.state.equip.spell] || null; }

  canCast() {
    const s = this.spell;
    if (!s) { this.message('No spell equipped.', 1.5); return false; }
    if (this.player.mp < s.mp) { this.message('Not enough MP.', 1.5); return false; }
    return true;
  }

  gainXp(n) {
    const p = this.player;
    p.xp += Math.round(n * (1 + p.mods.xp));
    let leveled = false;
    while (p.xp >= xpToNext(p.level)) { p.xp -= xpToNext(p.level); p.level++; leveled = true; }
    this.state.level = p.level;
    this.state.xp = p.xp;
    if (leveled) {
      this.refreshPlayer(true);
      this.message(`LEVEL UP!  Level ${p.level}  -  ATK ${p.atk}  HP ${p.maxHp}  MP ${p.maxMp}`, 3.5);
      this.popup(p.x + p.w / 2, p.y - 6, 'LEVEL UP', '#ffe27a', true);
    }
    this.onChange?.();
  }

  // Raw damage to the player, after defense and resistances.
  hurtPlayer(raw, fromX, element = null, source = null) {
    const p = this.player;
    if (p.invuln > 0 || this.playerDead || this.ending) return;
    let dmg = raw * 60 / (60 + p.mods.def);
    if (element) dmg *= 1 - (p.mods[`res_${element}`] || 0);
    dmg = Math.max(element && p.mods[`res_${element}`] >= 1 ? 0 : 1, Math.round(dmg));
    if (dmg <= 0) { this.popup(p.x + p.w / 2, p.y, 'NULL', '#aaaaff'); p.invuln = 0.4; return; }
    if (source && p.mods.thorns) {
      const back = Math.round(dmg * p.mods.thorns);
      if (back > 0 && source.damage(back, p.x + p.w / 2) > 0) this.popup(source.x + source.w / 2, source.y, String(back), '#ffb0b0');
    }
    p.hp = Math.max(0, p.hp - dmg);
    this.popup(p.x + p.w / 2, p.y, String(dmg), '#ff6060');
    if (p.hp <= 0) {
      if (p.abilities.echo && !this.echoUsed) {
        this.echoUsed = true;
        p.hp = Math.ceil(p.maxHp / 3);
        this.message('The Echo Heart beats once more...', 2.5);
        this.flash = 0.6;
      } else {
        this.deathTimer = 3;
        p.setState('hurt');
        p.invuln = 99;
        this.message('You have fallen...', 3);
        return;
      }
    }
    p.knockback(fromX);
  }

  update(dt, input) {
    const p = this.player;
    const room = this.room;
    this.state.time += dt;
    this.fade = Math.max(0, this.fade - dt * 3);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.shake = Math.max(0, this.shake - dt);
    this.doorNagTimer = Math.max(0, this.doorNagTimer - dt);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < m.time);
    for (const q of this.popups) { q.t += dt; q.y -= dt * 22; }
    this.popups = this.popups.filter((q) => q.t < (q.big ? 1.6 : 0.9));
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 3) this.banner = null; }
    if (this.bossIntro) { this.bossIntro.t += dt; if (this.bossIntro.t > 3) this.bossIntro = null; }
    this.updateParticles(dt);
    room.update(dt);
    if (this.ending) { this.ending.t += dt; return; }

    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      this.fade = Math.min(1, Math.max(this.fade, 1 - this.deathTimer / 1.5));
      p.vx *= 0.9;
      if (this.deathTimer <= 0) {
        this.refreshPlayer(true);
        p.invuln = 0;
        p.setState('idle');
        this.enter(this.state.room, this.state.x, this.state.y);
        this.fade = 1;
      }
      return;
    }
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      this.fade = Math.min(1, this.fade + dt * 8);
      if (this.respawnTimer <= 0) {
        const spot = this.lastSafe || this.entry;
        p.spawnAt(spot.x, spot.y);
        p.setState('idle');
        this.camera.follow(p, room, true);
      }
      return;
    }

    p.hp = Math.min(p.maxHp, p.hp + p.mods.hpRegen * dt);
    p.mp = Math.min(p.maxMp, p.mp + (1.5 + p.mods.mpRegen) * dt);
    p.ride(room);
    p.update(dt, input, room);
    this.handlePlayerEvents();
    this.castSpell();

    const hz = room.touchesHazard(p.x, p.y, p.w, p.h);
    if (hz && !(hz.kind === 'spikes' && p.abilities.spikes) && !(hz.kind === 'lava' && p.abilities.lava)) {
      const dmg = Math.round(hz.dmg * (1 + room.zone * 0.25));
      p.hp = Math.max(0, p.hp - dmg);
      this.popup(p.x + p.w / 2, p.y, String(dmg), '#ff6060');
      if (p.hp <= 0) { this.deathTimer = 3; this.message('You have fallen...', 3); return; }
      p.invuln = 1.1;
      this.respawnTimer = 0.35;
      return;
    }

    this.updateCombat(dt);
    this.updateDrops(dt);
    this.checkBreakables();
    this.trackSafeGround();
    this.checkPickups();
    this.checkChests();
    this.checkDoor();
    this.checkExits();
  }

  // ---------- particles ----------
  burst(x, y, color, n = 8, speed = 60, life = 0.5, g = 120) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: life * (0.6 + Math.random() * 0.6), color, g, size: 1 + Math.random() * 1.5 });
    }
  }

  updateParticles(dt) {
    for (const q of this.particles) { q.t += dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    this.particles = this.particles.filter((q) => q.t < q.life);
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  handlePlayerEvents() {
    const p = this.player;
    for (const ev of p.events) {
      const f = p.facing;
      if (ev.kind === 'spark') {
        if (Math.random() < 0.5) this.particles.push({ x: ev.x, y: ev.y, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30, t: 0, life: 0.4, color: ELEMENTS[ev.el].color, g: ev.el === 'fire' ? -40 : 60, size: 1.5 });
      } else if (ev.kind === 'dust') {
        this.burst(ev.x, ev.y, 'rgba(220,210,255,0.8)', ev.big ? 16 : 6, ev.big ? 90 : 40, 0.4, 0);
      } else if (ev.kind === 'ring') {
        for (let i = 0; i < 10; i++) this.particles.push({ x: ev.x, y: ev.y, vx: Math.cos(i / 10 * Math.PI * 2) * 60, vy: Math.sin(i / 10 * Math.PI * 2) * 20, t: 0, life: 0.3, color: '#cfe0ff', g: 0, size: 1.5 });
      } else if (ev.kind === 'beam') {
        this.spawnBeam(ev.beam, ev.w);
      } else if (ev.kind === 'quake') {
        this.shake = 0.15;
        this.burst(ev.x, ev.y, 'rgba(200,190,170,0.9)', 10, 70, 0.4, 200);
        for (const d of [-1, 1]) this.projectiles.push(new Projectile({ kind: 'wave', owner: 'player', x: ev.x, y: ev.y - 6, vx: d * 180, r: 7, life: 0.45, dmg: Math.round(p.weaponDamage(ev.w) * 0.5), ghost: true, pierce: true, color: 'rgba(255,230,180,0.9)' }));
      } else if (ev.kind === 'requiem') {
        this.flash = 1;
        this.shake = 0.5;
        const cx = p.x + p.w / 2;
        for (let i = 0; i < 40; i++) this.particles.push({ x: cx + f * Math.random() * 300, y: p.y - 100 + Math.random() * 200, vx: f * 120, vy: (Math.random() - 0.5) * 60, t: 0, life: 0.8, color: i % 2 ? '#c8b8ff' : '#ffffff', g: 0, size: 2 });
      }
    }
    p.events.length = 0;
  }

  // Projectiles released by weapon swings.
  spawnBeam(kind, w) {
    const p = this.player, f = p.facing;
    const x = p.x + p.w / 2 + f * 16, y = p.y + 14;
    const dmg = Math.round(p.weaponDamage(w) * 0.6);
    const el = w.element;
    const P = (o) => this.projectiles.push(new Projectile({ owner: 'player', x, y, dmg, element: el, ...o }));
    switch (kind) {
      case 'crescent': P({ kind: 'beam', vx: f * 240, r: 8, life: 0.9, pierce: true, ghost: true, color: 'rgba(200,180,255,0.9)' }); break;
      case 'shard': for (const a of [-0.15, 0, 0.15]) P({ kind: 'ring', vx: f * Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 4, life: 0.8 }); break;
      case 'fireball': P({ kind: 'fire', vx: f * 200, vy: -60, g: 200, r: 5, life: 1.2, bounces: 1 }); break;
      case 'bolt': P({ kind: 'wisp', vx: f * 260, wave: 6, freq: 20, r: 5, life: 0.8, pierce: true }); break;
      case 'venom': P({ kind: 'blob', vx: f * 180, vy: -120, g: 400, r: 4, life: 1.2 }); break;
      case 'cross': P({ kind: 'cross', vx: f * 230, r: 7, life: 1.6, ghost: true, pierce: true, boomerang: true }); break;
      case 'orb': P({ kind: 'spirit', vx: f * 220, r: 4, life: 0.8, dmg: Math.round(dmg * 0.8) }); break;
      default: break;
    }
  }

  // ---------- spells ----------
  castSpell() {
    const p = this.player;
    if (p.state !== 'cast') { this.castFired = false; return; }
    if (this.castFired || p.stateTime < ANIM.cast * 3) return;
    this.castFired = true;
    const s = this.spell;
    if (!s || p.mp < s.mp) return;
    p.mp -= s.mp;
    const f = p.facing, x = p.x + p.w / 2 + f * 14, y = p.y + 12;
    const dmg = spellDamage(s, p.level, p.mods.spell);
    const P = (o) => this.projectiles.push(new Projectile({ owner: 'player', x, y, dmg, element: s.element, ...o }));
    switch (s.cast) {
      case 'fireOrb': P({ kind: 'fire', vx: f * 150, vy: -200, g: 480, r: 6, life: 2, explode: true }); break;
      case 'iceLance': P({ kind: 'ring', vx: f * 330, r: 5, life: 1.2, pierce: true }); break;
      case 'cross': P({ kind: 'cross', vx: f * 240, r: 8, life: 2, ghost: true, pierce: true, boomerang: true }); break;
      case 'thunder':
        for (let i = 1; i <= 3; i++) this.projectiles.push(new Projectile({ owner: 'player', kind: 'wisp', x: x + f * i * 52, y: p.y - 80, vy: 420, r: 7, life: 0.45, dmg, element: 'thunder', ghost: true, pierce: true }));
        this.flash = 0.25;
        break;
      case 'drain': {
        let healed = 0;
        for (const e of this.room.enemies) {
          if (e.dead || Math.abs(e.x + e.w / 2 - x) > 90 || Math.abs(e.y + e.h / 2 - y) > 60) continue;
          const d = e.damage(dmg, x, 'dark');
          if (d > 0) { healed += d; this.popup(e.x + e.w / 2, e.y, String(d), '#d0a0ff'); this.burst(e.x + e.w / 2, e.y + e.h / 2, '#b080ff', 8, 50); }
        }
        p.hp = Math.min(p.maxHp, p.hp + Math.round(healed * 0.5));
        break;
      }
      case 'bats':
        for (let i = 0; i < 5; i++) P({ kind: 'bat', vx: f * (80 + i * 10), vy: -40 + i * 20, r: 4, life: 3, homing: true });
        break;
      case 'meteor': this.projectiles.push(new Projectile({ owner: 'player', kind: 'fire', x: x + f * 90, y: this.camera.y - 20, vx: f * 30, vy: 260, r: 12, life: 2, dmg, element: 'fire', explode: true, big: true })); this.shake = 0.3; break;
      default: P({ kind: 'spirit', vx: f * 270, r: 5, life: 1.6 });
    }
    this.onChange?.();
  }

  // ---------- combat ----------
  // Player hits enemy e for `base` damage with an element; handles crits,
  // popups, life steal and kills.
  strike(e, base, fromX, element) {
    const p = this.player;
    const crit = Math.random() < p.mods.crit;
    let dmg = base * (crit ? 1.5 + p.mods.critDmg : 1);
    if (element) dmg *= 1 + p.mods.elemAtk;
    const status = element ? ELEMENTS[element].status : null;
    const dealt = e.damage(Math.round(dmg), fromX, element, status);
    if (dealt < 0) return;
    const aff = e.affinity(element);
    const col = dealt === 0 ? '#9aa0c0' : aff > 1.2 ? '#ffd24a' : crit ? '#ffef80' : element ? ELEMENTS[element].color : '#ffffff';
    this.popup(e.x + e.w / 2, e.y, dealt === 0 ? 'IMMUNE' : crit ? `${dealt}!` : String(dealt), col, crit);
    this.burst(e.x + e.w / 2, e.y + e.h / 2, element ? ELEMENTS[element].color : '#ffffff', 5, 60, 0.3);
    const steal = p.mods.lifesteal + (element === 'blood' ? 0.08 : 0);
    if (steal > 0 && dealt > 0) p.hp = Math.min(p.maxHp, p.hp + dealt * steal);
  }

  reward(e) {
    e.rewarded = true;
    const p = this.player, st = this.state;
    st.kills++;
    this.gainXp(e.xp);
    this.popup(e.x + e.w / 2, e.y - 4, `+${Math.round(e.xp * (1 + p.mods.xp))} XP`, '#9fe0ff');
    if (p.mods.drain) p.mp = Math.min(p.maxMp, p.mp + p.mods.drain);
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    this.burst(cx, cy, 'rgba(255,255,255,0.8)', 10, 70, 0.6, 30);
    if (e.boss) return this.bossDefeated(e);
    if (e.summoned) return;
    // Drops: orbs often, equipment sometimes (luck helps).
    const tier = this.room.zoneDef?.tier ?? 0;
    const r = Math.random();
    if (r < 0.07 + p.mods.luck * 0.08) this.drops.push({ item: rollItem(tier), x: cx, y: cy, vy: -150, t: 0 });
    else if (r < 0.2) this.drops.push({ orb: 'hp', x: cx, y: cy, vy: -120, t: 0 });
    else if (r < 0.3) this.drops.push({ orb: 'mp', x: cx, y: cy, vy: -120, t: 0 });
  }

  bossDefeated(e) {
    const B = e.boss, st = this.state;
    st.flags[`boss_${e.bossId}`] = true;
    this.room.unseal();
    this.shake = 0.8;
    this.flash = 0.8;
    this.message(`${B.name} has been vanquished!`, 4);
    for (let i = 0; i < 60; i++) this.burst(e.x + Math.random() * e.w, e.y + Math.random() * e.h, B.aura, 1, 120, 1.2, -20);
    const def = ROOMS[this.room.id].boss;
    B.reward.forEach((id, i) => {
      const pid = `reward_${e.bossId}_${i}`;
      if (!st.collected[pid]) this.room.items.push({ id: pid, item: id, x: def.x + i * 2, y: def.floor, px: (def.x + i * 2) * TILE, py: def.floor * TILE });
    });
    this.drops.push({ item: rollItem(Math.min(9, (this.room.zoneDef?.tier ?? 0) + 1)), x: e.x + e.w / 2, y: e.y, vy: -200, t: 0 });
    if (B.final) this.ending = { t: -3 };
    this.save();
  }

  updateCombat(dt) {
    const p = this.player, room = this.room;
    for (const e of room.enemies) e.update(dt, this);
    for (const pr of this.projectiles) {
      if (pr.homing && pr.owner === 'player') {
        const tgt = room.enemies.find((e) => !e.dead);
        if (tgt) {
          const dx = tgt.x + tgt.w / 2 - pr.x, dy = tgt.y + tgt.h / 2 - pr.y, d = Math.hypot(dx, dy) || 1;
          pr.vx += (dx / d * 200 - pr.vx) * 0.05; pr.vy += (dy / d * 200 - pr.vy) * 0.05;
        }
      }
      if (pr.boomerang && pr.t > 0.5) pr.vx += (p.x + p.w / 2 > pr.x ? 1 : -1) * 700 * dt;
      pr.update(dt, room);
      if (pr.dead && pr.explode) this.explode(pr);
    }

    // Player weapon.
    const a = p.attackBox, w = p.currentWeapon;
    for (const e of room.enemies) {
      if (e.dead || !a || e.lastSwing === p.swingId || !overlap(a, e)) continue;
      e.lastSwing = p.swingId;
      this.strike(e, p.weaponDamage(w), p.x + p.w / 2, w?.element || null);
    }
    // Projectiles.
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      if (pr.owner === 'player') {
        for (const e of room.enemies) {
          if (e.dead || !overlap(pr.box, e) || (pr.hitIds && pr.hitIds.has(e))) continue;
          this.strike(e, pr.dmg, pr.x, pr.element || null);
          if (pr.explode) { pr.dead = true; this.explode(pr); break; }
          if (pr.pierce) { (pr.hitIds ||= new Set()).add(e); continue; }
          pr.dead = true;
          break;
        }
      } else if (overlap(pr.box, p)) {
        pr.dead = true;
        this.hurtPlayer(pr.dmg, pr.x, PROJ_ELEMENT[pr.kind] || null);
      }
    }
    // Enemy weapons and bodies.
    for (const e of room.enemies) {
      if (e.dead) continue;
      if (e.hitbox && overlap(e.hitbox, p)) this.hurtPlayer(e.atkDmg, e.x + e.w / 2, null, e);
      else if (overlap(e, p)) this.hurtPlayer(e.touchDmg, e.x + e.w / 2, null, e);
    }
    for (const e of room.enemies) if (e.dead && !e.rewarded) this.reward(e);
    room.enemies = room.enemies.filter((e) => !e.remove);
    this.projectiles = this.projectiles.filter((q) => !q.dead);
  }

  explode(pr) {
    if (pr.exploded) return;
    pr.exploded = true;
    const R = pr.big ? 60 : 30;
    this.burst(pr.x, pr.y, '#ffb040', pr.big ? 40 : 18, pr.big ? 160 : 90, 0.6, 40);
    this.shake = Math.max(this.shake, pr.big ? 0.35 : 0.1);
    for (const e of this.room.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.x + e.w / 2 - pr.x) < R + e.w / 2 && Math.abs(e.y + e.h / 2 - pr.y) < R + e.h / 2) this.strike(e, pr.dmg, pr.x, pr.element);
    }
  }

  updateDrops(dt) {
    const p = this.player, room = this.room;
    for (const d of this.drops) {
      d.t += dt;
      d.vy = Math.min(d.vy + 500 * dt, 300);
      const ny = d.y + d.vy * dt;
      const c = room.get(Math.floor(d.x / TILE), Math.floor((ny + 4) / TILE));
      if (d.vy > 0 && (c === SOLID || c === ONE_WAY || c === BREAK)) { d.y = Math.floor((ny + 4) / TILE) * TILE - 4; d.vy = 0; } else d.y = ny;
      const box = { x: d.x - 6, y: d.y - 8, w: 12, h: 12 };
      if (d.t > 0.3 && overlap(p, box)) {
        d.taken = true;
        if (d.orb === 'hp') { const v = Math.round(p.maxHp * 0.08); p.hp = Math.min(p.maxHp, p.hp + v); this.popup(d.x, d.y - 8, `+${v}`, '#ff8090'); }
        else if (d.orb === 'mp') { const v = Math.round(p.maxMp * 0.12); p.mp = Math.min(p.maxMp, p.mp + v); this.popup(d.x, d.y - 8, `+${v}`, '#80b0ff'); }
        else { this.giveItem(d.item); this.save(); }
      }
    }
    this.drops = this.drops.filter((d) => !d.taken && d.t < 25);
  }

  // Cracked walls crumble under your weapon (and spells).
  checkBreakables() {
    const room = this.room;
    if (!room.breakables.size) return;
    const boxes = [];
    if (this.player.attackBox) boxes.push([this.player.attackBox, this.player.swingId]);
    for (const pr of this.projectiles) if (pr.owner === 'player') boxes.push([pr.box, pr]);
    for (const [box, id] of boxes) {
      for (const [key, b] of room.breakables) {
        const r = { x: b.tx * TILE, y: b.ty * TILE, w: TILE, h: TILE };
        if (!overlap(box, r) || b.last === id) continue;
        b.last = id;
        b.hp--;
        this.burst(r.x + 16, r.y + 16, '#8a8098', 6, 60, 0.4, 300);
        if (b.hp <= 0) {
          room.breakWall(key);
          this.state.flags[`brk_${room.id}_${key}`] = true;
          this.burst(r.x + 16, r.y + 16, '#b0a8c0', 18, 120, 0.8, 400);
          this.shake = 0.12;
          if (!this.secretMsgT || this.state.time - this.secretMsgT > 4) { this.message('The wall crumbles away... a secret passage!', 2.5); this.secretMsgT = this.state.time; }
          this.save();
        }
      }
    }
  }

  trackSafeGround() {
    const p = this.player, room = this.room;
    if (!p.onGround || p.onMover) return;
    const row = Math.floor((p.y + p.h) / TILE);
    const l = Math.floor(p.x / TILE), r = Math.floor((p.x + p.w - 0.001) / TILE);
    for (let tx = l; tx <= r; tx++) {
      const c = room.get(tx, row);
      if (c !== SOLID && c !== ONE_WAY) return;
    }
    if (room.touchesHazard(p.x - TILE, p.y - 4, p.w + TILE * 2, p.h + TILE)) return;
    this.lastSafe = { x: p.x + p.w / 2, y: p.y + p.h };
  }

  checkPickups() {
    const p = this.player, room = this.room;
    for (const it of room.items) {
      const box = { x: it.px + 4, y: it.py - TILE * 2, w: TILE - 8, h: TILE * 2 };
      if (!overlap(p, box)) continue;
      room.items = room.items.filter((i) => i !== it);
      this.state.collected[it.id] = true;
      this.giveItem(it.item);
      this.save();
    }
  }

  // Treasure chests open when you touch or strike them.
  checkChests() {
    const p = this.player, room = this.room;
    for (const c of room.chests) {
      if (c.open) continue;
      const box = { x: c.x * TILE + 4, y: c.y * TILE - 20, w: 24, h: 20 };
      if (!overlap(p, box) && !(p.attackBox && overlap(p.attackBox, box))) continue;
      c.open = true;
      c.openT = 0;
      this.state.collected[c.id] = true;
      this.burst(box.x + 12, box.y + 6, '#ffe080', 20, 90, 0.8, 60);
      this.giveItem(c.item);
      this.save();
    }
  }

  checkDoor() {
    const p = this.player, d = this.room.door;
    if (!d || d.open) return;
    const box = { x: d.tx * TILE - 3, y: d.ty * TILE, w: TILE + 6, h: d.h * TILE };
    if (!overlap(p, box)) return;
    if (this.count(d.key)) {
      this.room.openDoor();
      this.state.flags[d.flag] = true;
      this.removeItem(d.key);
      this.message(`The ${ITEMS[d.key].name} turns in the lock...`, 3);
      this.save();
    } else if (this.doorNagTimer <= 0) {
      this.message(`The door is locked. It needs the ${ITEMS[d.key]?.name || 'right key'}.`, 2.5);
      this.doorNagTimer = 3;
    }
  }

  checkExits() {
    const p = this.player, room = this.room;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    if (cx >= 0 && cx < room.width && cy >= 0 && cy < room.height) return;
    const wx = room.wx * TILE + cx, wy = room.wy * TILE + cy;
    for (const [id, def] of Object.entries(ROOMS)) {
      if (id === room.id) continue;
      const w = def.map[0].length * TILE, h = def.map.length * TILE;
      const rx = wx - def.x * TILE, ry = wy - def.y * TILE;
      if (rx < 0 || ry < 0 || rx >= w || ry >= h) continue;
      const { vx, vy, state, jumping, facing, usedDouble, sprinting, superJump } = p;
      this.enter(id, rx, ry + p.h / 2);
      Object.assign(p, { vx, vy, jumping, facing, usedDouble, sprinting, superJump });
      if (state === 'air') p.setState('air');
      this.save();
      return;
    }
    p.x = Math.max(0, Math.min(p.x, room.width - p.w));
    p.y = Math.max(0, Math.min(p.y, room.height - p.h));
  }
}
