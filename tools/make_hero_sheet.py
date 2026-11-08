#!/usr/bin/env python3
"""Builds the game's hero data from the two painted sheets in tools/src:
  walk_sheet.png  128x512  5 directions (columns) x 8 walk frames (rows of 64px): down-left, right, down, up, up-right
  hero_idle.png   64x128   standing poses, 5 views per row: top row left, up-left, up, up-right, right; bottom row left, down-left, down, down-right, right
The 3 missing walk directions are mirrors (down-right = flip down-left, left = flip right, up-left = flip up-right).

Output (assets/chars/):
  hero_uv.png    animation as coordinates: 9 frames (0 idle, 1-8 walk) x 8 directions, cell 32x58, feet baseline at y 53.
                 Every pixel stores R = x, G = y of a colour in the skin, so recolouring the skin recolours every frame.
  hero_skin.png  64x64 palette texture (one pixel per colour of the character)
  hero_roles.json  which skin pixels belong to hair / eyes / skin / shirt / jeans / boots (the first entry is the role's main colour)
  hero_preview.png  colour contact sheet of everything above (for checking)
Direction order (rows): down, down-left, left, up-left, up, up-right, right, down-right.
"""
import json, os, collections
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'tools', 'src'), os.path.join(ROOT, 'assets', 'chars')
CW, CH, BASE = 32, 58, 53            # cell size; ground line (exclusive) inside the cell
ROLE = {}
for role, cols in {
    'hair': ['ad7757', 'c88f6e', '96684d', '88604b'],
    'skin': ['ecbf9a', 'c09776', 'd0a989'],
    'shirt': ['ebdfcc', 'cac3b6', 'ddceba', 'e7e5e2'],
    'jeans': ['6c878d', '5f6e71'],
    'boots': ['a68377', 'a38476', '7f6357'],
}.items():
    for c in cols: ROLE[c] = role
AMBIG = '8e6f65'                      # eyes in the head, boot highlights down low

walk = np.array(Image.open(os.path.join(SRC, 'walk_sheet.png')).convert('RGBA'))
idle = np.array(Image.open(os.path.join(SRC, 'hero_idle.png')).convert('RGBA'))

def center_x(img, y0, y1, x0, x1):   # horizontal centre of the head and torso in a region
    m = img[y0:y1, x0:x1, 3] > 0; xs = np.where(m.any(0))[0]
    return (xs.min() + xs.max() + 1) / 2 + x0

def cell(img, cx, base_y, xr, yr=None):       # a 32x58 cell whose torso centre is at x=16 and whose feet end on row 52; only pixels inside the source columns xr = (x0, x1) are taken (no neighbours)
    c = np.zeros((CH, CW, 4), np.uint8); cx = int(round(cx)); y0 = base_y - (BASE - 1)
    for y in range(CH):
        for x in range(CW):
            sx, sy = cx - CW // 2 + x, y0 + y
            if xr[0] <= sx < xr[1] and (yr[0] if yr else 0) <= sy < (yr[1] if yr else img.shape[0]): c[y, x] = img[sy, sx]
    return c

# ---- walk: 5 columns x 8 rows
WCOLS = [(0, 22), (22, 44), (44, 66), (66, 90), (90, 128)]
walk_cells = {}
for ci, (x0, x1) in enumerate(WCOLS):
    cxs = []
    for r in range(8):
        seg = walk[r * 64:(r + 1) * 64, x0:x1, 3] > 0; top = np.where(seg.any(1))[0].min()
        cxs.append(center_x(walk, r * 64 + top, r * 64 + top + 26, x0, x1))
    cx = sum(cxs) / 8
    for r in range(8):
        seg = walk[r * 64:(r + 1) * 64, :, 3] > 0
        walk_cells[ci, r] = cell(walk, cx, r * 64 + 58, (x0, x1))          # standing feet end on row 58 of every 64px row
# ---- idle: 5 views x 2 rows, split at y=66
IG = [(1, 8), (12, 21), (26, 36), (41, 50), (55, 62)]
def idle_cell(ci, row):
    x0, x1 = IG[ci][0], IG[ci][1] + 1; ya, yb = (24, 66) if row == 0 else (67, 109)
    m = idle[ya:yb, x0:x1, 3] > 0; ys = np.where(m.any(1))[0]; top, bot = ya + ys.min(), ya + ys.max()
    return cell(idle, center_x(idle, top, top + 26, x0, x1), bot, (x0, x1), (ya, yb))
flip = lambda c: c[:, ::-1].copy()
# direction rows: 0 d, 1 dl, 2 l, 3 ul, 4 u, 5 ur, 6 r, 7 dr   (walk columns: 0 dr, 1 r, 2 d, 3 u, 4 ur)
WALK_SRC = {0: (2, False), 1: (0, True), 2: (1, True), 3: (4, True), 4: (3, False), 5: (4, False), 6: (1, False), 7: (0, False)}
IDLE_SRC = {0: (2, 1), 1: (1, 1), 2: (0, 1), 3: (1, 0), 4: (2, 0), 5: (3, 0), 6: (4, 1), 7: (3, 1)}
frames = {}
for d in range(8):
    frames[d, 0] = idle_cell(*IDLE_SRC[d])
    ci, fl = WALK_SRC[d]
    for r in range(8): frames[d, r + 1] = flip(walk_cells[ci, r]) if fl else walk_cells[ci, r]

