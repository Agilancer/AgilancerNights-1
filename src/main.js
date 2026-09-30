import { VIEW_W, VIEW_W_MAX, VIEW_H, STEP } from './config.js';
import { Input, setupKeyboard } from './input.js';
import { setupTouchControls } from './touchControls.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { World } from './world.js';
import { Menu } from './menu.js';
import { xpToNext } from './items.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Everything is drawn at viewW x VIEW_H into this buffer, then scaled up.
const buffer = document.createElement('canvas');
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
// Debug view (tap the HUD, or press `): nothing -> read-out -> read-out + hit boxes.
let debugMode = 2;
let fps = 0;
let safeLeft = 0; // CSS px of notch on the left, keeps the HUD clear of it
let safePx = 0;   // same, in canvas pixels

// Block page scrolling / pinch-zoom / double-tap zoom in iOS Safari
// (except inside the menu, which scrolls).
document.addEventListener('touchmove', (e) => {
  if (!e.target.closest('.menu-scroll')) e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

const cycleDebug = () => {
  debugMode = (debugMode + 1) % 3;
  player.showHitbox = debugMode === 1;
};
canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  if (e.clientX - r.left < safeLeft + 150 && e.clientY - r.top < 60) cycleDebug();
});
window.addEventListener('keydown', (e) => { if (e.code === 'Backquote') cycleDebug(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !menu.isOpen) paused = true; });

// Size the canvas to the screen; the virtual width follows the aspect ratio.
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;
  const viewW = Math.max(VIEW_W, Math.min(VIEW_W_MAX, Math.round(VIEW_H * W / H)));
  buffer.width = viewW;
  camera.w = viewW;
  // Letterbox if the screen is wider/narrower than the allowed range.
  const cssH = Math.min(H, W * VIEW_H / viewW);
  const cssW = cssH * viewW / VIEW_H;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const safe = getComputedStyle(document.getElementById('safe'));
  safeLeft = parseFloat(safe.paddingLeft) || 0;
  safePx = safeLeft * dpr;
  camera.follow(player, world.room, true);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
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

function drawBar(x, y, w, h, frac, fill, back, k) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - k, y - k, w + 2 * k, h + 2 * k);
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), Math.max(1, h * 0.35));
}

function drawHud(k) {
  const p = player;
  const x = Math.max(6 * k, safePx + 4 * k);
  const y = 6 * k;
  const w = 88 * k;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  // Level badge.
  ctx.fillStyle = 'rgba(12, 6, 26, 0.8)';
  ctx.fillRect(x, y, 22 * k, 22 * k);
  ctx.strokeStyle = '#c9a24a';
  ctx.lineWidth = Math.max(1, k * 0.6);
  ctx.strokeRect(x + 0.5, y + 0.5, 22 * k - 1, 22 * k - 1);
  ctx.fillStyle = '#c9a24a';
  ctx.font = `${Math.round(5 * k)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText('LV', x + 11 * k, y + 6 * k);
  ctx.fillStyle = '#fff3cf';
  ctx.font = `bold ${Math.round(10 * k)}px Georgia, serif`;
  ctx.fillText(String(p.level), x + 11 * k, y + 15 * k);
  ctx.textAlign = 'left';
  const bx = x + 26 * k;
  drawBar(bx, y, w, 6 * k, p.hp / p.maxHp, '#d8323a', '#3a0e14', k);
  drawBar(bx, y + 9 * k, w * 0.8, 5 * k, p.mp / p.maxMp, '#3d7de0', '#0e1a3a', k);
  drawBar(bx, y + 17 * k, w * 0.8, 3 * k, p.xp / xpToNext(p.level), '#e0b43d', '#2a2210', k);
  ctx.font = `bold ${Math.round(5.5 * k)}px ui-monospace, Menlo, monospace`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`, bx + 3 * k, y + 3.2 * k);
  ctx.fillStyle = '#dfe9ff';
  ctx.font = `bold ${Math.round(4.5 * k)}px ui-monospace, Menlo, monospace`;
  ctx.fillText(`${Math.floor(p.mp)}/${p.maxMp}`, bx + 3 * k, y + 11.6 * k);
}

function render() {
  const viewW = buffer.width;
  world.room.draw(bctx, camera);
  for (const e of world.room.enemies) e.draw(bctx, camera, player.showHitbox);
  player.draw(bctx, camera);
  for (const pr of world.projectiles) pr.draw(bctx, camera);
  if (world.fade > 0) {
    bctx.fillStyle = `rgba(0,0,0,${Math.min(1, world.fade)})`;
    bctx.fillRect(0, 0, viewW, VIEW_H);
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);

  // Overlays are drawn at native resolution so text stays sharp.
  const k = canvas.height / VIEW_H;
  ctx.textBaseline = 'middle';

  // Floating damage / XP numbers.
  ctx.textAlign = 'center';
  for (const q of world.popups) {
    ctx.globalAlpha = Math.max(0, 1 - q.t / 0.9);
    ctx.font = `bold ${Math.round(7 * k)}px Georgia, serif`;
    const px = (q.x - camera.x) * k, py = (q.y - camera.y) * k;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillText(q.text, px + k, py + k);
    ctx.fillStyle = q.color;
    ctx.fillText(q.text, px, py);
  }
  ctx.globalAlpha = 1;

  drawHud(k);

  // Room name caption.
  const b = world.banner;
  if (b && b.t > 0.3) {
    const a = Math.min(1, (b.t - 0.3) * 4, (2.5 - b.t) * 2);
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `italic ${Math.round(10 * k)}px Georgia, serif`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(b.text).width + 24 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect((canvas.width - w) / 2, 62 * k, w, 18 * k);
    ctx.fillStyle = '#e9dcb4';
    ctx.fillText(b.text, canvas.width / 2, 71 * k);
    ctx.globalAlpha = 1;
  }

  // Pick-up / door / level-up messages.
  for (const m of world.messages) {
    const a = Math.min(1, m.t * 6, (m.time - m.t) * 3);
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `${Math.round(9 * k)}px Georgia, serif`;
    ctx.textAlign = 'center';
    const w = Math.min(canvas.width - 8 * k, ctx.measureText(m.text).width + 24 * k);
    const x = (canvas.width - w) / 2, y = 36 * k;
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
      `fps ${fps.toFixed(0)}  ${world.room.id}  view ${viewW}`,
      `pos ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`,
      `vel ${player.vx.toFixed(0)}, ${player.vy.toFixed(0)}`,
      `ground ${player.onGround ? 'yes' : 'no'}  ${player.state}`,
      `input ${held || '-'}`,
    ];
    ctx.font = `${Math.round(6 * k)}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const lh = 7 * k, x0 = Math.max(6 * k, safePx + 4 * k), y0 = 34 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x0, y0, 125 * k, lines.length * lh + 3 * k);
    ctx.fillStyle = '#e8e8f0';
    lines.forEach((l, i) => ctx.fillText(l, x0 + 2 * k, y0 + 1.5 * k + i * lh));
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
