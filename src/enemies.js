import { TILE } from './config.js';
import { EMPTY, ONE_WAY, isWall } from './tileTypes.js';
import { ENEMY_ATLAS, ENEMY_FRAMES } from './enemySprites.js';
import { paletteAtlas } from './palette.js';
import { AFFINITY } from './data/elements.js';

// Element families (see AFFINITY): what each enemy is weak or immune to.
export const FAMILY = {
  zombie: 'undead', skeleton: 'undead', skeleton_archer: 'undead', lich: 'undead',
  goblin: 'brute', orc: 'brute', orc_brute: 'brute', troll: 'brute', minotaur: 'beast',
  evil_knight: 'knight', demon: 'demon', wolf: 'beast', harpy: 'beast',
  spider: 'bug', giant_spider: 'bug', slime: 'slime',
  dark_wizard: 'arcane', goblin_shaman: 'arcane', banshee: 'ghost', wraith: 'ghost',
};

// Status effects inflicted by elements: seconds, and damage per second as a
// fraction of max HP (min 1).
const STATUS = {
  burn:   { time: 3, dot: 0.02, color: '#ff8a30' },
  poison: { time: 5, dot: 0.015, color: '#8ae044' },
  bleed:  { time: 3, dot: 0.03, color: '#ff3a4a' },
  freeze: { time: 2, slow: 0.35, color: '#9ae4ff' },
  shock:  { time: 0.5, stun: true, color: '#ffec60' },
  curse:  { time: 4, vuln: 0.3, color: '#a070e0' },
};

const atlas = typeof Image !== 'undefined' ? new Image() : null;
if (atlas) atlas.src = ENEMY_ATLAS;

