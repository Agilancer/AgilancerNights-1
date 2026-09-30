// Weapon attack animations: pose over time, drawing, and hit boxes.
// Everything is in the player's right-facing local space with (0, 0) at the
// bottom-centre of the hit box; the caller mirrors for left.
import { ELEMENTS } from './data/elements.js';

export const HAND = { x: 7, y: -19 };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const lerp = (a, b, t) => a + (b - a) * t;

// Hit windows (fractions of the swing). Each window is a separate hit.
export function hitWindows(w) {
  const a = w.anim;
  switch (a.motion) {
    case 'double': return [[0.12, 0.42], [0.55, 0.85]];
    case 'flurry': return Array.from({ length: a.stabs }, (_, i) => [(i + 0.2) / a.stabs, (i + 0.7) / a.stabs]);
    case 'spin': return a.turns > 1 ? [[0.08, 0.5], [0.5, 0.92]] : [[0.08, 0.9]];
    case 'thrust': return [[0.18, 0.55]];
    case 'overhead': case 'smash': return [[0.3, 0.66]];
    case 'whip': return [[0.34, 0.66]];
    case 'reap': return [[0.18, 0.72]];
    case 'giant': return [[0.22, 0.72]];
    default: return [[0.12, 0.55]];
  }
}

// Pose at normalized time t (0..1): blade angle, extension (0..1), and for
// whips / flails the list of chain points.
export function weaponPose(w, t) {
  const a = w.anim;
  let ang = 0, ext = 1;
  switch (a.motion) {
    case 'slash': ang = lerp(a.a0, a.a1, easeOut(clamp(t / 0.6))); break;
    case 'upper': ang = lerp(a.a1 + 0.2, a.a0 - 0.2, easeOut(clamp(t / 0.6))); break;
    case 'double':
      ang = t < 0.48 ? lerp(a.a0, a.a1, easeOut(clamp(t / 0.4))) : lerp(a.a1 + 0.2, a.a0 - 0.3, easeOut(clamp((t - 0.5) / 0.38)));
      break;
    case 'overhead': case 'smash':
      ang = t < 0.3 ? lerp(-1.4, -2.9, easeOut(t / 0.3)) : lerp(-2.9, 0.75, easeInOut(clamp((t - 0.3) / 0.36)));
      break;
    case 'thrust': {
      ang = -0.08;
      ext = t < 0.3 ? easeOut(t / 0.3) : 1 - clamp((t - 0.5) / 0.5) * 0.5;
      ext = 0.35 + ext * 0.65;
      break;
    }
    case 'flurry': {
      const k = t * a.stabs, i = Math.floor(k), f = k - i;
      ang = -0.25 + ((i * 7919) % 5) * 0.12;
      ext = 0.3 + Math.sin(Math.PI * clamp(f)) * 0.7;
      break;
    }
    case 'spin': ang = -Math.PI / 2 + easeInOut(clamp(t / 0.95)) * Math.PI * 2 * a.turns; break;
    case 'reap': ang = lerp(-2.7, 1.3, easeInOut(clamp(t / 0.75))); break;
    case 'giant': ang = t < 0.2 ? lerp(-1.2, -2.5, easeOut(t / 0.2)) : lerp(-2.5, 0.9, easeInOut(clamp((t - 0.2) / 0.5))); break;
    case 'whip': {
      // Base angle sweeps overhead; each segment lags behind the one before,
      // so the whip curls back then cracks out straight.
      const N = 12, pts = [];
      const base = (tt) => (tt < 0.25 ? lerp(-1.2, -2.8, easeOut(clamp(tt / 0.25))) : lerp(-2.8, 0.05, easeOut(clamp((tt - 0.25) / 0.28))));
      const out = t < 0.62 ? 1 : 1 - clamp((t - 0.62) / 0.38) * 0.75;
      let x = HAND.x, y = HAND.y;
      const seg = (w.len / N) * out;
      pts.push([x, y]);
      for (let i = 1; i <= N; i++) {
        const ai = base(t - a.lag * i) + (t > 0.55 ? Math.sin(t * 30 - i * 0.8) * 0.06 * (1 - out + 0.3) : 0);
        x += Math.cos(ai) * seg; y += Math.sin(ai) * seg;
        pts.push([x, y]);
      }
      return { ang: base(t), ext: out, pts };
    }
    default: ang = lerp(a.a0 ?? -2, a.a1 ?? 0.4, easeOut(clamp(t / 0.6)));
  }
  const pose = { ang, ext };
  if (w.shape === 'flail') {
    // Ball trails behind the handle.
    const lagA = ang - 0.6 * Math.sin(t * Math.PI);
    const hl = 10, cl = (w.len - hl) * ext;
    const hx = HAND.x + Math.cos(ang) * hl, hy = HAND.y + Math.sin(ang) * hl;
    pose.pts = [[HAND.x, HAND.y], [hx, hy], [hx + Math.cos(lagA) * cl, hy + Math.sin(lagA) * cl]];
  }
  return pose;
}

