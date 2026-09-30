import { TILE, PLAYER, PHYSICS as P, ANIM } from './config.js';
import { SOLID, ONE_WAY, GRATE, BREAK } from './tileTypes.js';
import { PLAYER_ATLAS, PLAYER_FRAMES as F } from './playerSprites.js';
import { BASE_ATK } from './items.js';
import { hitWindows, weaponPose, weaponBox, drawWeapon, tipOf } from './weaponFx.js';
import { emptyMods } from './stats.js';

const approach = (v, target, amount) =>
  v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);

// No Image in Node (the level checker reuses this physics code).
const atlas = typeof Image !== 'undefined' ? new Image() : null;
if (atlas) atlas.src = PLAYER_ATLAS;

const SPRINT_SPEED = 270;
const DOUBLE_TAP = 0.28;
const SUPER_JUMP = 930;

// Bare fists: a short invisible jab.
const FISTS = { id: 'fists', name: 'Fists', shape: 'none', atk: 0, dur: 0.22, len: 12, w: 2, lunge: 0,
  anim: { motion: 'thrust' }, colors: {} };

// The player's position (x, y) is the top-left of the HIT BOX (21 x 32).
// The sprite is drawn with its anchor on the hit box's bottom-centre.
export class Player {
  constructor() {
    this.w = PLAYER.hitW;
    this.h = PLAYER.hitH;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.jumping = false;   // rising from a jump (variable-height jump active)
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.dropTimer = 0;     // while > 0, one-way platforms are ignored
    this.dropping = false;  // holding down after a drop: keep falling through platforms
    this.holdDown = false;
    // idle | run | air | land | crouch | slide | attack | cast | hurt
    this.state = 'idle';
    this.stateTime = 0;
    this.airTime = 0;
    this.clock = 0;
    this.showHitbox = false;
    this.onMover = null;
    this.weapon = null;     // right hand
    this.weaponL = null;    // left hand (follow-up swing)
    this.swing = null;      // current swing { w, hand, t, dur, win }
    this.queuedL = false;
    this.attackBox = null;
    this.swingId = 0;       // a new id per hit window, so each window hits an enemy once
    this.canCast = null;    // world hook
    this.events = [];       // things for the world to spawn: beams, shockwaves, dust
    this.trail = [];
    this.ghosts = [];       // sprint / super-jump afterimages
    this.abilities = {};
    this.mods = emptyMods();
    this.usedDouble = false;
    this.sprinting = 0;
    this.lastTap = { dir: 0, t: -1 };
    this.superJump = false;
    this.level = 1;
    this.xp = 0;
    this.maxHp = 100;
    this.hp = 100;
    this.maxMp = 100;
    this.mp = 100;
    this.invuln = 0;
  }

  // Damage of the current / given weapon at this level (before element and crits).
  weaponDamage(w = this.weapon) {
    return Math.round((BASE_ATK + (w?.atk || 0) + this.mods.atk) * (1 + 0.15 * (this.level - 1)));
  }
  get atk() { return this.weaponDamage(this.weapon); }
  get currentWeapon() { return this.swing?.w || this.weapon; }

  solid(c) {
    return c === SOLID || c === BREAK || (c === GRATE && !this.abilities.mist);
  }

  knockback(fromX) {
    const dir = this.x + this.w / 2 < fromX ? -1 : 1;
    this.setState('hurt');
    this.swing = null;
    this.vx = dir * 150;
    this.vy = -190;
    this.onGround = false;
    this.onMover = null;
    this.jumping = false;
    this.sprinting = 0;
    this.invuln = 1.1 + this.mods.iframes;
  }

  spawnAt(x, y) {
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.vx = this.vy = 0;
    this.swing = null;
    this.sprinting = 0;
  }

  setState(s) {
    if (this.state !== s) {
      this.state = s;
      this.stateTime = 0;
    }
  }

  get busy() {
    return this.state === 'attack' || this.state === 'cast';
  }

  ride(room) {
    const m = this.onMover;
    if (!m) return;
    if (m.dx) this.moveX(m.dx, room);
    this.y = m.y - this.h;
  }

  startSwing(hand) {
    const w = (hand === 'L' ? this.weaponL : this.weapon) || FISTS;
    const speed = 1 - Math.min(0.3, this.mods.speed * 0.5);
    this.swing = { w, hand, t: 0, dur: w.dur * speed, win: -1, windows: hitWindows(w) };
    this.trail = [];
    this.queuedL = false;
    this.setState('attack');
    this.stateTime = 0;
  }

