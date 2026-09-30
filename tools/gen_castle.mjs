// Castle generator: lays out and builds the 143 rooms beyond the Sword
// Sanctum, then proves every one is playable with the real physics.
//
//   node tools/gen_castle.mjs [--seed N]      -> writes src/castle.js
//
// Layout: rooms are rectangles of 20x10-tile cells on a world grid. Zones grow
// from earlier zones and are sealed by an ability gate (double jump, sprint,
// mist, spike immunity, super jump, lava immunity) or a key door. Inside a room
// every cell row is a "level" with its floor on local row 8; levels connect
// through floor holes with a stack of one-way platforms, rooms connect through
// 2-tall side doorways or 3-wide floor holes.
import { writeFileSync } from 'fs';
import { explore, reachedExit } from './solver.mjs';
import { mulberry32 } from '../src/data/rng.js';
import { ZONES } from '../src/zones.js';
import { BOSSES } from '../src/boss.js';
import { ENEMY_TYPES } from '../src/enemies.js';
import { rollItem } from '../src/loot.js';
import { ITEMS } from '../src/items.js';

const CW = 20, CH = 10, OX = 156, OY = 14;
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg > 0 ? +process.argv[seedArg + 1] : 1337;
const R = mulberry32(SEED);
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const pickR = (list) => list[Math.floor(R() * list.length)];
const log = (...a) => console.log(...a);

// ---------------------------------------------------------------- plan
const PLAN = [
  null,
  { count: 16, attach: 0, bias: [1, 0],   bosses: ['bone_colossus'] },
  { count: 15, attach: 1, bias: [0, -1],  bosses: ['harpy_queen'] },
  { count: 16, attach: 2, bias: [1, -1],  bosses: ['grand_lich', 'grimoire_wraith'] },
  { count: 17, attach: 1, bias: [0, 1],   bosses: ['spider_matriarch', 'troll_king'] },
  { count: 15, attach: 3, bias: [1, -1],  bosses: ['minotaur_lord'] },
  { count: 15, attach: 4, bias: [1, 1],   bosses: ['drowned_siren'] },
  { count: 16, attach: 6, bias: [1, 1],   bosses: ['demon_smith', 'orc_warlord'] },
  { count: 17, attach: 2, bias: [1, 0],   bosses: ['flesh_abomination', 'fenrir'] },
  { count: 15, attach: 4, bias: [0, 1],   bosses: ['void_knight', 'nightlord'] },
];
const GATE = [null, null, 'doubleJump', 'sprint', 'mist', 'spikes', 'gravity', 'lava', 'key:crimson_key', 'key:abyss_key'];
// Abilities the player has while exploring each zone.
const ZAB = [{}];
{
  const acc = {};
  for (let z = 1; z <= 9; z++) {
    const g = GATE[z];
    if (g && !g.startsWith('key')) acc[g] = true;
    ZAB[z] = { ...acc };
  }
}

// ---------------------------------------------------------------- layout
const cells = new Map();     // "cx,cy" -> room
const rooms = [];            // all generated rooms
const links = [];            // connections
const free = (cx, cy) => cx >= 0 && cx <= 48 && cy >= -22 && cy <= 22 && !cells.has(`${cx},${cy}`);

function place(room) {
  for (let x = 0; x < room.w; x++) for (let y = 0; y < room.h; y++) cells.set(`${room.cx + x},${room.cy + y}`, room);
  rooms.push(room);
}
function fits(cx, cy, w, h) {
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (!free(cx + x, cy + y)) return false;
  return true;
}
function link(a, b, cellA, cellB, opt = {}) {
  const L = { a, b, cellA, cellB, ...opt };
  links.push(L);
  return L;
}
// Shared boundary cell pairs between room a and a candidate rect.
function sharedPairs(a, cx, cy, w, h) {
  const out = [];
  for (let x = 0; x < a.w; x++) for (let y = 0; y < a.h; y++) {
    const ax = a.cx + x, ay = a.cy + y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const bx = ax + dx, by = ay + dy;
      if (bx >= cx && bx < cx + w && by >= cy && by < cy + h) out.push([[ax, ay], [bx, by], dx !== 0 ? 'h' : 'v']);
    }
  }
  return out;
}

const SIZES = [[1, 1, 18], [2, 1, 24], [3, 1, 14], [1, 2, 14], [2, 2, 10], [4, 1, 8], [1, 3, 6], [3, 2, 6]];
function randSize(zone) {
  const tall = zone === 5 || zone === 3;
  const tot = SIZES.reduce((s, [w, h, p]) => s + p * (tall && h > 1 ? 2 : 1), 0);
  let r = R() * tot;
  for (const [w, h, p] of SIZES) { r -= p * (tall && h > 1 ? 2 : 1); if (r <= 0) return [w, h]; }
  return [1, 1];
}

