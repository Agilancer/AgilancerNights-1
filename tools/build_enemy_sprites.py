#!/usr/bin/env python3
"""Cut the enemy walk / attack / die animations out of the two enemy sheets.

Reads  assets/source/enemies_1.png, assets/source/enemies_2.png
       (opaque dark-navy background, blue labels, frames facing RIGHT)
Writes assets/enemies.png        packed atlas at game scale
       src/enemySprites.js       frame rects + anchors (bottom-centre of feet)

Re-run after editing the sheets:  python3 tools/build_enemy_sprites.py [--debug]
Requires: pillow, numpy, scipy.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent

# Panel frame lines measured from the sheets: x ranges per column, y ranges per row.
SHEETS = [
    dict(file='assets/source/enemies_1.png',
         cols=[(15, 312), (327, 610), (625, 909), (925, 1207), (1222, 1519)],
         rows=[(20, 488), (513, 980)],
         names=['orc_brute', 'dark_wizard', 'giant_spider', 'harpy', 'lich',
                'troll', 'minotaur', 'goblin_shaman', 'slime', 'banshee']),
    dict(file='assets/source/enemies_2.png',
         cols=[(15, 322), (338, 615), (631, 905), (922, 1202), (1219, 1520)],
         rows=[(35, 492), (513, 974)],
         names=['skeleton', 'evil_knight', 'zombie', 'goblin', 'orc',
                'skeleton_archer', 'wraith', 'spider', 'wolf', 'demon']),
]

# Height (game px) of the tallest walk frame, per enemy. The player is ~34px.
HEIGHT = {
    'orc_brute': 40, 'dark_wizard': 36, 'giant_spider': 26, 'harpy': 36, 'lich': 38,
    'troll': 46, 'minotaur': 46, 'goblin_shaman': 30, 'slime': 18, 'banshee': 36,
    'skeleton': 34, 'evil_knight': 38, 'zombie': 34, 'goblin': 26, 'orc': 38,
    'skeleton_archer': 34, 'wraith': 36, 'spider': 18, 'wolf': 26, 'demon': 42,
}

ANIMS = ['walk', 'attack', 'die']

# Frames per row (walk, attack, die), counted from the sheets.
COUNTS = {
    'orc_brute': (5, 5, 5), 'lich': (5, 4, 4), 'harpy': (4, 4, 3), 'minotaur': (4, 3, 3),
    'spider': (4, 3, 3), 'wolf': (4, 3, 4),
}


def backdrop_distance(rgb):
    """Colour distance from the (very uniform) navy backdrop of this panel."""
    bg = np.median(rgb.reshape(-1, 3), axis=0)
    return np.sqrt(((rgb - bg) ** 2).sum(axis=2))


def foreground(rgb):
    """Everything that isn't the navy backdrop or the blue UI text/lines."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(r, g)
    # Label text / panel lines: saturated blue-violet with red ~= green.
    label = (b > mx + 40) & (np.abs(r - g) < 22) & (mx < 130)
    label = ndimage.binary_dilation(label, iterations=2)
    fg = (backdrop_distance(rgb) > 8) & ~label
    return ndimage.binary_opening(fg, iterations=1)


# Ghostly enemies are made of blue/violet wisps that look like the label text,
# so inside their sprite rows only the backdrop and separator lines are keyed out.
GHOSTS = {'wraith', 'banshee'}


