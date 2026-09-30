import { VIEW_W, VIEW_W_MAX, VIEW_H, STEP } from './config.js';
import { Input, setupKeyboard } from './input.js';
import { setupTouchControls } from './touchControls.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { World, hasSave } from './world.js';
import { Menu } from './menu.js';
import { Title } from './title.js';
import { xpToNext, getIcon } from './items.js';
import { LIGHT_KINDS } from './room.js';
import { TILE } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const buffer = document.createElement('canvas');
buffer.height = VIEW_H;
const bctx = buffer.getContext('2d');
const light = document.createElement('canvas');
light.height = VIEW_H;
const lctx = light.getContext('2d');

const input = new Input();
setupKeyboard(input);
setupTouchControls(document.getElementById('controls'), input);

const player = new Player();
const camera = new Camera(VIEW_W, VIEW_H);
const world = new World(player, camera);
const menu = new Menu(document.getElementById('menu'), world);
const title = new Title();
window.game = { input, player, camera, world, menu };

let mode = 'title';       // 'title' | 'game'
let paused = false;
let debugMode = 2;
let fps = 0;
let safeLeft = 0, safePx = 0;
const ambient = [];       // screen-space atmosphere particles

// ---------- title ----------
const titleMenu = document.getElementById('title-menu');
const btnContinue = document.getElementById('title-continue');
function showTitle() {
  mode = 'title';
  menu.close();
  btnContinue.classList.toggle('hidden', !hasSave());
  titleMenu.classList.remove('hidden');
  document.getElementById('controls').style.visibility = 'hidden';
}
function startGame(fresh) {
  if (fresh) world.reset();
  mode = 'game';
  paused = false;
  titleMenu.classList.add('hidden');
  document.getElementById('controls').style.visibility = 'visible';
  world.fade = 1;
}
btnContinue.addEventListener('click', () => startGame(false));
document.getElementById('title-new').addEventListener('click', () => {
  if (!hasSave() || confirm('Begin a new game? Your saved progress will be lost.')) startGame(true);
});
document.getElementById('menu-quit').addEventListener('click', () => { world.save(); showTitle(); });
showTitle();

