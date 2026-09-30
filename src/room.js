import { TILE } from './config.js';
import { TILE_TOP } from './tileIndex.js';
import { drawTile } from './assets.js';
import { ITEMS, getIcon } from './items.js';

import { EMPTY, SOLID, ONE_WAY } from './tileTypes.js';
import { Enemy } from './enemies.js';

export { EMPTY, SOLID, ONE_WAY };

// Map characters. `c` is collision, `kind` picks how it is drawn.
const LEGEND = {
  '.': { c: EMPTY },
  '#': { c: SOLID, kind: 'wall' },
  '=': { c: ONE_WAY, kind: 'oneway' },
  '^': { c: EMPTY, kind: 'spikes', hazard: true },
  'L': { c: EMPTY, kind: 'lava', hazard: true },
  'C': { c: SOLID, kind: 'crate' },
  'D': { c: SOLID, kind: 'door' },
};

// Per-room tile choices. `wall` lists variants (first one most common).
export const THEMES = {
  hall:    { wall: ['wall_1', 'wall_4', 'brick'], cap: 'plat_stone', oneway: 'plat_wood', bg: 'wall_4', shade: 0.55 },
  stone:   { wall: ['brick', 'wall_1', 'wall_4'], cap: 'plat_stone', oneway: 'plat_brick', bg: 'brick', shade: 0.55 },
  tower:   { wall: ['wall_4', 'brick', 'wall_1'], cap: 'plat_stone', oneway: 'plat_wood', bg: 'brick', shade: 0.55 },
  lava:    { wall: ['wall_red', 'brick_blood', 'wall_red'], cap: 'plat_broken', oneway: 'plat_lava', bg: 'wall_red', shade: 0.66 },
  moss:    { wall: ['wall_2', 'brick_moss', 'wall_1'], cap: 'plat_vines', oneway: 'plat_vines', bg: 'brick_moss', shade: 0.6 },
  crypt:   { wall: ['wall_4', 'wall_1', 'brick'], cap: 'plat_iron', oneway: 'plat_iron', bg: 'wall_4', shade: 0.62 },
  shrine:  { wall: ['wall_1', 'wall_4'], cap: 'plat_stone', oneway: 'plat_wood', bg: 'arcade_wall', shade: 0.42 },
};

// Decorations that cast light: glow radius and height (fraction of the tile).
const LIGHTS = {
  torch: { r: 40, y: 0.35 }, candelabra: { r: 34, y: 0.3 }, chandelier: { r: 44, y: 0.6 },
  chandelier_2: { r: 44, y: 0.6 }, lantern: { r: 30, y: 0.6 }, fireplace: { r: 44, y: 0.7 },
};

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// A platform that glides back and forth between two points.
class Mover {
  constructor(def) {
    this.x0 = def.x * TILE;
    this.y0 = def.y * TILE;
    this.w = (def.w || 2) * TILE;
    this.h = 12;
    this.ox = (def.dx || 0) * TILE;
    this.oy = (def.dy || 0) * TILE;
    this.period = def.period || 4;
    this.phase = def.phase || 0;
    this.x = this.x0;
    this.y = this.y0;
    this.dx = this.dy = 0;
  }

  update(time) {
    const t = 0.5 - 0.5 * Math.cos(((time / this.period) + this.phase) * Math.PI * 2);
    const nx = this.x0 + this.ox * t;
    const ny = this.y0 + this.oy * t;
    this.dx = nx - this.x;
    this.dy = ny - this.y;
    this.x = nx;
    this.y = ny;
  }
}