let uid = 0;
function newRoom(zone, kind, cx, cy, w, h, extra = {}) {
  return { id: `z${zone}_${String(uid++).padStart(3, '0')}`, zone, kind, cx, cy, w, h, ...extra };
}

// Attach a new room of size w x h to room `base`. Returns the room or null.
function attach(base, zone, kind, w, h, opt = {}) {
  const tries = [];
  const sides = opt.horizontalOnly ? ['r', 'l'] : ['r', 'l', 'u', 'd'];
  for (const side of sides) {
    for (let off = -(side === 'r' || side === 'l' ? h - 1 : w - 1); off < (side === 'r' || side === 'l' ? base.h : base.w); off++) {
      let cx, cy;
      if (side === 'r') { cx = base.cx + base.w; cy = base.cy + off; }
      if (side === 'l') { cx = base.cx - w; cy = base.cy + off; }
      if (side === 'd') { cx = base.cx + off; cy = base.cy + base.h; }
      if (side === 'u') { cx = base.cx + off; cy = base.cy - h; }
      if (!fits(cx, cy, w, h)) continue;
      let pairs = sharedPairs(base, cx, cy, w, h);
      if (opt.horizontalOnly) pairs = pairs.filter((p) => p[2] === 'h');
      if (base.allowCells) pairs = pairs.filter(([ca]) => base.allowCells(ca));
      if (!pairs.length) continue;
      const b = opt.bias || [0, 0];
      const score = (side === 'r' ? b[0] : side === 'l' ? -b[0] : side === 'd' ? b[1] : -b[1]) + R() * 1.2;
      tries.push({ cx, cy, pairs, score });
    }
  }
  if (!tries.length) return null;
  tries.sort((p, q) => q.score - p.score);
  const t = tries[0];
  const room = newRoom(zone, kind, t.cx, t.cy, w, h, opt.extra || {});
  if (room.allowCellsFn) room.allowCells = room.allowCellsFn(room);
  let pairs = t.pairs;
  if (room.allowCells) pairs = pairs.filter(([, cb]) => room.allowCells(cb, true));
  if (!pairs.length) return null;
  place(room);
  const [ca, cb, dir] = pickR(pairs);
  link(base, room, ca, cb, { dir, ...(opt.link || {}) });
  return room;
}

// The hand-built passage from the Sword Sanctum ends at world tile x=156,
// y=20-21 which is cell (0,0) level 0 left door.
const PASSAGE = { id: 'sanctum_passage', zone: 1, kind: 'passage' };

