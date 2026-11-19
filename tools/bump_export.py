#!/usr/bin/env python3
"""Paints the bump maps the game's lighting reads: assets/props/<name>_bump.png, same size as the sprite.
Grey = how far each pixel sticks out toward the viewer (1 grey step = 0.1 pixel); alpha = the sprite's own alpha.
Every layer of a prop gets a depth of its own (the roof sticks out in front of the posts, the shopkeeper sits behind the table...); the steps between layers give hard lit and shaded edges.
Edges are only bevelled by a pixel and the painted detail adds fine relief, so shapes stay sharp, not pillowy. The game turns the grey into surface directions and lights them from the sun, the furnace and campfires.
Re-run after the art changes:  python3 tools/props_export.py; python3 tools/shop_export.py; python3 tools/workbench_export.py; python3 tools/bump_export.py"""
import struct, zlib
from PIL import Image

def layers(path):
    d = open(path, 'rb').read(); W, H = struct.unpack_from('<HH', d, 8); off = 128
    fb, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, off); n = new or old; p = off + 16; out = {}
    for _ in range(n):
        csz, ct = struct.unpack_from('<IH', d, p); b = p + 6
        if ct == 0x2005:
            li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, b); w, h = struct.unpack_from('<HH', d, b + 16)
            im = Image.frombytes('RGBA', (w, h), zlib.decompressobj().decompress(d[b + 20:p + csz])); full = Image.new('RGBA', (max(W, w + x), max(H, h + y)), (0, 0, 0, 0)); full.alpha_composite(im, (x, y)); out[li] = full
        p += csz
    return out

def edge_dist(alpha, w, h, cap=1.5):
    """distance (in pixels) from each opaque pixel to the nearest transparent one, by a two-pass chamfer"""
    INF = 99; d = [[0 if alpha[y][x] <= 8 else INF for x in range(w)] for y in range(h)]
    def pad(x, y): return d[y][x] if 0 <= x < w and 0 <= y < h else 0
    for y in range(h):
        for x in range(w):
            if d[y][x]: d[y][x] = min(d[y][x], pad(x - 1, y) + 1, pad(x, y - 1) + 1, pad(x - 1, y - 1) + 1.4, pad(x + 1, y - 1) + 1.4)
    for y in range(h - 1, -1, -1):
        for x in range(w - 1, -1, -1):
            if d[y][x]: d[y][x] = min(d[y][x], pad(x + 1, y) + 1, pad(x, y + 1) + 1, pad(x + 1, y + 1) + 1.4, pad(x - 1, y + 1) + 1.4)
    return [[min(v, cap) for v in r] for r in d]

def paint(parts, out, round_k=1.2, size=None):
    """parts: list of (RGBA image, depth in pixels), drawn in order, later ones in front"""
    w, h = size or parts[0][0].size; depth = [[0.0] * w for _ in range(h)]; alpha = [[0] * w for _ in range(h)]
    for img, z in parts:
        px = img.load(); a = [[px[x, y][3] if x < img.width and y < img.height else 0 for x in range(w)] for y in range(h)]; ed = edge_dist(a, w, h)
        for y in range(h):
            for x in range(w):
                if a[y][x] > 8:
                    r, g, b = px[x, y][:3]; lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255   # the painted detail itself carries the relief: darker marks (plank lines, gaps, shadows in the art) sit back, lighter ones come forward, so edges stay crisp
                    depth[y][x] = z + round_k * min(ed[y][x], 1.5) + 3.0 * (lum - 0.45); alpha[y][x] = max(alpha[y][x], a[y][x])
    o = Image.new('RGBA', (w, h), (0, 0, 0, 0)); op = o.load()
    for y in range(h):
        for x in range(w):
            if alpha[y][x] > 8: v = max(0, min(255, round(depth[y][x] * 10))); op[x, y] = (v, v, v, alpha[y][x])
    o.save('assets/props/%s_bump.png' % out)

A = 'assets/props/'
M = layers('tools/src/Market_stall.aseprite'); CW = 56
crop = lambda im: im.crop((0, 0, CW, im.height))
# the shopkeeper stands behind the table; posts at the front corners; the roof juts out over everything; the table and goods are in between
paint([(crop(M[4]), 0)], 'shop_merchant')
paint([(crop(M[5]), 8), (crop(M[6]), 8), (crop(M[7]), 6), (crop(M[8]), 7), (crop(M[10]), 8), (crop(M[11]), 8), (crop(M[9]), 12)], 'shop_stall')
paint([(Image.open(A + 'workbench.png'), 4)], 'workbench')
paint([(Image.open(A + 'anvil.png'), 6)], 'anvil')
paint([(Image.open(A + 'hammer.png'), 3)], 'hammer')
F = Image.open(A + 'furnace.png').crop((0, 0, 48, 72)); body = F.copy(); bp = body.load()
for y in range(72):
    for x in range(48):
        r, g, b, a = bp[x, y]
        if a and y < 38: bp[x, y] = (0, 0, 0, 0)        # no smoke or sparks in the bump map
paint([(body, 8)], 'furnace')
print('ok')
