// Bosses: palette-swapped, scaled-up monsters with special attack patterns
// and an enraged second phase below half health.
import { TILE } from './config.js';
import { Enemy, Projectile, firePattern } from './enemies.js';

// specials: quake (leap + ground shockwaves), rain (projectiles fall from above),
// nova (ring burst), fan (5-way spread), charge (rush across the room),
// summon (call minions), teleport (vanish and reappear), beam (big orb).
export const BOSSES = {
  bone_colossus:     { name: 'Bone Colossus',     t: 'skeleton',     v: 'bone',      scale: 3,   hp: 420,  atk: 20, xp: 350,  specials: ['quake', 'rain'],             rain: 'bone',    minion: 'skeleton', aura: 'rgba(255,240,200,0.8)', reward: ['leap_boots'] },
  harpy_queen:       { name: 'Harpy Queen',       t: 'harpy',        v: 'storm',     scale: 2.6, hp: 520,  atk: 24, xp: 500,  specials: ['fan', 'rain', 'charge'],     rain: 'feather', aura: 'rgba(255,240,120,0.8)', reward: ['gale_greaves'] },
  grand_lich:        { name: 'The Grand Lich',    t: 'lich',         v: 'arcane',    scale: 2.6, hp: 700,  atk: 28, xp: 700,  specials: ['nova', 'summon', 'teleport'], minion: 'skeleton', aura: 'rgba(190,110,255,0.8)', reward: ['spirit_lantern'] },
  grimoire_wraith:   { name: 'The Grimoire Wraith', t: 'wraith',     v: 'void',      scale: 2.8, hp: 820,  atk: 30, xp: 800,  specials: ['teleport', 'nova', 'beam'],  aura: 'rgba(150,90,255,0.85)', reward: ['mist_veil'] },
  spider_matriarch:  { name: 'Spider Matriarch',  t: 'giant_spider', v: 'toxic',     scale: 2.6, hp: 950,  atk: 32, xp: 950,  specials: ['rain', 'summon', 'charge'],  rain: 'web', minion: 'spider', aura: 'rgba(140,255,80,0.8)', reward: ['widow_s_talons'] },
  troll_king:        { name: 'The Troll King',    t: 'troll',        v: 'crimson',   scale: 2.3, hp: 1150, atk: 36, xp: 1100, specials: ['quake', 'charge', 'summon'], minion: 'goblin', aura: 'rgba(255,60,60,0.8)', reward: ['saints_soles'] },
  minotaur_lord:     { name: 'Minotaur Lord',     t: 'minotaur',     v: 'gold',      scale: 2.3, hp: 1400, atk: 40, xp: 1400, specials: ['charge', 'quake', 'charge'], aura: 'rgba(255,210,80,0.85)', reward: ['gravity_crown'] },
  drowned_siren:     { name: 'The Drowned Siren', t: 'banshee',      v: 'drowned',   scale: 2.8, hp: 1600, atk: 42, xp: 1600, specials: ['nova', 'beam', 'teleport'],  aura: 'rgba(80,255,220,0.8)', reward: ['salamander_scale'] },
  demon_smith:       { name: 'The Demon Smith',   t: 'demon',        v: 'magma',     scale: 2.3, hp: 1900, atk: 46, xp: 1900, specials: ['rain', 'charge', 'quake'],   rain: 'fire', aura: 'rgba(255,120,30,0.9)', reward: ['vampire_fang'] },
  orc_warlord:       { name: 'Orc Warlord',       t: 'orc_brute',    v: 'crimson',   scale: 2.5, hp: 2100, atk: 48, xp: 2100, specials: ['quake', 'summon', 'charge'], minion: 'orc', aura: 'rgba(255,70,50,0.85)', reward: ['crimson_key', 'seer_eye'] },
  flesh_abomination: { name: 'The Flesh Abomination', t: 'slime',    v: 'flesh',     scale: 4,   hp: 2500, atk: 50, xp: 2500, specials: ['rain', 'quake', 'summon'],   rain: 'blob', minion: 'slime', aura: 'rgba(255,100,140,0.85)', reward: ['sanguine_kiss'] },
  fenrir:            { name: 'Fenrir',            t: 'wolf',         v: 'void',      scale: 3,   hp: 2800, atk: 54, xp: 2800, specials: ['charge', 'nova', 'charge'],  aura: 'rgba(140,100,255,0.85)', reward: ['abyss_key'] },
  void_knight:       { name: 'The Void Knight',   t: 'evil_knight',  v: 'void',      scale: 2.6, hp: 3200, atk: 58, xp: 3200, specials: ['beam', 'teleport', 'charge'], aura: 'rgba(170,110,255,0.9)', reward: ['echo_heart'] },
  nightlord:         { name: 'The Nightlord',     t: 'dark_wizard',  v: 'nightlord', scale: 3.2, hp: 5000, atk: 64, xp: 6000, specials: ['nova', 'rain', 'summon', 'teleport', 'beam'], rain: 'star', minion: 'wraith', aura: 'rgba(255,40,60,0.9)', reward: [], final: true },
};

