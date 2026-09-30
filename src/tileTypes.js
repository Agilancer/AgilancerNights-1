// Collision values shared by rooms, the player and enemies.
export const EMPTY = 0;
export const SOLID = 1;
export const ONE_WAY = 2; // jump up through it, stand on it, down + jump to drop
export const GRATE = 3;   // iron grate: solid, unless the player has the Mist Veil
export const BREAK = 4;   // cracked wall: solid until smashed

// Solid for enemies and projectiles.
export const isWall = (c) => c === SOLID || c === GRATE || c === BREAK;
