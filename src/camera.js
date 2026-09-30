export class Camera {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.x = 0;
    this.y = 0;
  }

  // Centre on the target, clamped to the room edges.
  follow(target, room) {
    const cx = target.x + target.w / 2 - this.w / 2;
    const cy = target.y + target.h / 2 - this.h / 2 - 16; // look slightly up
    this.x = Math.round(Math.max(0, Math.min(cx, room.width - this.w)));
    this.y = Math.round(Math.max(0, Math.min(cy, room.height - this.h)));
  }
}