// Segment from hand to tip (local), for hit boxes and trails.
export function tipOf(w, pose) {
  if (pose.pts) return pose.pts[pose.pts.length - 1];
  const L = w.len * pose.ext + 4;
  return [HAND.x + Math.cos(pose.ang) * L, HAND.y + Math.sin(pose.ang) * L];
}

// World-space hit box for the current pose: bounding box of the blade.
export function weaponBox(w, pose, ox, oy, facing) {
  const pts = pose.pts ? pose.pts.slice(Math.floor(pose.pts.length / 3)) : [[HAND.x, HAND.y], tipOf(w, pose)];
  if (!pose.pts) {
    // Sample along the blade so the box hugs it.
    const [tx, ty] = pts[1];
    pts.push([(HAND.x + tx) / 2, (HAND.y + ty) / 2]);
  }
  const pad = w.anim.motion === 'giant' ? 26 : Math.max(3, w.w + 1);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [px, py] of pts) {
    const X = ox + px * facing, Y = oy + py;
    x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
  }
  if (w.anim.motion === 'smash') y1 = Math.max(y1, oy);
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

function poly(ctx, pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

// Draw the weapon along +x from the hand (already rotated), length L.
function drawShape(ctx, w, L, time) {
  const c = w.colors, bw = w.w;
  const glow = c.glow || (w.element ? ELEMENTS[w.element].glow : null);
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 6; }
  switch (w.shape) {
    case 'dagger': case 'sword': case 'greatsword': case 'rapier': case 'katana': {
      const guard = w.shape === 'greatsword' ? 5 : w.shape === 'rapier' ? 3 : 3.5;
      ctx.fillStyle = c.hilt; ctx.fillRect(-5, -1, 5, 2.5);
      ctx.fillStyle = c.guard; ctx.fillRect(0, -guard, 2, guard * 2 + 0.5);
      if (w.shape === 'rapier') { ctx.beginPath(); ctx.arc(1, 0, 3, -1.6, 1.6); ctx.strokeStyle = c.guard; ctx.lineWidth = 1; ctx.stroke(); }
      const half = bw / 2, curve = w.anim.curve || 0;
      const pts = [];
      const steps = 6;
      for (let i = 0; i <= steps; i++) { const x = 2 + (L - 2) * (i / steps); pts.push([x, -half + curve * (i / steps) ** 2]); }
      pts.push([L + 3, curve * 0.9]);
      for (let i = steps; i >= 0; i--) { const x = 2 + (L - 2) * (i / steps); pts.push([x, half * (1 - 0.4 * (i / steps)) + curve * (i / steps) ** 2]); }
      poly(ctx, pts, c.blade);
      ctx.fillStyle = c.edge;
      ctx.fillRect(3, -half, L - 4, 1);
      break;
    }
    case 'axe': case 'hammer': case 'mace': case 'staff': case 'spear': case 'lance': case 'scythe': {
      const shaft = w.shape === 'lance' ? L * 0.35 : w.shape === 'spear' ? L - 7 : L - 3;
      ctx.fillStyle = c.hilt; ctx.fillRect(-6, -1, shaft + 6, 2);
      if (w.shape === 'axe') poly(ctx, [[L - 9, -1], [L - 4, -9], [L + 2, -8], [L + 3, 3], [L - 2, 8], [L - 9, 1]], c.blade);
      if (w.shape === 'axe') { ctx.fillStyle = c.edge; ctx.fillRect(L + 1, -7, 1.5, 9); }
      if (w.shape === 'hammer') { ctx.fillStyle = c.blade; ctx.fillRect(L - 6, -6, 8, 12); ctx.fillStyle = c.edge; ctx.fillRect(L + 1, -6, 1.5, 12); }
      if (w.shape === 'mace') {
        ctx.fillStyle = c.blade; ctx.beginPath(); ctx.arc(L, 0, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.edge; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + time; ctx.fillRect(L + Math.cos(a) * 5.5 - 1, Math.sin(a) * 5.5 - 1, 2, 2); }
      }
      if (w.shape === 'staff') {
        ctx.fillStyle = c.guard; ctx.fillRect(L - 4, -3, 3, 6);
        const g = ctx.createRadialGradient(L + 2, 0, 0, L + 2, 0, 6);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, w.element ? ELEMENTS[w.element].color : '#a0c8ff'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(L - 5, -7, 14, 14);
      }
      if (w.shape === 'spear') poly(ctx, [[L - 8, -3], [L + 4, 0], [L - 8, 3]], c.blade);
      if (w.shape === 'spear') { ctx.fillStyle = c.guard; ctx.fillRect(L - 10, -2, 2, 4); }
      if (w.shape === 'lance') {
        ctx.fillStyle = c.guard; ctx.fillRect(shaft - 2, -5, 3, 10);
        poly(ctx, [[shaft, -4], [L + 4, -0.5], [L + 4, 0.5], [shaft, 4]], c.blade);
        ctx.fillStyle = c.edge; ctx.fillRect(shaft + 2, -3, L - shaft, 1);
      }
      if (w.shape === 'scythe') {
        poly(ctx, [[L - 1, -2], [L + 2, 2], [L - 6, 10], [L - 20, 14], [L - 10, 8]], c.blade);
        ctx.fillStyle = c.edge; ctx.fillRect(L - 18, 13, 10, 1);
      }
      break;
    }
    case 'claw': {
      ctx.fillStyle = c.hilt; ctx.fillRect(-3, -3, 5, 6);
      for (const dy of [-3, 0, 3]) poly(ctx, [[1, dy - 1], [L, dy - 0.5 + dy * 0.2], [L + 2, dy * 0.3], [1, dy + 1]], c.blade);
      break;
    }
    default: break;
  }
  ctx.shadowBlur = 0;
}

