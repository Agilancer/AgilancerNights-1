import { TILE } from './config.js';
import { TILE_TOP } from './tileIndex.js';
import { drawTile } from './assets.js';
import { ITEMS, getIcon } from './items.js';
import { EMPTY, SOLID, ONE_WAY, GRATE, BREAK } from './tileTypes.js';
import { Enemy } from './enemies.js';
import { ZONES, SCRIBBLES } from './zones.js';

export { EMPTY, SOLID, ONE_WAY, GRATE, BREAK };

// Map characters. `c` is collision, `kind` picks how it is drawn.
const LEGEND = {
  '.': { c: EMPTY },
  '#': { c: SOLID, kind: 'wall' },
  '=': { c: ONE_WAY, kind: 'oneway' },
  '^': { c: EMPTY, kind: 'spikes', hazard: true },
  'L': { c: EMPTY, kind: 'lava', hazard: true },
  'C': { c: SOLID, kind: 'crate' },
  'D': { c: SOLID, kind: 'door' },
  'B': { c: BREAK, kind: 'break' },  // cracked wall: smash it
  'G': { c: GRATE, kind: 'grate' },  // iron grate: Mist Veil passes through
};

// Tile choices for the hand-built opening rooms (generated zones bring their own).
export const THEMES = {
  hall:    { wall: ['wall_1', 'wall_4', 'brick'], cap: 'plat_stone', oneway: 'plat_wood', bg: 'wall_4', shade: 0.55 },
  stone:   { wall: ['brick', 'wall_1', 'wall_4'], cap: 'plat_stone', oneway: 'plat_brick', bg: 'brick', shade: 0.55 },
  tower:   { wall: ['wall_4', 'brick', 'wall_1'], cap: 'plat_stone', oneway: 'plat_wood', bg: 'brick', shade: 0.55 },
  lava:    { wall: ['wall_red', 'brick_blood', 'wall_red'], cap: 'plat_broken', oneway: 'plat_lava', bg: 'wall_red', shade: 0.66 },
  moss:    { wall: ['wall_2', 'brick_moss', 'wall_1'], cap: 'plat_vines', oneway: 'plat_vines', bg: 'brick_moss', shade: 0.6 },
  crypt:   { wall: ['wall_4', 'wall_1', 'brick'], cap: 'plat_iron', oneway: 'plat_iron', bg: 'wall_4', shade: 0.62 },
  shrine:  { wall: ['wall_1', 'wall_4'], cap: 'plat_stone', oneway: 'plat_wood', bg: 'arcade_wall', shade: 0.42 },
};

