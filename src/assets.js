import { TILE_INDEX } from './tileIndex.js';

// Images are only created in a browser; the level checker runs in Node.
const load = (src) => {
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.src = src;
  return img;
};

export const images = {
  tiles: load('assets/tiles.png'),
  tilesBig: load('assets/tiles_big.png'),
};

const ready = (img) => img && img.complete && img.naturalWidth > 0;

// Draw a named tile. `size` 32 uses the normal atlas; anything larger uses
// the 64px atlas so big props stay detailed. (dw, dh) default to size.
export function drawTile(ctx, name, dx, dy, size = 32, dw = size, dh = size) {
  const i = TILE_INDEX[name];
  if (i === undefined) return;
  const big = size > 32;
  const img = big ? images.tilesBig : images.tiles;
  if (!ready(img)) return;
  const s = big ? 64 : 32;
  ctx.drawImage(img, (i % 10) * s, Math.floor(i / 10) * s, s, s, dx, dy, dw, dh);
}
