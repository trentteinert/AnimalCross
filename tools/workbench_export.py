#!/usr/bin/env python3
"""Splits tools/src/Workbench.aseprite into workbench_shadow.png (flat on the ground) and workbench.png (table and the paper on top). 64x64, same origin."""
import struct, zlib
from PIL import Image
d = open('tools/src/Workbench.aseprite', 'rb').read()
off = 128; fb, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, off); n = new or old; p = off + 16; ims = {}
for _ in range(n):
    csz, ct = struct.unpack_from('<IH', d, p); b = p + 6
    if ct == 0x2005:
        li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, b); w, h = struct.unpack_from('<HH', d, b + 16)
        if w == 64: ims[li] = Image.frombytes('RGBA', (w, h), zlib.decompressobj().decompress(d[b + 20:p + csz]))
    p += csz
# layers: 2 shadow, 3 table, 4 paper on the table (the hidden ones are sketches)
t = Image.new('RGBA', (64, 64)); t.alpha_composite(ims[3]); t.alpha_composite(ims[4]); t.save('assets/props/workbench.png')
sh = ims[2].copy(); px = sh.load()
for y in range(64):
    for x in range(64):
        if px[x, y][3]: px[x, y] = (47, 56, 48, px[x, y][3])
sh.save('assets/props/workbench_shadow.png')
