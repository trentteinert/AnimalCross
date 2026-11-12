#!/usr/bin/env python3
"""Lays a 16-tile dual-grid terrain set out by corner mask for the game: tile for mask m sits at x = m * 16 in a 256x16 strip.
mask = TL*1 + TR*2 + BL*4 + BR*8, where a corner counts if the terrain covers that corner of the tile (found by looking at the pixels,
so the tiles may be in any order and in a 16x1 strip or a 4x4 square).
usage: python3 tools/make_tiles.py tools/src/grass_tiles.png assets/tiles/grass.png"""
import sys
from PIL import Image
import numpy as np

def tiles_of(img):
    w, h = img.size; cols, rows = w // 16, h // 16
    return [img.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)) for r in range(rows) for c in range(cols)]
def mask(t):
    a = np.array(t.convert('RGBA'))[:, :, 3] > 0
    return sum(k for k, (y, x) in {1: (1, 1), 2: (1, 14), 4: (14, 1), 8: (14, 14)}.items() if a[y, x])
if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]; out = Image.new('RGBA', (256, 16), (0, 0, 0, 0)); seen = {}
    for t in tiles_of(Image.open(src).convert('RGBA')):
        m = mask(t)
        if m in seen: raise SystemExit('two tiles have mask %d' % m)
        seen[m] = 1; out.paste(t, (m * 16, 0))
    if len(seen) != 16: raise SystemExit('missing masks: %s' % sorted(set(range(16)) - set(seen)))
    out.save(dst); print('ok: 16 tiles ->', dst)
