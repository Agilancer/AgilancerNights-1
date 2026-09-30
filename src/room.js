import { TILE } from './config.js';

export const EMPTY = 0;
export const SOLID = 1;
export const ONE_WAY = 2; // jump up through it, stand on it, down + jump to drop

const LEGEND = { '.': EMPTY, '#': SOLID, '=': ONE_WAY, 'P': EMPTY };

// Test room: 48 x 20 tiles (768 x 320 px). 'P' marks the player spawn.
export const TEST_ROOM = [
  '################################################',
  '#..............................................#',
  '#..............................................#',
  '#.................==========...................#',
  '#..............................................#',
  '#..............................................#',
  '#..........=====..............=====............#',
  '#..............................................#',
  '#..............................................#',
  '#...====..............######............====...#',
  '#..............................................#',
  '#..............................................#',
  '#.........=====................======.......#..#',
  '#...........................................#..#',
  '#...........................................#..#',
  '#....====...........#####.......====........#..#',
  '#...........................................#..#',
  '#..P.......................##.........#.....#..#',
  '################################################',
  '################################################',
];

export class Room {
  constructor(rows) {
    this.rows = rows.length;
    this.cols = rows[0].length;
    this.width = this.cols * TILE;
    this.height = this.rows * TILE;
    this.tiles = new Uint8Array(this.cols * this.rows);
    this.spawn = { x: TILE * 2, y: this.height - TILE * 3 };
    rows.forEach((row, ty) => {
      if (row.length !== this.cols) throw new Error(`Room row ${ty} has wrong length`);
      [...row].forEach((ch, tx) => {
        this.tiles[ty * this.cols + tx] = LEGEND[ch] ?? EMPTY;
        // Spawn point = bottom-centre of the 'P' tile.
        if (ch === 'P') this.spawn = { x: tx * TILE + TILE / 2, y: (ty + 1) * TILE };
      });
    });
  }

  // Out-of-bounds counts as solid so the player can never leave the room.
  get(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return SOLID;
    return this.tiles[ty * this.cols + tx];
  }

  draw(ctx, cam) {
    // Parallax backdrop: dark castle wall with faint pillars.
    ctx.fillStyle = '#12101c';
    ctx.fillRect(0, 0, cam.w, cam.h);
    ctx.fillStyle = '#1b1829';
    const px = Math.round(cam.x * 0.5);
    for (let x = -(px % 96); x < cam.w; x += 96) ctx.fillRect(x, 0, 28, cam.h);
    ctx.fillStyle = '#221e33';
    const py = Math.round(cam.y * 0.5);
    for (let y = -(py % 48); y < cam.h; y += 48) ctx.fillRect(0, y, cam.w, 2);

    const x0 = Math.floor(cam.x / TILE), x1 = Math.floor((cam.x + cam.w) / TILE);
    const y0 = Math.floor(cam.y / TILE), y1 = Math.floor((cam.y + cam.h) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.get(tx, ty);
        if (t === EMPTY) continue;
        const sx = tx * TILE - cam.x, sy = ty * TILE - cam.y;
        if (t === SOLID) {
          ctx.fillStyle = '#4a4a63';
          ctx.fillRect(sx, sy, TILE, TILE);
          ctx.fillStyle = '#5d5d7a';
          ctx.fillRect(sx, sy, TILE, 1);
          ctx.fillRect(sx, sy, 1, TILE);
          ctx.fillStyle = '#34344a';
          ctx.fillRect(sx, sy + TILE / 2, TILE, 1);
          ctx.fillRect(sx + ((ty & 1) ? 4 : 12), sy, 1, TILE / 2);
          ctx.fillRect(sx + ((ty & 1) ? 12 : 4), sy + TILE / 2, 1, TILE / 2);
        } else if (t === ONE_WAY) {
          ctx.fillStyle = '#8a5a2b';
          ctx.fillRect(sx, sy, TILE, 5);
          ctx.fillStyle = '#b07a41';
          ctx.fillRect(sx, sy, TILE, 1);
          ctx.fillStyle = '#5c3a1a';
          ctx.fillRect(sx + 3, sy + 5, 2, 4);
          ctx.fillRect(sx + 11, sy + 5, 2, 4);
        }
      }
    }
  }
}