# ---- detail transfer: the walk frames are rougher than the standing poses, so each walk frame's head (hair texture, face, eyes) is replaced by the
# standing pose's head of the same direction. The head is whatever lies above the first shirt pixel; it is aligned by its top row and its centre.
SHIRT = {c for c, r in ROLE.items() if r == 'shirt'}
def hx(px): return '%02x%02x%02x' % tuple(px[:3])
def head_rows(c):  # (first opaque row, first shirt row)
    rows = [y for y in range(CH) if c[y, :, 3].any()]; top = rows[0]
    sh = next(y for y in range(CH) if any(c[y, x, 3] and hx(c[y, x]) in SHIRT for x in range(CW)))
    return top, sh
def head_cx(c, top, sh):
    xs = [x for y in range(top, sh) for x in range(CW) if c[y, x, 3]]; return (min(xs) + max(xs) + 1) / 2
for d in range(8):
    src = frames[d, 0]; st, ss = head_rows(src); scx = head_cx(src, st, ss)
    for f in range(1, 9):
        c = frames[d, f]; wt, ws = head_rows(c); wcx = head_cx(c, wt, ws); dx = int(round(wcx - scx))
        c[wt:ws, :, :] = 0                                         # clear the old head (the arms start below the first shirt row)
        for y in range(st, ss):
            for x in range(CW):
                if src[y, x, 3]:
                    ty, tx = wt + (y - st), x + dx
                    if 0 <= ty < ws + (ss - st - (ws - wt)) and 0 <= tx < CW and ty < CH: c[ty, tx] = src[y, x]
        # if the standing head is taller than the room above the shirt the extra rows were written onto the shoulders; that only happens when the heads differ in height by a pixel or two

# the shirt's fabric texture (the light flecks and folds of the standing pose) is overlaid on the main shirt colour of the walk frames, aligned by shirt top and centre
def shirt_box(c, sh):
    xs = [x for y in range(sh, min(CH, sh + 14)) for x in range(CW) if c[y, x, 3] and hx(c[y, x]) in SHIRT]; return (min(xs) + max(xs) + 1) / 2
for d in range(8):
    src = frames[d, 0]; _, ss = head_rows(src); scx = shirt_box(src, ss)
    for f in range(1, 9):
        c = frames[d, f]; _, ws = head_rows(c); dx = int(round(shirt_box(c, ws) - scx))
        for y in range(14):
            for x in range(CW):
                sy, sx = ss + y, x
                if sy < CH and src[sy, sx, 3] and hx(src[sy, sx]) in ('ddceba', 'e7e5e2'):
                    ty, tx = ws + y, sx + dx
                    if ty < CH and 0 <= tx < CW and c[ty, tx, 3] and hx(c[ty, tx]) == 'ebdfcc': c[ty, tx] = src[sy, sx]

# ---- palette entries (role, colour); the shared eye/boot colour becomes two entries
entries, index = [], {}
cnt = collections.Counter()
def role_of(hexc, y):
    if hexc == AMBIG: return 'eyes' if y < 30 else 'boots'
    if hexc not in ROLE: raise SystemExit('colour #%s in the sheets has no role' % hexc)
    return ROLE[hexc]
for (d, f), c in frames.items():
    for y in range(CH):
        for x in range(CW):
            if c[y, x, 3]: cnt[(role_of('%02x%02x%02x' % tuple(c[y, x, :3]), y), '%02x%02x%02x' % tuple(c[y, x, :3]))] += 1
entries = [k for k, _ in cnt.most_common()]
order = ['hair', 'eyes', 'skin', 'shirt', 'jeans', 'boots']
entries.sort(key=lambda e: (order.index(e[0]), -cnt[e]))     # grouped by role, main colour first
pos = {e: (i % 8, i // 8) for i, e in enumerate(entries)}
skin = np.zeros((64, 64, 4), np.uint8)
roles = {r: [] for r in order}
for e, (x, y) in pos.items():
    h = e[1]; skin[y, x] = [int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255]; roles[e[0]].append([x, y])
uv = np.zeros((8 * CH, 9 * CW, 4), np.uint8)
for (d, f), c in frames.items():
    for y in range(CH):
        for x in range(CW):
            if c[y, x, 3]:
                h = '%02x%02x%02x' % tuple(c[y, x, :3]); px = pos[(role_of(h, y), h)]
                uv[d * CH + y, f * CW + x] = [px[0], px[1], 0, 255]
Image.fromarray(uv).save(os.path.join(OUT, 'hero_uv.png')); Image.fromarray(skin).save(os.path.join(OUT, 'hero_skin.png'))
json.dump(roles, open(os.path.join(OUT, 'hero_roles.json'), 'w'))
# preview: rebuild colours from the lookup
prev = np.zeros(uv.shape, np.uint8)
for y in range(uv.shape[0]):
    for x in range(uv.shape[1]):
        if uv[y, x, 3]: prev[y, x] = skin[uv[y, x, 1], uv[y, x, 0]]
bg = Image.new('RGBA', (uv.shape[1], uv.shape[0]), (120, 160, 120, 255)); bg.alpha_composite(Image.fromarray(prev)); bg.save(os.path.join(OUT, 'hero_preview.png'))
print('entries', {r: len(v) for r, v in roles.items()}, 'sheet', uv.shape[1], 'x', uv.shape[0])
