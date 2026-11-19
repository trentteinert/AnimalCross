#!/usr/bin/env python3
"""Splits tools/src/Market_stall.aseprite into the pieces the game draws separately (all the same size, same origin, 56x65):
shop_merchant.png (the shopkeeper, behind the table) and shop_stall.png (posts, roof, table, cloth and goods, in front of the shopkeeper).
The file has no shadow layer, so shop_shadow.png (96x65, same origin) is cast from the silhouette: sheared away from the stall like sunlight from the upper left.
Layers: 4 shopkeeper, then 5 to 11 the stall (posts, roof, table, cloth, goods). Layers 1 and 2 (ink pot, goblet) are loose extras and are left out."""
import struct, zlib
from PIL import Image
d = open('tools/src/Market_stall.aseprite', 'rb').read(); W, H = struct.unpack_from('<HH', d, 8)
off = 128; fb, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, off); n = new or old; p = off + 16; ims = {}
for _ in range(n):
    csz, ct = struct.unpack_from('<IH', d, p); b = p + 6
    if ct == 0x2005:
        li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, b); w, h = struct.unpack_from('<HH', d, b + 16)
        ims[li] = Image.frombytes('RGBA', (w, h), zlib.decompressobj().decompress(d[b + 20:p + csz]))
    p += csz
CW = 56
def stack(ids):
    o = Image.new('RGBA', (W, H))
    for i in ids: o.alpha_composite(ims[i])
    return o
stall = stack([5, 6, 7, 8, 9, 10, 11]); merchant = stack([4])
stall.crop((0, 0, CW, H)).save('assets/props/shop_stall.png'); merchant.crop((0, 0, CW, H)).save('assets/props/shop_merchant.png')
sil = Image.alpha_composite(stall, merchant).load(); sh = Image.new('RGBA', (W, H)); sp = sh.load(); yb = H - 1
for y in range(H):
    for x in range(CW):
        if sil[x, y][3] > 8:
            sx = round(x + 0.45 * (yb - y)); sy = round(yb - 0.22 * (yb - y))
            for dx in (0, 1):
                for dy in (0, 1):
                    if 0 <= sx + dx < W and 0 <= sy + dy < H: sp[sx + dx, sy + dy] = (47, 56, 48, 125)
sh.save('assets/props/shop_shadow.png')