const RAIN_KIND = { bone: 'bone', feather: 'feather', web: 'web', fire: 'fire', blob: 'blob', star: 'star' };

export class Boss extends Enemy {
  constructor(def) {
    const B = BOSSES[def.boss];
    super({ t: B.t, x: def.x, y: def.y, v: B.v, scale: B.scale, face: -1 });
    this.boss = B;
    this.bossId = def.boss;
    this.name = B.name;
    this.maxHp = this.hp = B.hp;
    this.atkDmg = B.atk;
    this.touchDmg = Math.round(B.atk * 0.6);
    this.xp = B.xp;
    this.specialT = 2.5;
    this.special = null;
    this.phase2 = false;
    this.alpha = 1;
    this.minionM = def.m || 1;
  }

  update(dt, world) {
    if (!this.dead) {
      if (!this.phase2 && this.hp < this.maxHp / 2) {
        this.phase2 = true;
        world.message(`${this.name} is enraged!`, 2);
        world.shake = 0.4;
      }
      this.specialT -= dt * (this.phase2 ? 1.5 : 1);
      if (this.special) { this.tickStatus(dt); this.runSpecial(dt, world); return; }
      if (this.specialT <= 0 && this.state !== 'attack' && (this.onGround || this.air)) { this.startSpecial(world); return; }
    }
    super.update(dt, world);
  }

  startSpecial(world) {
    const list = this.boss.specials;
    const kind = list[Math.floor(Math.random() * list.length)];
    const p = world.player;
    this.facing = p.x + p.w / 2 > this.x + this.w / 2 ? 1 : -1;
    this.special = { kind, t: 0, n: 0 };
    this.setState('attack');
    if (kind === 'quake' && !this.air) { this.vy = -430; this.onGround = false; }
    if (kind === 'teleport') this.special.phase = 'out';
  }

  endSpecial() {
    this.special = null;
    this.setState('walk');
    this.specialT = (this.phase2 ? 2.4 : 3.6) + Math.random() * 1.5;
  }

  shoot(world, list) { for (const pr of list) world.projectiles.push(pr); }

