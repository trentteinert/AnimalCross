#!/usr/bin/env python3
"""Splits tools/src/Merchant_shop.aseprite into the pieces the game draws separately:
shop_shadow.png (the ground shadow, drawn flat under everything), shop_merchant.png (the shopkeeper, behind the counter) and
shop_stall.png (counter, goods, posts and sign, in front of the shopkeeper). All 64x64, same origin, so they line up when drawn at the same spot."""
import struct, zlib
from PIL import Image
d = open('tools/src/Merchant_shop.aseprite', 'rb').read()
off = 128; fb, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, off); n = new or old; p = off + 16; names = []; ims = {}
for _ in range(n):
    csz, ct = struct.unpack_from('<IH', d, p); b = p + 6
    if ct == 0x2004: nl = struct.unpack_from('<H', d, b + 16)[0]; names.append(d[b + 18:b + 18 + nl].decode())
    elif ct == 0x2005:
        li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, b); w, h = struct.unpack_from('<HH', d, b + 16)
        ims[li] = Image.frombytes('RGBA', (w, h), zlib.decompressobj().decompress(d[b + 20:p + csz]))
    p += csz
# layers (bottom to top): 1 shadow, 4 merchant, 5 counter, 6 goblet, 7 ink pot, 8 awning and posts, 9 coins, 10 SHOP lettering. Layers 0, 2 and 3 are hidden sketches.
def stack(ids):
    o = Image.new('RGBA', (64, 64))
    for i in ids: o.alpha_composite(ims[i])
    return o
sh = ims[1].copy(); px = sh.load()
for y in range(64):
    for x in range(64):
        if px[x, y][3]: px[x, y] = (47, 56, 48, px[x, y][3])   # a flat tint, keeping your alpha: the game scales it with the time of day
sh.save('assets/props/shop_shadow.png'); ims[4].save('assets/props/shop_merchant.png'); stack([5, 6, 7, 8, 9, 10]).save('assets/props/shop_stall.png')