  update(dt, input, room) {
    this.stateTime += dt;
    this.clock += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.holdDown = input.held.down;
    const wasOnGround = this.onGround;
    const hurt = this.state === 'hurt';
    const ab = this.abilities;

    // --- Actions (attack / magic) ---
    if (this.state === 'attack' && this.swing && input.pressed.attack && this.swing.hand === 'R' && this.weaponL && this.swing.t > 0.5) {
      this.queuedL = true;
    } else if (!this.busy && this.state !== 'slide' && !hurt) {
      if (input.pressed.attack) this.startSwing('R');
      else if (input.pressed.magic && (!this.canCast || this.canCast())) this.setState('cast');
    }

    // --- Sprint: double-tap a direction (Gale Greaves) ---
    const dir = hurt ? 0 : (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    if (ab.sprint && !hurt) {
      for (const d of [-1, 1]) {
        if (d < 0 ? input.pressed.left : input.pressed.right) {
          if (this.lastTap.dir === d && this.clock - this.lastTap.t < DOUBLE_TAP) this.sprinting = d;
          this.lastTap = { dir: d, t: this.clock };
        }
      }
    }
    if (this.sprinting && dir !== this.sprinting) this.sprinting = 0;

    // --- Horizontal movement ---
    const crouching = this.onGround && input.held.down && !this.busy && this.state !== 'slide' && !hurt;
    if (dir !== 0 && !this.busy && this.state !== 'slide') this.facing = dir;
    const runSpeed = (this.sprinting ? SPRINT_SPEED : P.runSpeed) * (1 + this.mods.speed);

    if (hurt) {
      this.vx = approach(this.vx, 0, 260 * dt);
    } else if (this.state === 'slide') {
      const t = Math.min(this.stateTime / P.slideTime, 1);
      this.vx = this.facing * P.slideSpeed * (1 - t * t);
    } else {
      const rooted = this.onGround && (this.busy || crouching);
      const target = rooted ? 0 : dir * runSpeed;
      const moving = target !== 0;
      const accel = this.onGround
        ? (moving ? P.groundAccel : P.groundDecel)
        : (moving ? P.airAccel : P.airDecel);
      this.vx = approach(this.vx, target, accel * dt * (this.sprinting ? 1.4 : 1));
      // Thrusts lunge forward.
      const s = this.swing;
      if (s && this.state === 'attack' && s.w.lunge && s.t > 0.15 && s.t < 0.45 && this.onGround) this.vx = this.facing * s.w.lunge * 4;
    }

    // --- Jump timers ---
    this.jumpBuffer = input.pressed.jump ? P.jumpBuffer : Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.onGround ? P.coyoteTime : Math.max(0, this.coyote - dt);
    this.dropTimer = Math.max(0, this.dropTimer - dt);
    if (this.onGround) { this.usedDouble = false; this.superJump = false; }

    const jumpV = P.jumpVelocity * (1 + this.mods.jump);
    const canJump = !(this.busy && this.onGround) && !hurt;
    if (this.jumpBuffer > 0 && this.onGround && input.held.down && this.state !== 'slide' && !this.busy && !hurt) {
      this.jumpBuffer = 0;
      if (this.standingOnOneWayOnly(room)) {
        this.dropTimer = 0.15;
        this.dropping = true;
        this.coyote = 0;
        this.onGround = false;
      } else {
        this.setState('slide');
        this.vx = this.facing * P.slideSpeed;
      }
    } else if (this.jumpBuffer > 0 && this.coyote > 0 && canJump) {
      if (ab.gravity && input.held.up && this.onGround) {
        // Gravity Crown: a towering leap.
        this.vy = -SUPER_JUMP;
        this.jumping = false;
        this.superJump = true;
        this.events.push({ kind: 'dust', x: this.x + this.w / 2, y: this.y + this.h, big: true });
      } else {
        this.vy = -jumpV;
        this.jumping = true;
      }
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      if (this.state === 'slide') this.setState('air');
    } else if (this.jumpBuffer > 0 && !this.onGround && ab.doubleJump && !this.usedDouble && canJump) {
      // Leap Boots: a second jump in mid-air.
      this.vy = -jumpV * 0.95;
      this.jumping = true;
      this.usedDouble = true;
      this.jumpBuffer = 0;
      this.dropping = false;
      this.events.push({ kind: 'ring', x: this.x + this.w / 2, y: this.y + this.h });
    }

    if (this.jumping && !input.held.jump && this.vy < -P.jumpCutVelocity) this.vy = -P.jumpCutVelocity;
    if (this.vy >= 0) this.jumping = false;

    this.vy = Math.min(this.vy + P.gravity * dt, P.maxFallSpeed);

    this.moveX(this.vx * dt, room);
    this.moveY(this.vy * dt, room);
    if (this.onGround) this.dropping = false;

    this.airTime = this.onGround ? 0 : this.airTime + dt;
    this.updateSwing(dt);
    this.updateState(dt, dir, crouching, wasOnGround);

    // Afterimages while sprinting or super-jumping.
    if ((this.sprinting && Math.abs(this.vx) > 180) || (this.superJump && this.vy < -300)) {
      if (Math.floor(this.clock * 30) % 2 === 0) this.ghosts.push({ x: this.x, y: this.y, f: this.currentFrame(), facing: this.facing, t: 0 });
    }
    for (const g of this.ghosts) g.t += dt;
    this.ghosts = this.ghosts.filter((g) => g.t < 0.25);
  }

  updateSwing(dt) {
    this.attackBox = null;
    const s = this.swing;
    if (!s || this.state !== 'attack') { this.swing = null; return; }
    s.t = Math.min(1, this.stateTime / s.dur);
    const pose = weaponPose(s.w, s.t);
    const tip = tipOf(s.w, pose);
    this.trail.push(tip);
    if (this.trail.length > 7) this.trail.shift();
    const wi = s.windows.findIndex(([a, b]) => s.t >= a && s.t <= b);
    if (wi >= 0) {
      if (wi !== s.win) {
        s.win = wi;
        this.swingId++;
        if (s.w.beam && wi === 0) this.events.push({ kind: 'beam', beam: s.w.beam, w: s.w });
        if (s.w.anim.motion === 'smash') this.events.push({ kind: 'quake', x: this.x + this.w / 2 + this.facing * 26, y: this.y + this.h, w: s.w });
        if (s.w.anim.motion === 'giant') this.events.push({ kind: 'requiem', w: s.w });
      }
      const ox = this.x + this.w / 2, oy = this.y + this.h;
      this.attackBox = weaponBox(s.w, pose, ox, oy, this.facing);
      if (s.w.element) this.events.push({ kind: 'spark', el: s.w.element, x: ox + tip[0] * this.facing, y: oy + tip[1] });
    }
  }

  updateState(dt, dir, crouching, wasOnGround) {
    const s = this.state;
    if (s === 'hurt') {
      if (this.stateTime < 0.35) return;
    } else if (s === 'attack') {
      if (this.swing && this.stateTime < this.swing.dur) return;
      if (this.queuedL && this.weaponL) { this.startSwing('L'); return; }
      this.swing = null;
    } else if (s === 'cast') {
      if (this.stateTime < F.cast.length * ANIM.cast) return;
    } else if (s === 'slide') {
      if (this.stateTime < P.slideTime && this.onGround && this.vx !== 0) return;
    } else if (s === 'land' && this.onGround && dir === 0 && !crouching && this.stateTime < ANIM.land) {
      return;
    }

    if (!this.onGround) this.setState('air');
    else if (crouching) this.setState('crouch');
    else if (!wasOnGround || s === 'air') this.setState(dir !== 0 ? 'run' : 'land');
    else if (dir !== 0) this.setState('run');
    else this.setState('idle');
  }

  moveX(dx, room) {
    if (dx === 0) return;
    this.x += dx;
    const top = Math.floor(this.y / TILE);
    const bottom = Math.floor((this.y + this.h - 0.001) / TILE);
    const col = dx > 0 ? Math.floor((this.x + this.w - 0.001) / TILE) : Math.floor(this.x / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      if (this.solid(room.get(col, ty))) {
        const lift = this.y + this.h - ty * TILE;
        if (ty === bottom && this.onGround && lift > 0 && lift <= 6 && !this.blockedAt(room, col, ty - 1, top - 1)) {
          this.y -= lift;
          return;
        }
        this.x = dx > 0 ? col * TILE - this.w : (col + 1) * TILE;
        this.vx = 0;
        this.sprinting = 0;
        return;
      }
    }
  }

  blockedAt(room, col, fromRow, toRow) {
    for (let ty = fromRow; ty >= toRow; ty--) if (this.solid(room.get(col, ty))) return true;
    return false;
  }

  moveY(dy, room) {
    const prevBottom = this.y + this.h;
    this.y += dy;
    this.onGround = false;
    this.onMover = null;
    const left = Math.floor(this.x / TILE);
    const right = Math.floor((this.x + this.w - 0.001) / TILE);
    const passOneWay = this.dropTimer > 0 || (this.dropping && this.holdDown);
    if (dy > 0) {
      let surface = Infinity, mover = null;
      const row = Math.floor((this.y + this.h - 0.001) / TILE);
      const rowTop = row * TILE;
      for (let tx = left; tx <= right; tx++) {
        const t = room.get(tx, row);
        const landOnOneWay = t === ONE_WAY && !passOneWay && prevBottom <= rowTop + 0.001;
        if (this.solid(t) || landOnOneWay) { surface = rowTop; break; }
      }
      if (!passOneWay) {
        for (const m of room.movers || []) {
          if (this.x < m.x + m.w && this.x + this.w > m.x &&
              prevBottom <= m.y + 0.5 && this.y + this.h >= m.y && m.y < surface) {
            surface = m.y;
            mover = m;
          }
        }
      }
      if (surface !== Infinity) {
        this.y = surface - this.h;
        this.vy = 0;
        this.onGround = true;
        this.onMover = mover;
        return;
      }
    } else if (dy < 0) {
      const row = Math.floor(this.y / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (this.solid(room.get(tx, row))) {
          this.y = (row + 1) * TILE;
          this.vy = 0;
          this.jumping = false;
          return;
        }
      }
    }
  }

  standingOnOneWayOnly(room) {
    if (this.onMover) return true;
    const row = Math.floor((this.y + this.h) / TILE);
    const left = Math.floor(this.x / TILE);
    const right = Math.floor((this.x + this.w - 0.001) / TILE);
    let oneWay = false;
    for (let tx = left; tx <= right; tx++) {
      const t = room.get(tx, row);
      if (this.solid(t)) return false;
      if (t === ONE_WAY) oneWay = true;
    }
    return oneWay;
  }

  currentFrame() {
    const t = this.stateTime;
    const pick = (frames, step, loop) => {
      const i = Math.floor(t / step);
      return frames[loop ? i % frames.length : Math.min(i, frames.length - 1)];
    };
    switch (this.state) {
      case 'run': return pick(F.run, ANIM.run * (this.sprinting ? 0.6 : 1), true);
      case 'attack': {
        const s = this.swing;
        const k = s ? s.t : 0;
        const m = s?.w.anim.motion;
        // Thrusts hold the extended pose; everything else plays through.
        const idx = m === 'thrust' || m === 'flurry' ? (k < 0.2 ? 1 : 3) : Math.min(F.attack.length - 1, Math.floor(k * F.attack.length));
        return F.attack[idx];
      }
      case 'cast': return pick(F.cast, ANIM.cast);
      case 'crouch': return pick(F.duck, ANIM.duck);
      case 'slide': return pick(F.slide, P.slideTime / F.slide.length);
      case 'land': return F.jump[5];
      case 'hurt': return F.jump[5];
      case 'air': {
        const v = this.vy;
        if (this.jumping && this.airTime < 0.05) return F.jump[0];
        if (v < -200) return F.jump[1];
        if (v < -60) return F.jump[2];
        if (v < 60) return F.jump[3];
        return F.jump[4];
      }
      default: return F.cast[0];
    }
  }

  draw(ctx, cam) {
    if (!atlas || !atlas.complete || !atlas.naturalWidth) return;
    // Afterimages.
    for (const g of this.ghosts) {
      ctx.save();
      ctx.globalAlpha = 0.35 * (1 - g.t / 0.25);
      ctx.translate(Math.round(g.x + this.w / 2 - cam.x), Math.round(g.y + this.h - cam.y));
      if (g.facing < 0) ctx.scale(-1, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(atlas, g.f.x, g.f.y, g.f.w, g.f.h, -g.f.ax, -g.f.ay, g.f.w, g.f.h);
      ctx.restore();
    }
    const cx = Math.round(this.x + this.w / 2 - cam.x);
    const by = Math.round(this.y + this.h - cam.y);
    const blink = this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0;
    if (!blink) {
      const f = this.currentFrame();
      ctx.save();
      ctx.translate(cx, by);
      if (this.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(atlas, f.x, f.y, f.w, f.h, -f.ax, -f.ay, f.w, f.h);
      const s = this.swing;
      if (this.state === 'attack' && s && s.w.shape !== 'none') drawWeapon(ctx, s.w, s.t, this.clock, this.trail);
      ctx.restore();
    }
    if (this.showHitbox) {
      const hx = Math.round(this.x - cam.x), hy = Math.round(this.y - cam.y);
      ctx.strokeStyle = 'rgba(60, 120, 255, 0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hx + 0.5, hy + 0.5, this.w - 1, this.h - 1);
      const a = this.attackBox;
      if (a) {
        ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
        ctx.strokeRect(Math.round(a.x - cam.x) + 0.5, Math.round(a.y - cam.y) + 0.5, a.w - 1, a.h - 1);
      }
    }
  }
}
