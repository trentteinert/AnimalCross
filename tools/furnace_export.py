#!/usr/bin/env python3
"""Cuts tools/src/Furnace.aseprite (96x64, 5 frames) into the furnace's parts, all with the same origin so they line up:
  furnace_body.png    the furnace and the conveyor belt beside it (layers "Layer 7" and "Layer 1", frame 1: the belt and body do not change)
  furnace_coals.png / furnace_coals_dim.png   the coal bed ("Layer 15"): bright while burning, a dark copy for when the furnace is cold
  furnace_flames.png  the flames ("Layer 9"), 5 frames side by side (480x64)
  furnace_smoke.png   the smoke ("Layer 8"), 5 frames
  furnace_bar.png     the bar ("Bar"), 5 frames: it slides from the furnace along the belt, frame 5 is where it comes to rest
The game plays them in that order and only while smelting. Cleaned on the way: a stray dark pixel left of the furnace in frame 3 of "Layer 7" (the furnace does not change between frames)."""
import struct, zlib
from PIL import Image
d = open('tools/src/Furnace.aseprite', 'rb').read(); W, H = struct.unpack_from('<HH', d, 8); nf = struct.unpack_from('<H', d, 6)[0]
off = 128; names = []; cels = {}
for fi in range(nf):
    fb, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, off); n = new or old; p = off + 16
    for _ in range(n):
        csz, ct = struct.unpack_from('<IH', d, p); b = p + 6
        if ct == 0x2004 and fi == 0: nl = struct.unpack_from('<H', d, b + 16)[0]; names.append(d[b + 18:b + 18 + nl].decode())
        elif ct == 0x2005:
            li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, b); w, h = struct.unpack_from('<HH', d, b + 16)
            full = Image.new('RGBA', (W, H), (0, 0, 0, 0)); full.alpha_composite(Image.frombytes('RGBA', (w, h), zlib.decompressobj().decompress(d[b + 20:p + csz])), (x, y)); cels[(fi, li)] = full
        p += csz
    off += fb
L = {n: i for i, n in enumerate(names)}
body = cels[(0, L['Layer 7'])].copy(); body.alpha_composite(cels[(0, L['Layer 1'])]); body.save('assets/props/furnace_body.png')
coals = cels[(0, L['Layer 15'])]; coals.save('assets/props/furnace_coals.png')
dim = coals.copy(); dp = dim.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = dp[x, y]
        if a: dp[x, y] = (round(r * 0.5), round(g * 0.48), round(b * 0.55), a)   # cold coals: dark and dull
dim.save('assets/props/furnace_coals_dim.png')
for nm, key in (('flames', 'Layer 9'), ('smoke', 'Layer 8'), ('bar', 'Bar')):
    strip = Image.new('RGBA', (W * nf, H))
    for f in range(nf): strip.paste(cels[(f, L[key])], (W * f, 0))
    strip.save('assets/props/furnace_%s.png' % nm)
print('furnace body bbox', body.getbbox(), 'bar rest', cels[(nf - 1, L['Bar'])].getbbox())