export class Room {
  // def: entry from ROOMS; state: world state (for collected items / open doors).
  constructor(id, def, state) {
    this.id = id;
    this.def = def;
    this.name = def.name;
    this.wx = def.x; // world position in tiles
    this.wy = def.y;
    this.theme = THEMES[def.theme] || THEMES.hall;
    const rows = def.map;
    this.rows = rows.length;
    this.cols = rows[0].length;
    this.width = this.cols * TILE;
    this.height = this.rows * TILE;
    this.cells = new Uint8Array(this.cols * this.rows); // collision
    this.kinds = new Array(this.cols * this.rows).fill(null);
    this.hazards = [];
    this.doors = [];
    rows.forEach((row, ty) => {
      if (row.length !== this.cols) throw new Error(`${id}: row ${ty} has wrong length`);
      [...row].forEach((ch, tx) => {
        const l = LEGEND[ch] || LEGEND['.'];
        const i = ty * this.cols + tx;
        this.cells[i] = l.c;
        this.kinds[i] = l.kind || null;
        if (ch === '^') this.hazards.push({ x: tx * TILE + 3, y: ty * TILE + 20, w: TILE - 6, h: 12, dmg: 15 });
        if (ch === 'L') this.hazards.push({ x: tx * TILE, y: ty * TILE + 12, w: TILE, h: 20, dmg: 30 });
        if (ch === 'D') this.doors.push({ tx, ty });
      });
    });
    // Door cells are grouped into one door per room (a 1 x N column).
    if (this.doors.length) {
      const d = this.doors;
      this.door = {
        tx: d[0].tx, ty: Math.min(...d.map((c) => c.ty)), h: d.length,
        flag: def.door?.flag || `door_${id}`, key: def.door?.key || 'iron_key',
      };
      if (state.flags[this.door.flag]) this.openDoor();
    }
    this.chains = this.findChains();
    this.movers = (def.movers || []).map((m) => new Mover(m));
    // Enemies respawn every time the room is entered (as in SotN).
    this.enemies = (def.enemies || []).map((e) => new Enemy(e));
    this.items = (def.items || [])
      .filter((it) => !state.collected[it.id])
      .map((it) => ({ ...it, px: it.x * TILE, py: it.y * TILE }));
    this.time = 0;
  }

