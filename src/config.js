// Global tuning values. Units are pixels and seconds unless noted.

// Internal (virtual) resolution of the game screen. Everything is rendered at
// this size and then scaled up with nearest-neighbour filtering.
export const VIEW_W = 320;
export const VIEW_H = 240;

export const TILE = 32;

// Fixed simulation step (60 Hz, like the original hardware).
export const STEP = 1 / 60;

export const PLAYER = {
  spriteW: 32,
  spriteH: 32,
  hitW: 21,
  hitH: 32,
};

export const PHYSICS = {
  runSpeed: 140,        // max horizontal speed
  groundAccel: 2000,    // how fast we reach runSpeed on the ground
  groundDecel: 2600,    // how fast we stop on the ground
  airAccel: 1400,
  airDecel: 900,
  gravity: 950,
  jumpVelocity: 400,    // initial upward speed (~84px = ~2.6 tiles max height)
  jumpCutVelocity: 200, // upward speed is clamped to this when jump is released early (min hop ~21px)
  maxFallSpeed: 480,
  coyoteTime: 0.08,     // grace period to still jump after walking off a ledge
  jumpBuffer: 0.1,      // jump pressed slightly before landing still counts
  slideSpeed: 260,      // down + jump on solid ground
  slideTime: 0.4,
};

// Seconds per frame for each animation.
export const ANIM = {
  run: 0.075,
  attack: 0.05,
  cast: 0.06,
  duck: 0.04,
  land: 0.08,
};
