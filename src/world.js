import { TILE, ANIM } from './config.js';
import { ROOMS, START } from './rooms.js';
import { Room, SOLID, ONE_WAY } from './room.js';
import { ITEMS, ALL_SLOTS, xpToNext, spellDamage, HP_PER_LEVEL, MP_PER_LEVEL } from './items.js';
import { Projectile, overlap } from './enemies.js';

const SAVE_KEY = 'agilancer-nights-save-v2';
const MP_REGEN = 1.5; // per second

export function newState() {
  return {
    room: START.room,
    // Bottom-centre of the player, in room pixels (where you respawn).
    x: START.x * TILE + TILE / 2,
    y: START.y * TILE,
    inventory: ['spirit_bolt'], // item ids, in the order they were found
    equip: { spell: 'spirit_bolt' }, // slot id -> item id
    flags: {},       // e.g. opened doors
    collected: {},   // pickup id -> true
    level: 1,
    xp: 0,
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && ROOMS[s.room]) return { ...newState(), ...s };
  } catch (e) { /* no storage (private mode) or bad data */ }
  return null;
}

// Owns the current room, moves the player between rooms, runs combat and
// tracks progress.
export class World {
  constructor(player, camera) {
    this.player = player;
    this.camera = camera;
    this.state = loadState() || newState();
    this.messages = [];
    this.popups = [];       // floating damage / XP numbers
    this.projectiles = [];
    this.fade = 1;          // 1 = black, fades to 0
    this.respawnTimer = 0;  // hazard hit: brief fade, then back to safe footing
    this.deathTimer = 0;
    this.doorNagTimer = 0;
    this.banner = null;     // { text, t } room-name caption
    this.onChange = null;   // called when inventory/equipment/stats change
    this.castFired = false;
    player.canCast = () => this.canCast();
    this.applyStats(true);
    this.applyEquipment();
    this.enter(this.state.room, this.state.x, this.state.y);
  }

  get playerDead() { return this.deathTimer > 0; }

  save() {
    this.state.level = this.player.level;
    this.state.xp = this.player.xp;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    this.state = newState();
    this.applyStats(true);
    this.applyEquipment();
    this.enter(this.state.room, this.state.x, this.state.y);
    this.onChange?.();
  }

  // Max HP / MP from level; `refill` tops both up.
  applyStats(refill) {
    const p = this.player;
    p.level = this.state.level;
    p.xp = this.state.xp;
    p.maxHp = 100 + (p.level - 1) * HP_PER_LEVEL;
    p.maxMp = 100 + (p.level - 1) * MP_PER_LEVEL;
    if (refill) { p.hp = p.maxHp; p.mp = p.maxMp; }
  }

  // Load a room and stand the player at (bx, by) = bottom-centre in room px.
  enter(id, bx, by) {
    this.room = new Room(id, ROOMS[id], this.state);
    this.player.spawnAt(bx, by);
    this.player.onMover = null;
    this.projectiles = [];
    this.popups = [];
    this.entry = { x: bx, y: by };
    this.lastSafe = null;
    this.state.room = id;
    this.state.x = bx;
    this.state.y = by;
    this.camera.follow(this.player, this.room, true);
    this.fade = Math.max(this.fade, 0.6);
    this.banner = { text: this.room.name, t: 0 };
  }

  message(text, time = 2.5) {
    this.messages = [{ text, t: 0, time }];
  }

  popup(x, y, text, color) {
    this.popups.push({ x, y, text, color, t: 0 });
  }

  has(itemId) {
    return this.state.inventory.includes(itemId);
  }

  giveItem(itemId) {
    if (!this.has(itemId)) this.state.inventory.push(itemId);
    this.onChange?.();
  }

  removeItem(itemId) {
    this.state.inventory = this.state.inventory.filter((i) => i !== itemId);
    for (const k of Object.keys(this.state.equip)) if (this.state.equip[k] === itemId) delete this.state.equip[k];
    this.applyEquipment();
    this.onChange?.();
  }