const GRAVITY = 900;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ai:      walker (patrol, chase, attack) | charger (lunges) | hopper (hops about)
//          flyer (hovers, swoops) | floater (ghost: drifts through walls)
// attack:  melee -> weapon hit box `reach` px in front during frames `hit`
//          shot  -> fires `pattern` on frame `fire` (patterns are fixed shapes,
//                   never aimed at the player)
// touch:   damage for bumping into the body. fps: seconds per frame.
export const ENEMY_TYPES = {
  zombie:          { hp: 30,  atk: 12, touch: 6,  xp: 10, ai: 'walker', speed: 14, chase: 22, sight: 150, attack: { kind: 'melee', range: 22, reach: 18, hit: [2, 3], cooldown: 1.6 }, fps: { walk: 0.2, attack: 0.16, die: 0.14 } },
  skeleton:        { hp: 24,  atk: 10, touch: 5,  xp: 12, ai: 'walker', speed: 26, chase: 44, sight: 160, attack: { kind: 'melee', range: 30, reach: 24, hit: [1, 2], cooldown: 1.2 }, fps: { walk: 0.16, attack: 0.13, die: 0.12 } },
  goblin:          { hp: 18,  atk: 8,  touch: 4,  xp: 9,  ai: 'walker', speed: 38, chase: 70, sight: 170, attack: { kind: 'melee', range: 20, reach: 16, hit: [1, 2], cooldown: 0.9 }, fps: { walk: 0.11, attack: 0.1, die: 0.12 } },
  orc:             { hp: 50,  atk: 16, touch: 8,  xp: 22, ai: 'walker', speed: 22, chase: 40, sight: 170, attack: { kind: 'melee', range: 30, reach: 26, hit: [2, 3], cooldown: 1.6 }, fps: { walk: 0.16, attack: 0.15, die: 0.14 }, heavy: true },
  orc_brute:       { hp: 64,  atk: 18, touch: 9,  xp: 28, ai: 'walker', speed: 20, chase: 38, sight: 170, attack: { kind: 'melee', range: 32, reach: 28, hit: [2, 3], cooldown: 1.7 }, fps: { walk: 0.15, attack: 0.13, die: 0.13 }, heavy: true },
  troll:           { hp: 90,  atk: 22, touch: 10, xp: 40, ai: 'walker', speed: 16, chase: 30, sight: 180, attack: { kind: 'melee', range: 36, reach: 34, hit: [2, 3], cooldown: 2.0 }, fps: { walk: 0.2, attack: 0.17, die: 0.16 }, heavy: true },
  minotaur:        { hp: 110, atk: 24, touch: 12, xp: 55, ai: 'walker', speed: 26, chase: 62, sight: 200, attack: { kind: 'melee', range: 36, reach: 34, hit: [1, 2], cooldown: 1.8 }, fps: { walk: 0.14, attack: 0.18, die: 0.18 }, heavy: true },
  evil_knight:     { hp: 80,  atk: 20, touch: 10, xp: 45, ai: 'walker', speed: 28, chase: 52, sight: 190, attack: { kind: 'melee', range: 32, reach: 30, hit: [1, 2], cooldown: 1.3 }, fps: { walk: 0.15, attack: 0.13, die: 0.15 }, heavy: true },
  demon:           { hp: 120, atk: 26, touch: 12, xp: 70, ai: 'walker', speed: 30, chase: 56, sight: 200, attack: { kind: 'melee', range: 38, reach: 36, hit: [2, 3], cooldown: 1.6 }, fps: { walk: 0.14, attack: 0.13, die: 0.15 }, heavy: true },
  wolf:            { hp: 28,  atk: 12, touch: 6,  xp: 14, ai: 'charger', speed: 44, chase: 100, sight: 190, attack: { kind: 'lunge', range: 90, cooldown: 1.6 }, fps: { walk: 0.09, attack: 0.12, die: 0.12 } },
  spider:          { hp: 14,  atk: 7,  touch: 5,  xp: 6,  ai: 'walker', speed: 40, chase: 40, sight: 150, attack: { kind: 'shot', pattern: 'web', range: 140, fire: 2, cooldown: 2.2 }, fps: { walk: 0.08, attack: 0.14, die: 0.12 } },
  giant_spider:    { hp: 45,  atk: 12, touch: 7,  xp: 20, ai: 'walker', speed: 30, chase: 30, sight: 170, attack: { kind: 'shot', pattern: 'webArc', range: 170, fire: 3, cooldown: 2.4 }, fps: { walk: 0.1, attack: 0.14, die: 0.14 } },
  skeleton_archer: { hp: 22,  atk: 10, touch: 5,  xp: 14, ai: 'walker', speed: 0,  chase: 0,  sight: 230, attack: { kind: 'shot', pattern: 'arrow', range: 230, fire: 3, cooldown: 2.4 }, fps: { walk: 0.18, attack: 0.16, die: 0.12 } },
  dark_wizard:     { hp: 34,  atk: 14, touch: 6,  xp: 24, ai: 'walker', speed: 14, chase: 14, sight: 210, attack: { kind: 'shot', pattern: 'orb', range: 200, fire: 2, cooldown: 2.6 }, fps: { walk: 0.2, attack: 0.16, die: 0.14 } },
  lich:            { hp: 70,  atk: 18, touch: 8,  xp: 50, ai: 'walker', speed: 12, chase: 12, sight: 220, attack: { kind: 'shot', pattern: 'spread', range: 210, fire: 3, cooldown: 2.8 }, fps: { walk: 0.2, attack: 0.18, die: 0.16 } },
  goblin_shaman:   { hp: 26,  atk: 12, touch: 5,  xp: 18, ai: 'walker', speed: 20, chase: 20, sight: 200, attack: { kind: 'shot', pattern: 'lob', range: 190, fire: 3, cooldown: 2.4 }, fps: { walk: 0.15, attack: 0.15, die: 0.13 } },
  slime:           { hp: 20,  atk: 8,  touch: 6,  xp: 8,  ai: 'hopper', speed: 50, chase: 50, sight: 150, attack: { kind: 'shot', pattern: 'blobs', range: 120, fire: 2, cooldown: 2.6 }, fps: { walk: 0.14, attack: 0.14, die: 0.13 } },
  harpy:           { hp: 26,  atk: 12, touch: 8,  xp: 16, ai: 'flyer', speed: 40, chase: 170, sight: 170, attack: { kind: 'swoop', range: 170, cooldown: 2.6 }, fps: { walk: 0.12, attack: 0.1, die: 0.14 } },
  banshee:         { hp: 40,  atk: 14, touch: 8,  xp: 30, ai: 'floater', speed: 26, chase: 26, sight: 210, attack: { kind: 'shot', pattern: 'ring', range: 180, fire: 3, cooldown: 3.2 }, fps: { walk: 0.14, attack: 0.16, die: 0.16 } },
  wraith:          { hp: 36,  atk: 13, touch: 8,  xp: 26, ai: 'floater', speed: 30, chase: 30, sight: 200, attack: { kind: 'shot', pattern: 'wisp', range: 190, fire: 2, cooldown: 2.6 }, fps: { walk: 0.14, attack: 0.15, die: 0.16 } },
};