function layoutZone(z) {
  const P = PLAN[z];
  const zoneRooms = [];
  let gate;
  const gateKind = GATE[z];
  if (z === 1) {
    gate = newRoom(1, 'normal', 0, 0, 2, 1);
    place(gate);
    link(PASSAGE, gate, null, [0, 0], { dir: 'h', passage: true });
  } else {
    // Gate room: attached horizontally to a room of the parent zone.
    const parents = rooms.filter((r) => r.zone === P.attach && r.kind === 'normal');
    parents.sort((a, b) => (b.cx * P.bias[0] + b.cy * P.bias[1]) - (a.cx * P.bias[0] + a.cy * P.bias[1]) + (R() - 0.5) * 4);
    const grav = gateKind === 'gravity';
    const [gw, gh] = grav ? [2, 2] : [3, 1];
    for (const par of parents) {
      gate = attach(par, z, 'gate', gw, gh, {
        horizontalOnly: true, bias: P.bias,
        extra: { gateKind, allowCellsFn: (room) => (cell, incoming) => incoming ? (!grav || cell[1] === room.cy + 1) : true },
      });
      if (gate) break;
    }
    if (!gate) throw new Error(`no room for zone ${z} gate`);
    // Other doors of a gate room must be past the gate.
    const inLink = links[links.length - 1];
    const inCell = inLink.cellB;
    gate.inCell = inCell;
    gate.inSide = inCell[0] === gate.cx ? 'left' : 'right';
    gate.allowCells = (cell) => {
      if (grav) return cell[1] === gate.cy && !(cell[0] === inCell[0] && false);
      return Math.abs(cell[0] - inCell[0]) >= 1;
    };
  }
  zoneRooms.push(gate);
  const secrets = 2;
  const normals = P.count - P.bosses.length - secrets - 1;
  let guard = 0;
  while (zoneRooms.filter((r) => r.kind !== 'secret').length < 1 + normals && guard++ < 2000) {
    const bases = zoneRooms.filter((r) => r.kind === 'normal' || r.kind === 'gate');
    bases.sort((a, b) => (b.cx * P.bias[0] + b.cy * P.bias[1]) - (a.cx * P.bias[0] + a.cy * P.bias[1]));
    const base = R() < 0.6 ? bases[Math.floor(R() * Math.min(4, bases.length))] : pickR(bases);
    const [w, h] = randSize(z);
    const room = attach(base, z, 'normal', w, h, { bias: P.bias });
    if (room) zoneRooms.push(room);
  }
  if (zoneRooms.length < 1 + normals) throw new Error(`zone ${z}: only placed ${zoneRooms.length}`);
  // Boss arenas: the last one at the far end, a middle one halfway.
  const depth = bfsDepth(gate);
  const byDepth = zoneRooms.filter((r) => r.kind === 'normal').sort((a, b) => depth.get(b) - depth.get(a));
  P.bosses.forEach((bossId, i) => {
    const want = i === P.bosses.length - 1 ? 0 : Math.floor(byDepth.length / 2);
    for (let k = 0; k < byDepth.length; k++) {
      const base = byDepth[(want + k) % byDepth.length];
      const room = attach(base, z, 'boss', 2, 1, { horizontalOnly: true, bias: P.bias, extra: { bossId } });
      if (room) { zoneRooms.push(room); return; }
    }
    throw new Error(`zone ${z}: no room for boss ${bossId}`);
  });
  // Secret rooms behind breakable walls.
  for (let i = 0; i < secrets; i++) {
    let ok = false;
    for (let k = 0; k < 60 && !ok; k++) {
      const base = pickR(zoneRooms.filter((r) => r.kind === 'normal'));
      const room = attach(base, z, 'secret', 1, 1, { horizontalOnly: true, bias: [R() - 0.5, 0], link: { secret: true } });
      if (room) { zoneRooms.push(room); ok = true; }
    }
    if (!ok) throw new Error(`zone ${z}: no room for secret`);
  }
  // A few extra loops between neighbouring rooms.
  const normalsOnly = zoneRooms.filter((r) => r.kind === 'normal');
  for (const a of normalsOnly) {
    for (const b of normalsOnly) {
      if (a.id >= b.id || R() > 0.22) continue;
      if (links.some((L) => (L.a === a && L.b === b) || (L.a === b && L.b === a))) continue;
      const pairs = sharedPairs(a, b.cx, b.cy, b.w, b.h);
      if (pairs.length) { const [ca, cb, dir] = pickR(pairs); link(a, b, ca, cb, { dir }); }
    }
  }
  return zoneRooms;
}

function bfsDepth(start) {
  const d = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const r = q.shift();
    for (const L of links) {
      const o = L.a === r ? L.b : L.b === r ? L.a : null;
      if (!o || o === PASSAGE || d.has(o) || o.kind === 'secret' || o.kind === 'boss') continue;
      d.set(o, d.get(r) + 1);
      q.push(o);
    }
  }
  return d;
}

for (let z = 1; z <= 9; z++) {
  const zr = layoutZone(z);
  log(`zone ${z} ${ZONES[z].name}: ${zr.length} rooms`);
}
log(`layout: ${rooms.length} rooms, ${links.length} links`);
if (process.argv.includes("--layout-only")) process.exit(0);

// ---------------------------------------------------------------- interiors
// Door descriptors per room, in local terms.
function doorsOf(room) {
  const out = [];
  for (const L of links) {
    let mine, other, cellMine, cellOther;
    if (L.a === room) { mine = L.cellA; other = L.b; cellOther = L.cellB; }
    else if (L.b === room) { mine = L.cellB; other = L.a; cellOther = L.cellA; }
    else continue;
    if (L.passage) { out.push({ side: 'left', level: 0, other: 'sanctum_passage', link: L }); continue; }
    const lx = mine[0] - room.cx, ly = mine[1] - room.cy;
    const dx = cellOther[0] - mine[0], dy = cellOther[1] - mine[1];
    const d = { link: L, other: other.id, lx, ly, secret: L.secret, breakHere: L.secret && other.kind === 'secret' };
    if (dx === 1) Object.assign(d, { side: 'right', level: ly });
    if (dx === -1) Object.assign(d, { side: 'left', level: ly });
    if (dy === 1) Object.assign(d, { side: 'bottom', col: lx });
    if (dy === -1) Object.assign(d, { side: 'top', col: lx });
    out.push(d);
  }
  return out;
}

// Hole columns for a vertical link are chosen once per link so both rooms agree.
function holeCol(L) {
  if (L.hole === undefined) L.hole = ri(4, CW - 7);
  return L.hole;
}

