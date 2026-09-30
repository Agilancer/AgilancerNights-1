import { TILE, PLAYER, PHYSICS as P, ANIM } from './config.js';
import { SOLID, ONE_WAY } from './room.js';
import { PLAYER_ATLAS, PLAYER_FRAMES as F } from './playerSprites.js';

const approach = (v, target, amount) =>
  v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);

const atlas = new Image();
atlas.src = PLAYER_ATLAS;

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
        this.x = dx > 0 ? col * TILE - this.w : (col + 1) * TILE;
        this.vx = 0;
        return;
      }
    }
  }

  moveY(dy, room) {
    const prevBottom = this.y + this.h;
    this.y += dy;
    this.onGround = false;
    const left = Math.floor(this.x / TILE);
    const right = Math.floor((this.x + this.w - 0.001) / TILE);
    if (dy > 0) {
      const row = Math.floor((this.y + this.h - 0.001) / TILE);
      const rowTop = row * TILE;
      for (let tx = left; tx <= right; tx++) {
        const t = room.get(tx, row);
        const landOnOneWay = t === ONE_WAY && this.dropTimer <= 0 && prevBottom <= rowTop + 0.001;
        if (t === SOLID || landOnOneWay) {
          this.y = rowTop - this.h;
          this.vy = 0;
          this.onGround = true;
          return;
        }
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
      ctx.restore();
    }

    // Hit box stays invisible unless debugging.
    if (this.showHitbox) {
      const hx = Math.round(this.x - cam.x), hy = Math.round(this.y - cam.y);
      ctx.strokeStyle = 'rgba(60, 120, 255, 0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hx + 0.5, hy + 0.5, this.w - 1, this.h - 1);
    }
  }
}