// Enemy projectiles. Each pattern launches a fixed shape in the direction the
// enemy faces: arcs, waves, spreads, rings.
export class Projectile {
  constructor(o) {
    Object.assign(this, { vx: 0, vy: 0, g: 0, r: 4, life: 4, t: 0, wave: 0, freq: 0, bounces: 0, owner: 'enemy', element: null, dead: false }, o);
    this.baseY = this.y;
  }

  get box() { return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 }; }

  update(dt, room) {
    this.t += dt;
    if (this.t > this.life) { this.dead = true; return; }
    this.vy += this.g * dt;
    this.x += this.vx * dt;
    if (this.wave) {
      this.baseY += this.vy * dt;
      this.y = this.baseY + Math.sin(this.t * this.freq) * this.wave;
    } else {
      this.y += this.vy * dt;
    }
    const tx = Math.floor(this.x / TILE), ty = Math.floor(this.y / TILE);
    if (tx < 0 || ty < 0 || tx >= room.cols || ty >= room.rows) { this.dead = true; return; }
    if (isWall(room.get(tx, ty)) && !this.ghost) {
      if (this.bounces > 0 && this.vy > 0) {
        this.bounces--;
        this.y = ty * TILE - 1;
        this.vy = -this.vy * 0.55;
      } else {
        this.dead = true;
      }
    }
  }

  draw(ctx, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    const glow = (c, r) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const dot = (c, r) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    switch (this.kind) {
      case 'arrow': {
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-7, -0.5, 11, 1.5);
        ctx.fillStyle = '#dfe6f0'; ctx.fillRect(4, -1.5, 3, 3);
        ctx.fillStyle = '#e8e0d0'; ctx.fillRect(-8, -2, 2, 4);
        ctx.restore();
        break;
      }
      case 'orb': glow('rgba(190,90,255,0.7)', 9); dot('#f0c8ff', 2.5); break;
      case 'bolt': glow('rgba(120,255,110,0.7)', 8); dot('#d8ffd0', 2.5); break;
      case 'fire': glow('rgba(255,140,40,0.8)', 9); dot('#ffe08a', 3); break;
      case 'web':
        ctx.strokeStyle = '#e8ecf4'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4);
        ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.stroke();
        break;
      case 'blob': dot('#3c9a2c', 3.5); dot('#9af060', 2); break;
      case 'ring': glow('rgba(140,200,255,0.7)', 8); dot('#e0f4ff', 2.5); break;
      case 'wisp': glow('rgba(110,120,255,0.75)', 8); dot('#d0d8ff', 2); break;
      case 'spirit': glow('rgba(180,220,255,0.85)', 11); dot('#ffffff', 3); break;
      case 'bone':
        ctx.save(); ctx.translate(x, y); ctx.rotate(this.t * 12);
        ctx.fillStyle = '#efe6d0'; ctx.fillRect(-5, -1, 10, 2); ctx.fillRect(-6, -2, 2, 4); ctx.fillRect(4, -2, 2, 4);
        ctx.restore(); break;
      case 'feather':
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(this.vy, this.vx));
        ctx.fillStyle = '#c8c070'; ctx.fillRect(-6, -1, 10, 2); ctx.fillStyle = '#fff6b0'; ctx.fillRect(2, -1.5, 3, 3); ctx.restore(); break;
      case 'star': glow('rgba(255,80,80,0.8)', 10); dot('#ffd0d0', 3); break;
      case 'wave': {
        const g = ctx.createLinearGradient(x, y - 14, x, y + 4);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, this.color || 'rgba(255,200,120,0.9)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, this.r, 14, 0, Math.PI, 0); ctx.fill(); break;
      }
      case 'beam': glow(this.color || 'rgba(190,120,255,0.8)', 16); dot('#ffffff', 5); break;
      case 'drop': dot('#9a0a1a', 2.5); break;
      case 'cross':
        glow('rgba(255,240,160,0.8)', 12);
        ctx.save(); ctx.translate(x, y); ctx.rotate(this.t * 14);
        ctx.fillStyle = '#fff4c0'; ctx.fillRect(-6, -1.5, 12, 3); ctx.fillRect(-1.5, -6, 3, 12); ctx.restore(); break;
      case 'bat':
        ctx.fillStyle = '#2a1030';
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        ctx.fillRect(x - 5, y - 1 - Math.sin(this.t * 30) * 2, 4, 1.5); ctx.fillRect(x + 1, y - 1 - Math.sin(this.t * 30) * 2, 4, 1.5);
        ctx.fillStyle = '#ff4060'; ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 0.5, y - 1, 1, 1); break;
      default: dot('#fff', 3);
    }
  }
}

