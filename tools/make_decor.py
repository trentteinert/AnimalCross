#!/usr/bin/env python3
"""Cuts the painted scenery into the game's files.
  tools/src/tree_parts.png  trunk (bare tree with branches), crown (leaf cluster plus two loose clumps) and the crown's ground shadow, laid out on one sheet
  tools/src/leaves.png      falling leaf animation: 60x5 = 4 frames of 15x5, each frame holding 3 leaf variants in 5x5 cells
  tools/src/decor_sheet.png flowers, bushes (two colourings), rocks and pebbles
Output (assets/props/): tree.png + tree.json, leaves.png, decor.png + decor.json (a rectangle per sprite, found automatically and named by position)."""
import json, os, shutil
from PIL import Image
import numpy as np
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'tools', 'src'), os.path.join(ROOT, 'assets', 'props')
os.makedirs(OUT, exist_ok=True)

# ---- tree: three pieces on one sheet. Offsets are relative to the foot of the trunk.
shutil.copy(os.path.join(SRC, 'tree_parts.png'), os.path.join(OUT, 'tree.png'))
tree = {
    'trunk': {'x': 68, 'y': 8, 'w': 50, 'h': 116, 'ax': 18, 'ay': 116},        # foot of the trunk at (18, 116) inside the trunk rectangle
    'crown': {'x': 120, 'y': 0, 'w': 63, 'h': 85, 'ox': -24, 'oy': -122},        # top-left of the crown, relative to the foot
    'shadow': {'x': 0, 'y': 105, 'w': 52, 'h': 35, 'ox': -26, 'oy': -16},        # top-left of the ground shadow, relative to the foot
}
json.dump(tree, open(os.path.join(OUT, 'tree.json'), 'w'))

# ---- leaves
shutil.copy(os.path.join(SRC, 'leaves.png'), os.path.join(OUT, 'leaves.png'))

# ---- decor sheet: every separate shape (8-connected, at least 6 pixels), named by where it sits
shutil.copy(os.path.join(SRC, 'decor_sheet.png'), os.path.join(OUT, 'decor.png'))
a = np.array(Image.open(os.path.join(SRC, 'decor_sheet.png')).convert('RGBA')); al = a[:, :, 3] > 0
lab, k = ndimage.label(al, structure=np.ones((3, 3))); rects = []
for i, b in enumerate(ndimage.find_objects(lab)):
    m = (lab[b] == i + 1)
    if m.sum() >= 6: rects.append({'x': b[1].start, 'y': b[0].start, 'w': b[1].stop - b[1].start, 'h': b[0].stop - b[0].start})
rects.sort(key=lambda r: r['x'])
groups = {'big': [], 'small': [], 'bush_a': [], 'bush_b': [], 'pebble': [], 'rock': []}
for r in rects:
    if r['y'] < 36: groups['big'].append(r)
    elif r['y'] < 52: groups['small'].append(r)
    elif r['y'] < 68: groups['pebble' if r['x'] >= 64 else 'bush_a'].append(r)
    else: groups['rock' if r['x'] >= 64 else 'bush_b'].append(r)
decor = {}
for i, r in enumerate(groups['big'] + groups['small']): decor['flower%d' % i] = r            # flower0-2 big, flower3-7 small
for i, r in enumerate(groups['bush_a'] + groups['bush_b']): decor['bush%d' % i] = r          # bush0-3 one colouring, bush4-7 the other
for i, r in enumerate(groups['rock']): decor['rock%d' % i] = r
for i, r in enumerate(groups['pebble']): decor['pebble%d' % i] = r
for r in decor.values(): r['ax'] = r['w'] // 2; r['ay'] = r['h']                              # anchored at the bottom centre
json.dump(decor, open(os.path.join(OUT, 'decor.json'), 'w'))
print({n: (r['w'], r['h']) for n, r in decor.items()})
