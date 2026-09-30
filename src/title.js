// The animated title screen, drawn at the display canvas' native resolution.
const hash = (i, s) => {
  let h = (i * 374761393 + s * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// A fixed castle silhouette: towers with spires, walls, arches and windows.
function castleShape(seed) {
  const towers = [];
  let x = -0.02;
  let i = 0;
  while (x < 1.04) {
    const main = Math.abs(x - 0.5) < 0.09;
    const w = main ? 0.07 : 0.03 + hash(i, seed) * 0.05;
    const h = main ? 0.62 : 0.2 + hash(i, seed + 1) * 0.28 * (1 - Math.abs(x - 0.5));
    towers.push({ x, w, h, spire: hash(i, seed + 2) > 0.25 || main, win: Math.floor(2 + hash(i, seed + 3) * 5) });
    x += w + 0.005 + hash(i, seed + 4) * 0.03;
    i++;
  }
  return towers;
}
const CASTLE = castleShape(3);

export class Title {
  constructor() {
    this.t = 0;
    this.bats = Array.from({ length: 14 }, (_, i) => ({ x: hash(i, 9), y: 0.15 + hash(i, 10) * 0.3, s: 0.02 + hash(i, 11) * 0.03, p: hash(i, 12) * 6 }));
    this.embers = Array.from({ length: 50 }, (_, i) => ({ x: hash(i, 20), y: hash(i, 21), s: 0.02 + hash(i, 22) * 0.05 }));
    this.flash = 0;
    this.nextBolt = 3;
  }

  update(dt) {
    this.t += dt;
    for (const b of this.bats) { b.x += b.s * dt; if (b.x > 1.1) b.x = -0.1; }
    for (const e of this.embers) { e.y -= e.s * dt; e.x += Math.sin(this.t + e.y * 10) * 0.002; if (e.y < -0.05) e.y = 1.05; }
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) { this.flash = 1; this.bolt = { x: 0.15 + Math.random() * 0.7, seed: Math.random() }; this.nextBolt = 4 + Math.random() * 6; }
    this.flash = Math.max(0, this.flash - dt * 2.2);
  }

  draw(ctx, W, H) {
    const t = this.t;
    // Sky.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#07030f'); sky.addColorStop(0.45, '#220a26'); sky.addColorStop(0.8, '#4a1022'); sky.addColorStop(1, '#12040a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      const a = 0.25 + 0.6 * Math.abs(Math.sin(t * (0.5 + hash(i, 1)) + i));
      ctx.fillStyle = `rgba(255,240,255,${a * 0.8})`;
      ctx.fillRect(hash(i, 2) * W, hash(i, 3) * H * 0.6, hash(i, 4) > 0.9 ? 2 : 1, hash(i, 4) > 0.9 ? 2 : 1);
    }
    // Blood moon.
    const mx = W * 0.74, my = H * 0.26, mr = Math.min(W, H) * 0.15;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 2.6);
    halo.addColorStop(0, 'rgba(255,60,50,0.35)'); halo.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    const moon = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    moon.addColorStop(0, '#ffd8c0'); moon.addColorStop(0.6, '#e0604a'); moon.addColorStop(1, '#8a1a1a');
    ctx.fillStyle = moon; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,20,20,0.35)';
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(mx + (hash(i, 30) - 0.5) * mr * 1.3, my + (hash(i, 31) - 0.5) * mr * 1.3, mr * (0.06 + hash(i, 32) * 0.12), 0, Math.PI * 2); ctx.fill(); }
    // Clouds drifting across the moon.
    for (let i = 0; i < 6; i++) {
      const cx = ((hash(i, 40) + t * 0.008 * (1 + i * 0.3)) % 1.4 - 0.2) * W, cy = H * (0.18 + hash(i, 41) * 0.25);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.18);
      g.addColorStop(0, 'rgba(30,10,30,0.55)'); g.addColorStop(1, 'rgba(30,10,30,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - W * 0.2, cy - W * 0.1, W * 0.4, W * 0.2);
    }
    // Lightning.
    if (this.flash > 0.3 && this.bolt) {
      ctx.strokeStyle = `rgba(230,220,255,${this.flash})`; ctx.lineWidth = Math.max(1, W / 500);
      ctx.beginPath();
      let x = this.bolt.x * W, y = 0;
      ctx.moveTo(x, y);
      for (let i = 0; i < 12; i++) { x += (hash(i, this.bolt.seed * 1000) - 0.5) * W * 0.05; y += H * 0.045; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // Castle silhouette.
    const base = H * 0.86;
    ctx.fillStyle = this.flash > 0 ? `rgb(${20 + this.flash * 60},${10 + this.flash * 40},${24 + this.flash * 70})` : '#0a0410';
    for (const tw of CASTLE) {
      const x = tw.x * W, w = tw.w * W, h = tw.h * H;
      ctx.fillRect(x, base - h, w, h + H);
      // Battlements.
      for (let b = 0; b < w; b += w / 4) ctx.fillRect(x + b, base - h - w * 0.12, w / 8, w * 0.12);
      if (tw.spire) { ctx.beginPath(); ctx.moveTo(x - w * 0.12, base - h); ctx.lineTo(x + w / 2, base - h - w * 1.6); ctx.lineTo(x + w * 1.12, base - h); ctx.fill(); }
    }
    ctx.fillRect(0, base - H * 0.12, W, H);
    // Arches in the wall.
    ctx.fillStyle = '#05020a';
    for (let i = 0; i < 9; i++) { const ax = W * (0.08 + i * 0.105), aw = W * 0.03; ctx.fillRect(ax, base - H * 0.07, aw, H * 0.07); ctx.beginPath(); ctx.arc(ax + aw / 2, base - H * 0.07, aw / 2, Math.PI, 0); ctx.fill(); }
    // Lit windows.
    for (const [i, tw] of CASTLE.entries()) {
      for (let k = 0; k < tw.win; k++) {
        if (hash(i * 13 + k, 50) < 0.45) continue;
        const flick = 0.55 + 0.45 * Math.sin(t * (2 + hash(k, i)) + k * 3 + i);
        const wx = (tw.x + tw.w * (0.3 + hash(k, i + 60) * 0.4)) * W, wy = base - tw.h * H * (0.2 + k / (tw.win + 1) * 0.75);
        ctx.fillStyle = `rgba(255,${150 + 60 * flick},70,${0.55 + 0.45 * flick})`;
        ctx.fillRect(wx, wy, Math.max(2, W * 0.004), Math.max(3, H * 0.012));
      }
    }
    // Fog.
    for (let i = 0; i < 4; i++) {
      const fy = base - H * 0.02 + i * H * 0.03;
      const g = ctx.createLinearGradient(0, fy - H * 0.06, 0, fy + H * 0.06);
      g.addColorStop(0, 'rgba(60,20,50,0)'); g.addColorStop(0.5, `rgba(80,30,70,${0.25 + 0.1 * Math.sin(t * 0.6 + i)})`); g.addColorStop(1, 'rgba(60,20,50,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, fy - H * 0.06, W, H * 0.12);
    }
    // Bats.
    ctx.fillStyle = '#050208';
    for (const b of this.bats) {
      const x = b.x * W, y = b.y * H + Math.sin(t * 2 + b.p) * H * 0.02, s = W * 0.008, f = Math.sin(t * 16 + b.p);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 2, y - s * f); ctx.lineTo(x - s, y + s * 0.3); ctx.lineTo(x, y + s * 0.5); ctx.lineTo(x + s, y + s * 0.3); ctx.lineTo(x + s * 2, y - s * f); ctx.closePath(); ctx.fill();
    }
    // Embers.
    for (const e of this.embers) {
      ctx.fillStyle = `rgba(255,${120 + e.s * 1500},60,${0.4 + 0.5 * Math.sin(t * 3 + e.x * 20)})`;
      ctx.fillRect(e.x * W, e.y * H, Math.max(1, W / 600), Math.max(1, W / 600));
    }
    // Title.
    const ts = Math.min(W / 9.5, H / 4.2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(ts)}px 'UnifrakturCook', 'Cinzel Decorative', Georgia, serif`;
    const ty = H * 0.5;
    ctx.shadowColor = 'rgba(255,60,40,0.8)';
    ctx.shadowBlur = ts * 0.35 * (0.8 + 0.2 * Math.sin(t * 2));
    const gold = ctx.createLinearGradient(0, ty - ts / 2, 0, ty + ts / 2);
    gold.addColorStop(0, '#fff4c8'); gold.addColorStop(0.45, '#e8b650'); gold.addColorStop(0.55, '#a8701c'); gold.addColorStop(1, '#f0c870');
    ctx.fillStyle = gold;
    ctx.fillText('Agilancer Nights', W / 2, ty);
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, ts / 40);
    ctx.strokeStyle = 'rgba(60,10,10,0.9)';
    ctx.strokeText('Agilancer Nights', W / 2, ty);
    // Ornaments like the ones on the tile sheets.
    const tw = ctx.measureText('Agilancer Nights').width;
    ctx.strokeStyle = 'rgba(232,182,80,0.8)';
    ctx.lineWidth = Math.max(1, ts / 30);
    for (const d of [-1, 1]) {
      const x0 = W / 2 + d * (tw / 2 + ts * 0.3), x1 = W / 2 + d * (tw / 2 + ts * 1.6);
      ctx.beginPath(); ctx.moveTo(x0, ty); ctx.lineTo(x1, ty); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, ty - ts * 0.12); ctx.lineTo(x0 + d * ts * 0.18, ty); ctx.lineTo(x0, ty + ts * 0.12); ctx.lineTo(x0 - d * ts * 0.18, ty); ctx.closePath(); ctx.stroke();
    }
    ctx.font = `italic ${Math.round(ts * 0.26)}px Georgia, serif`;
    ctx.fillStyle = `rgba(230,200,190,${0.7 + 0.2 * Math.sin(t)})`;
    ctx.fillText('~  a nocturne in stone and blood  ~', W / 2, ty + ts * 0.72);
    ctx.textAlign = 'left';
    // Lightning flash wash.
    if (this.flash > 0) { ctx.fillStyle = `rgba(200,190,255,${this.flash * 0.18})`; ctx.fillRect(0, 0, W, H); }
  }
}