// Spawn a pattern from (x, y) facing `f` (+1 right, -1 left).
export function firePattern(pattern, x, y, f, dmg) {
  const P = (o) => new Projectile({ x, y, dmg, ...o });
  switch (pattern) {
    case 'arrow':  return [P({ kind: 'arrow', vx: f * 175, vy: -165, g: 330, r: 3 })];
    case 'orb':    return [P({ kind: 'orb', vx: f * 85, wave: 18, freq: 4, r: 4, life: 5 })];
    case 'wisp':   return [P({ kind: 'wisp', vx: f * 95, wave: 10, freq: 7, r: 4, ghost: true }),
                           P({ kind: 'wisp', vx: f * 95, wave: -10, freq: 7, r: 4, ghost: true })];
    case 'spread': return [-0.3, 0, 0.3].map((a) => P({ kind: 'bolt', vx: f * Math.cos(a) * 115, vy: Math.sin(a) * 115, r: 4 }));
    case 'lob':    return [P({ kind: 'fire', vx: f * 105, vy: -250, g: 560, r: 4, bounces: 1 })];
    case 'web':    return [P({ kind: 'web', vx: f * 95, r: 4, life: 3 })];
    case 'webArc': return [P({ kind: 'web', vx: f * 125, vy: -130, g: 280, r: 4 })];
    case 'blobs':  return [P({ kind: 'blob', vx: f * 60, vy: -210, g: 520, r: 3 }), P({ kind: 'blob', vx: f * 115, vy: -170, g: 520, r: 3 })];
    case 'ring':   return Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return P({ kind: 'ring', vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, r: 4, life: 2.6, ghost: true });
    });
    default: return [];
  }
}

export class Enemy {
  // def: { t: type name, x: tile column, y: floor row (walkers) or hover row (flyers) }
  constructor(def) {
    this.def = def;
    this.kind = def.t;
    this.type = ENEMY_TYPES[def.t];
    this.frames = ENEMY_FRAMES[def.t];
    this.family = FAMILY[def.t];
    this.variant = def.v || null;   // palette swap
    this.scale = def.scale || 1;    // bosses are drawn (and collide) bigger
    const m = def.m || 1;           // zone difficulty multiplier
    this.maxHp = Math.round(this.type.hp * m);
    this.atkDmg = Math.round(this.type.atk * (1 + (m - 1) * 0.55));
    this.touchDmg = Math.round(this.type.touch * (1 + (m - 1) * 0.55));
    this.xp = Math.round(this.type.xp * m * 1.1);
    this.status = {};
    const walk = this.frames.walk;
    const fh = Math.max(...walk.map((f) => f.h));
    const fw = walk.reduce((s, f) => s + f.w, 0) / walk.length;
    this.w = Math.round((def.w || Math.max(10, Math.min(34, Math.round(fw * 0.5)))) * this.scale);
    this.h = Math.round((def.h || Math.max(12, fh - 2)) * this.scale);
    this.air = this.type.ai === 'flyer' || this.type.ai === 'floater';
    this.x = def.x * TILE + TILE / 2 - this.w / 2;
    this.y = this.air ? def.y * TILE + TILE / 2 - this.h / 2 : def.y * TILE - this.h;
    this.homeX = this.x; this.homeY = this.y;
    this.vx = 0; this.vy = 0;
    this.facing = def.face || -1;
    this.hp = this.maxHp;
    this.state = 'walk';
    this.t = Math.random() * 3;
    this.stateT = 0;
    this.cooldown = 0.6 + Math.random();
    this.invuln = 0;
    this.knock = 0;
    this.onGround = false;
    this.hitbox = null;   // active weapon / swoop hit box
    this.lastSwing = -1;  // player swing id that last hit us
    this.hpShow = 0;
    this.remove = false;
  }

