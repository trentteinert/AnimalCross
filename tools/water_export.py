#!/usr/bin/env python3
"""The animated water edges (tools/src/Moving_water.aseprite): the visible water layer, every frame, laid out by corner mask like the other terrain sets
(water tile for mask m at x = m * 16; mask = which corners are water: TL 1, TR 2, BL 4, BR 8), one 256 x 16 row per frame -> assets/tiles/water_anim.png.
Which tile is which is read from the sand layer under it (the water is where the sand is not), because the moving edges themselves wobble past the corners.
The white pixels are the foam line; the blue is only a placeholder (the game colours the water itself, see js/water.js).
Run:  python3 tools/water_export.py"""
import sys; sys.path.insert(0, 'tools')
from ase_frames import read_frames
from PIL import Image
import numpy as np
W, H, L, F, durs = read_frames('tools/src/Moving_water.aseprite')
names = [l['name'] for l in L]; wl = next(i for i, l in enumerate(L) if l['vis'] and l['type'] == 0); sand = names.index('Layer 2')
def corners(t):
    a = np.array(t)[:, :, 3] > 0
    return sum(k for k, (y, x) in {1: (1, 1), 2: (1, 14), 4: (14, 1), 8: (14, 14)}.items() if a[y, x])
pos = {}
for r in range(4):
    for c in range(4):
        m = 15 - corners(F[0][sand].crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)))
        if m in pos.values(): raise SystemExit('two tiles with water mask %d' % m)
        pos[(c, r)] = m
sheet = Image.new('RGBA', (256, 16 * len(F)))
for f, fr in enumerate(F):
    for (c, r), m in pos.items(): sheet.paste(fr[wl].crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)), (m * 16, f * 16))
sheet.save('assets/tiles/water_anim.png')
open('js/waterdata.js', 'w').write('// written by tools/water_export.py: the animated water edge tiles (assets/tiles/water_anim.png): one row per frame, how long each frame shows (ms)\nconst WATER_ANIM = { frames: %d, ms: %s };\n' % (len(F), durs))
print('water_anim.png', sheet.size, len(F), 'frames', sorted(pos.values()))