// ---------- input plumbing ----------
document.addEventListener('touchmove', (e) => {
  if (!e.target.closest('.menu-scroll') && !e.target.closest('#map-canvas')) e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
const cycleDebug = () => { debugMode = (debugMode + 1) % 3; player.showHitbox = debugMode === 1; };
canvas.addEventListener('click', (e) => {
  if (mode !== 'game') return;
  if (world.ending && world.ending.t > 4) { world.ending = null; world.save(); showTitle(); return; }
  const r = canvas.getBoundingClientRect();
  if (e.clientX - r.left < safeLeft + 150 && e.clientY - r.top < 60) cycleDebug();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Backquote') cycleDebug();
  if (mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) startGame(!hasSave());
});
document.addEventListener('visibilitychange', () => { if (document.hidden && !menu.isOpen && mode === 'game') paused = true; });

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;
  const viewW = Math.max(VIEW_W, Math.min(VIEW_W_MAX, Math.round(VIEW_H * W / H)));
  buffer.width = viewW;
  light.width = viewW;
  camera.w = viewW;
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
  if (mode === 'title') { title.update(dt); return; }
  if (menu.isOpen) {
    if (input.pressed.menu || input.pressed.pause) menu.close();
    return;
  }
  if (input.pressed.menu && !world.ending) { menu.open(); paused = false; return; }
  if (input.pressed.pause) paused = !paused;
  if (paused) return;
  world.room.lantern = !!player.abilities.lantern;
  world.update(dt, input);
  camera.follow(player, world.room);
  updateAmbient(dt);
}

// ---------- atmosphere ----------
function updateAmbient(dt) {
  const Z = world.zone, fx = Z.fx, W = buffer.width, H = VIEW_H;
  const rate = { dust: 6, wind: 14, motes: 8, storm: 60, drips: 10, embers: 18, eyes: 0.6, void: 16 }[fx] || 0;
  for (let n = rate * dt; n > 0; n--) {
    if (Math.random() > n) break;
    const p = { t: 0, x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, life: 4, fx };
    if (fx === 'dust') Object.assign(p, { vx: 4 - Math.random() * 8, vy: 3 + Math.random() * 4, life: 6 });
    if (fx === 'wind') Object.assign(p, { x: -10, vx: 160 + Math.random() * 80, vy: 10, life: 4 });
    if (fx === 'motes') Object.assign(p, { vx: Math.random() * 6 - 3, vy: -3 - Math.random() * 4, life: 5 });
    if (fx === 'storm') Object.assign(p, { y: -8, vx: -40, vy: 340 + Math.random() * 60, life: 1.2 });
    if (fx === 'drips') Object.assign(p, { y: 0, vy: 60, life: 3 });
    if (fx === 'embers') Object.assign(p, { y: H + 4, vx: Math.random() * 20 - 10, vy: -30 - Math.random() * 30, life: 6 });
    if (fx === 'eyes') Object.assign(p, { life: 3 + Math.random() * 2 });
    if (fx === 'void') Object.assign(p, { y: H + 4, vx: Math.random() * 10 - 5, vy: -18 - Math.random() * 20, life: 8 });
    ambient.push(p);
  }
  for (const p of ambient) { p.t += dt; p.x += p.vx * dt; p.y += (p.fx === 'drips' ? (p.vy += 400 * dt) : p.vy) * dt; }
  for (let i = ambient.length - 1; i >= 0; i--) if (ambient[i].t > ambient[i].life || ambient[i].y > VIEW_H + 20) ambient.splice(i, 1);
  if (fx === 'storm' && Math.random() < dt * 0.12) world.flash = Math.max(world.flash, 0.55);
}

function drawAmbient(c) {
  for (const p of ambient) {
    const a = Math.min(1, p.t * 2, (p.life - p.t));
    switch (p.fx) {
      case 'dust': c.fillStyle = `rgba(210,200,230,${0.25 * a})`; c.fillRect(p.x, p.y, 1, 1); break;
      case 'wind': c.fillStyle = `rgba(200,210,255,${0.25 * a})`; c.fillRect(p.x, p.y, 8, 1); break;
      case 'motes': c.fillStyle = `rgba(255,230,160,${0.5 * a})`; c.fillRect(p.x, p.y, 1.5, 1.5); break;
      case 'storm': c.fillStyle = 'rgba(170,180,230,0.35)'; c.fillRect(p.x, p.y, 1, 6); break;
      case 'drips': c.fillStyle = world.room.zone === 8 ? 'rgba(160,10,20,0.7)' : 'rgba(120,200,210,0.6)'; c.fillRect(p.x, p.y, 1, 3); break;
      case 'embers': c.fillStyle = `rgba(255,${120 + Math.random() * 80},40,${0.8 * a})`; c.fillRect(p.x, p.y, 1.5, 1.5); break;
      case 'eyes': {
        // Eyes that open in the dark and watch the player.
        const blink = Math.sin(p.t * 3) > 0.9 ? 0.2 : 1;
        const dx = Math.sign(player.x - camera.x - p.x) * 0.7;
        c.fillStyle = `rgba(255,230,200,${0.55 * a})`;
        c.fillRect(p.x - 3, p.y, 3, 1.6 * blink); c.fillRect(p.x + 2, p.y, 3, 1.6 * blink);
        c.fillStyle = `rgba(160,0,20,${0.9 * a})`;
        c.fillRect(p.x - 2 + dx, p.y, 1, 1.4 * blink); c.fillRect(p.x + 3 + dx, p.y, 1, 1.4 * blink);
        break;
      }
      case 'void': c.fillStyle = `rgba(${Math.random() < 0.5 ? '190,120,255' : '120,200,255'},${0.6 * a})`; c.fillRect(p.x, p.y, 1, 2); break;
      default: break;
    }
  }
}

// Darkness: a black veil with holes for the player and every light source.
function drawDarkness() {
  const Z = world.zone;
  if (!Z.dark) return;
  const W = light.width;
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, W, VIEW_H);
  lctx.fillStyle = `rgba(0,0,0,${Z.dark})`;
  lctx.fillRect(0, 0, W, VIEW_H);
  lctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, s = 1) => {
    const g = lctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${s})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const R = player.abilities.lantern ? 150 : 95;
  hole(player.x + player.w / 2 - camera.x, player.y + player.h / 2 - camera.y, R);
  for (const d of world.room.def.decor || []) {
    if (!LIGHT_KINDS[d.t]) continue;
    const s = (d.s || 1) * TILE;
    const x = d.x * TILE + s / 2 - camera.x, y = d.y * TILE + s * 0.4 - camera.y;
    if (x < -80 || x > W + 80 || y < -80 || y > VIEW_H + 80) continue;
    hole(x, y, 60 * (d.s || 1), 0.9);
  }
  for (const pr of world.projectiles) hole(pr.x - camera.x, pr.y - camera.y, 30, 0.8);
  lctx.globalCompositeOperation = 'source-over';
  bctx.drawImage(light, 0, 0);
}