  get dead() { return this.state === 'die'; }

  setState(s) { this.state = s; this.stateT = 0; this.fired = false; }

  attackTime() { return this.frames.attack.length * this.type.fps.attack; }

  // How much of an element (or 'physical') this enemy takes.
  affinity(element) {
    const a = AFFINITY[this.family] || {};
    return a[element || 'physical'] ?? 1;
  }

  // Take a hit. Returns the damage actually dealt (0 = immune / ignored).
  damage(n, fromX, element = null, status = null) {
    if (this.dead || this.invuln > 0) return -1;
    let mult = this.affinity(element);
    if (this.status.curse) mult *= 1 + STATUS.curse.vuln;
    const dealt = Math.round(n * mult);
    this.hp -= dealt;
    this.invuln = 0.14;
    this.hpShow = 2;
    if (status && mult > 0 && Math.random() < 0.35) this.inflict(status);
    if (!this.type.heavy && !this.air && !this.boss) {
      this.knock = 0.18;
      this.vx = (this.x + this.w / 2 < fromX ? -1 : 1) * 90;
    }
    if (this.hp <= 0) this.kill();
    return dealt;
  }

  kill() {
    this.hp = 0;
    this.setState('die');
    this.hitbox = null;
  }

  inflict(kind) {
    if (!STATUS[kind]) return;
    this.status[kind] = STATUS[kind].time;
  }

  // Burning, poison and bleeding tick; frozen enemies are slow, shocked ones stunned.
  tickStatus(dt) {
    let slow = 1, stun = false;
    for (const k of Object.keys(this.status)) {
      const S = STATUS[k];
      this.status[k] -= dt;
      if (S.dot) {
        this.dotAcc = (this.dotAcc || 0) + Math.max(1, this.maxHp * S.dot) * dt;
        if (this.dotAcc >= 1) { const d = Math.floor(this.dotAcc); this.dotAcc -= d; this.hp -= d; this.hpShow = 1; }
      }
      if (S.slow) slow = S.slow;
      if (S.stun) stun = true;
      if (this.status[k] <= 0) delete this.status[k];
    }
    if (this.hp <= 0 && !this.dead) this.kill();
    return { slow, stun };
  }

