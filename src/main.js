import { VIEW_W, VIEW_H, STEP } from './config.js';
import { Input, setupKeyboard } from './input.js';
import { setupTouchControls } from './touchControls.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { World } from './world.js';
import { Menu } from './menu.js';

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

const player = new Player();
const camera = new Camera(VIEW_W, VIEW_H);
const world = new World(player, camera);
const menu = new Menu(document.getElementById('menu'), world);

// Handy for poking at state from the browser console.
window.game = { input, player, camera, world, menu };

let paused = false;
// Tap the game screen to cycle: nothing -> read-out -> read-out + hit box.
let debugMode = 2;
let fps = 0;

// Block page scrolling / pinch-zoom / double-tap zoom in iOS Safari
// (except inside the menu, which scrolls).
document.addEventListener('touchmove', (e) => {
  if (!e.target.closest('.menu-scroll')) e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

canvas.addEventListener('click', () => {
  debugMode = (debugMode + 1) % 3;
  player.showHitbox = debugMode === 1;
});
document.addEventListener('visibilitychange', () => { if (document.hidden && !menu.isOpen) paused = true; });

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
  if (menu.isOpen) {
    if (input.pressed.menu || input.pressed.pause) menu.close();
    return;
  }
  if (input.pressed.menu) { menu.open(); paused = false; return; }
  if (input.pressed.pause) paused = !paused;
  if (paused) return;
  world.update(dt, input);
  camera.follow(player, world.room);
}

function render() {
  world.room.draw(bctx, camera);
  player.draw(bctx, camera);
  if (world.fade > 0) {
    bctx.fillStyle = `rgba(0,0,0,${Math.min(1, world.fade)})`;
    bctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);

  // Overlays are drawn at native resolution so text stays sharp.
  const k = canvas.width / VIEW_W;
  ctx.textBaseline = 'middle';

  // Room name caption.
  const b = world.banner;
  if (b && b.t > 0.3) {
    const a = Math.min(1, (b.t - 0.3) * 4, (2.5 - b.t) * 2);
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `italic ${Math.round(10 * k)}px Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = ctx.measureText(b.text).width + 16 * k;
    ctx.fillRect(0, canvas.height - 26 * k, w, 18 * k);
    ctx.fillStyle = '#e9dcb4';
    ctx.fillText(b.text, 8 * k, canvas.height - 17 * k);
    ctx.globalAlpha = 1;
  }

  // Pick-up / door messages.
  for (const m of world.messages) {
    const a = Math.min(1, m.t * 6, (m.time - m.t) * 3);
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `${Math.round(9 * k)}px Georgia, serif`;
    ctx.textAlign = 'center';
    const w = Math.min(canvas.width - 8 * k, ctx.measureText(m.text).width + 24 * k);
    const x = (canvas.width - w) / 2, y = 34 * k;
    ctx.fillStyle = 'rgba(12, 6, 26, 0.88)';
    ctx.fillRect(x, y, w, 20 * k);
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = Math.max(1, k * 0.75);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 20 * k - 1);
    ctx.fillStyle = '#f3e7c2';
    ctx.fillText(m.text, canvas.width / 2, y + 10 * k);
    ctx.globalAlpha = 1;
  }

  if (debugMode !== 2) {
    const held = Object.keys(input.held).filter((a) => input.held[a]).join(' ');
    const lines = [
      `fps ${fps.toFixed(0)}  ${world.room.id}`,
      `pos ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`,
      `vel ${player.vx.toFixed(0)}, ${player.vy.toFixed(0)}`,
      `ground ${player.onGround ? 'yes' : 'no'}  ${player.state}`,
      `input ${held || '-'}`,
    ];
    ctx.font = `${Math.round(7 * k)}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const lh = 8 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(2 * k, 2 * k, 120 * k, lines.length * lh + 3 * k);
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
  }
  ctx.textAlign = 'left';
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
