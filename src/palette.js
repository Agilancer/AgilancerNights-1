// Palette swaps for enemy sprites, built at runtime from the base atlas.
// Deeper parts of the castle (and every boss) use these variants.

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const f = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Each palette maps (h, s, l) -> (h, s, l). Hue is 0..1.
export const PALETTES = {
  crimson:   (h, s, l) => [0.99, clamp01(s * 0.9 + 0.35), l],
  frost:     (h, s, l) => [0.56, clamp01(s * 0.6 + 0.25), clamp01(l * 1.08 + 0.04)],
  void:      (h, s, l) => [0.76, clamp01(0.55 + s * 0.3), clamp01(1 - l) * 0.75],
  bone:      (h, s, l) => [0.11, s * 0.25, clamp01(l * 1.12)],
  toxic:     (h, s, l) => [0.28, clamp01(s + 0.3), l],
  gold:      (h, s, l) => [0.12, clamp01(s + 0.4), clamp01(l * 1.1 + 0.05)],
  shadow:    (h, s, l) => [0.7, s * 0.4, l * 0.45],
  flesh:     (h, s, l) => [0.97, clamp01(s * 0.5 + 0.35), clamp01(l * 1.05 + 0.08)],
  arcane:    (h, s, l) => [0.78, clamp01(s + 0.25), l],
  storm:     (h, s, l) => [0.15, clamp01(s + 0.2), clamp01(l * 1.15)],
  drowned:   (h, s, l) => [0.46, s * 0.5, l * 0.9],
  magma:     (h, s, l) => [0.03 + l * 0.08, clamp01(s + 0.5), clamp01(l * 1.1)],
  moon:      (h, s, l) => [0.62, s * 0.35, clamp01(l * 1.1)],
  nightlord: (h, s, l) => (l > 0.55 ? [0.0, 0.9, l * 0.7] : [0.75, 0.3, l * 0.35]),
};

const cache = {};
// Canvas with the recoloured atlas (or the image itself for no palette).
export function paletteAtlas(img, name) {
  if (!name || !PALETTES[name] || !img || !img.complete || !img.naturalWidth) return img;
  if (cache[name]) return cache[name];
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const px = d.data, fn = PALETTES[name];
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const [h, s, l] = rgb2hsl(px[i], px[i + 1], px[i + 2]);
    const [r, g, b] = hsl2rgb(...fn(h, s, l));
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  }
  x.putImageData(d, 0, 0);
  cache[name] = c;
  return c;
}