function drawChain(ctx, w, pts, time) {
  const c = w.colors, style = w.anim.style || 'leather';
  const glow = w.element ? ELEMENTS[w.element].glow : null;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 5; }
  ctx.strokeStyle = c.blade;
  ctx.lineWidth = style === 'leather' ? 2 : 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (style === 'chain') { ctx.fillStyle = i % 2 ? c.edge : c.blade; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
    if (style === 'bone') { ctx.fillStyle = c.edge; ctx.fillRect(x - 2, y - 1, 4, 2); }
    if (style === 'thorn' && i % 2) { ctx.fillStyle = c.edge; ctx.fillRect(x - 0.5, y - 3, 1, 2); ctx.fillRect(x + 1, y + 1, 1, 2); }
    if (style === 'flame') { ctx.fillStyle = i % 2 ? c.edge : '#ffec90'; ctx.fillRect(x - 1, y - 2 - Math.sin(time * 40 + i) * 1.5, 2, 2); }
  }
  const [tx, ty] = pts[pts.length - 1];
  ctx.fillStyle = c.edge;
  if (style === 'morningstar') { ctx.beginPath(); ctx.arc(tx, ty, 3.5, 0, Math.PI * 2); ctx.fill(); }
  else ctx.fillRect(tx - 1.5, ty - 1.5, 3, 3);
  ctx.fillStyle = c.hilt; ctx.fillRect(pts[0][0] - 3, pts[0][1] - 1, 4, 3);
  ctx.shadowBlur = 0;
}