function drawDrops() {
  for (const d of world.drops) {
    const x = Math.round(d.x - camera.x), y = Math.round(d.y - camera.y + Math.sin(d.t * 5) * 1.5);
    if (d.t > 20 && Math.floor(d.t * 8) % 2) continue;
    if (d.orb) {
      const g = bctx.createRadialGradient(x, y - 4, 0, x, y - 4, 7);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, d.orb === 'hp' ? '#ff4060' : '#4080ff'); g.addColorStop(1, 'rgba(0,0,0,0)');
      bctx.fillStyle = g; bctx.fillRect(x - 7, y - 11, 14, 14);
    } else {
      bctx.fillStyle = 'rgba(255,230,140,0.25)'; bctx.fillRect(x - 8, y - 14, 16, 16);
      bctx.drawImage(getIcon(d.item), x - 7, y - 13, 14, 14);
    }
  }
}

function drawParticles() {
  for (const q of world.particles) {
    bctx.globalAlpha = Math.max(0, 1 - q.t / q.life);
    bctx.fillStyle = q.color;
    bctx.fillRect(q.x - camera.x, q.y - camera.y, q.size, q.size);
  }
  bctx.globalAlpha = 1;
}

// ---------- HUD ----------
function drawBar(x, y, w, h, frac, fill, back, k) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - k, y - k, w + 2 * k, h + 2 * k);
  ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
  const f = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = fill; ctx.fillRect(x, y, w * f, h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w * f, Math.max(1, h * 0.35));
}

