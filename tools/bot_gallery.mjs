// Play-test the Lava Gallery's moving platforms with the real game loop:
// a bot waits for each platform, hops on, rides it and hops off, both ways.
//   node tools/bot_gallery.mjs
import { TILE, STEP } from '../src/config.js';
import { World } from '../src/world.js';
import { Player } from '../src/player.js';
import { Camera } from '../src/camera.js';

const player = new Player();
const world = new World(player, new Camera(320, 240));
world.enter('gallery', 2 * TILE + 16, 4 * TILE);
let frames = 0, deaths = 0;

function tick(dir = 0, jump = false, press = false, down = false) {
  const inp = {
    held: { left: dir < 0, right: dir > 0, jump, down, up: false, attack: false, magic: false },
    pressed: { jump: press, attack: false, magic: false, menu: false, pause: false },
  };
  const before = world.respawnTimer;
  world.update(STEP, inp);
  if (world.respawnTimer > 0 && before <= 0) deaths++;
  frames++;
}
const m = (i) => world.room.movers[i];
const cx = () => player.x + player.w / 2;
function waitUntil(cond, max = 1200) { for (let i = 0; i < max && !cond(); i++) tick(); }
// Walk `dir` until cond.
function walk(dir, cond, max = 400) {
  for (let i = 0; i < max && !cond(); i++) tick(dir);
  for (let i = 0; i < 8; i++) tick();
}
// Jump toward the target, letting go of the d-pad once over `aimX` (tiles).
function hop(dir, cond, aimX = null) {
  const mv = player.onMover;            // on a platform: step to its edge first
  if (mv) for (let i = 0; i < 60 && (dir > 0 ? mv.x + mv.w - cx() > 8 : cx() - mv.x > 8); i++) tick(dir);
  for (let i = 0; i < 300 && !cond(); i++) {
    const past = aimX !== null && (dir > 0 ? cx() >= aimX * TILE : cx() <= aimX * TILE);
    tick(past ? 0 : dir, true, i === 0);
  }
  for (let i = 0; i < 8; i++) tick();
}
const onM = (i) => () => player.onMover === m(i);
const onStatic = () => player.onGround && !player.onMover;
const at = (i, t) => () => Math.abs(m(i).x - (m(i).x0 + m(i).ox * t)) < 3 && Math.abs(m(i).y - (m(i).y0 + m(i).oy * t)) < 3;

const log = (s) => console.log(`${s.padEnd(34)} room=${world.room.id} x=${(cx() / TILE).toFixed(1)} y=${((player.y + player.h) / TILE).toFixed(1)} deaths=${deaths}`);

// ---- left to right
waitUntil(at(0, 0)); walk(1, onM(0)); log('on mover 1');
waitUntil(at(0, 1)); walk(1, onStatic); log('pillar A');
waitUntil(at(1, 0)); walk(1, onM(1)); log('on mover 2');
waitUntil(at(1, 1)); walk(1, onStatic); log('pillar B');
waitUntil(at(2, 0)); walk(1, onM(2)); log('on mover 3');
waitUntil(at(2, 1)); walk(1, onStatic); log('pillar C');
waitUntil(at(3, 0)); walk(1, onM(3)); log('on mover 4');
waitUntil(at(3, 1)); walk(1, onStatic); log('exit ledge');
walk(1, () => world.room.id !== 'gallery'); log('walked out');
const forward = world.room.id === 'chapel' && deaths === 0;

// ---- right to left
world.enter('gallery', 41 * TILE + 16, 4 * TILE); deaths = 0;
waitUntil(at(3, 1)); walk(-1, onM(3)); log('back on mover 4');
waitUntil(at(3, 0)); walk(-1, onStatic); log('pillar C');
waitUntil(at(2, 1)); hop(-1, onM(2), 30); log('on mover 3');
waitUntil(at(2, 0)); hop(-1, onStatic, 23); log('pillar B');
waitUntil(at(1, 1)); walk(-1, onM(1)); log('on mover 2');
waitUntil(at(1, 0)); walk(-1, onStatic); log('pillar A');
waitUntil(at(0, 1)); hop(-1, onM(0), 11); log('on mover 1');
waitUntil(at(0, 0)); hop(-1, onStatic, 3); log('entry ledge');
walk(-1, () => world.room.id !== 'gallery'); log('walked out');
const back = world.room.id === 'tower' && deaths === 0;
console.log(forward && back ? 'PASS' : 'FAIL', `(${(frames / 60).toFixed(0)}s of game time)`);
process.exit(forward && back ? 0 : 1);