function build(room, attempt) {
  const W = room.w * CW, H = room.h * CH;
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? '#' : g[y][x]);
  const protect = Array.from({ length: room.h }, () => new Set());
  const prot = (k, a, b) => { for (let x = a; x <= b; x++) protect[k].add(x); };
  const fy = (k) => k * CH + 8;
  const top = (k) => (k === 0 ? 1 : k * CH);
  const Z = ZONES[room.zone];
  const hazard = room.zone === 7 ? 'L' : '^';
  const chests = [], enemies = [], decor = [], items = [];
  const meta = {};
  const lvlOf = (row) => Math.floor(row / CH);

  for (let k = 0; k < room.h; k++) for (let y = top(k); y <= k * CH + 7; y++) for (let x = 1; x < W - 1; x++) set(x, y, '.');

  const doors = doorsOf(room);
  for (const d of doors) {
    if (d.side === 'left' || d.side === 'right') {
      const x = d.side === 'left' ? 0 : W - 1;
      const k = d.level;
      const ch = d.breakHere ? 'B' : '.';
      set(x, fy(k) - 2, ch); set(x, fy(k) - 1, ch);
      if (d.breakHere) { set(x + (d.side === 'left' ? 1 : -1), fy(k) - 2, '.'); }
      prot(k, d.side === 'left' ? 0 : W - 5, d.side === 'left' ? 4 : W - 1);
      d.start = [d.side === 'left' ? 1 : W - 2, fy(k)];
      d.exit = [d.side, fy(k) - 3, fy(k)];
    } else {
      const hc = d.col * CW + holeCol(d.link);
      if (d.side === 'top') {
        for (let x = hc; x < hc + 3; x++) { set(x, 0, '.'); set(x, 1, '='); set(x, 3, '='); set(x, 5, '='); set(x, 7, '='); }
        prot(0, hc - 2, hc + 4);
        d.start = [hc + 1, 1];
        d.exit = ['top', hc, hc + 2];
      } else {
        for (let x = hc; x < hc + 3; x++) { set(x, H - 2, '.'); set(x, H - 1, '='); }
        prot(room.h - 1, hc - 2, hc + 4);
        d.start = [hc + 1, H - 1];
        d.exit = ['bottom', hc, hc + 2];
      }
    }
  }

  // Internal connections between levels.
  const gravGate = room.kind === 'gate' && room.gateKind === 'gravity';
  for (let k = 0; k < room.h - 1; k++) {
    let hc;
    for (let t = 0; t < 40; t++) {
      hc = ri(3, W - 6);
      let ok = true;
      for (let x = hc - 2; x <= hc + 4; x++) if (protect[k].has(x) || protect[k + 1].has(x)) ok = false;
      if (ok) break;
    }
    for (let x = hc; x < hc + 3; x++) {
      set(x, fy(k), '.'); set(x, fy(k) + 1, '=');
      if (!gravGate || k !== 0) for (const r of [1, 3, 5, 7]) set(x, (k + 1) * CH + r, '=');
    }
    prot(k, hc - 2, hc + 4); prot(k + 1, hc - 2, hc + 4);
    if (gravGate && k === 0) meta.gravHole = hc;
  }

  // Key gates: a locked door across the entry hall, a few steps inside.
  if (room.kind === 'gate' && room.gateKind?.startsWith('key')) {
    const left = room.inSide === 'left';
    const k = room.inCell[1] - room.cy;
    const x = left ? 4 : W - 5;
    for (let y = top(k); y < fy(k) - 2; y++) set(x, y, '#');
    set(x, fy(k) - 2, 'D'); set(x, fy(k) - 1, 'D');
    prot(k, 0, W - 1);
  }
  // Ability gates (first room of a zone).
  if (room.kind === 'gate' && !room.gateKind?.startsWith('key') && room.gateKind !== 'gravity') {
    const left = room.inSide === 'left';
    const k = room.inCell[1] - room.cy;
    const X = (x) => (left ? x : W - 1 - x);
    const kind = room.gateKind;
    const f = fy(k), t0 = top(k);
    if (kind === 'doubleJump') {
      for (let x = 10; x <= 11; x++) for (let y = f - 4; y < f; y++) set(X(x), y, '#');
    } else if (kind === 'mist') {
      for (let y = t0; y < f; y++) set(X(12), y, 'G');
    } else if (kind === 'sprint') {
      // A pit too wide to cross without a sprinting double jump.
      for (let x = 8; x < 8 + room.gateWidth; x++) set(X(x), f, '^');
    } else {
      // A long hazard floor under a low ceiling: only immunity gets you through.
      const width = room.gateWidth;
      for (let x = 6; x < 6 + width; x++) set(X(x), f, kind === 'lava' ? 'L' : '^');
      for (let x = 3; x < 6 + width + 3; x++) for (let y = t0; y <= f - 3; y++) set(X(x), y, '#');
    }
    prot(k, 0, W - 1);
  }

  // Boss arena: a flat floor with a pair of ledges.
  if (room.kind === 'boss') {
    for (let k = 0; k < room.h; k++) prot(k, 0, W - 1);
    for (const x of [8, 9, 10, W - 11, W - 10, W - 9]) set(x, 4, '=');
    meta.boss = { id: room.bossId, x: Math.floor(W / 2) + 2, y: BOSSES[room.bossId].t === 'harpy' || BOSSES[room.bossId].t === 'banshee' || BOSSES[room.bossId].t === 'wraith' ? 4 : fy(0), floor: fy(0) };
  }

  // Features along each level.
  const rich = attempt < 3 ? 1 : attempt < 5 ? 0.5 : 0;
  if (room.kind === 'normal' || room.kind === 'gate') {
    for (let k = 0; k < room.h; k++) {
      if (room.kind === 'gate' && k === room.inCell[1] - room.cy) continue;
      if (gravGate && k === 1) continue;
      const f = fy(k);
      let x = 3;
      while (x < W - 5) {
        const free = (a, b) => { for (let i = a; i <= b; i++) if (protect[k].has(i) || i < 1 || i > W - 2) return false; return true; };
        const r = R();
        if (r < 0.28 * rich && free(x, x + 4)) {
          const w = room.zone >= 3 ? ri(2, 4) : ri(2, 3);
          for (let i = x + 1; i <= x + w; i++) set(i, f, hazard);
          if (w === 4) { set(x + 2, f - 2, '='); set(x + 3, f - 2, '='); }
          x += w + 3;
        } else if (r < 0.45 * rich && free(x, x + 3)) {
          const hgt = room.zone >= 2 && R() < 0.5 ? 3 : ri(1, 2);
          const w = ri(2, 3);
          for (let i = x; i < x + w; i++) for (let y = f - hgt; y < f; y++) set(i, y, '#');
          x += w + 3;
        } else if (r < 0.65 * rich && free(x, x + 5)) {
          const y = f - (room.zone >= 2 ? ri(2, 3) : 2);
          const w = ri(3, 5);
          for (let i = x; i < x + w; i++) set(i, y, '=');
          if (R() < 0.5) chests.push({ x: x + 1, y });
          x += w + 2;
        } else if (r < 0.72 && free(x, x + 3) && top(k) + 2 < f - 4) {
          for (let i = x; i < x + ri(2, 4); i++) set(i, top(k), '#');
          x += 5;
        } else {
          x += ri(2, 4);
        }
      }
    }
  }

  // Treasure pockets that need an ability from later in the castle.
  const pocketKinds = [];
  if (room.zone <= 1) pocketKinds.push('ledge');
  if (room.zone >= 2 && room.zone <= 5) pocketKinds.push('high');
  if (room.zone <= 3) pocketKinds.push('grate');
  if (room.zone <= 4) pocketKinds.push('spiketunnel');
  if (room.zone <= 6) pocketKinds.push('lavatunnel');
  if (room.kind === 'normal' && attempt < 4 && R() < 0.4 && pocketKinds.length) {
    const kind = pickR(pocketKinds);
    for (let k = 0; k < room.h && !meta.pocket; k++) {
      for (const side of ['left', 'right']) {
        if (doors.some((d) => d.side === side && d.level === k)) continue;
        const X = (x) => (side === 'left' ? x : W - 1 - x);
        const span = kind.endsWith('tunnel') ? 15 : 6;
        let ok = true;
        for (let x = 1; x <= span; x++) if (protect[k].has(X(x))) ok = false;
        if (!ok) continue;
        const f = fy(k), t0 = top(k);
        for (let x = 1; x <= span; x++) for (let y = t0; y < f; y++) set(X(x), y, '.');
        for (let x = 1; x <= span; x++) set(X(x), f, '#');
        if (kind === 'ledge') { for (let x = 1; x <= 3; x++) set(X(x), f - 4, '#'); chests.push({ x: X(2), y: f - 4, pocket: 'doubleJump' }); }
        if (kind === 'high') { for (let x = 1; x <= 3; x++) set(X(x), t0 + 1, '#'); chests.push({ x: X(2), y: t0 + 1, pocket: 'gravity' }); }
        if (kind === 'grate') { for (let y = t0; y < f; y++) set(X(4), y, 'G'); chests.push({ x: X(2), y: f, pocket: 'mist' }); }
        if (kind.endsWith('tunnel')) {
          const hz = kind === 'lavatunnel' ? 'L' : '^';
          for (let x = 4; x <= 13; x++) set(X(x), f, hz);
          for (let x = 3; x <= 14; x++) for (let y = t0; y <= f - 3; y++) set(X(x), y, '#');
          chests.push({ x: X(2), y: f, pocket: kind === 'lavatunnel' ? 'lava' : 'spikes' });
        }
        for (let x = 1; x <= span; x++) protect[k].add(X(x));
        meta.pocket = kind;
        break;
      }
    }
  }

  // Most rooms hide at least one chest somewhere on the floor.
  if ((room.kind === 'normal') && !chests.some((c) => !c.pocket) && R() < 0.7) {
    for (let tries = 0; tries < 40; tries++) {
      const k = ri(0, room.h - 1), x = ri(2, W - 3), y = fy(k);
      if (protect[k].has(x) || at(x, y) !== '#' || at(x, y - 1) !== '.' || at(x, y - 2) !== '.') continue;
      chests.push({ x, y });
      break;
    }
  }
  if (room.kind === 'secret') {
    const d = doors[0];
    const x = d.side === 'left' ? W - 4 : 3;
    chests.push({ x, y: fy(0), secret: true });
  }

  // Enemies.
  if (room.kind === 'normal' || room.kind === 'gate') {
    const n = Math.max(1, Math.min(7, Math.round(room.w * room.h * 1.5 + R() * 1.5 - (room.kind === 'gate' ? 2 : 0))));
    for (let i = 0; i < n; i++) {
      const [t, v] = pickR(Z.foes);
      const air = ['flyer', 'floater'].includes(ENEMY_TYPES[t].ai);
      for (let tries = 0; tries < 30; tries++) {
        const k = ri(0, room.h - 1), x = ri(4, W - 5);
        if (protect[k].has(x) && room.kind !== 'gate') continue;
        if (room.kind === 'gate' && k === room.inCell[1] - room.cy) {
          const near = room.inSide === 'left' ? x < 20 : x > W - 21;
          if (near) continue;
        }
        if (air) {
          const y = top(k) + ri(1, 3);
          if (at(x, y) !== '.') continue;
          enemies.push({ t, x, y, ...(v ? { v } : {}) });
        } else {
          const y = fy(k);
          if (!'#='.includes(at(x, y)) || at(x, y - 1) !== '.' || at(x, y - 2) !== '.') continue;
          if (at(x - 1, y) === '^' || at(x + 1, y) === '^' || at(x - 1, y) === 'L' || at(x + 1, y) === 'L') continue;
          enemies.push({ t, x, y, ...(v ? { v } : {}) });
        }
        break;
      }
    }
  }

  // Decorations that make sense: things on walls, on floors, hanging from ceilings.
  const D = Z.decor;
  const used = new Set();
  const freeCell = (x, y) => at(x, y) === '.' && !used.has(`${x},${y}`);
  const addDecor = (t, x, y, s = 1) => {
    for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) if (!freeCell(x + i, y + j)) return false;
    for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) used.add(`${x + i},${y + j}`);
    decor.push(s > 1 ? { t, x, y, s } : { t, x, y });
    return true;
  };
  for (const c of chests) used.add(`${c.x},${c.y - 1}`);
  if (D) {
    for (let k = 0; k < room.h; k++) {
      const f = fy(k), t0 = top(k);
      for (let x = 2 + ri(0, 3); x < W - 3; x += ri(5, 9)) {
        const t = pickR(D.wall);
        if (t === 'waterfall' || t === 'waterfall_2' || t === 'lavafall') {
          let ok = true;
          for (let y = t0; y < f; y++) if (!freeCell(x, y) || at(x, t0 - 1) !== '#') ok = false;
          if (ok && at(x, f) === '#') for (let y = t0; y < f; y++) addDecor(t, x, y);
          continue;
        }
        const big = t.startsWith('window') && R() < 0.5;
        addDecor(t, x, t0 + ri(1, 2), big ? 2 : 1);
      }
      for (let x = 3 + ri(0, 4); x < W - 3; x += ri(6, 11)) {
        const t = pickR(D.floor);
        const big = ['statue', 'coffin_alcove', 'statue_alcove', 'clock'].includes(t) && R() < 0.4;
        const s = big ? 2 : 1;
        let ok = true;
        for (let i = 0; i < s; i++) if (at(x + i, f - s + 1 + (s - 1)) !== '.' || at(x + i, f) !== '#') ok = false;
        if (ok) addDecor(t, x, f - s, s);
      }
      for (let x = 2 + ri(0, 5); x < W - 3; x += ri(7, 12)) {
        const t = pickR(D.hang);
        const big = t.startsWith('chandelier') && R() < 0.5;
        const s = big ? 2 : 1;
        let ok = true;
        for (let i = 0; i < s; i++) if (at(x + i, t0 - 1) !== '#') ok = false;
        if (ok) addDecor(t, x, t0, s);
      }
    }
  }

  return { grid: g.map((r) => r.join('')), W, H, doors, chests, enemies, decor, items, meta };
}

