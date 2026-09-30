import { TILE, PLAYER, PHYSICS as P } from './config.js';
import { SOLID, ONE_WAY } from './room.js';

const approach = (v, target, amount) =>
  v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);

// The player's position (x, y) is the top-left of the HIT BOX (21 x 32).
// The 32 x 32 sprite is drawn centred on the hit box.
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
  }

  // (x, y) = bottom-centre of where the player should stand.
  spawnAt(x, y) {
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.vx = this.vy = 0;
  }

  update(dt, input, room) {
    // --- Horizontal movement ---
    const dir = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    if (dir !== 0) this.facing = dir;
    const target = dir * P.runSpeed;
    const accel = this.onGround
      ? (dir !== 0 ? P.groundAccel : P.groundDecel)
      : (dir !== 0 ? P.airAccel : P.airDecel);
    this.vx = approach(this.vx, target, accel * dt);

    // --- Jump timers ---
    this.jumpBuffer = input.pressed.jump ? P.jumpBuffer : Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.onGround ? P.coyoteTime : Math.max(0, this.coyote - dt);
    this.dropTimer = Math.max(0, this.dropTimer - dt);

    if (this.jumpBuffer > 0 && this.onGround && input.held.down && this.standingOnOneWayOnly(room)) {
      // Down + jump on a one-way platform drops through it.
      this.dropTimer = 0.15;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
    } else if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -P.jumpVelocity;
      this.jumping = true;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
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

  draw(ctx, cam) {
    const hx = Math.round(this.x - cam.x);
    const hy = Math.round(this.y - cam.y);
    // Centre the 32px sprite over the 21px hit box (11px spare: 5 / 6 split,
    // mirrored with facing so it stays symmetric).
    const spare = PLAYER.spriteW - this.w;
    const sx = hx - (this.facing > 0 ? Math.floor(spare / 2) : Math.ceil(spare / 2));
    const sy = hy + this.h - PLAYER.spriteH;

    // Sprite placeholder: green square.
    ctx.fillStyle = '#2ecc40';
    ctx.fillRect(sx, sy, PLAYER.spriteW, PLAYER.spriteH);

    // Hit box: blue.
    ctx.fillStyle = 'rgba(40, 90, 255, 0.75)';
    ctx.fillRect(hx, hy, this.w, this.h);
    ctx.strokeStyle = '#0a2cff';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx + 0.5, hy + 0.5, this.w - 1, this.h - 1);

    // Facing marker ("eye").
    ctx.fillStyle = '#fff';
    ctx.fillRect(this.facing > 0 ? hx + this.w - 6 : hx + 3, hy + 6, 3, 3);
  }
}