  update(dt, world) {
    const T = this.type, room = world.room, p = world.player;
    this.t += dt; this.stateT += dt;
    this.cooldown -= dt; this.invuln -= dt; this.knock -= dt; this.hpShow -= dt;
    this.hitbox = null;
    const st = this.tickStatus(dt);
    if (!this.dead && st.stun) { this.vx = 0; if (!this.air) this.physics(dt, room, 0); return; }
    if (st.slow < 1) dt *= st.slow;
    if (this.dead) {
      if (!this.air) this.physics(dt, room, 0);
      if (this.stateT > this.frames.die.length * T.fps.die + 0.4) this.remove = true;
      return;
    }
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const dx = p.x + p.w / 2 - cx, dy = p.y + p.h / 2 - cy;
    // Walkers only notice you at about their own height; shooters (who lob
    // arcs up onto ledges) and fliers look further up and down.
    const sightY = this.boss ? 400 : this.air ? T.sight : T.attack.kind === 'shot' ? 120 : 56;
    const sees = !world.playerDead && Math.abs(dx) < (this.boss ? 2000 : T.sight) && Math.abs(dy) < sightY;
    const ai = T.ai;
    if (ai === 'flyer') return this.fly(dt, world, dx, dy, sees);
    if (ai === 'floater') return this.float(dt, world, dx, dy, sees);

    let want = 0;
    if (this.state === 'attack') {
      this.runAttack(world);
      if (T.attack.kind === 'lunge') {
        if (this.stateT > 0.12 && this.onGround) this.endAttack();
        want = null; // keep lunge momentum
      } else if (this.stateT >= this.attackTime()) {
        this.endAttack();
      }
    } else if (this.knock > 0) {
      want = null;
    } else if (sees) {
      this.facing = dx > 0 ? 1 : -1;
      const a = T.attack;
      const inRange = Math.abs(dx) < a.range * this.scale && (a.kind !== 'melee' || Math.abs(dy) < 36 * this.scale);
      if (inRange && this.cooldown <= 0 && this.onGround) {
        this.setState('attack');
        if (a.kind === 'lunge') { this.vx = this.facing * 210; this.vy = -200; this.onGround = false; want = null; }
      } else if (a.kind === 'shot') {
        want = Math.abs(dx) > a.range * 0.8 ? this.facing * T.chase : 0;
      } else {
        want = Math.abs(dx) > a.range * 0.6 ? this.facing * T.chase : 0;
      }
    } else {
      want = this.facing * T.speed;
    }

    if (ai === 'hopper' && this.state !== 'attack') {
      // Slimes move in little hops.
      if (this.onGround && want) {
        if (this.stateT > 0.9) { this.vy = -210; this.vx = Math.sign(want) * T.speed; this.onGround = false; this.stateT = 0; }
        else this.vx = 0;
      }
      want = null;
    }

    if (want !== null) {
      // Don't walk off ledges, into walls or onto spikes.
      if (want !== 0 && this.onGround && this.blockedAhead(room, Math.sign(want))) {
        if (!sees) this.facing = -this.facing;
        want = 0;
      }
      this.vx = want;
    }
    this.physics(dt, room, this.state === 'attack' && T.attack.kind === 'lunge' ? 0 : null);
  }

  endAttack() {
    this.setState('walk');
    this.cooldown = this.type.attack.cooldown * (0.8 + Math.random() * 0.4);
  }

  runAttack(world) {
    const a = this.type.attack;
    const frame = Math.floor(this.stateT / this.type.fps.attack);
    const f = this.facing;
    if (a.kind === 'melee') {
      if (frame >= a.hit[0] && frame <= a.hit[1]) {
        const reach = a.reach * this.scale;
        this.hitbox = { x: f > 0 ? this.x + this.w - 4 : this.x - reach + 4, y: this.y + this.h * 0.1, w: reach, h: this.h * 0.7 };
      }
    } else if (a.kind === 'lunge' || a.kind === 'swoop') {
      this.hitbox = { x: this.x - 2, y: this.y, w: this.w + 4, h: this.h };
    } else if (a.kind === 'shot' && !this.fired && frame >= a.fire) {
      this.fired = true;
      const mx = f > 0 ? this.x + this.w + 2 : this.x - 2;
      const my = this.y + this.h * (this.kind.includes('spider') || this.kind === 'slime' ? 0.45 : 0.35);
      for (const pr of firePattern(a.pattern, mx, my, f, this.atkDmg)) world.projectiles.push(pr);
    }
  }

  blockedAhead(room, dir) {
    const front = dir > 0 ? this.x + this.w + 2 : this.x - 2;
    const col = Math.floor(front / TILE);
    const foot = Math.floor((this.y + this.h + 2) / TILE);
    const mid = Math.floor((this.y + this.h - 4) / TILE);
    if (isWall(room.get(col, mid))) return true;
    if (room.get(col, foot) === EMPTY) return true;
    if (room.kind(col, foot) === 'spikes' || room.kind(col, foot) === 'lava') return true;
    return col < 0 || col >= room.cols;
  }

