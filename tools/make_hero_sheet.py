#!/usr/bin/env python3
"""Builds the game's hero data from the painted sheet tools/src/hero_sheet.png:
  1056x48 = 33 frames of 32x48: frame 0 = standing (facing down), then 4 walk frames for each direction in this order:
  down (1-4), down-right (5-8), right (9-12), up-right (13-16), up (17-20), up-left (21-24), left (25-28), down-left (29-32).
The other directions have no standing pose of their own, so each uses its most 'legs together' walk frame.

Output (assets/chars/):
  hero_uv.png    animation as coordinates: 5 frames (0 idle, 1-4 walk) x 8 directions, cell 32x48, feet end on row 47.
                 Every pixel stores R = x, G = y of a colour in the skin, so recolouring the skin recolours every frame.
  hero_skin.png  64x64 palette texture (one pixel per colour of the character)
  hero_roles.json  which skin pixels can be recoloured: eyes / skin / shirt / jeans / boots (the first entry is the role's main colour).
                   Colours with no role (belt, collar, cheeks) stay as painted.
  hero_preview.png  colour contact sheet rebuilt from the lookup (for checking)
Direction rows in the output: down, down-left, left, up-left, up, up-right, right, down-right.
"""
import json, os
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'tools', 'src', 'hero_sheet.png'), os.path.join(ROOT, 'assets', 'chars')
CW, CH = 32, 48
sheet = np.array(Image.open(SRC).convert('RGBA'))

def role_of(h, y):  # (role or None, key) for a colour at row y of the cell
    if h == '6f768d' or h == '585f74': return 'jeans'
    if h in ('e1c6b4', 'd6b299'): return 'skin'
    if h in ('c49a61', 'b38d5b', 'd5ac73'): return 'shirt'
    if h == '513b30': return 'eyes' if y < 30 else 'boots'
    if h == '77543c': return 'shirt' if y < 28 else (None if y < 40 else 'boots')   # collar trim / belt / shoes
    if h == '9e7548': return 'boots'
    if h in ('edacb9', 'e0ded3'): return None                                          # cheeks and white collar stay as painted
    raise SystemExit('colour #%s has no role' % h)
hx = lambda p: '%02x%02x%02x' % tuple(p[:3])
frame = lambda i: sheet[:, i * CW:(i + 1) * CW].copy()
SRC_FRAMES = {0: [1, 2, 3, 4], 7: [5, 6, 7, 8], 6: [9, 10, 11, 12], 5: [13, 14, 15, 16], 4: [17, 18, 19, 20], 3: [21, 22, 23, 24], 2: [25, 26, 27, 28], 1: [29, 30, 31, 32]}
def legs_together(i):  # width of the legs (rows 38+): smaller = more of a standing pose
    m = sheet[38:, i * CW:(i + 1) * CW, 3] > 0; xs = np.where(m.any(0))[0]; return xs.max() - xs.min() if len(xs) else 99
frames = {}
for d, fs in SRC_FRAMES.items():
    frames[d, 0] = frame(0) if d == 0 else frame(min(fs, key=legs_together))
    for k, f in enumerate(fs): frames[d, k + 1] = frame(f)

# palette entries (role, colour)
cnt = {}
for c in frames.values():
    for y in range(CH):
        for x in range(CW):
            if c[y, x, 3]: k = (role_of(hx(c[y, x]), y), hx(c[y, x])); cnt[k] = cnt.get(k, 0) + 1
order = ['eyes', 'skin', 'shirt', 'jeans', 'boots', None]
entries = sorted(cnt, key=lambda e: (order.index(e[0]), -cnt[e]))          # grouped by role, main colour first
pos = {e: (i % 8, i // 8) for i, e in enumerate(entries)}
skin = np.zeros((64, 64, 4), np.uint8); roles = {r: [] for r in order if r}
for e, (x, y) in pos.items():
    h = e[1]; skin[y, x] = [int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255]
    if e[0]: roles[e[0]].append([x, y])
uv = np.zeros((8 * CH, 5 * CW, 4), np.uint8)
for (d, f), c in frames.items():
    for y in range(CH):
        for x in range(CW):
            if c[y, x, 3]:
                px = pos[(role_of(hx(c[y, x]), y), hx(c[y, x]))]; uv[d * CH + y, f * CW + x] = [px[0], px[1], 0, 255]
Image.fromarray(uv).save(os.path.join(OUT, 'hero_uv.png')); Image.fromarray(skin).save(os.path.join(OUT, 'hero_skin.png'))
json.dump(roles, open(os.path.join(OUT, 'hero_roles.json'), 'w'))
prev = np.zeros(uv.shape, np.uint8)
for y in range(uv.shape[0]):
    for x in range(uv.shape[1]):
        if uv[y, x, 3]: prev[y, x] = skin[uv[y, x, 1], uv[y, x, 0]]
bg = Image.new('RGBA', (uv.shape[1], uv.shape[0]), (120, 160, 120, 255)); bg.alpha_composite(Image.fromarray(prev)); bg.save(os.path.join(OUT, 'hero_preview.png'))
print('roles', {r: len(v) for r, v in roles.items()}, 'sheet', uv.shape[1], 'x', uv.shape[0], 'idle frames', {d: (SRC_FRAMES[d][0] if d == 0 else min(SRC_FRAMES[d], key=legs_together)) for d in SRC_FRAMES})