  // Put an item in a slot (or null to empty it). An item lives in one slot at a time.
  equip(slotId, itemId) {
    const eq = this.state.equip;
    if (itemId) {
      const slot = ALL_SLOTS.find((s) => s.id === slotId);
      if (!slot || ITEMS[itemId]?.type !== slot.accepts) return false;
      for (const k of Object.keys(eq)) if (eq[k] === itemId) delete eq[k];
      eq[slotId] = itemId;
    } else {
      delete eq[slotId];
    }
    this.applyEquipment();
    this.save();
    this.onChange?.();
    return true;
  }

  applyEquipment() {
    const eq = this.state.equip;
    const w = eq.rightHand || eq.leftHand;
    this.player.weapon = w ? ITEMS[w] : null;
  }

  get spell() {
    return ITEMS[this.state.equip.spell] || null;
  }

  canCast() {
    const s = this.spell;
    if (!s) { this.message('No spell equipped.', 1.5); return false; }
    if (this.player.mp < s.mp) { this.message('Not enough MP.', 1.5); return false; }
    return true;
  }

  gainXp(n) {
    const p = this.player;
    p.xp += n;
    let leveled = false;
    while (p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level);
      p.level++;
      leveled = true;
    }
    this.state.level = p.level;
    this.state.xp = p.xp;
    if (leveled) {
      this.applyStats(true);
      this.message(`LEVEL UP!  Level ${p.level}  -  ATK ${p.atk}  HP ${p.maxHp}  MP ${p.maxMp}`, 3.5);
      this.popup(p.x + p.w / 2, p.y - 6, 'LEVEL UP', '#ffe27a');
    }
    this.save();
    this.onChange?.();
  }

  hurtPlayer(dmg, fromX) {
    const p = this.player;
    if (p.invuln > 0 || this.playerDead) return;
    p.hp = Math.max(0, p.hp - dmg);
    this.popup(p.x + p.w / 2, p.y, String(dmg), '#ff6060');
    if (p.hp <= 0) {
      this.deathTimer = 3;
      p.setState('hurt');
      p.invuln = 99;
      this.message('You have fallen...', 3);
      return;
    }
    p.knockback(fromX);
  }

  update(dt, input) {
    const p = this.player;
    const room = this.room;
    this.fade = Math.max(0, this.fade - dt * 3);
    this.doorNagTimer = Math.max(0, this.doorNagTimer - dt);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < m.time);
    for (const q of this.popups) { q.t += dt; q.y -= dt * 22; }
    this.popups = this.popups.filter((q) => q.t < 0.9);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 2.5) this.banner = null;
    }
    room.update(dt);

    // Dead: wait, then return to the last room you entered, fully healed.
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      this.fade = Math.min(1, Math.max(this.fade, 1 - this.deathTimer / 1.5));
      p.vx *= 0.9;
      if (this.deathTimer <= 0) {
        this.applyStats(true);
        p.invuln = 0;
        p.setState('idle');
        this.enter(this.state.room, this.state.x, this.state.y);
        this.fade = 1;
      }
      return;
    }

    // Hurt by a hazard: fade out, then return to the last safe footing.
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

    p.mp = Math.min(p.maxMp, p.mp + MP_REGEN * dt);
    p.ride(room);
    p.update(dt, input, room);
    this.castSpell();

    const hz = room.touchesHazard(p.x, p.y, p.w, p.h);
    if (hz) {
      p.hp = Math.max(0, p.hp - hz.dmg);
      this.popup(p.x + p.w / 2, p.y, String(hz.dmg), '#ff6060');
      if (p.hp <= 0) { this.deathTimer = 3; this.message('You have fallen...', 3); return; }
      p.invuln = 1.1;
      this.respawnTimer = 0.35;
      return;
    }

    this.updateCombat(dt);
    this.trackSafeGround();
    this.checkPickups();
    this.checkDoor();
    this.checkExits();
  }

  // Fire the equipped spell on the casting animation's release frame.
  castSpell() {
    const p = this.player;
    if (p.state !== 'cast') { this.castFired = false; return; }
    if (this.castFired || p.stateTime < ANIM.cast * 3) return;
    this.castFired = true;
    const s = this.spell;
    if (!s || p.mp < s.mp) return;
    p.mp -= s.mp;
    const f = p.facing;
    this.projectiles.push(new Projectile({
      kind: 'spirit', owner: 'player', x: p.x + p.w / 2 + f * 14, y: p.y + 12,
      vx: f * 270, r: 5, life: 1.6, dmg: spellDamage(s, p.level),
    }));
    this.onChange?.();
  }

  updateCombat(dt) {
    const p = this.player, room = this.room;
    for (const e of room.enemies) e.update(dt, this);
    for (const pr of this.projectiles) pr.update(dt, room);

    const kill = (e) => {
      this.gainXp(e.type.xp);
      this.popup(e.x + e.w / 2, e.y - 4, `+${e.type.xp} XP`, '#9fe0ff');
    };
    // Player's weapon.
    const a = p.attackBox;
    for (const e of room.enemies) {
      if (e.dead) continue;
      if (a && e.lastSwing !== p.swingId && overlap(a, e)) {
        e.lastSwing = p.swingId;
        const dmg = p.atk;
        this.popup(e.x + e.w / 2, e.y, String(dmg), '#ffffff');
        if (e.damage(dmg, p.x + p.w / 2)) kill(e);
      }
    }
    // Projectiles.
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      if (pr.owner === 'player') {
        for (const e of room.enemies) {
          if (e.dead || !overlap(pr.box, e)) continue;
          pr.dead = true;
          this.popup(e.x + e.w / 2, e.y, String(pr.dmg), '#cfe8ff');
          if (e.damage(pr.dmg, pr.x)) kill(e);
          break;
        }
      } else if (overlap(pr.box, p)) {
        pr.dead = true;
        this.hurtPlayer(pr.dmg, pr.x);
      }
    }
    // Enemy weapons and bodies.
    for (const e of room.enemies) {
      if (e.dead) continue;
      if (e.hitbox && overlap(e.hitbox, p)) this.hurtPlayer(e.type.atk, e.x + e.w / 2);
      else if (overlap(e, p)) this.hurtPlayer(e.type.touch, e.x + e.w / 2);
    }
    room.enemies = room.enemies.filter((e) => !e.remove);
    this.projectiles = this.projectiles.filter((q) => !q.dead);
  }

  // Remember solid footing well away from hazards, for respawning.
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
      const def = ITEMS[it.item];
      this.message(def.type === 'weapon'
        ? `Obtained ${def.name}!  Equip it from the MENU.`
        : `Obtained ${def.name}!`, 3.5);
      this.save();
    }
  }

  checkDoor() {
    const p = this.player, d = this.room.door;
    if (!d || d.open) return;
    const box = { x: d.tx * TILE - 3, y: d.ty * TILE, w: TILE + 6, h: d.h * TILE };
    if (!overlap(p, box)) return;
    if (this.has(d.key)) {
      this.room.openDoor();
      this.state.flags[d.flag] = true;
      this.removeItem(d.key);
      this.message(`The ${ITEMS[d.key].name} turns in the lock...`, 3);
      this.save();
    } else if (this.doorNagTimer <= 0) {
      this.message('The door is locked.', 2);
      this.doorNagTimer = 3;
    }
  }

  // Leaving the room's rectangle moves us into whichever room is there.
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
      const { vx, vy, state, jumping, facing } = p;
      this.enter(id, rx, ry + p.h / 2);
      Object.assign(p, { vx, vy, jumping, facing });
      if (state === 'air') p.setState('air');
      this.save();
      return;
    }
    // Nowhere to go: stay inside.
    p.x = Math.max(0, Math.min(p.x, room.width - p.w));
    p.y = Math.max(0, Math.min(p.y, room.height - p.h));
  }
}