  // Ground physics for walkers.
  physics(dt, room, forceVx) {
    if (forceVx === 0 && this.onGround) this.vx *= 0.8;
    this.vy = Math.min(this.vy + GRAVITY * dt, 500);
    // Horizontal.
    this.x += this.vx * dt;
    const top = Math.floor(this.y / TILE), bot = Math.floor((this.y + this.h - 1) / TILE);
    const col = this.vx > 0 ? Math.floor((this.x + this.w) / TILE) : Math.floor(this.x / TILE);
    for (let ty = top; ty <= bot; ty++) {
      if (isWall(room.get(col, ty))) {
        this.x = this.vx > 0 ? col * TILE - this.w - 0.01 : (col + 1) * TILE + 0.01;
        this.vx = 0;
        if (this.state !== 'attack') this.facing = -this.facing;
        break;
      }
    }
    // Vertical.
    const prevBottom = this.y + this.h;
    this.y += this.vy * dt;
    this.onGround = false;
    const l = Math.floor(this.x / TILE), r = Math.floor((this.x + this.w - 0.01) / TILE);
    if (this.vy > 0) {
      const row = Math.floor((this.y + this.h) / TILE);
      for (let tx = l; tx <= r; tx++) {
        const c = room.get(tx, row);
        if (isWall(c) || (c === ONE_WAY && prevBottom <= row * TILE + 0.5)) {
          this.y = row * TILE - this.h;
          this.vy = 0;
          this.onGround = true;
          break;
        }
      }
    } else if (this.vy < 0) {
      const row = Math.floor(this.y / TILE);
      for (let tx = l; tx <= r; tx++) if (isWall(room.get(tx, row))) { this.y = (row + 1) * TILE; this.vy = 0; break; }
    }
  }

  // Harpies: hover near home, then swoop at where the player *was*.
  fly(dt, world, dx, dy, sees) {
    const T = this.type;
    if (this.state === 'attack') {
      this.runAttack(world);
      const tx = this.target.x - (this.x + this.w / 2), ty = this.target.y - (this.y + this.h / 2);
      const d = Math.hypot(tx, ty);
      if (d < 6 || this.stateT > 1.4) { this.endAttack(); }
      else { this.vx = (tx / d) * T.chase; this.vy = (ty / d) * T.chase; }
    } else {
      if (sees && this.cooldown <= 0 && Math.abs(dx) < T.attack.range) {
        this.facing = dx > 0 ? 1 : -1;
        this.target = { x: this.x + this.w / 2 + dx, y: this.y + this.h / 2 + dy };
        this.setState('attack');
      } else {
        // Drift back toward home with a lazy figure-of-eight.
        const hx = this.homeX + Math.sin(this.t * 0.7) * 40 - this.x;
        const hy = this.homeY + Math.sin(this.t * 1.9) * 10 - this.y;
        this.vx = Math.max(-T.speed, Math.min(T.speed, hx * 1.5));
        this.vy = Math.max(-T.speed, Math.min(T.speed, hy * 1.5));
        if (sees) this.facing = dx > 0 ? 1 : -1;
        else if (Math.abs(this.vx) > 4) this.facing = this.vx > 0 ? 1 : -1;
      }
    }
    this.moveFree(dt, world.room, true);
  }

  // Ghosts: drift through walls to hover at a distance, then cast.
  float(dt, world, dx, dy, sees) {
    const T = this.type;
    if (this.state === 'attack') {
      this.runAttack(world);
      this.vx *= 0.9; this.vy *= 0.9;
      if (this.stateT >= this.attackTime()) this.endAttack();
    } else if (sees) {
      this.facing = dx > 0 ? 1 : -1;
      const keep = 110;
      const want = Math.abs(dx) > keep + 20 ? this.facing * T.chase : Math.abs(dx) < keep - 20 ? -this.facing * T.chase : 0;
      this.vx += (want - this.vx) * 0.05;
      this.vy += ((dy - 16) * 0.6 - this.vy) * 0.03;
      if (this.cooldown <= 0 && Math.abs(dx) < T.attack.range) this.setState('attack');
    } else {
      this.vx += (Math.sin(this.t * 0.5) * T.speed - this.vx) * 0.03;
      this.vy += ((this.homeY - this.y) * 0.5 - this.vy) * 0.03;
      if (Math.abs(this.vx) > 3) this.facing = this.vx > 0 ? 1 : -1;
    }
    this.moveFree(dt, world.room, false);
    this.y += Math.sin(this.t * 2.4) * 0.25;
  }

