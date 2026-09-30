// Level checker: proves every room can be crossed with the real player physics.
//
//   node tools/check_rooms.mjs [roomId]
//
// From each start point it explores every standing position reachable with a
// set of run / jump / drop manoeuvres, then reports which exits, items and
// doors it touched. Moving platforms are approximated as static copies at
// several points along their path, so treat those rooms as "probably fine"
// and play-test them.
import { TILE, STEP, PHYSICS } from '../src/config.js';
import { ROOMS } from '../src/rooms.js';
import { Room } from '../src/room.js';
import { Player } from '../src/player.js';

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function makeRoom(id, flags) {
  const room = new Room(id, ROOMS[id], { flags, collected: {} });
  const ghosts = [];
  for (const m of room.movers) {
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      ghosts.push({ x: m.x0 + m.ox * t, y: m.y0 + m.oy * t, w: m.w, dx: 0, dy: 0 });
    }
  }
  room.movers = ghosts;
  return room;
}

function input(dir, jump, down) {
  return {
    held: { left: dir < 0, right: dir > 0, jump, down, up: false, attack: false, magic: false },
    pressed: { jump: false, attack: false, magic: false },
  };
}

// A manoeuvre is a function frame -> {dir, jump, down}.
function manoeuvres() {
  const list = [];
  for (const d of [-1, 1]) for (const n of [3, 6, 12, 24, 48]) list.push((f) => ({ dir: f < n ? d : 0 }));
  const pre = [[0, 0], [1, 5], [-1, 5], [1, 14], [-1, 14]];
  for (const [d0, P] of pre) {
    for (const H of [3, 8, 14, 40]) {
      for (const d1 of [-1, 0, 1]) {
        for (const A of [6, 14, 24, 999]) {
          for (const d2 of A === 999 ? [d1] : [-1, 0, 1]) {
            list.push((f) => {
              if (f < P) return { dir: d0 };
              const g = f - P;
              return { dir: g < A ? d1 : d2, jump: g < H, press: g === 0 };
            });
          }
        }
      }
    }
  }
  for (const d of [-1, 0, 1]) list.push((f) => ({ dir: f > 2 ? d : 0, down: f < 2, jump: f === 0, press: f === 0 }));
  return list;
}
const MOVES = manoeuvres();

function explore(id, starts, flags = {}) {
  const room = makeRoom(id, flags);
  const def = ROOMS[id];
  const items = room.items.map((it) => ({ id: it.item, box: { x: it.px + 4, y: it.py - TILE * 2, w: TILE - 8, h: TILE * 2 } }));
  const door = room.door && !room.door.open
    ? { x: room.door.tx * TILE - 3, y: room.door.ty * TILE, w: TILE + 6, h: room.door.h * TILE } : null;
  const found = { exits: new Map(), items: new Set(), door: false };
  const seen = new Set();
  const queue = [];
  const key = (x, y) => `${Math.round(x / 6)},${Math.round(y)}`;
  const push = (x, y) => {
    const k = key(x, y);
    if (seen.has(k)) return;
    seen.add(k);
    queue.push([x, y]);
  };
  for (const [tx, ty] of starts) push(tx * TILE + TILE / 2, ty * TILE);

  const p = new Player();
  while (queue.length) {
    const [bx, by] = queue.shift();
    for (const move of MOVES) {
      p.spawnAt(bx, by);
      p.onGround = true; p.coyote = PHYSICS.coyoteTime; p.state = 'idle'; p.jumping = false;
      p.jumpBuffer = 0; p.dropTimer = 0;
      let wasAir = false;
      for (let f = 0; f < 300; f++) {
        const m = move(f);
        const inp = input(m.dir || 0, !!m.jump, !!m.down);
        inp.pressed.jump = !!m.press;
        p.update(STEP, inp, room);
        if (room.touchesHazard(p.x, p.y, p.w, p.h)) break;
        for (const it of items) if (overlap(p, it.box)) found.items.add(it.id);
        if (door && overlap(p, door)) found.door = true;
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        if (cx < 0 || cy < 0 || cx >= room.width || cy >= room.height) {
          const side = cx < 0 ? 'left' : cx >= room.width ? 'right' : cy < 0 ? 'top' : 'bottom';
          const e = `${side}@${side === 'left' || side === 'right' ? Math.floor(cy / TILE) : Math.floor(cx / TILE)}`;
          found.exits.set(e, true);
          break;
        }
        // Record where we touch down after being airborne, or where a walk stops.
        if (p.onGround && (wasAir || (f > 2 && !m.dir && Math.abs(p.vx) < 1))) {
          push(p.x + p.w / 2, p.y + p.h);
          break;
        }
        wasAir = !p.onGround;
      }
    }
  }
  if (process.argv.includes('--map')) {
    const g = def.map.map((r) => [...r]);
    for (const k of seen) {
      const [qx, y] = k.split(',').map(Number);
      const tx = Math.floor(qx * 6 / TILE), ty = Math.floor(y / TILE) - 1;
      if (g[ty] && g[ty][tx] === '.') g[ty][tx] = '*';
    }
    console.log(g.map((r, i) => `${String(i).padStart(2)} ${r.join('')}`).join('\n'));
  }
  return { found, nodes: seen.size, def };
}

// Start points (tile x, surface row) for each way into a room, and what must be reachable.
const CHECKS = [
  { room: 'entrance', from: 'start', starts: [[3, 12]], need: ['right', 'item:knife'] },
  { room: 'entrance', from: 'corridor', starts: [[38, 12]], need: [] },
  { room: 'corridor', from: 'entrance', starts: [[1, 8]], need: ['top', 'door'] },
  { room: 'corridor', from: 'tower', starts: [[29, 1]], need: ['left', 'door'] },
  { room: 'corridor', from: 'tower (door open)', starts: [[29, 1]], need: ['right'], flags: { sanctum_door: true } },
  { room: 'sanctum', from: 'corridor', starts: [[1, 8]], need: ['item:short_sword', 'left', 'right'] },
  { room: 'tower', from: 'corridor', starts: [[7, 29]], need: ['right'] },
  { room: 'tower', from: 'gallery', starts: [[16, 4]], need: ['bottom'] },
  { room: 'gallery', from: 'tower', starts: [[2, 4]], need: ['right'] },
  { room: 'gallery', from: 'chapel', starts: [[41, 4]], need: ['left'] },
  { room: 'chapel', from: 'gallery', starts: [[2, 8]], need: ['bottom'] },
  { room: 'chapel', from: 'vault', starts: [[25, 23]], need: ['left'] },
  { room: 'vault', from: 'chapel', starts: [[25, 1]], need: ['item:iron_key', 'top'] },
];

const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
let ok = true;
for (const c of CHECKS) {
  if (only && c.room !== only) continue;
  const t0 = Date.now();
  const { found, nodes } = explore(c.room, c.starts, c.flags);
  const got = [...found.exits.keys()];
  const has = (n) => n === 'door' ? found.door
    : n.startsWith('item:') ? found.items.has(n.slice(5))
    : got.some((e) => e.startsWith(n + '@'));
  const missing = c.need.filter((n) => !has(n));
  if (missing.length) ok = false;
  console.log(`${missing.length ? 'FAIL' : 'ok  '} ${c.room} from ${c.from}: exits [${got.join(' ')}]` +
    `${found.items.size ? ' items [' + [...found.items].join(' ') + ']' : ''}${found.door ? ' door' : ''}` +
    `${missing.length ? '  MISSING ' + missing.join(', ') : ''}  (${nodes} spots, ${Date.now() - t0}ms)`);
}
process.exit(ok ? 0 : 1);
