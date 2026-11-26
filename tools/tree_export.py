#!/usr/bin/env python3
"""The tree varieties drawn in tools/src/Forest_tree.aseprite: every visible group holds one tree as three layers (shadow, trunk, crown; the layer order in the group).
Writes assets/props/trees.png + trees.json: a list of { name, trunk: {x, y, w, h, ax, ay}, crown: {x, y, w, h, ox, oy}, shadow: {x, y, w, h, ox, oy} },
the same shape as the old single tree (tree.json): the trunk's anchor is the foot of the stem, the crown and the shadow are placed relative to it.
Run:  python3 tools/tree_export.py"""
import sys, json; sys.path.insert(0, 'tools')
from ase_lib import read, kids
from PIL import Image
import numpy as np
W, H, L, I = read('tools/src/Forest_tree.aseprite')
def clean(im):   # drop stray specks (a few pixels apart from the rest)
    a = np.array(im); al = a[:, :, 3] > 0; seen = np.zeros_like(al); out = np.zeros_like(a)
    for y, x in zip(*np.nonzero(al)):
        if seen[y, x]: continue
        st = [(y, x)]; seen[y, x] = True; comp = []
        while st:
            p = st.pop(); comp.append(p)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    q = (p[0] + dy, p[1] + dx)
                    if 0 <= q[0] < al.shape[0] and 0 <= q[1] < al.shape[1] and al[q] and not seen[q]: seen[q] = True; st.append(q)
        if len(comp) >= 6:
            for p in comp: out[p] = a[p]
    return Image.fromarray(out)
trees = []
for g, l in enumerate(L):
    if l['type'] != 1 or not l['vis']: continue
    ks = [i for i in kids(L, g) if L[i]['type'] == 0 and i in I]
    if len(ks) != 3: continue
    sh, tr, cr = (clean(I[i]) for i in ks)
    tb = tr.getbbox(); t = np.array(tr)[:, :, 3] > 0; xs = np.nonzero(t[tb[3] - 10])[0]; fx, fy = (int(xs.min()) + int(xs.max())) // 2, tb[3]   # the foot: the middle of the stem, at the bottom of the trunk
    trees.append({'name': l['name'], 'pics': {'trunk': tr, 'crown': cr, 'shadow': sh}, 'foot': (fx, fy)})
x = 0; sheet_h = 0; parts = []
for t in trees:
    for k in ('trunk', 'crown', 'shadow'):
        im = t['pics'][k]; b = im.getbbox(); parts.append((t, k, im.crop(b), b)); sheet_h = max(sheet_h, b[3] - b[1])
sheet = Image.new('RGBA', (sum(p[2].width + 1 for p in parts), sheet_h)); meta = []
for t in trees: t['out'] = {'name': t['name']}; meta.append(t['out'])
for t, k, pic, b in parts:
    sheet.paste(pic, (x, 0)); fx, fy = t['foot']; e = {'x': x, 'y': 0, 'w': pic.width, 'h': pic.height}
    if k == 'trunk': e.update(ax=fx - b[0], ay=fy - b[1])
    else: e.update(ox=b[0] - fx, oy=b[1] - fy)
    t['out'][k] = e; x += pic.width + 1
sheet.save('assets/props/trees.png'); json.dump(meta, open('assets/props/trees.json', 'w'))
print(len(meta), 'trees:', [m['name'] for m in meta], sheet.size)
