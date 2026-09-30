import { TILE, PLAYER, PHYSICS as P, ANIM } from './config.js';
import { SOLID, ONE_WAY } from './room.js';
import { PLAYER_ATLAS, PLAYER_FRAMES as F } from './playerSprites.js';
import { BASE_ATK } from './items.js';

const approach = (v, target, amount) =>
  v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);

// No Image in Node (the level checker reuses this physics code).
const atlas = typeof Image !== 'undefined' ? new Image() : null;
if (atlas) atlas.src = PLAYER_ATLAS;

// Durations of the one-shot actions.
const ATTACK_TIME = F.attack.length * ANIM.attack;
const CAST_TIME = F.cast.length * ANIM.cast;

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
    // idle | run | air | land | crouch | slide | attack | cast
    this.state = 'idle';
    this.stateTime = 0;
    this.airTime = 0;
    this.showHitbox = false;
    this.onMover = null;    // moving platform we're standing on
    this.weapon = null;     // item def of the equipped weapon (or null = fists)
    this.attackBox = null;  // active attack hit box, for future enemies
  }

  get atk() {
    return BASE_ATK + (this.weapon?.atk || 0);
  }

  // Call before update(): moving platforms carry whoever stands on them.
  ride(room) {
    const m = this.onMover;
    if (!m) return;
    if (m.dx) this.moveX(m.dx, room);
    this.y = m.y - this.h;
  }

  // (x, y) = bottom-centre of where the player should stand.
  spawnAt(x, y) {
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.vx = this.vy = 0;
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

  update(dt, input, room) {
    this.stateTime += dt;
    const wasOnGround = this.onGround;

    // --- Actions (attack / magic) ---
    if (!this.busy && this.state !== 'slide') {
      if (input.pressed.attack) this.setState('attack');
      else if (input.pressed.magic) this.setState('cast');
    }

    // --- Horizontal movement ---
    const dir = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const crouching = this.onGround && input.held.down && !this.busy && this.state !== 'slide';
    // Like SotN: you can't turn around mid-attack or mid-slide.
    if (dir !== 0 && !this.busy && this.state !== 'slide') this.facing = dir;

    if (this.state === 'slide') {
      const t = Math.min(this.stateTime / P.slideTime, 1);
      this.vx = this.facing * P.slideSpeed * (1 - t * t);
    } else {
      // Standing still while attacking/casting on the ground, or crouching.
      const rooted = this.onGround && (this.busy || crouching);
      const target = rooted ? 0 : dir * P.runSpeed;
      const moving = target !== 0;
      const accel = this.onGround
        ? (moving ? P.groundAccel : P.groundDecel)
        : (moving ? P.airAccel : P.airDecel);
      this.vx = approach(this.vx, target, accel * dt);
    }

    // --- Jump timers ---
    this.jumpBuffer = input.pressed.jump ? P.jumpBuffer : Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.onGround ? P.coyoteTime : Math.max(0, this.coyote - dt);
    this.dropTimer = Math.max(0, this.dropTimer - dt);

    const canJump = !(this.busy && this.onGround);
    if (this.jumpBuffer > 0 && this.onGround && input.held.down && this.state !== 'slide' && !this.busy) {
      this.jumpBuffer = 0;
      if (this.standingOnOneWayOnly(room)) {
        // Down + jump on a one-way platform drops through it.
        this.dropTimer = 0.15;
        this.coyote = 0;
        this.onGround = false;
      } else {
        // Down + jump on solid ground slides.
        this.setState('slide');
        this.vx = this.facing * P.slideSpeed;
      }
    } else if (this.jumpBuffer > 0 && this.coyote > 0 && canJump) {
      this.vy = -P.jumpVelocity;
      this.jumping = true;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      if (this.state === 'slide') this.setState('air'); // jump cancels a slide
    }

    // Releasing jump early cuts the jump short.
    if (this.jumping && !input.held.jump && this.vy < -P.jumpCutVelocity) {
      this.vy = -P.jumpCutVelocity;
    }
    if (this.vy >= 0) this.jumping = false;

    // --- Gravity ---
    this.vy = Math.min(this.vy + P.gravity * dt, P.maxFallSpeed);

    // --- Move and collide, one axis at a time ---
    this.moveX(this.vx * dt, room);
    this.moveY(this.vy * dt, room);

    this.airTime = this.onGround ? 0 : this.airTime + dt;
    this.updateState(dt, dir, crouching, wasOnGround);
    this.updateAttackBox();
  }

  updateAttackBox() {
    this.attackBox = null;
    if (this.state !== 'attack') return;
    const t = this.stateTime;
    if (t < ANIM.attack * 1 || t > ANIM.attack * 4) return;
    const reach = this.weapon?.reach || 12;
    const cx = this.x + this.w / 2;
    const x = this.facing > 0 ? cx + 4 : cx - 4 - reach;
    this.attackBox = { x, y: this.y + 2, w: reach, h: 22 };
  }

  updateState(dt, dir, crouching, wasOnGround) {
    const s = this.state;
    if (s === 'attack' || s === 'cast') {
      if (this.stateTime < (s === 'attack' ? ATTACK_TIME : CAST_TIME)) return;
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
      if (room.get(col, ty) === SOLID) {
        // Step up onto a ledge that is only a few pixels higher than our feet
        // (e.g. stepping off a moving platform that stopped slightly low).
        const lift = this.y + this.h - ty * TILE;
        if (ty === bottom && this.onGround && lift > 0 && lift <= 6 && !this.blockedAt(room, col, ty - 1, top - 1)) {
          this.y -= lift;
          return;
        }
        this.x = dx > 0 ? col * TILE - this.w : (col + 1) * TILE;
        this.vx = 0;
        return;
      }
    }
  }

  blockedAt(room, col, fromRow, toRow) {
    for (let ty = fromRow; ty >= toRow; ty--) if (room.get(col, ty) === SOLID) return true;
    return false;
  }

  moveY(dy, room) {
    const prevBottom = this.y + this.h;
    this.y += dy;
    this.onGround = false;
    this.onMover = null;
    const left = Math.floor(this.x / TILE);
    const right = Math.floor((this.x + this.w - 0.001) / TILE);
    if (dy > 0) {
      // Nearest surface we crossed this step: a tile or a moving platform.
      let surface = Infinity, mover = null;
      const row = Math.floor((this.y + this.h - 0.001) / TILE);
      const rowTop = row * TILE;
      for (let tx = left; tx <= right; tx++) {
        const t = room.get(tx, row);
        const landOnOneWay = t === ONE_WAY && this.dropTimer <= 0 && prevBottom <= rowTop + 0.001;
        if (t === SOLID || landOnOneWay) { surface = rowTop; break; }
      }
      if (this.dropTimer <= 0) {
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
        if (room.get(tx, row) === SOLID) {
          this.y = (row + 1) * TILE; // bonk
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
      if (t === SOLID) return false;
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
      case 'run': return pick(F.run, ANIM.run, true);
      case 'attack': return pick(F.attack, ANIM.attack);
      case 'cast': return pick(F.cast, ANIM.cast);
      case 'crouch': return pick(F.duck, ANIM.duck);
      case 'slide': return pick(F.slide, P.slideTime / F.slide.length);
      case 'land': return F.jump[5];
      case 'air': {
        const v = this.vy;
        if (this.jumping && this.airTime < 0.05) return F.jump[0]; // take-off
        if (v < -200) return F.jump[1];
        if (v < -60) return F.jump[2];
        if (v < 60) return F.jump[3];
        return F.jump[4];
      }
      default: return F.cast[0]; // idle stance
    }
  }

  draw(ctx, cam) {
    // Hit box bottom-centre in screen space.
    const cx = Math.round(this.x + this.w / 2 - cam.x);
    const by = Math.round(this.y + this.h - cam.y);

    if (atlas.complete && atlas.naturalWidth) {
      const f = this.currentFrame();
      ctx.save();
      ctx.translate(cx, by);
      if (this.facing < 0) ctx.scale(-1, 1); // frames face right; mirror for left
      ctx.drawImage(atlas, f.x, f.y, f.w, f.h, -f.ax, -f.ay, f.w, f.h);
      if (this.state === 'attack' && this.weapon) this.drawSword(ctx);
      ctx.restore();
    }

    // Hit box stays invisible unless debugging.
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

  // Sword swing, drawn in the sprite's (right-facing) local space where
  // (0, 0) is the hit box bottom-centre.
  drawSword(ctx) {
    const t = this.stateTime / (ANIM.attack * F.attack.length);
    if (t > 0.85) return;
    const k = Math.min(1, t / 0.6);
    const ease = 1 - (1 - k) * (1 - k);
    const a0 = -2.0, a1 = 0.35;             // radians: raised behind -> forward
    const ang = a0 + (a1 - a0) * ease;
    const hx = 7, hy = -19;                 // hand position
    const len = (this.weapon.reach || 24) - 2;
    // Slash trail.
    if (k > 0.15) {
      ctx.strokeStyle = 'rgba(220, 230, 255, 0.35)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(hx, hy, len - 3, Math.max(a0, ang - 1.4), ang);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    ctx.fillStyle = '#6a3e1e';
    ctx.fillRect(-4, -1, 4, 3);             // grip
    ctx.fillStyle = '#f0c050';
    ctx.fillRect(0, -3, 2, 7);              // cross-guard
    ctx.fillStyle = '#aab4cc';
    ctx.fillRect(2, -1, len - 4, 3);        // blade
    ctx.fillStyle = '#f4f6ff';
    ctx.fillRect(2, -1, len - 4, 1);        // edge highlight
    ctx.fillRect(len - 2, 0, 2, 1);         // tip
    ctx.restore();
  }
}