// ---------------------------------------------------------------- validation
function starts(doors, d) { return [d.start]; }
function exitReached(found, d) { return reachedExit(found, d.exit[0], d.exit[1], d.exit[2]); }
function chestBox(c) { return { x: c.x * 32 + 4, y: c.y * 32 - 20, w: 24, h: 20 }; }

function validate(room, b) {
  const def = { map: b.grid, id: room.id };
  const ab = { ...ZAB[room.zone] };
  const doors = b.doors.filter((d) => d.start);
  const normalDoors = doors.filter((d) => !d.breakHere);
  if (!doors.length) return 'no doors';
  const targets = b.chests.map((c, i) => ({ id: `chest${i}`, box: chestBox(c), c }));
  if (room.kind === 'gate') {
    const inD = doors.find((d) => d.side === room.inSide && d.level === room.inCell[1] - room.cy);
    const others = normalDoors.filter((d) => d !== inD);
    const g = room.gateKind;
    const isKey = g.startsWith('key');
    const without = { ...ab };
    if (!isKey) delete without[g];
    const r0 = explore(def, { starts: [inD.start], abilities: without, openDoors: !isKey });
    if (isKey) {
      if (others.some((d) => exitReached(r0.found, d))) return 'key gate leaks';
    } else if (others.some((d) => exitReached(r0.found, d))) return `gate ${g} can be bypassed`;
    const r1 = explore(def, { starts: [inD.start], abilities: ab, openDoors: true });
    for (const d of others) if (!exitReached(r1.found, d)) return `gate ${g}: door ${d.side} unreachable with ability`;
    for (const d of others) {
      const r = explore(def, { starts: [d.start], abilities: ab, openDoors: true });
      if (!exitReached(r.found, inD)) return `gate: cannot return from ${d.side}`;
    }
  } else if (room.kind !== 'passage') {
    const d0 = normalDoors[0] || doors[0];
    const r = explore(def, { starts: [d0.start], abilities: ab, targets: targets.filter((t) => !t.c.pocket), openBreakables: true });
    for (const d of doors) if (d !== d0 && !exitReached(r.found, d)) return `door ${d.side}${d.level ?? d.col} unreachable from ${d0.side}`;
    for (const t of targets) if (!t.c.pocket && !r.found.has(t.id)) return `chest ${t.id} unreachable`;
    for (const d of doors) {
      if (d === d0) continue;
      const rr = explore(def, { starts: [d.start], abilities: ab, openBreakables: true });
      if (!exitReached(rr.found, d0)) return `cannot return from ${d.side}`;
    }
    // Pockets: need their ability, reachable with it.
    for (const t of targets.filter((q) => q.c.pocket)) {
      const pa = t.c.pocket;
      const withA = { ...ZAB[9], [pa]: true };
      const rw = explore(def, { starts: [d0.start], abilities: withA, targets: [t], need: new Set([t.id]), openBreakables: true });
      if (!rw.found.has(t.id)) return `pocket ${pa} unreachable even with it`;
      const withoutA = { ...ab };
      delete withoutA[pa];
      const rn = explore(def, { starts: [d0.start], abilities: withoutA, targets: [t], need: new Set([t.id]), openBreakables: true });
      if (rn.found.has(t.id)) return `pocket ${pa} reachable without it`;
    }
  }
  return null;
}

