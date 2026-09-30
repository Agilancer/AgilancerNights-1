// Global tuning values. Units are pixels and seconds unless noted.

// Internal (virtual) resolution of the game screen. Everything is rendered at
// this size and then scaled up with nearest-neighbour filtering.
export const VIEW_W = 320;
export const VIEW_H = 240;

export const TILE = 16;

// Fixed simulation step (60 Hz, like the original hardware).
export const STEP = 1 / 60;

export const PLAYER = {
  spriteW: 32,
  spriteH: 32,
  hitW: 21,
  hitH: 32,
};

export const PHYSICS = {
  runSpeed: 130,        // max horizontal speed
  groundAccel: 2000,    // how fast we reach runSpeed on the ground
  groundDecel: 2600,    // how fast we stop on the ground
  airAccel: 1400,
  airDecel: 900,
  gravity: 950,
  jumpVelocity: 340,    // initial upward speed (~60px / ~4 tiles max height)
  jumpCutVelocity: 110, // upward speed is clamped to this when jump is released early
  maxFallSpeed: 420,
  coyoteTime: 0.08,     // grace period to still jump after walking off a ledge
  jumpBuffer: 0.1,      // jump pressed slightly before landing still counts
};
