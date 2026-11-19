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

def paint(parts, out, round_k=1.0, size=None):
    """parts: list of (RGBA image, depth in pixels), drawn in order, later ones in front"""
    w, h = size or parts[0][0].size; depth = [[0.0] * w for _ in range(h)]; alpha = [[0] * w for _ in range(h)]
    for img, z in parts:
        px = img.load(); a = [[px[x, y][3] if x < img.width and y < img.height else 0 for x in range(w)] for y in range(h)]; ed = edge_dist(a, w, h)
        for y in range(h):
            for x in range(w):
                if a[y][x] > 8:
                    r, g, b = px[x, y][:3]; lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255   # the painted detail itself carries the relief: darker marks (plank lines, gaps, shadows in the art) sit back, lighter ones come forward, so edges stay crisp
                    depth[y][x] = z + round_k * min(ed[y][x], 1.5) + 2.0 * (lum - 0.45); alpha[y][x] = max(alpha[y][x], a[y][x])
    o = Image.new('RGBA', (w, h), (0, 0, 0, 0)); op = o.load()
    for y in range(h):
        for x in range(w):
            if alpha[y][x] > 8: v = max(0, min(255, round(depth[y][x] * 10))); op[x, y] = (v, v, v, alpha[y][x])
    o.save('assets/props/%s_bump.png' % out)

A = 'assets/props/'
M = layers('tools/src/Market_stall.aseprite'); CW = 56
crop = lambda im: im.crop((0, 0, CW, im.height))
paint([(crop(M[4]), 6)], 'shop_merchant')
paint([(crop(M[i]), 8) for i in (5, 6, 7, 8, 10, 11, 9)], 'shop_stall')   # one depth for the whole stall: the lighting only shows real edges and painted detail, never a rounded bulge
paint([(Image.open(A + 'workbench.png'), 4)], 'workbench')
paint([(Image.open(A + 'anvil.png'), 6)], 'anvil')
paint([(Image.open(A + 'hammer.png'), 3)], 'hammer')
F = Image.open(A + 'furnace.png').crop((0, 0, 48, 72)); body = F.copy(); bp = body.load()
for y in range(72):
    for x in range(48):
        r, g, b, a = bp[x, y]
        if a and y < 38: bp[x, y] = (0, 0, 0, 0)        # no smoke or sparks in the bump map
paint([(body, 8)], 'furnace')

# ---- cast shadows, from true heights ------------------------------------------------------------------------------------------------------------
# Every pixel gets the height it really has above the ground (a post: how far up the screen it is; a roof: a slab at the top; a table top: flat at table height), and the sun's rays carry
# it down to the ground to the right and a little toward the back. The shadows are the footprints of those rays, so a tall roof throws a long shadow, a low table a short one, and a post a thin one.
KX, KZ = 0.5, 0.32   # how far right and how far back (up the screen) one pixel of height throws its shadow
def cast(parts, name, pad):
    w, h = parts[0][0].size; H = {}
    for img, fn in parts:
        px = img.load()
        for y in range(img.height):
            for x in range(min(img.width, w)):
                if px[x, y][3] > 8: H[(x, y)] = fn(x, y)
    sh = Image.new('RGBA', (w + pad, h), (0, 0, 0, 0)); sp = sh.load()
    for (x, y), hh in H.items():
        for ox, oy in ((0, 0), (1, 0), (0, 1), (1, 1)):
            hx = max(0, hh - oy * 0)   # a pixel's far corner is a pixel lower or to the side: same height, so the footprint is simply a 2x2 splat that closes the gaps
            gx = round(x + ox + KX * hx); gy = round(y + oy + hh - KZ * hx)
            if 0 <= gx < w + pad and 0 <= gy < h: sp[gx, gy] = (47, 56, 48, 125)
    sh.save('assets/props/%s_shadow.png' % name)
AY = 65; roof = lambda x, y: 44 + (26 - y) * 0.5
cast([(crop(M[4]), lambda x, y: max(0, 58 - y)),                                  # the shopkeeper's feet are a little behind the stall's front
      (crop(M[5]), lambda x, y: max(0, AY - y)), (crop(M[6]), lambda x, y: max(0, AY - y)),   # posts
      (crop(M[7]), lambda x, y: min(20, max(0, AY - y))), (crop(M[8]), lambda x, y: min(17, max(0, AY - y))),   # table, cloth
      (crop(M[10]), lambda x, y: min(22, max(0, AY - y))), (crop(M[11]), lambda x, y: min(22, max(0, AY - y))),   # goods
      (crop(M[9]), roof)], 'shop', 40)                                            # the thatch is a sloping slab above the posts
cast([(Image.open(A + 'anvil.png'), lambda x, y: 16 - y)], 'anvil', 14)
cast([(Image.open(A + 'hammer.png'), lambda x, y: 11 - y)], 'hammer', 8)
cast([(body, lambda x, y: 72 - y)], 'furnace', 22)
print('ok')