// Auto-tune width of width-based gates, then build + validate each room.
const built = new Map();
let fails = 0;
const t0 = Date.now();
for (const [i, room] of rooms.entries()) {
  let ok = false, why = '';
  const widths = room.kind === 'gate' && ['sprint', 'spikes', 'lava'].includes(room.gateKind)
    ? (room.gateKind === 'sprint' ? [7, 8, 9, 10] : [10, 12, 14]) : [null];
  for (let attempt = 0; attempt < 8 && !ok; attempt++) {
    for (const gw of widths) {
      room.gateWidth = gw;
      const b = build(room, attempt);
      why = validate(room, b);
      if (!why) { built.set(room, b); ok = true; break; }
    }
  }
  if (!ok) { fails++; log(`  FAIL ${room.id} (${room.kind} ${room.w}x${room.h} z${room.zone}): ${why}`); }
  if (i % 10 === 0) log(`  built ${i + 1}/${rooms.length}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
if (fails) { log(`${fails} rooms failed validation`); process.exit(1); }

// ---------------------------------------------------------------- loot
// Special items go to pockets and secret rooms; everything else is rolled.
const specials = {
  1: ['life_vessel', 'mana_vessel', 'fire_orb'], 2: ['life_vessel', 'ice_lance', 'emberheart', 'mana_vessel'],
  3: ['life_vessel', 'holy_cross', 'gorgonblade', 'wyrmfang'], 4: ['life_vessel', 'mana_vessel', 'kraken_s_tooth', 'ossuary_maul'],
  5: ['life_vessel', 'thunder_call', 'moonfang', 'nightreaver'], 6: ['life_vessel', 'mana_vessel', 'soul_drain', 'thunderclap', 'starfall'],
  7: ['life_vessel', 'bat_swarm', 'hellreaver', 'sunspear'], 8: ['life_vessel', 'mana_vessel', 'meteor', 'frostmourne_edge', 'cathedral_s_wrath'],
  9: ['life_vessel', 'mana_vessel', 'eclipse', 'aurelion'],
};
const LR = mulberry32(SEED + 99);
let chestN = 0;
for (const [room, b] of built) {
  const Z = ZONES[room.zone];
  const pool = specials[room.zone];
  for (const c of b.chests) {
    c.id = `chest_${room.id}_${chestN++}`;
    if ((c.pocket || c.secret) && pool.length) { c.item = pool.shift(); c.rare = true; }
    else c.item = rollItem(Math.min(9, Z.tier + (c.pocket || c.secret ? 2 : 0)), LR);
  }
}
// The Requiem: deepest secret room.
const lastSecret = [...built.keys()].filter((r) => r.zone === 9 && r.kind === 'secret').pop();
built.get(lastSecret).chests[0].item = 'requiem';
built.get(lastSecret).chests[0].rare = true;
// Leftover specials go into ordinary chests of their zone, deepest rooms first.
for (const z of Object.keys(specials)) {
  const pool = specials[z];
  const spots = [...built.entries()].filter(([r]) => r.zone === +z && r.kind === 'normal')
    .flatMap(([r, b]) => b.chests.filter((c) => !c.rare).map((c) => ({ r, c })))
    .sort((p, q) => (q.r.cx + Math.abs(q.r.cy)) - (p.r.cx + Math.abs(p.r.cy)));
  while (pool.length && spots.length) { const { c } = spots.shift(); c.item = pool.shift(); c.rare = true; }
  if (pool.length) log(`  (zone ${z} had no spot for: ${pool.join(', ')})`);
}

// ---------------------------------------------------------------- emit
const nameUse = {};
function roomName(room) {
  const Z = ZONES[room.zone];
  if (room.kind === 'boss') return `${BOSSES[room.bossId].name}'s Lair`;
  if (room.kind === 'secret') return pickR(['Hidden Alcove', 'Forgotten Cell', 'Sealed Reliquary', 'Walled-up Chamber', 'Secret Vault']);
  const list = Z.rooms;
  const k = (nameUse[room.zone] = (nameUse[room.zone] || 0) + 1) - 1;
  const n = list[k % list.length];
  return k >= list.length ? `${n} II` : n;
}

const out = {};
out.sanctum_passage = {
  name: 'Sanctum Passage', zone: 1, x: 116, y: 16,
  map: [
    '########################################',
    '########################################',
    '#......................................#',
    '#......................................#',
    '........................................',
    '........................................',
    '########################################',
    '########################################',
  ],
  decor: [{ t: 'torch', x: 8, y: 2 }, { t: 'torch', x: 20, y: 2 }, { t: 'torch', x: 32, y: 2 }],
  items: [], movers: [], enemies: [{ t: 'skeleton', x: 22, y: 6, m: 1.1 }], chests: [],
};
for (const [room, b] of built) {
  const def = {
    name: roomName(room), zone: room.zone, x: OX + room.cx * CW, y: OY + room.cy * CH,
    map: b.grid, decor: b.decor, items: b.items, movers: [], enemies: b.enemies,
    chests: b.chests.map(({ x, y, id, item, rare }) => ({ id, x, y, item, ...(rare ? { rare: true } : {}) })),
  };
  if (b.meta.boss) def.boss = b.meta.boss;
  if (room.kind === 'gate' && room.gateKind.startsWith('key')) {
    const key = room.gateKind.split(':')[1];
    def.door = { flag: `door_${room.id}`, key };
  }
  out[room.id] = def;
}
const total = Object.keys(out).length;
const js = `// Generated by tools/gen_castle.mjs (seed ${SEED}) -- ${total} rooms. Regenerate rather than edit by hand.\n` +
  `export const CASTLE_ROOMS = ${JSON.stringify(out)};\n`;
writeFileSync(new URL('../src/castle.js', import.meta.url), js);
log(`wrote src/castle.js: ${total} rooms, ${(js.length / 1024).toFixed(0)} KB, in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