// The colossal energy blade of the ultimate weapon.
function drawGiant(ctx, w, pose, t, time) {
  const L = w.len;
  ctx.save();
  ctx.translate(HAND.x, HAND.y);
  ctx.rotate(pose.ang);
  const alpha = Math.sin(Math.PI * clamp((t - 0.1) / 0.75));
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 3; k >= 0; k--) {
    const width = 6 + k * 7;
    const g = ctx.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, `rgba(180,160,255,${0.05 * alpha})`);
    g.addColorStop(0.3, `rgba(160,140,255,${(0.18 - k * 0.03) * alpha})`);
    g.addColorStop(0.9, `rgba(220,230,255,${(0.28 - k * 0.05) * alpha})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    poly(ctx, [[4, -width / 2], [L - 20, -width / 2 - 2], [L + 10, 0], [L - 20, width / 2 + 2], [4, width / 2]], g);
  }
  // Crackling energy along the edge.
  ctx.strokeStyle = `rgba(255,255,255,${0.8 * alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 10; x < L; x += 8) ctx.lineTo(x, Math.sin(x * 0.3 + time * 50) * 3);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  // The hilt in the hand.
  ctx.save();
  ctx.translate(HAND.x, HAND.y);
  ctx.rotate(pose.ang);
  drawShape(ctx, { ...w, len: 26, shape: 'greatsword' }, 26, time);
  ctx.restore();
}

// Draw the weapon at time t (0..1) of the swing, plus its trail.
export function drawWeapon(ctx, w, t, time, trail) {
  const pose = weaponPose(w, t);
  if (w.anim.motion === 'giant') { drawGiant(ctx, w, pose, t, time); return pose; }
  // Trail from recent tip positions.
  if (trail && trail.length > 1) {
    const col = w.element ? ELEMENTS[w.element].color : 'rgb(220,230,255)';
    ctx.strokeStyle = col;
    for (let i = 1; i < trail.length; i++) {
      ctx.globalAlpha = (i / trail.length) * 0.45;
      ctx.lineWidth = 1 + (i / trail.length) * 3;
      ctx.beginPath(); ctx.moveTo(trail[i - 1][0], trail[i - 1][1]); ctx.lineTo(trail[i][0], trail[i][1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (pose.pts && w.shape === 'whip') { drawChain(ctx, w, pose.pts, time); return pose; }
  if (pose.pts && w.shape === 'flail') {
    const [h, m, b] = pose.pts;
    ctx.fillStyle = w.colors.hilt; ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(pose.ang); ctx.fillRect(-4, -1, 14, 2.5); ctx.restore();
    ctx.fillStyle = '#8a8aa0';
    for (let i = 1; i < 6; i++) ctx.fillRect(m[0] + (b[0] - m[0]) * i / 6 - 0.5, m[1] + (b[1] - m[1]) * i / 6 - 0.5, 1.5, 1.5);
    ctx.fillStyle = w.colors.blade; ctx.beginPath(); ctx.arc(b[0], b[1], 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = w.colors.edge; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.fillRect(b[0] + Math.cos(a) * 5.5 - 1, b[1] + Math.sin(a) * 5.5 - 1, 2, 2); }
    return pose;
  }
  ctx.save();
  ctx.translate(HAND.x, HAND.y);
  ctx.rotate(pose.ang);
  drawShape(ctx, w, w.len * pose.ext, time);
  ctx.restore();
  return pose;
}

// A static pose used for inventory icons.
export function drawWeaponIcon(ctx, w, size) {
  const s = size / 34;
  ctx.save();
  ctx.translate(size * 0.18, size * 0.82);
  ctx.scale(s * (w.len > 40 ? 34 / Math.min(w.len, 60) : 1), s * (w.len > 40 ? 34 / Math.min(w.len, 60) : 1));
  if (w.shape === 'whip') {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const a = -0.8 + Math.sin(i * 0.6) * 0.5; pts.push([i * 3, -i * 2.4 + Math.sin(i) * 3]); void a; }
    drawChain(ctx, w, pts, 0);
  } else if (w.shape === 'flail') {
    ctx.rotate(-0.8);
    ctx.fillStyle = w.colors.hilt; ctx.fillRect(0, -1, 12, 2.5);
    ctx.fillStyle = w.colors.blade; ctx.beginPath(); ctx.arc(24, 6, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a8aa0'; for (let i = 1; i < 5; i++) ctx.fillRect(12 + i * 2.4, i * 1.2, 1.5, 1.5);
  } else {
    ctx.rotate(-Math.PI / 4);
    drawShape(ctx, { ...w, len: Math.min(w.len, 40) }, Math.min(w.len, 40) - (w.shape === 'lance' ? 2 : 0), 0);
  }
  ctx.restore();
}