def ghost_foreground(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(r, g)
    line = (b > mx + 25) & (rgb.max(axis=2) < 70)   # faint separator lines
    label = ndimage.binary_dilation((b > mx + 60) & (np.abs(r - g) < 12), iterations=2)
    return ndimage.binary_opening((backdrop_distance(rgb) > 8) & ~line & ~label, iterations=1)


def bands(mask, min_gap=10, min_h=18):
    """Split rows of a mask into horizontal bands of content."""
    prof = mask.sum(axis=1) > 2
    out, start, gap = [], None, 0
    for y, v in enumerate(prof):
        if v:
            if start is None:
                start = y
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                if y - gap - start >= min_h:
                    out.append((start, y - gap + 1))
                start, gap = None, 0
    if start is not None and len(prof) - start >= min_h:
        out.append((start, len(prof)))
    return out


def frames_in_band(mask, n):
    """Split a band into n frames, cutting at the emptiest column near even spacing."""
    cols = mask.sum(axis=0)
    xs = np.nonzero(cols)[0]
    xa, xb = xs.min(), xs.max() + 1
    w = (xb - xa) / n
    cuts = [xa]
    for i in range(1, n):
        t = xa + w * i
        lo, hi = int(t - 0.3 * w), int(t + 0.3 * w)
        window = cols[lo:hi]
        best = lo + int(np.argmin(window + np.abs(np.arange(lo, hi) - t) * 0.01))
        cuts.append(best)
    cuts.append(xb)
    out = []
    for c0, c1 in zip(cuts, cuts[1:]):
        m = np.zeros_like(mask)
        m[:, c0:c1] = mask[:, c0:c1]
        lab, k = ndimage.label(m, structure=np.ones((3, 3)))
        if k:
            sizes = ndimage.sum(m, lab, range(1, k + 1))
            m = np.isin(lab, [i + 1 for i in range(k) if sizes[i] >= 6])
        out.append(m)
    return out


def main():
    debug = '--debug' in sys.argv
    tiles = []  # (enemy, anim, idx, rgba small, ax, ay)
    for sheet in SHEETS:
        src = np.array(Image.open(ROOT / sheet['file']).convert('RGB')).astype(int)
        dbg = Image.open(ROOT / sheet['file']).convert('RGB') if debug else None
        dd = ImageDraw.Draw(dbg) if debug else None
        k = 0
        for (py0, py1) in sheet['rows']:
            for (px0, px1) in sheet['cols']:
                name = sheet['names'][k]; k += 1
                x0, y0 = px0 + 6, py0 + 55              # skip border + title
                x1, y1 = px1 - 6, py1 - 6
                rgb = src[y0:y1, x0:x1]
                fg = foreground(rgb)
                bs = bands(fg)
                # Drop the thin label bands ("WALK" etc. are keyed out, but be safe).
                bs = [b for b in bs if b[1] - b[0] >= 24]
                if len(bs) != 3:
                    print(f'!! {name}: found {len(bs)} bands {bs}')
                scale = None
                cut = {}
                if name in GHOSTS:
                    gfg = ghost_foreground(rgb)
                    # Grow each band a little; wisps trail below the body.
                    bs = [(max(0, a - 4), min(fg.shape[0], b + 10)) for a, b in bs]
                for ai, (anim, (by0, by1)) in enumerate(zip(ANIMS, bs[:3])):
                    band = (gfg if name in GHOSTS else fg)[by0:by1]
                    fr = frames_in_band(band, COUNTS.get(name, (4, 4, 4))[ai])
                    cut[anim] = []
                    for m in fr:
                        m = ndimage.binary_fill_holes(m)
                        ys, xs = np.nonzero(m)
                        fy0, fy1, fx0, fx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
                        rgba = np.zeros((fy1 - fy0, fx1 - fx0, 4), np.uint8)
                        rgba[..., :3] = rgb[by0 + fy0:by0 + fy1, fx0:fx1]
                        rgba[..., 3] = np.where(m[fy0:fy1, fx0:fx1], 255, 0)
                        cut[anim].append((rgba, fx0, fy0, by1 - by0))
                        if debug:
                            dd.rectangle([x0 + fx0, y0 + by0 + fy0, x0 + fx1, y0 + by0 + fy1], outline=(255, 0, 0))
                walk_h = max(r.shape[0] for r, *_ in cut['walk'])
                scale = HEIGHT[name] / walk_h
                print(f'{name:16s} walk {len(cut["walk"])} attack {len(cut["attack"])} die {len(cut["die"])}  scale {scale:.3f}')
                for anim in ANIMS:
                    frames = cut[anim]
                    # Ground line of the band = lowest pixel of any frame in it.
                    ground = max(fy0 + r.shape[0] for r, fx0, fy0, _ in frames)
                    for i, (rgba, fx0, fy0, bh) in enumerate(frames):
                        img = Image.fromarray(rgba, 'RGBA').convert('RGBa')
                        w = max(1, round(img.width * scale)); h = max(1, round(img.height * scale))
                        small = np.array(img.resize((w, h), Image.LANCZOS).convert('RGBA'))
                        small[..., 3] = np.where(small[..., 3] >= 110, 255, 0)
                        small[small[..., 3] == 0] = 0
                        # Horizontal anchor: centre of the bottom 40% (legs/body), stable
                        # while weapons swing out front.
                        a = rgba[int(rgba.shape[0] * 0.6):, :, 3].astype(float)
                        cols = a.sum(axis=0)
                        axs = (cols * np.arange(len(cols))).sum() / max(cols.sum(), 1)
                        ax = round(axs * scale)
                        ay = round((ground - fy0) * scale)
                        tiles.append((name, anim, i, Image.fromarray(small, 'RGBA'), ax, ay))
        if debug:
            dbg.save(ROOT / f'assets/source/_debug_{Path(sheet["file"]).stem}.png')

    # Pack: one row per enemy-animation.
    pad = 1
    rows = {}
    for t in tiles:
        rows.setdefault((t[0], t[1]), []).append(t)
    width = max(sum(t[3].width + pad for t in r) for r in rows.values()) + pad
    height = sum(max(t[3].height for t in r) + pad for r in rows.values()) + pad
    atlas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    data = {}
    y = pad
    for (name, anim), r in rows.items():
        x = pad
        data.setdefault(name, {})[anim] = []
        for t in r:
            atlas.paste(t[3], (x, y))
            data[name][anim].append(dict(x=x, y=y, w=t[3].width, h=t[3].height, ax=t[4], ay=t[5]))
            x += t[3].width + pad
        y += max(t[3].height for t in r) + pad
    atlas.save(ROOT / 'assets/enemies.png')
    (ROOT / 'src/enemySprites.js').write_text(
        '// Generated by tools/build_enemy_sprites.py -- do not edit by hand.\n'
        '// Frames face RIGHT. (ax, ay) is the pixel that sits on the enemy\'s bottom-centre.\n'
        "export const ENEMY_ATLAS = 'assets/enemies.png';\n"
        f'export const ENEMY_FRAMES = {json.dumps(data, separators=(",", ":"))};\n')
    print(f'wrote assets/enemies.png ({atlas.width}x{atlas.height}) and src/enemySprites.js')


if __name__ == '__main__':
    main()
