// Placement lint for room art and enemies:
//   node tools/lint_rooms.mjs
// - floor objects (statues, candelabras, clocks...) must stand on solid ground
// - hanging objects (chandeliers, banners, chains, curtains) must hang from a ceiling
// - nothing may overlap walls, platforms, hazards, pedestals or other decor
// - enemies must start standing on ground (walkers) or in open air (flyers)
import { ROOMS } from '../src/rooms.js';
import { TILE_INDEX } from '../src/tileIndex.js';
import { ENEMY_TYPES } from '../src/enemies.js';

const FLOOR = new Set(['statue', 'gargoyle', 'gargoyle_2', 'gargoyle_head', 'candelabra', 'clock', 'barrel', 'sack',
  'crate', 'crates', 'bookshelf', 'fireplace', 'statue_alcove', 'coffin_alcove', 'iron_fence', 'fence', 'balustrade', 'column']);
const HANG = new Set(['chandelier', 'chandelier_2', 'chains', 'banner_blue', 'banner_lion', 'banner_red', 'curtain', 'curtain_torn']);

let problems = 0;
const bad = (room, msg) => { problems++; console.log(`  ${room}: ${msg}`); };

for (const [id, r] of Object.entries(ROOMS)) {
  const m = r.map, H = m.length, W = m[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? '#' : m[y][x]);
  const used = new Map();
  for (const it of r.items || []) { used.set(`${it.x},${it.y - 1}`, 'pedestal'); used.set(`${it.x},${it.y - 2}`, 'item'); }
  for (const d of r.decor || []) {
    const s = d.s || 1;
    const tag = `${d.t}@${d.x},${d.y}`;
    if (TILE_INDEX[d.t] === undefined) bad(id, `${tag} unknown tile`);
    for (let y = d.y; y < d.y + s; y++) {
      for (let x = d.x; x < d.x + s; x++) {
        if (at(x, y) !== '.') bad(id, `${tag} overlaps '${at(x, y)}' at ${x},${y}`);
        const k = `${x},${y}`;
        if (used.has(k)) bad(id, `${tag} overlaps ${used.get(k)} at ${k}`);
        used.set(k, tag);
      }
    }
    if (FLOOR.has(d.t)) {
      for (let x = d.x; x < d.x + s; x++) if (!'#C'.includes(at(x, d.y + s))) bad(id, `${tag} is not standing on the floor (below ${x},${d.y + s} is '${at(x, d.y + s)}')`);
    }
    if (HANG.has(d.t)) {
      for (let x = d.x; x < d.x + s; x++) if (at(x, d.y - 1) !== '#') bad(id, `${tag} is not hanging from a ceiling (above ${x},${d.y - 1} is '${at(x, d.y - 1)}')`);
    }
  }
  for (const e of r.enemies || []) {
    const t = ENEMY_TYPES[e.t];
    const tag = `enemy ${e.t}@${e.x},${e.y}`;
    if (!t) { bad(id, `${tag} unknown type`); continue; }
    const air = t.ai === 'flyer' || t.ai === 'floater';
    if (air) {
      if (at(e.x, e.y) !== '.') bad(id, `${tag} starts inside '${at(e.x, e.y)}'`);
    } else {
      if (!'#=C'.includes(at(e.x, e.y))) bad(id, `${tag} has no ground under it ('${at(e.x, e.y)}')`);
      if (at(e.x, e.y - 1) !== '.') bad(id, `${tag} starts inside '${at(e.x, e.y - 1)}'`);
    }
  }
}
console.log(problems ? `${problems} placement problem(s)` : 'all placements ok');
process.exit(problems ? 1 : 0);