  // One-way platforms that aren't built into a wall hang from chains: find
  // each free-standing run and measure a chain from each end up to whatever
  // is above (ceiling or another platform).
  findChains() {
    const out = [];
    const c = (x, y) => this.get(x, y);
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (c(tx, ty) !== ONE_WAY || (tx > 0 && c(tx - 1, ty) === ONE_WAY)) continue;
        let end = tx;
        while (end + 1 < this.cols && c(end + 1, ty) === ONE_WAY) end++;
        if (c(tx - 1, ty) === SOLID || c(end + 1, ty) === SOLID) continue; // bracketed to a wall
        if (ty === this.rows - 1 || ty === 0) continue;                    // floor / ceiling gaps
        for (const [col, px] of [[tx, tx * TILE + 5], [end, end * TILE + TILE - 6]]) {
          let top = ty - 1;
          while (top >= 0 && c(col, top) === EMPTY) top--;
          out.push({ x: px, y0: (top + 1) * TILE, y1: ty * TILE + 2 });
        }
      }
    }
    return out;
  }

  openDoor() {
    for (let i = 0; i < this.door.h; i++) {
      const k = (this.door.ty + i) * this.cols + this.door.tx;
      this.cells[k] = EMPTY;
      this.kinds[k] = null;
    }
    this.door.open = true;
  }

  // Outside the map, cells repeat the nearest edge cell, so a gap in the
  // outer wall stays open and leads out of the room. (One-way platforms on
  // the edge don't repeat: you can drop through a floor gap into the room below.)
  get(tx, ty) {
    const out = tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows;
    tx = Math.max(0, Math.min(this.cols - 1, tx));
    ty = Math.max(0, Math.min(this.rows - 1, ty));
    const c = this.cells[ty * this.cols + tx];
    return out && c === ONE_WAY ? EMPTY : c;
  }

  kind(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return null;
    return this.kinds[ty * this.cols + tx];
  }

  // The hazard (spikes / lava) overlapping this box, or null.
  touchesHazard(x, y, w, h) {
    for (const z of this.hazards) {
      if (x < z.x + z.w && x + w > z.x && y < z.y + z.h && y + h > z.y) return z;
    }
    return null;
  }

  update(dt) {
    this.time += dt;
    for (const m of this.movers) m.update(this.time);
  }

  draw(ctx, cam) {
    const th = this.theme;
    const x0 = Math.floor(cam.x / TILE), x1 = Math.floor((cam.x + cam.w) / TILE);
    const y0 = Math.floor(cam.y / TILE), y1 = Math.floor((cam.y + cam.h) / TILE);
    const sx = (tx) => tx * TILE - cam.x;
    const sy = (ty) => ty * TILE - cam.y;

    // 1. Background wall, darkened.
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) drawTile(ctx, th.bg, sx(tx), sy(ty));
    }
    ctx.fillStyle = `rgba(6, 4, 14, ${th.shade})`;
    ctx.fillRect(0, 0, cam.w, cam.h);

    // 2. Decorations (behind everything solid). Light sources get a flickering glow.
    for (const [i, d] of (this.def.decor || []).entries()) {
      const s = (d.s || 1) * TILE;
      const dx = d.x * TILE - cam.x, dy = d.y * TILE - cam.y;
      if (dx > cam.w + 48 || dy > cam.h + 48 || dx + s < -48 || dy + s < -48) continue;
      const glow = LIGHTS[d.t];
      if (glow) {
        const f = 0.85 + 0.15 * Math.sin(this.time * 9 + i * 2.1) * Math.sin(this.time * 5.3 + i);
        const gx = dx + s / 2, gy = dy + s * glow.y, r = glow.r * (d.s || 1) * f;
        const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, r);
        g.addColorStop(0, `rgba(255, 170, 70, ${0.28 * f})`);
        g.addColorStop(1, 'rgba(255, 120, 40, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
      }
      drawTile(ctx, d.t, dx, dy, s);
    }

    // 3a. Chains holding up free-standing platforms.
    for (const ch of this.chains) {
      const x = ch.x - cam.x;
      if (x < -4 || x > cam.w + 4) continue;
      for (let y = ch.y0, i = 0; y < ch.y1; y += 4, i++) {
        const sy = y - cam.y;
        if (sy < -6 || sy > cam.h) continue;
        ctx.fillStyle = '#2a2a36';
        if (i % 2) ctx.fillRect(x - 1, sy, 3, 5); else ctx.fillRect(x - 2, sy + 1, 5, 3);
        ctx.fillStyle = i % 2 ? '#8c8ca4' : '#6a6a80';
        if (i % 2) ctx.fillRect(x, sy + 1, 1, 3); else ctx.fillRect(x - 1, sy + 2, 3, 1);
      }
    }

    // 3. Tiles.
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const k = this.kind(tx, ty);
        if (!k) continue;
        const px = sx(tx), py = sy(ty);
        if (k === 'wall') {
          const r = hash(tx + this.wx * 7, ty + this.wy * 13);
          const v = r < 0.72 ? th.wall[0] : r < 0.9 ? th.wall[1] : th.wall[2];
          drawTile(ctx, v, px, py);
          const above = this.kind(tx, ty - 1);
          if (ty > 0 && above !== 'wall' && above !== 'crate') {
            drawTile(ctx, th.cap, px, py - (TILE_TOP[th.cap] || 0));
          }
          // Soft shadow under overhangs.
          if (this.kind(tx, ty + 1) !== 'wall' && ty < this.rows - 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(px, py + TILE, TILE, 4);
          }
        } else if (k === 'oneway') {
          drawTile(ctx, th.oneway, px, py - (TILE_TOP[th.oneway] || 0));
        } else if (k === 'spikes') {
          drawTile(ctx, 'spike_pit', px, py);
        } else if (k === 'lava') {
          const glow = 0.5 + 0.5 * Math.sin(this.time * 3 + tx * 0.9);
          ctx.fillStyle = '#9c1c06';
          ctx.fillRect(px, py + 8, TILE, TILE - 8);
          drawTile(ctx, 'floor_lava', px, py + 2);
          ctx.fillStyle = `rgba(255, 120, 30, ${0.08 + glow * 0.12})`;
          ctx.fillRect(px, py - 10, TILE, 12);
        } else if (k === 'crate') {
          drawTile(ctx, 'crate', px, py - (TILE_TOP.crate || 0), 32, TILE, TILE + (TILE_TOP.crate || 0));
        } else if (k === 'door') {
          // Draw the whole door once, from its top cell, stretched over the column.
          if (ty === this.door.ty) drawTile(ctx, 'door', px, py, 64, TILE, TILE * this.door.h);
        }
      }
    }

    // 4. Moving platforms.
    for (const m of this.movers) {
      const n = Math.round(m.w / TILE);
      for (let i = 0; i < n; i++) {
        drawTile(ctx, 'mover', Math.round(m.x - cam.x) + i * TILE, Math.round(m.y - cam.y) - (TILE_TOP.mover || 0));
      }
    }

    // Outside a room narrower than the screen: black.
    ctx.fillStyle = '#000';
    if (cam.x < 0) {
      ctx.fillRect(0, 0, -cam.x, cam.h);
      ctx.fillRect(this.width - cam.x, 0, cam.w, cam.h);
    }

    // 5. Items on pedestals.
    for (const it of this.items) {
      const px = it.px - cam.x, py = it.py - cam.y;
      drawTile(ctx, 'column', px, py - TILE); // pedestal stands on the floor row
      const bob = Math.round(Math.sin(this.time * 2.5) * 2);
      const icon = getIcon(ITEMS[it.item].icon);
      const g = ctx.createRadialGradient(px + 16, py - TILE - 8 + bob, 1, px + 16, py - TILE - 8 + bob, 16);
      g.addColorStop(0, 'rgba(255, 230, 150, 0.55)');
      g.addColorStop(1, 'rgba(255, 230, 150, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(px, py - TILE * 2 + bob, TILE, TILE);
      if (icon) ctx.drawImage(icon, px + 8, py - TILE - 16 + bob);
    }
  }
}