function drawHud(k) {
  const p = player;
  const x = Math.max(6 * k, safePx + 4 * k), y = 6 * k, w = 88 * k;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(12, 6, 26, 0.8)'; ctx.fillRect(x, y, 22 * k, 22 * k);
  ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = Math.max(1, k * 0.6); ctx.strokeRect(x + 0.5, y + 0.5, 22 * k - 1, 22 * k - 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9a24a'; ctx.font = `${Math.round(5 * k)}px Georgia, serif`; ctx.fillText('LV', x + 11 * k, y + 6 * k);
  ctx.fillStyle = '#fff3cf'; ctx.font = `bold ${Math.round(10 * k)}px Georgia, serif`; ctx.fillText(String(p.level), x + 11 * k, y + 15 * k);
  ctx.textAlign = 'left';
  const bx = x + 26 * k;
  drawBar(bx, y, w, 6 * k, p.hp / p.maxHp, '#d8323a', '#3a0e14', k);
  drawBar(bx, y + 9 * k, w * 0.8, 5 * k, p.mp / p.maxMp, '#3d7de0', '#0e1a3a', k);
  drawBar(bx, y + 17 * k, w * 0.8, 3 * k, p.xp / xpToNext(p.level), '#e0b43d', '#2a2210', k);
  ctx.font = `bold ${Math.round(5.5 * k)}px ui-monospace, Menlo, monospace`;
  ctx.fillStyle = '#ffffff'; ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`, bx + 3 * k, y + 3.2 * k);
  ctx.fillStyle = '#dfe9ff'; ctx.font = `bold ${Math.round(4.5 * k)}px ui-monospace, Menlo, monospace`;
  ctx.fillText(`${Math.floor(p.mp)}/${p.maxMp}`, bx + 3 * k, y + 11.6 * k);
  if (p.sprinting) { ctx.fillStyle = '#9fd0ff'; ctx.fillText('SPRINT', bx + w * 0.82, y + 11.6 * k); }
}

function drawBoss(k) {
  const b = world.boss;
  if (!b || b.dead) return;
  const W = canvas.width, w = Math.min(W * 0.55, 260 * k), x = (W - w) / 2, y = canvas.height - 16 * k;
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(8 * k)}px Georgia, serif`;
  ctx.fillStyle = '#f0d0c0'; ctx.fillText(b.name, W / 2, y - 7 * k);
  drawBar(x, y, w, 5 * k, b.hp / b.maxHp, b.phase2 ? '#ff3a50' : '#c02838', '#2a0810', k);
  ctx.textAlign = 'left';
  const intro = world.bossIntro;
  if (intro && intro.t < 3) {
    const a = Math.min(1, intro.t * 2, (3 - intro.t) * 2);
    ctx.globalAlpha = Math.max(0, a);
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(22 * k)}px 'UnifrakturCook', Georgia, serif`;
    ctx.fillStyle = '#ff5050'; ctx.shadowColor = '#000'; ctx.shadowBlur = 8 * k;
    ctx.fillText(intro.name, W / 2, canvas.height * 0.4);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

function drawEnding(k) {
  const e = world.ending;
  if (!e || e.t < 0) return;
  const W = canvas.width, H = canvas.height, a = Math.min(1, e.t / 2);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(40,20,60,${a})`); g.addColorStop(1, `rgba(255,170,120,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = Math.min(1, Math.max(0, (e.t - 1.5) / 1.5));
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff4d8';
  ctx.font = `${Math.round(26 * k)}px 'UnifrakturCook', Georgia, serif`;
  ctx.fillText('The Night Is Broken', W / 2, H * 0.3);
  ctx.font = `italic ${Math.round(9 * k)}px Georgia, serif`;
  const st = world.state;
  const mins = Math.floor(st.time / 60);
  const lines = ['The Nightlord falls, and with him the endless dark.', 'Dawn creeps over the broken spires of the castle.',
    '', `Time ${Math.floor(mins / 60)}h ${mins % 60}m  ·  Level ${player.level}  ·  ${st.kills} foes vanquished`,
    `${Object.keys(st.visited).length} rooms explored  ·  ${Object.keys(st.inventory).length} kinds of treasure found`, '', 'Tap to return to the title'];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.45 + i * 12 * k));
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function render() {
  if (mode === 'title') { title.draw(ctx, canvas.width, canvas.height); return; }
  const viewW = buffer.width;
  const shake = world.shake > 0 ? world.shake * 6 : 0;
  const sx = shake ? Math.round((Math.random() - 0.5) * shake) : 0, sy = shake ? Math.round((Math.random() - 0.5) * shake) : 0;
  camera.x += sx; camera.y += sy;
  world.room.draw(bctx, camera);
  for (const e of world.room.enemies) e.draw(bctx, camera, player.showHitbox);
  drawDrops();
  player.draw(bctx, camera);
  for (const pr of world.projectiles) pr.draw(bctx, camera);
  drawParticles();
  drawDarkness();
  drawAmbient(bctx);
  camera.x -= sx; camera.y -= sy;
  const Z = world.zone;
  if (Z.tint) { bctx.fillStyle = Z.tint; bctx.fillRect(0, 0, viewW, VIEW_H); }
  if (Z.pulse) { bctx.fillStyle = `rgba(120,0,20,${0.06 + 0.06 * Math.sin(world.room.time * 2.2)})`; bctx.fillRect(0, 0, viewW, VIEW_H); }
  if (world.flash > 0) { bctx.fillStyle = `rgba(255,255,255,${world.flash * 0.6})`; bctx.fillRect(0, 0, viewW, VIEW_H); }
  if (world.fade > 0) { bctx.fillStyle = `rgba(0,0,0,${Math.min(1, world.fade)})`; bctx.fillRect(0, 0, viewW, VIEW_H); }

  ctx.imageSmoothingEnabled = false;
  if (Z.wobble) {
    // The abyss doesn't hold still: the picture ripples.
    const strip = 4, k0 = canvas.height / VIEW_H, t = world.room.time;
    for (let y = 0; y < VIEW_H; y += strip) {
      const off = Math.sin(y * 0.06 + t * 1.7) * 1.4 + Math.sin(y * 0.013 - t * 0.6) * 1.2;
      ctx.drawImage(buffer, 0, y, viewW, strip, off * k0, y * k0, canvas.width, strip * k0 + 1);
    }
  } else {
    ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  }

  const k = canvas.height / VIEW_H;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  for (const q of world.popups) {
    ctx.globalAlpha = Math.max(0, 1 - q.t / (q.big ? 1.6 : 0.9));
    ctx.font = `bold ${Math.round((q.big ? 9 : 7) * k)}px Georgia, serif`;
    const px = (q.x - camera.x) * k, py = (q.y - camera.y) * k;
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(q.text, px + k, py + k);
    ctx.fillStyle = q.color; ctx.fillText(q.text, px, py);
  }
  ctx.globalAlpha = 1;
  drawHud(k);
  drawBoss(k);

  const b = world.banner;
  if (b && b.t > 0.3) {
    const a = Math.min(1, (b.t - 0.3) * 4, (3 - b.t) * 2);
    ctx.globalAlpha = Math.max(0, a);
    ctx.textAlign = 'center';
    ctx.font = `italic ${Math.round(10 * k)}px Georgia, serif`;
    const w = Math.max(ctx.measureText(b.text).width, b.sub ? ctx.measureText(b.sub).width * 0.8 : 0) + 24 * k;
    const h = b.sub ? 28 * k : 18 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect((canvas.width - w) / 2, 62 * k, w, h);
    if (b.sub) {
      ctx.fillStyle = '#c9a24a'; ctx.font = `${Math.round(7 * k)}px Georgia, serif`; ctx.fillText(b.sub.toUpperCase(), canvas.width / 2, 69 * k);
      ctx.fillStyle = '#e9dcb4'; ctx.font = `italic ${Math.round(10 * k)}px Georgia, serif`; ctx.fillText(b.text, canvas.width / 2, 81 * k);
    } else {
      ctx.fillStyle = '#e9dcb4'; ctx.fillText(b.text, canvas.width / 2, 71 * k);
    }
    ctx.globalAlpha = 1;
  }
  for (const m of world.messages) {
    const a = Math.min(1, m.t * 6, (m.time - m.t) * 3);
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `${Math.round(8.5 * k)}px Georgia, serif`;
    ctx.textAlign = 'center';
    const w = Math.min(canvas.width - 8 * k, ctx.measureText(m.text).width + 24 * k);
    const x = (canvas.width - w) / 2, y = 36 * k;
    ctx.fillStyle = 'rgba(12, 6, 26, 0.88)'; ctx.fillRect(x, y, w, 20 * k);
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = Math.max(1, k * 0.75); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 20 * k - 1);
    ctx.fillStyle = '#f3e7c2'; ctx.fillText(m.text, canvas.width / 2, y + 10 * k, w - 12 * k);
    ctx.globalAlpha = 1;
  }

  if (debugMode !== 2) {
    const held = Object.keys(input.held).filter((a) => input.held[a]).join(' ');
    const lines = [
      `fps ${fps.toFixed(0)}  ${world.room.id}  view ${viewW}`,
      `pos ${player.x.toFixed(1)}, ${player.y.toFixed(1)}  vel ${player.vx.toFixed(0)}, ${player.vy.toFixed(0)}`,
      `${player.state}  ${player.onGround ? 'ground' : 'air'}  enemies ${world.room.enemies.length}  proj ${world.projectiles.length}`,
      `input ${held || '-'}`,
    ];
    ctx.font = `${Math.round(6 * k)}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const lh = 7 * k, x0 = Math.max(6 * k, safePx + 4 * k), y0 = 34 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x0, y0, 150 * k, lines.length * lh + 3 * k);
    ctx.fillStyle = '#e8e8f0'; lines.forEach((l, i) => ctx.fillText(l, x0 + 2 * k, y0 + 1.5 * k + i * lh));
  }
  drawEnding(k);
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(20 * k)}px Georgia, serif`;
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
  }
  ctx.textAlign = 'left';
}

let last = performance.now();
let acc = 0;
function frame(now) {
  const elapsed = Math.min((now - last) / 1000, 0.25);
  last = now;
  fps = fps * 0.9 + (elapsed > 0 ? 1 / elapsed : 0) * 0.1;
  acc += elapsed;
  while (acc >= STEP) { step(STEP); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
