#!/usr/bin/env python3
"""Cut the player animations out of the source sprite sheet.

Reads  assets/source/player_sheet.png  (large, transparent background, frames
facing RIGHT) and writes:
  assets/player.png          packed atlas, scaled to game resolution
  src/playerSprites.js       frame rectangles + anchor points

Every frame's anchor is the point that sits on the hit box's bottom-centre.
Re-run after editing the sheet:  python3 tools/build_player_sprites.py
Requires: pillow, numpy, scipy.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/source/player_sheet.png'
OUT_PNG = ROOT / 'assets/player.png'
OUT_JS = ROOT / 'src/playerSprites.js'

SCALE = 0.29        # sheet px -> game px (a standing figure ends up ~32px tall)
HIT_H = 32          # player hit box height in game px (for mid-air anchoring)

# Each animation: rows of the sheet are found by clicking through connected
# components; frames are listed by the approximate (x, y) of the figure's
# top-left in the sheet, left to right.
# anchor 'ground': feet on the group's ground line.
# anchor 'air':    figure's vertical centre on the hit box's centre.
ANIMS = {
    'run':    dict(anchor='ground', frames=[(30, 76), (125, 78), (225, 80), (325, 75), (426, 74), (529, 75), (629, 79), (719, 77)]),
    'jump':   dict(anchor='air',    frames=[(848, 98), (955, 70), (1049, 46), (1146, 26), (1250, 57), (1353, 96)]),
    'attack': dict(anchor='ground', frames=[(32, 318), (143, 318), (247, 317), (358, 315), (476, 317), (583, 320)]),
    'cast':   dict(anchor='ground', frames=[(726, 321), (833, 325), (941, 324), (1044, 322), (1137, 322), (1235, 319), (1327, 323), (1423, 322)]),
    'duck':   dict(anchor='ground', frames=[(743, 600), (822, 617), (896, 631), (976, 630)]),
    'slide':  dict(anchor='ground', frames=[(1079, 595), (1165, 604), (1265, 608), (1354, 610), (1434, 616)]),
}


def main():
    sheet = np.array(Image.open(SRC).convert('RGBA'))
    alpha = sheet[..., 3]
    labels, _ = ndimage.label(alpha > 160, structure=np.ones((3, 3)))
    boxes = ndimage.find_objects(labels)

    def component_at(x, y):
        # Find the component whose bbox top-left is closest to (x, y).
        best, bestd = None, 1e9
        for i, s in enumerate(boxes):
            if s is None or (s[1].stop - s[1].start) > 200:  # skip panel borders
                continue
            d = abs(s[1].start - x) + abs(s[0].start - y)
            if d < bestd:
                best, bestd = i + 1, d
        assert bestd < 12, f'no sprite near {(x, y)}'
        return best

    cut = []  # (anim, index, rgba image in game px, anchor mode, src bbox)
    for name, spec in ANIMS.items():
        for idx, (fx, fy) in enumerate(spec['frames']):
            lab = component_at(fx, fy)
            core = labels == lab
            # Grow a little to pick up the soft outline pixels.
            mask = ndimage.binary_dilation(core, iterations=3) & (alpha > 40)
            ys, xs = np.nonzero(mask)
            y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            rgba = sheet[y0:y1, x0:x1].copy()
            rgba[..., 3] = np.where(mask[y0:y1, x0:x1], rgba[..., 3], 0)
            cut.append((name, idx, rgba, (x0, y0, x1, y1)))

    # Horizontal anchor: centroid of the head/torso (top 45% of the figure),
    # which stays stable while limbs, cape and hair swing around.
    def anchor_x(rgba):
        h = rgba.shape[0]
        a = rgba[: int(h * 0.45), :, 3].astype(float)
        cols = a.sum(axis=0)
        return (cols * np.arange(len(cols))).sum() / cols.sum()

    ground = {}
    for name, idx, rgba, (x0, y0, x1, y1) in cut:
        ground[name] = max(ground.get(name, 0), y1)

    frames = {}
    tiles = []
    for name, idx, rgba, (x0, y0, x1, y1) in cut:
        img = Image.fromarray(rgba, 'RGBA').convert('RGBa')  # premultiplied for clean resize
        w = max(1, round(img.width * SCALE))
        h = max(1, round(img.height * SCALE))
        small = np.array(img.resize((w, h), Image.LANCZOS).convert('RGBA'))
        # Hard pixel-art edges.
        small[..., 3] = np.where(small[..., 3] >= 110, 255, 0)
        small[small[..., 3] == 0] = 0
        ax = anchor_x(rgba) * SCALE
        if ANIMS[name]['anchor'] == 'ground':
            ay = (ground[name] - y0) * SCALE
        else:
            ay = h / 2 + HIT_H / 2
        tiles.append((name, idx, Image.fromarray(small, 'RGBA'), round(ax), round(ay)))

    # Pack: one row per animation.
    pad = 1
    width = max(sum(t[2].width + pad for t in tiles if t[0] == n) for n in ANIMS) + pad
    heights = {n: max(t[2].height for t in tiles if t[0] == n) for n in ANIMS}
    atlas = Image.new('RGBA', (width, sum(heights.values()) + pad * (len(ANIMS) + 1)), (0, 0, 0, 0))
    y = pad
    for n in ANIMS:
        x = pad
        frames[n] = []
        for name, idx, img, ax, ay in tiles:
            if name != n:
                continue
            atlas.paste(img, (x, y))
            frames[n].append(dict(x=x, y=y, w=img.width, h=img.height, ax=ax, ay=ay))
            x += img.width + pad
        y += heights[n] + pad
    atlas.save(OUT_PNG)

    OUT_JS.write_text(
        '// Generated by tools/build_player_sprites.py -- do not edit by hand.\n'
        '// Frames face RIGHT. (ax, ay) is the pixel that sits on the hit box bottom-centre.\n'
        f"export const PLAYER_ATLAS = 'assets/player.png';\n"
        f'export const PLAYER_FRAMES = {json.dumps(frames, separators=(",", ":"))};\n'
    )
    print(f'wrote {OUT_PNG.relative_to(ROOT)} ({atlas.width}x{atlas.height}) and {OUT_JS.relative_to(ROOT)}')
    for n in ANIMS:
        print(f'  {n}: {len(frames[n])} frames, heights {[f["h"] for f in frames[n]]}')


if __name__ == '__main__':
    main()
