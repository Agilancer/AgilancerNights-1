#!/usr/bin/env python3
"""Cut the two 50-tile castle sheets into game atlases.

Reads  assets/source/tileset_1.png, assets/source/tileset_2.png
Writes assets/tiles.png      10x10 grid of 32x32 tiles (sheet 1 = rows 0-4, sheet 2 = rows 5-9)
       assets/tiles_big.png  same grid at 64x64 (for props drawn 2x2)
       src/tileIndex.js      tile name -> atlas index

"Prop" tiles (banners, candles, platforms, spikes...) have the dark backdrop
behind them made transparent so they can sit on top of the wall background.
Re-run after editing the sheets:  python3 tools/build_tiles.py
Requires: pillow, numpy, scipy.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent

# Frame lines of each box, measured from the sheets: (left, right) and (top, bottom).
SHEETS = [
    dict(
        file='assets/source/tileset_1.png',
        cols=[(38, 158), (190, 308), (340, 457), (489, 606), (637, 753), (785, 903), (935, 1053), (1085, 1203), (1235, 1352), (1383, 1501)],
        rows=[(99, 227), (283, 411), (468, 597), (654, 780), (836, 962)],
        names=[
            'brick', 'brick_moss', 'brick_blood', 'wall_ledge', 'battlement', 'battlement_2', 'arcade_wall', 'column', 'window_blue', 'window_cross',
            'curtain', 'curtain_torn', 'banner_blue', 'banner_lion', 'torch', 'candelabra', 'chandelier', 'lantern', 'door', 'arch',
            'stairs_blue', 'stairs_brick', 'stairs_wood', 'stairs_ruin', 'ladder_wall', 'ladder_wall_2', 'fence', 'balustrade', 'gargoyle', 'statue',
            'gothic_arch', 'window_tall', 'window_broken', 'wall_crumble', 'statue_alcove', 'coffin_alcove', 'crate', 'barrel', 'crates', 'sack',
            'bookshelf', 'fireplace', 'clock', 'stairs_carpet', 'tapestry', 'banner_red', 'waterfall', 'water', 'lavafall', 'spikes',
        ],
    ),
    dict(
        file='assets/source/tileset_2.png',
        cols=[(31, 148), (182, 299), (332, 451), (484, 602), (635, 752), (785, 902), (935, 1053), (1086, 1204), (1237, 1355), (1388, 1505)],
        rows=[(99, 228), (287, 406), (471, 595), (655, 774), (830, 949)],
        names=[
            'wall_1', 'wall_2', 'wall_red', 'wall_4', 'corner_l', 'corner_r', 'pillar', 'ruined_wall', 'window_frame', 'arrow_slit',
            'floor_stone', 'floor_cracked', 'floor_moss', 'floor_dark', 'floor_carpet', 'floor_checker', 'floor_wood', 'floor_grate', 'floor_lava', 'floor_ice',
            'plat_stone', 'plat_vines', 'plat_broken', 'plat_brick', 'plat_chain', 'plat_iron', 'plat_curtain', 'plat_wood', 'plat_ice', 'plat_lava',
            'stairs_up', 'stairs_down', 'ramp_up', 'ramp_down', 'stairs_spiral', 'ladder', 'rope_ladder', 'climb_wall', 'spike_pit', 'water_deep',
            'chains', 'gargoyle_2', 'gargoyle_head', 'iron_fence', 'bridge', 'bridge_broken', 'mover', 'waterfall_2', 'waterfall_edge', 'chandelier_2',
        ],
    ),
]

# Tiles whose dark backdrop becomes transparent.
PROPS = {
    'column', 'window_blue', 'window_cross', 'banner_blue', 'banner_lion', 'candelabra', 'chandelier', 'lantern', 'door',
    'fence', 'balustrade', 'gargoyle', 'statue', 'gothic_arch', 'window_tall', 'crate', 'barrel', 'crates', 'sack',
    'clock', 'banner_red', 'spikes', 'curtain_torn',
    'pillar', 'window_frame', 'arrow_slit',
    'plat_stone', 'plat_vines', 'plat_broken', 'plat_brick', 'plat_chain', 'plat_iron', 'plat_curtain', 'plat_wood', 'plat_ice', 'plat_lava',
    'ladder', 'rope_ladder', 'spike_pit', 'chains', 'gargoyle_2', 'gargoyle_head', 'iron_fence', 'mover', 'chandelier_2',
}

INSET = 3        # skip the frame line itself (props)
INSET_SOLID = 6  # opaque tiles: stay clear of the frame so tiles repeat without seams


def key_backdrop(rgba):
    """Make dark pixels connected to the tile border transparent."""
    rgb = rgba[..., :3].astype(int)
    dark = rgb.max(axis=2) < 40
    lab, _ = ndimage.label(dark)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    # Swallow the 1px dark fringe left behind.
    bg = ndimage.binary_dilation(bg, iterations=1) & (rgb.max(axis=2) < 70) | bg
    out = rgba.copy()
    out[..., 3] = np.where(bg, 0, 255)
    return out


def cut_torch(rgba):
    """Keep the flame and bracket, drop the (torch-lit) brick wall behind it."""
    rgb = rgba[..., :3].astype(int)
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    flame = (r > 190) & (g > 70) & (xx > w * 0.3) & (xx < w * 0.7) & (yy < h * 0.62)
    flame = ndimage.binary_dilation(flame, iterations=1)
    bracket = (r > g) & (g > b) & (r > 60) & (xx > w * 0.36) & (xx < w * 0.64) & (yy >= h * 0.5) & (yy < h * 0.95)
    bracket |= (r > g) & (g > b) & (r > 60) & (xx > w * 0.26) & (xx < w * 0.74) & (yy >= h * 0.5) & (yy < h * 0.62)
    keep = flame | bracket
    out = rgba.copy()
    out[..., 3] = np.where(keep, 255, 0)
    return out


CUTOUTS = {'torch': cut_torch}


def shrink(rgba, size, prop):
    img = Image.fromarray(rgba, 'RGBA').convert('RGBa').resize((size, size), Image.LANCZOS).convert('RGBA')
    a = np.array(img)
    if prop:
        a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
        a[a[..., 3] == 0] = 0
    else:
        a[..., 3] = 255
    return a


def main():
    small = np.zeros((320, 320, 4), np.uint8)
    big = np.zeros((640, 640, 4), np.uint8)
    index = {}
    tops = {}
    for s, sheet in enumerate(SHEETS):
        src = np.array(Image.open(ROOT / sheet['file']).convert('RGBA'))
        for r, (y0, y1) in enumerate(sheet['rows']):
            for c, (x0, x1) in enumerate(sheet['cols']):
                i = s * 50 + r * 10 + c
                name = sheet['names'][r * 10 + c]
                prop = name in PROPS or name in CUTOUTS
                ins = INSET if prop else INSET_SOLID
                crop = src[y0 + ins:y1 - ins + 1, x0 + ins:x1 - ins + 1].copy()
                if name in CUTOUTS:
                    crop = CUTOUTS[name](crop)
                elif prop:
                    crop = key_backdrop(crop)
                gy, gx = divmod(i, 10)
                small[gy * 32:(gy + 1) * 32, gx * 32:(gx + 1) * 32] = shrink(crop, 32, prop)
                big[gy * 64:(gy + 1) * 64, gx * 64:(gx + 1) * 64] = shrink(crop, 64, prop)
                assert name not in index, name
                index[name] = i
                if prop:
                    # First row that is mostly solid = the tile's walking surface.
                    a = small[gy * 32:(gy + 1) * 32, gx * 32:(gx + 1) * 32, 3]
                    dense = np.nonzero((a > 0).mean(axis=1) >= 0.6)[0]
                    if len(dense) and dense[0] > 0:
                        tops[name] = int(dense[0])
    Image.fromarray(small).save(ROOT / 'assets/tiles.png')
    Image.fromarray(big).save(ROOT / 'assets/tiles_big.png')
    (ROOT / 'src/tileIndex.js').write_text(
        '// Generated by tools/build_tiles.py -- do not edit by hand.\n'
        '// Index into assets/tiles.png (10 tiles per row, 32x32) and assets/tiles_big.png (64x64).\n'
        f'export const TILE_INDEX = {json.dumps(index, separators=(",", ":"))};\n'
        '// Rows of empty space above the surface of prop tiles (e.g. platforms), in 32px units.\n'
        f'export const TILE_TOP = {json.dumps(tops, separators=(",", ":"))};\n'
    )
    print('wrote assets/tiles.png, assets/tiles_big.png, src/tileIndex.js', len(index), 'tiles')


if __name__ == '__main__':
    main()