  runSpecial(dt, world) {
    const S = this.special, room = world.room;
    S.t += dt;
    this.stateT += dt;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const dmg = this.atkDmg;
    switch (S.kind) {
      case 'quake':
        if (this.air) {
          if (S.t > 0.5 && !S.n) { S.n = 1; this.shoot(world, firePattern('ring', cx, cy, this.facing, dmg)); }
          if (S.t > 1) this.endSpecial();
        } else {
          this.physics(dt, room, 0);
          if (this.onGround && S.t > 0.15 && !S.n) {
            S.n = 1;
            world.shake = 0.35;
            const y = this.y + this.h - 8;
            for (const d of [-1, 1]) world.projectiles.push(new Projectile({ kind: 'wave', x: cx + d * this.w / 2, y, vx: d * 170, r: 9, life: 2.4, dmg, ghost: true, color: this.boss.aura }));
          }
          if (S.n && S.t > 0.7) this.endSpecial();
        }
        break;
      case 'rain': {
        const count = this.phase2 ? 14 : 9;
        const every = 1.3 / count;
        while (S.n < count && S.t > S.n * every) {
          const x = TILE + ((S.n * 7919) % (room.width - TILE * 2)) * 1 + Math.random() * 20;
          world.projectiles.push(new Projectile({ kind: RAIN_KIND[this.boss.rain] || 'orb', x, y: world.camera.y + 4, vy: 40, g: 260, r: 5, life: 4, dmg }));
          S.n++;
        }
        if (!this.air) this.physics(dt, room, 0);
        if (S.t > 1.8) this.endSpecial();
        break;
      }
      case 'nova':
        if (!S.n && S.t > 0.35) {
          S.n = 1;
          const k = this.phase2 ? 16 : 12;
          for (let i = 0; i < k; i++) {
            const a = (i / k) * Math.PI * 2;
            world.projectiles.push(new Projectile({ kind: 'orb', x: cx, y: cy, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, r: 5, life: 3.5, dmg, ghost: true }));
          }
        }
        if (this.phase2 && S.n === 1 && S.t > 0.9) {
          S.n = 2;
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 + 0.26;
            world.projectiles.push(new Projectile({ kind: 'orb', x: cx, y: cy, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, r: 5, life: 3.5, dmg, ghost: true }));
          }
        }
        if (!this.air) this.physics(dt, room, 0);
        if (S.t > 1.3) this.endSpecial();
        break;
      case 'fan':
        if (!S.n && S.t > 0.3) {
          S.n = 1;
          for (let i = -2; i <= 2; i++) {
            const a = i * 0.28 + (this.air ? 0.35 : -0.1);
            world.projectiles.push(new Projectile({ kind: 'feather', x: cx, y: cy, vx: this.facing * Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 4, life: 3, dmg }));
          }
        }
        if (S.t > 0.9) this.endSpecial();
        break;
      case 'charge': {
        // Wind up, then rush in a straight line.
        this.hitbox = S.t > 0.45 ? { x: this.x, y: this.y, w: this.w, h: this.h } : null;
        const v = S.t > 0.45 ? this.facing * (this.phase2 ? 330 : 260) : 0;
        if (this.air) {
          this.vx = v; this.vy = 0;
          this.moveFree(dt, room, true);
          if (S.t > 1.6 || (S.t > 0.5 && (this.x <= 1 || this.x + this.w >= room.width - 1))) this.endSpecial();
        } else {
          this.vx = v;
          const bx = this.x;
          this.physics(dt, room, null);
          if (S.t > 0.6 && Math.abs(this.x - bx) < 0.5) { world.shake = 0.25; this.endSpecial(); }
          if (S.t > 2.2) this.endSpecial();
        }
        break;
      }
      case 'summon':
        if (!S.n && S.t > 0.5 && this.boss.minion) {
          S.n = 1;
          const alive = room.enemies.filter((e) => !e.boss && !e.dead).length;
          if (alive < 4) {
            for (const d of [-1, 1]) {
              const tx = Math.max(1, Math.min(room.cols - 2, Math.floor((cx + d * 60) / TILE)));
              const e = new Enemy({ t: this.boss.minion, x: tx, y: this.air ? Math.floor(cy / TILE) : Math.floor((this.y + this.h) / TILE), m: this.minionM, v: this.boss.v });
              e.summoned = true;
              room.enemies.push(e);
            }
          }
        }
        if (!this.air) this.physics(dt, room, 0);
        if (S.t > 1) this.endSpecial();
        break;
      case 'teleport':
        if (S.phase === 'out') {
          this.alpha = Math.max(0, 1 - S.t / 0.4);
          if (S.t > 0.4) {
            const p = world.player;
            const side = Math.random() < 0.5 ? -1 : 1;
            const nx = Math.max(TILE, Math.min(room.width - TILE - this.w, p.x + side * 120));
            this.x = nx;
            if (this.air) this.y = Math.max(TILE, p.y - 40 - this.h / 2);
            S.phase = 'in'; S.t = 0;
          }
        } else {
          this.alpha = Math.min(1, S.t / 0.3);
          if (S.t > 0.35 && !S.n) {
            S.n = 1;
            this.facing = world.player.x > this.x ? 1 : -1;
            this.shoot(world, firePattern(this.air ? 'ring' : 'spread', cx, cy, this.facing, dmg));
          }
          if (S.t > 0.8) this.endSpecial();
        }
        break;
      case 'beam':
        if (!S.n && S.t > 0.45) {
          S.n = 1;
          world.projectiles.push(new Projectile({ kind: 'beam', x: cx + this.facing * this.w / 2, y: cy - this.h * 0.1, vx: this.facing * 190, r: 9, life: 3, dmg: Math.round(dmg * 1.3), ghost: true, color: this.boss.aura }));
          if (this.phase2) world.projectiles.push(new Projectile({ kind: 'beam', x: cx - this.facing * this.w / 2, y: cy + this.h * 0.2, vx: -this.facing * 150, r: 8, life: 3, dmg, ghost: true, color: this.boss.aura }));
        }
        if (!this.air) this.physics(dt, room, 0);
        if (S.t > 1) this.endSpecial();
        break;
      default: this.endSpecial();
    }
  }

  drawAura(ctx) {
    const pulse = 0.6 + 0.4 * Math.sin(this.t * (this.phase2 ? 9 : 4));
    ctx.shadowColor = this.boss.aura;
    ctx.shadowBlur = 8 + pulse * (this.phase2 ? 14 : 8);
    ctx.globalAlpha *= this.alpha;
  }
}
