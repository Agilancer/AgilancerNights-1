// Reachability solver shared by the level checker and the castle generator.
// Runs the real player physics through a set of run / jump / drop manoeuvres
// (plus double jumps, sprints and super jumps when those abilities are on) from
// every standing spot it can reach, and reports which exits and target boxes
// it touched.
import { TILE, STEP, PHYSICS } from '../src/config.js';
import { Room } from '../src/room.js';
import { Player } from '../src/player.js';

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function input(m) {
  return {
    held: { left: m.dir < 0, right: m.dir > 0, jump: !!m.jump, down: !!m.down, up: !!m.up, attack: false, magic: false },
    pressed: { jump: !!m.press, left: !!m.tapL, right: !!m.tapR, attack: false, magic: false },
  };
}

const MOVE_CACHE = new Map();
function manoeuvres(ab) {
  const key = ['doubleJump', 'sprint', 'gravity'].map((k) => (ab[k] ? 1 : 0)).join('');
  if (MOVE_CACHE.has(key)) return MOVE_CACHE.get(key);
  const list = [];
  for (const d of [-1, 1]) for (const n of [4, 10, 24, 60]) list.push((f) => ({ dir: f < n ? d : 0 }));
  const pre = [[0, 0], [1, 6], [-1, 6]];
  const airs = [];
  for (const d1 of [-1, 0, 1]) {
    for (const A of [8, 20, 999]) for (const d2 of A === 999 ? [d1] : [-1, 0, 1]) airs.push([d1, A, d2]);
  }
  const jumps = (preList, H, second, extra = {}) => {
    for (const [d0, P] of preList) for (const [d1, A, d2] of airs) {
      list.push((f) => {
        if (f < P) return { dir: d0, ...(extra.pre ? extra.pre(f, d0) : {}) };
        const g = f - P;
        const again = second !== null && g === second;
        return { dir: g < A ? d1 : d2, jump: g < H || (second !== null && g >= second && g < second + 30), press: g === 0 || again, up: extra.up && g === 0 };
      });
    }
  };
  for (const H of [6, 40]) jumps(pre, H, null);
  if (ab.doubleJump) for (const s of [10, 22]) jumps(pre, 40, s);
  if (ab.sprint) {
    // Double-tap to sprint, run, then jump (with or without a second jump).
    const sp = [[1, 16], [-1, 16], [1, 30], [-1, 30]];
    const tap = (f, d) => ({ tapR: d > 0 && (f === 0 || f === 4), tapL: d < 0 && (f === 0 || f === 4), dir: f === 2 || f === 3 ? 0 : d, hold: true });
    for (const [d0, P] of sp) {
      for (const second of ab.doubleJump ? [null, 14, 26] : [null]) {
        for (const d1 of [d0]) {
          list.push((f) => {
            if (f < P) return tap(f, d0);
            const g = f - P;
            return { dir: d1, jump: g < 40 || (second !== null && g >= second && g < second + 30), press: g === 0 || g === second };
          });
        }
      }
    }
  }
  if (ab.gravity) for (const [d1, A, d2] of airs) list.push((f) => ({ dir: f < A ? d1 : d2, jump: f < 5, press: f === 0, up: f < 2 }));
  for (const d of [-1, 0, 1]) list.push((f) => ({ dir: f > 2 ? d : 0, down: f < 40, jump: f === 0, press: f === 0 }));
  MOVE_CACHE.set(key, list);
  return list;
}

// def: room definition. opts:
//   starts: [[tileX, surfaceRow], ...]  standing spots to start from
//   abilities: { doubleJump, sprint, gravity, mist, spikes, lava }
//   targets: [{ id, box: {x,y,w,h} }]  (room px)
//   openBreakables / openDoors: treat 'B' / 'D' as empty
//   need: Set of exit / target ids; stops early once all are found
export function explore(def, opts) {
  const ab = opts.abilities || {};
  const map = def.map.map((r) => {
    let s = r;
    if (opts.openBreakables) s = s.replace(/B/g, '.');
    if (opts.openDoors) s = s.replace(/D/g, '.');
    return s;
  });
  const room = new Room(def.id || 'solve', { ...def, map, enemies: [], items: [], chests: [], boss: undefined }, { flags: {}, collected: {} });
  const ghosts = [];
  for (const m of room.movers) for (let i = 0; i <= 8; i++) ghosts.push({ x: m.x0 + m.ox * i / 8, y: m.y0 + m.oy * i / 8, w: m.w, dx: 0, dy: 0 });
  room.movers = ghosts;
  const targets = opts.targets || [];
  const found = new Set();
  const need = opts.need;
  const done = () => need && need.size > 0 && [...need].every((n) => found.has(n));
  const seen = new Set();
  const queue = [];
  const key = (x, y) => `${Math.round(x / 7)},${Math.round(y)}`;
  const push = (x, y) => {
    const k = key(x, y);
    if (seen.has(k)) return;
    seen.add(k);
    queue.push([x, y]);
  };
  for (const [tx, ty] of opts.starts) push(tx * TILE + TILE / 2, ty * TILE);
  const MOVES = manoeuvres(ab);
  const p = new Player();
  p.abilities = { ...ab };
  const maxNodes = opts.maxNodes || 4000;
  let nodes = 0;
  while (queue.length && !done() && nodes < maxNodes) {
    nodes++;
    const [bx, by] = queue.shift();
    for (const move of MOVES) {
      p.spawnAt(bx, by);
      Object.assign(p, { onGround: true, coyote: PHYSICS.coyoteTime, state: 'idle', jumping: false, jumpBuffer: 0, dropTimer: 0, dropping: false, usedDouble: false, sprinting: 0, superJump: false, stateTime: 0 });
      p.lastTap = { dir: 0, t: -1 };
      let wasAir = false;
      for (let f = 0; f < 260; f++) {
        const m = move(f);
        p.update(STEP, input(m), room);
        const hz = room.touchesHazard(p.x, p.y, p.w, p.h);
        if (hz && !(hz.kind === 'spikes' && ab.spikes) && !(hz.kind === 'lava' && ab.lava)) break;
        for (const t of targets) if (!found.has(t.id) && overlap(p, t.box)) found.add(t.id);
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        if (cx < 0 || cy < 0 || cx >= room.width || cy >= room.height) {
          const side = cx < 0 ? 'left' : cx >= room.width ? 'right' : cy < 0 ? 'top' : 'bottom';
          const at = side === 'left' || side === 'right' ? Math.floor(cy / TILE) : Math.floor(cx / TILE);
          found.add(`${side}@${at}`);
          break;
        }
        if (p.onGround && (wasAir || (f > 2 && !m.dir && !m.hold && Math.abs(p.vx) < 1))) { push(p.x + p.w / 2, p.y + p.h); break; }
        wasAir = !p.onGround;
      }
    }
  }
  return { found, seen, nodes };
}

// True if any exit on `side` within [lo, hi] (tile rows or cols) was found.
export function reachedExit(found, side, lo, hi) {
  for (const f of found) {
    const [s, at] = f.split('@');
    if (s === side && +at >= lo && +at <= hi) return true;
  }
  return false;
}
export { manoeuvres };
