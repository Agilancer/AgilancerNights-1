import { VIEW_W, VIEW_H, STEP } from './config.js';
import { Input, setupKeyboard } from './input.js';
import { setupTouchControls } from './touchControls.js';
import { Room, TEST_ROOM } from './room.js';
import { Player } from './player.js';
import { Camera } from './camera.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Everything is drawn at VIEW_W x VIEW_H into this buffer, then scaled up.
const buffer = document.createElement('canvas');
buffer.width = VIEW_W;
buffer.height = VIEW_H;
const bctx = buffer.getContext('2d');

const input = new Input();
setupKeyboard(input);
setupTouchControls(document.getElementById('controls'), input);

const room = new Room(TEST_ROOM);
const player = new Player();
player.spawnAt(room.spawn.x, room.spawn.y);
const camera = new Camera(VIEW_W, VIEW_H);
camera.follow(player, room);

// Handy for poking at state from the browser console.
window.game = { input, room, player, camera };

let paused = false;
// Tap the game screen to cycle: read-out -> read-out + hit box -> nothing.
let debugMode = 0;
let fps = 0;

// Block page scrolling / pinch-zoom / double-tap zoom in iOS Safari.
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

canvas.addEventListener('click', () => {
  debugMode = (debugMode + 1) % 3;
  player.showHitbox = debugMode === 1;
});
document.addEventListener('visibilitychange', () => { if (document.hidden) paused = true; });

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
window.addEventListener('resize', resize);
resize();

function step(dt) {
  input.update();
  if (input.pressed.pause) paused = !paused;
  if (paused) return;
  player.update(dt, input, room);
  camera.follow(player, room);
}

function render() {
  room.draw(bctx, camera);
  player.draw(bctx, camera);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);

  // Overlays are drawn at native resolution so text stays sharp.
  const k = canvas.width / VIEW_W;
  if (debugMode !== 2) {
    const held = Object.keys(input.held).filter((a) => input.held[a]).join(' ');
    const lines = [
      `fps ${fps.toFixed(0)}`,
      `pos ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`,
      `vel ${player.vx.toFixed(0)}, ${player.vy.toFixed(0)}`,
      `ground ${player.onGround ? 'yes' : 'no'}  ${player.state}`,
      `input ${held || '-'}`,
    ];
    ctx.font = `${Math.round(7 * k)}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'top';
    const lh = 8 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(2 * k, 2 * k, 110 * k, lines.length * lh + 3 * k);
    ctx.fillStyle = '#e8e8f0';
    lines.forEach((l, i) => ctx.fillText(l, 4 * k, 3.5 * k + i * lh));
  }
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(20 * k)}px Georgia, serif`;
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
  }
}

let last = performance.now();
let acc = 0;
function frame(now) {
  const elapsed = Math.min((now - last) / 1000, 0.25); // avoid spiral after a stall
  last = now;
  fps = fps * 0.9 + (elapsed > 0 ? 1 / elapsed : 0) * 0.1;
  acc += elapsed;
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