  moveFree(dt, room, solid) {
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    const hits = (x, y) => {
      if (!solid) return false;
      for (let ty = Math.floor(y / TILE); ty <= Math.floor((y + this.h - 1) / TILE); ty++)
        for (let tx = Math.floor(x / TILE); tx <= Math.floor((x + this.w - 1) / TILE); tx++)
          if (isWall(room.get(tx, ty))) return true;
      return false;
    };
    if (!hits(nx, this.y)) this.x = nx; else this.vx = 0;
    if (!hits(this.x, ny)) this.y = ny; else this.vy = 0;
    this.x = Math.max(0, Math.min(room.width - this.w, this.x));
    this.y = Math.max(0, Math.min(room.height - this.h, this.y));
  }

  frame() {
    const F = this.frames, fps = this.type.fps;
    if (this.state === 'die') return F.die[Math.min(F.die.length - 1, Math.floor(this.stateT / fps.die))];
    if (this.state === 'attack') {
      const i = Math.floor(this.stateT / fps.attack);
      const loop = this.type.attack.kind === 'swoop' || this.type.attack.kind === 'lunge';
      return F.attack[loop ? i % F.attack.length : Math.min(F.attack.length - 1, i)];
    }
    const moving = Math.abs(this.vx) > 1 || this.air || this.type.ai === 'hopper';
    return F.walk[moving ? Math.floor(this.t / fps.walk) % F.walk.length : 0];
  }

  drawAura() {}

  draw(ctx, cam, showBoxes) {
    if (!atlas || !atlas.complete || !atlas.naturalWidth) return;
    const f = this.frame();
    const bx = Math.round(this.x + this.w / 2 - cam.x), by = Math.round(this.y + this.h - cam.y);
    ctx.save();
    if (this.dead) ctx.globalAlpha = Math.max(0, 1 - Math.max(0, this.stateT - this.frames.die.length * this.type.fps.die) / 0.4);
    else if (this.invuln > 0 && Math.floor(this.invuln * 30) % 2) ctx.globalAlpha = 0.35;
    else if (this.type.ai === 'floater') ctx.globalAlpha = 0.85;
    ctx.translate(bx, by);
    ctx.scale(this.facing < 0 ? -this.scale : this.scale, this.scale);
    const img = paletteAtlas(atlas, this.variant);
    if (this.boss) this.drawAura(ctx, img, f);
    ctx.drawImage(img, f.x, f.y, f.w, f.h, -f.ax, -f.ay, f.w, f.h);
    ctx.restore();
    // Status sparkles.
    for (const k of Object.keys(this.status)) {
      if (Math.random() < 0.3) {
        ctx.fillStyle = STATUS[k].color;
        ctx.fillRect(bx - this.w / 2 + Math.random() * this.w, by - Math.random() * this.h, 1.5, 1.5);
      }
    }
    // Small health bar after being hit.
    if (this.hpShow > 0 && !this.dead && !this.boss) {
      const w = Math.max(16, this.w), x = bx - w / 2, y = by - this.h - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
      ctx.fillStyle = '#d23a3a'; ctx.fillRect(x, y, w * Math.max(0, this.hp / this.maxHp), 2);
    }
    if (showBoxes) {
      ctx.strokeStyle = 'rgba(255,200,60,0.9)'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(this.x - cam.x) + 0.5, Math.round(this.y - cam.y) + 0.5, this.w - 1, this.h - 1);
      if (this.hitbox) {
        const h = this.hitbox; ctx.strokeStyle = 'rgba(255,60,60,0.9)';
        ctx.strokeRect(Math.round(h.x - cam.x) + 0.5, Math.round(h.y - cam.y) + 0.5, h.w - 1, h.h - 1);
      }
    }
  }
}

export { overlap };
