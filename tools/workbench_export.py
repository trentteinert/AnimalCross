#!/usr/bin/env python3
"""Splits tools/src/Workbench.aseprite into workbench.png (table, cloth, mat and the hammer on it) and workbench_shadow.png (the shadow you drew).
Both are 36x23 with the same origin. Layers: 2 shadow, 4 table, 5 cloth, 6 mat, 7 hammer. Layers 0, 1 (reference) and 3 (a few stray dots) are hidden and left out."""
import struct, zlib
from PIL import Image
d = open('tools/src/Workbench.aseprite', 'rb').read(); W, H = struct.unpack_from('<HH', d, 8)
off = 128; fb, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, off); n = new or old; p = off + 16; ims = {}
for _ in range(n):
    csz, ct = struct.unpack_from('<IH', d, p); b = p + 6
    if ct == 0x2005:
        li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, b); w, h = struct.unpack_from('<HH', d, b + 16)
        if w <= 64: full = Image.new('RGBA', (W, H), (0, 0, 0, 0)); full.alpha_composite(Image.frombytes('RGBA', (w, h), zlib.decompressobj().decompress(d[b + 20:p + csz])), (x, y)); ims[li] = full
    p += csz
t = Image.new('RGBA', (W, H))
for i in (4, 5, 6, 7): t.alpha_composite(ims[i])
t.save('assets/props/workbench.png')
sh = ims[2].copy(); px = sh.load()
for y in range(H):
    for x in range(W):
        if px[x, y][3]: px[x, y] = (47, 56, 48, px[x, y][3])
sh.save('assets/props/workbench_shadow.png'); print('ok', W, H, t.getbbox())
