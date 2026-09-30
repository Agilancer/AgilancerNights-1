// Structural checks over the whole castle:
//   node tools/check_castle.mjs
// - every opening in a room's outer wall leads into a neighbouring room's
//   open cell (no doors into rock, no doors to nowhere)
// - rooms don't overlap
// - every room can be reached from the start by walking the door graph
import { ROOMS, START } from '../src/rooms.js';

const rects = Object.entries(ROOMS).map(([id, r]) => ({ id, x: r.x, y: r.y, w: r.map[0].length, h: r.map.length, r }));
const at = (wx, wy) => {
  for (const q of rects) if (wx >= q.x && wx < q.x + q.w && wy >= q.y && wy < q.y + q.h) return [q, q.r.map[wy - q.y][wx - q.x]];
  return [null, null];
};
let bad = 0;
for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
  const a = rects[i], b = rects[j];
  if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) { bad++; console.log('overlap', a.id, b.id); }
}
const edges = new Map(rects.map((q) => [q.id, new Set()]));
const open = (c) => c && c !== '#';
for (const q of rects) {
  const m = q.r.map;
  const check = (lx, ly, dx, dy) => {
    const c = m[ly][lx];
    if (!open(c) || c === 'D' && false) return;
    const [o, oc] = at(q.x + lx + dx, q.y + ly + dy);
    if (!o) { bad++; console.log(`${q.id}: opening at ${lx},${ly} leads out of the world`); return; }
    if (!open(oc)) { bad++; console.log(`${q.id}: opening at ${lx},${ly} leads into rock of ${o.id}`); return; }
    edges.get(q.id).add(o.id);
  };
  for (let x = 0; x < q.w; x++) { check(x, 0, 0, -1); check(x, q.h - 1, 0, 1); }
  for (let y = 0; y < q.h; y++) { check(0, y, -1, 0); check(q.w - 1, y, 1, 0); }
}
const seen = new Set([START.room]);
const queue = [START.room];
while (queue.length) for (const n of edges.get(queue.shift())) if (!seen.has(n)) { seen.add(n); queue.push(n); }
const lost = rects.filter((q) => !seen.has(q.id)).map((q) => q.id);
if (lost.length) { bad++; console.log('unreachable rooms:', lost.join(' ')); }
console.log(`${rects.length} rooms, ${[...edges.values()].reduce((s, e) => s + e.size, 0) / 2} connections, ${bad ? bad + ' problem(s)' : 'all doors line up'}`);
process.exit(bad ? 1 : 0);