const LIGHTS = {
  torch: { r: 40, y: 0.35 }, candelabra: { r: 34, y: 0.3 }, chandelier: { r: 44, y: 0.6 },
  chandelier_2: { r: 44, y: 0.6 }, lantern: { r: 30, y: 0.6 }, fireplace: { r: 44, y: 0.7 }, lavafall: { r: 36, y: 0.5 },
};
export const LIGHT_KINDS = LIGHTS;

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

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
  constructor(id, def, state) {
    this.id = id;
    this.def = def;
    this.zone = def.zone || 0;
    this.zoneDef = ZONES[this.zone];
    this.name = def.name;
    this.zoneName = this.zone ? this.zoneDef.name : '';
    this.wx = def.x;
    this.wy = def.y;
    this.theme = THEMES[def.theme] || this.zoneDef.theme || THEMES.hall;
    const rows = def.map;
    this.rows = rows.length;
    this.cols = rows[0].length;
    this.width = this.cols * TILE;
    this.height = this.rows * TILE;
    this.cells = new Uint8Array(this.cols * this.rows);
    this.kinds = new Array(this.cols * this.rows).fill(null);
    this.hazards = [];
    this.doors = [];
    this.breakables = new Map();
    rows.forEach((row, ty) => {
      if (row.length !== this.cols) throw new Error(`${id}: row ${ty} has wrong length`);
      [...row].forEach((ch, tx) => {
        const l = LEGEND[ch] || LEGEND['.'];
        const i = ty * this.cols + tx;
        this.cells[i] = l.c;
        this.kinds[i] = l.kind || null;
        if (ch === '^') this.hazards.push({ x: tx * TILE + 3, y: ty * TILE + 20, w: TILE - 6, h: 12, dmg: 15, kind: 'spikes' });
        if (ch === 'L') this.hazards.push({ x: tx * TILE, y: ty * TILE + 12, w: TILE, h: 20, dmg: 30, kind: 'lava' });
        if (ch === 'D') this.doors.push({ tx, ty });
        if (ch === 'B') {
          const key = `${tx},${ty}`;
          if (state.flags[`brk_${id}_${key}`]) { this.cells[i] = EMPTY; this.kinds[i] = null; }
          else this.breakables.set(key, { tx, ty, hp: 3 });
        }
      });
    });
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
    const mult = this.zoneDef.mult || 1;
    this.enemies = (def.enemies || []).map((e) => new Enemy({ m: mult, ...e }));
    this.items = (def.items || [])
      .filter((it) => !state.collected[it.id])
      .map((it) => ({ ...it, px: it.x * TILE, py: it.y * TILE }));
    this.chests = (def.chests || []).map((c) => ({ ...c, open: !!state.collected[c.id] }));
    this.lantern = false;  // set by the world when the player has the Spirit Lantern
    this.sealed = [];
    this.time = 0;
  }

  findChains() {
    const out = [];
    const c = (x, y) => this.get(x, y);
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (c(tx, ty) !== ONE_WAY || (tx > 0 && c(tx - 1, ty) === ONE_WAY)) continue;
        let end = tx;
        while (end + 1 < this.cols && c(end + 1, ty) === ONE_WAY) end++;
        if (c(tx - 1, ty) === SOLID || c(end + 1, ty) === SOLID) continue;
        if (ty === this.rows - 1 || ty === 0) continue;
        if (c(tx, ty + 1) === SOLID) continue; // resting on a wall below
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

  breakWall(key) {
    const b = this.breakables.get(key);
    if (!b) return;
    const i = b.ty * this.cols + b.tx;
    this.cells[i] = EMPTY;
    this.kinds[i] = null;
    this.breakables.delete(key);
  }

  // Boss arenas: bar every opening in the outer wall until the boss falls.
  seal() {
    const edge = [];
    for (let x = 0; x < this.cols; x++) edge.push([x, 0], [x, this.rows - 1]);
    for (let y = 0; y < this.rows; y++) edge.push([0, y], [this.cols - 1, y]);
    for (const [x, y] of edge) {
      const i = y * this.cols + x;
      if (this.cells[i] === SOLID) continue;
      this.sealed.push({ i, c: this.cells[i], k: this.kinds[i] });
      this.cells[i] = SOLID;
      this.kinds[i] = 'bars';
    }
  }

  unseal() {
    for (const s of this.sealed) { this.cells[s.i] = s.c; this.kinds[s.i] = s.k; }
    this.sealed = [];
  }

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

  drawBackground(ctx, cam) {
    const th = this.theme, Z = this.zoneDef;
    if (Z.bg === 'sky') {
      // Night sky over the ramparts: moon, stars, distant spires.
      const g = ctx.createLinearGradient(0, 0, 0, cam.h);
      g.addColorStop(0, '#05030e'); g.addColorStop(0.6, '#1a1236'); g.addColorStop(1, '#2a1a3a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cam.w, cam.h);
      const px = -cam.x * 0.08, py = -cam.y * 0.05;
      for (let i = 0; i < 90; i++) {
        const sx = ((hash(i, 7) * 900 + px) % 900 + 900) % 900 - 100, sy = hash(i, 13) * cam.h * 0.8 + py;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(this.time * (1 + hash(i, 3) * 2) + i))})`;
        ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
      }
      const mx = cam.w * 0.72 - cam.x * 0.03, my = 46 - cam.y * 0.02;
      const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 70);
      mg.addColorStop(0, 'rgba(255,240,220,0.35)'); mg.addColorStop(1, 'rgba(255,240,220,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - 70, my - 70, 140, 140);
      ctx.fillStyle = '#f2e8d8'; ctx.beginPath(); ctx.arc(mx, my, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,180,170,0.5)'; ctx.beginPath(); ctx.arc(mx - 6, my - 4, 5, 0, Math.PI * 2); ctx.arc(mx + 7, my + 6, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b0716';
      for (let i = 0; i < 14; i++) {
        const bx = ((i * 97 - cam.x * 0.25) % (cam.w + 200) + cam.w + 200) % (cam.w + 200) - 100;
        const bh = 50 + hash(i, 1) * 80, bw = 18 + hash(i, 2) * 26;
        ctx.fillRect(bx, cam.h - bh - 20 - cam.y * 0.1, bw, bh + 200);
        ctx.beginPath(); ctx.moveTo(bx - 3, cam.h - bh - 20 - cam.y * 0.1); ctx.lineTo(bx + bw / 2, cam.h - bh - 48 - cam.y * 0.1); ctx.lineTo(bx + bw + 3, cam.h - bh - 20 - cam.y * 0.1); ctx.fill();
      }
      return;
    }
    if (Z.bg === 'void') {
      ctx.fillStyle = '#020006'; ctx.fillRect(0, 0, cam.w, cam.h);
      for (let i = 0; i < 70; i++) {
        const s = hash(i, 99);
        const sx = ((hash(i, 5) * 1200 - cam.x * (0.1 + s * 0.3) + this.time * 6 * s) % 1200 + 1200) % 1200 - 200;
        const sy = ((hash(i, 6) * 600 - cam.y * 0.2 - this.time * 10 * s) % 600 + 600) % 600 - 100;
        ctx.fillStyle = s > 0.8 ? 'rgba(200,120,255,0.8)' : 'rgba(180,170,255,0.5)';
        ctx.fillRect(Math.round(sx), Math.round(sy), s > 0.9 ? 2 : 1, s > 0.9 ? 2 : 1);
      }
      const n = ctx.createRadialGradient(cam.w * 0.3, cam.h * 0.4, 5, cam.w * 0.3, cam.h * 0.4, 220);
      n.addColorStop(0, `rgba(90,20,140,${0.25 + 0.08 * Math.sin(this.time)})`); n.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = n; ctx.fillRect(0, 0, cam.w, cam.h);
      return;
    }
    const x0 = Math.floor(cam.x / TILE), x1 = Math.floor((cam.x + cam.w) / TILE);
    const y0 = Math.floor(cam.y / TILE), y1 = Math.floor((cam.y + cam.h) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) drawTile(ctx, th.bg, tx * TILE - cam.x, ty * TILE - cam.y);
    const pulse = Z.pulse ? 0.06 * Math.sin(this.time * 2.2) : 0;
    ctx.fillStyle = `rgba(6, 4, 14, ${th.shade + pulse})`;
    ctx.fillRect(0, 0, cam.w, cam.h);
  }

  draw(ctx, cam) {
    const th = this.theme, Z = this.zoneDef;
    const x0 = Math.floor(cam.x / TILE), x1 = Math.floor((cam.x + cam.w) / TILE);
    const y0 = Math.floor(cam.y / TILE), y1 = Math.floor((cam.y + cam.h) / TILE);
    const sx = (tx) => tx * TILE - cam.x;
    const sy = (ty) => ty * TILE - cam.y;

    this.drawBackground(ctx, cam);

    // Words on the walls, deep in the castle.
    if (Z.scribbles) {
      ctx.font = 'italic 9px Georgia, serif';
      ctx.textAlign = 'center';
      for (let i = 0; i < Math.floor(this.cols / 12); i++) {
        const h = hash(i + this.wx, this.wy + 3);
        const text = SCRIBBLES[Math.floor(h * SCRIBBLES.length)];
        const x = (i * 12 + 4 + h * 6) * TILE - cam.x, y = (1.6 + hash(i, this.wx) * (this.rows - 4)) * TILE - cam.y;
        ctx.fillStyle = `rgba(160,20,30,${0.12 + 0.1 * Math.sin(this.time * 0.7 + i)})`;
        ctx.fillText(text, x, y);
      }
      ctx.textAlign = 'left';
    }

    // Decorations; light sources glow and flicker.
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

    for (const ch of this.chains) {
      const x = ch.x - cam.x;
      if (x < -4 || x > cam.w + 4) continue;
      for (let y = ch.y0, i = 0; y < ch.y1; y += 4, i++) {
        const yy = y - cam.y;
        if (yy < -6 || yy > cam.h) continue;
        ctx.fillStyle = '#2a2a36';
        if (i % 2) ctx.fillRect(x - 1, yy, 3, 5); else ctx.fillRect(x - 2, yy + 1, 5, 3);
        ctx.fillStyle = i % 2 ? '#8c8ca4' : '#6a6a80';
        if (i % 2) ctx.fillRect(x, yy + 1, 1, 3); else ctx.fillRect(x - 1, yy + 2, 3, 1);
      }
    }

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const k = this.kind(tx, ty);
        if (!k) continue;
        const px = sx(tx), py = sy(ty);
        if (k === 'wall' || k === 'break') {
          const r = hash(tx + this.wx * 7, ty + this.wy * 13);
          const v = r < 0.72 ? th.wall[0] : r < 0.9 ? th.wall[1] : th.wall[2];
          drawTile(ctx, v, px, py);
          const above = this.kind(tx, ty - 1);
          if (ty > 0 && above !== 'wall' && above !== 'crate' && above !== 'break') drawTile(ctx, th.cap, px, py - (TILE_TOP[th.cap] || 0));
          if (this.kind(tx, ty + 1) !== 'wall' && ty < this.rows - 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(px, py + TILE, TILE, 4);
          }
          if (k === 'break') {
            // A faint crack; with the Spirit Lantern it glows.
            ctx.strokeStyle = this.lantern ? `rgba(160,220,255,${0.5 + 0.3 * Math.sin(this.time * 4)})` : 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(px + 8, py + 4); ctx.lineTo(px + 14, py + 14); ctx.lineTo(px + 11, py + 20); ctx.lineTo(px + 19, py + 28); ctx.stroke();
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
          if (ty === this.door.ty) drawTile(ctx, 'door', px, py, 64, TILE, TILE * this.door.h);
        } else if (k === 'grate' || k === 'bars') {
          ctx.fillStyle = 'rgba(10,10,16,0.35)';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = k === 'bars' ? '#6a6070' : '#55606a';
          for (let i = 3; i < TILE; i += 7) ctx.fillRect(px + i, py, 2, TILE);
          ctx.fillRect(px, py + 3, TILE, 2);
          ctx.fillRect(px, py + TILE - 5, TILE, 2);
          ctx.fillStyle = 'rgba(200,210,230,0.25)';
          for (let i = 3; i < TILE; i += 7) ctx.fillRect(px + i, py, 1, TILE);
        }
      }
    }

    for (const m of this.movers) {
      const n = Math.round(m.w / TILE);
      for (let i = 0; i < n; i++) drawTile(ctx, 'mover', Math.round(m.x - cam.x) + i * TILE, Math.round(m.y - cam.y) - (TILE_TOP.mover || 0));
    }

    ctx.fillStyle = '#000';
    if (cam.x < 0) {
      ctx.fillRect(0, 0, -cam.x, cam.h);
      ctx.fillRect(this.width - cam.x, 0, cam.w, cam.h);
    }

    // Treasure chests.
    for (const c of this.chests) {
      const px = c.x * TILE - cam.x, py = c.y * TILE - cam.y;
      if (px < -40 || px > cam.w + 40) continue;
      drawChest(ctx, px + 4, py - 18, c.open, this.time, c.rare);
    }

    // Items on pedestals.
    for (const it of this.items) {
      const px = it.px - cam.x, py = it.py - cam.y;
      drawTile(ctx, 'column', px, py - TILE);
      const bob = Math.round(Math.sin(this.time * 2.5) * 2);
      const icon = getIcon(it.item);
      const g = ctx.createRadialGradient(px + 16, py - TILE - 8 + bob, 1, px + 16, py - TILE - 8 + bob, 18);
      const rel = ITEMS[it.item]?.type === 'relic';
      g.addColorStop(0, rel ? 'rgba(255, 120, 120, 0.6)' : 'rgba(255, 230, 150, 0.55)');
      g.addColorStop(1, 'rgba(255, 230, 150, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - 4, py - TILE * 2 + bob - 4, TILE + 8, TILE + 8);
      if (icon) ctx.drawImage(icon, px + 6, py - TILE - 18 + bob, 20, 20);
    }
  }
}

// A small wooden chest with gold bands; open ones show a dark gap.
function drawChest(ctx, x, y, open, t, rare) {
  const band = rare ? '#e070ff' : '#e0b040';
  ctx.fillStyle = '#000000aa'; ctx.fillRect(x + 1, y + 17, 23, 2);
  ctx.fillStyle = rare ? '#3a1a4a' : '#6a3a1a';
  ctx.fillRect(x, y + 7, 24, 11);
  if (open) {
    ctx.fillStyle = '#1a0a04'; ctx.fillRect(x + 1, y + 3, 22, 4);
    ctx.fillStyle = rare ? '#4a2a5a' : '#7a4a22'; ctx.fillRect(x, y - 3, 24, 6);
  } else {
    ctx.fillStyle = rare ? '#4a2a5a' : '#7a4a22'; ctx.fillRect(x, y + 2, 24, 6);
    const s = 0.5 + 0.5 * Math.sin(t * 3 + x);
    ctx.fillStyle = `rgba(255,230,140,${0.15 + s * 0.2})`; ctx.fillRect(x - 2, y, 28, 20);
  }
  ctx.fillStyle = band;
  ctx.fillRect(x, y + 7, 24, 1.5);
  ctx.fillRect(x + 3, y + 2, 2, 16); ctx.fillRect(x + 19, y + 2, 2, 16);
  ctx.fillRect(x + 10, y + 6, 4, 5);
}
