export class Camera {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.x = 0;
    this.y = 0;
  }

  // Follow the target, clamped to the room edges. Smoothed vertically so
  // jumps don't jerk the screen; `snap` jumps straight there.
  follow(target, room, snap = false) {
    const cx = target.x + target.w / 2 - this.w / 2;
    const cy = target.y + target.h / 2 - this.h / 2 - 12;
    const tx = Math.max(0, Math.min(cx, room.width - this.w));
    const ty = Math.max(0, Math.min(cy, room.height - this.h));
    this.x = Math.round(tx);
    this.y = snap ? Math.round(ty) : Math.round(this.y + (ty - this.y) * 0.18);
  }
}
