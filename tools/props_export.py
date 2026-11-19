#!/usr/bin/env python3
"""Cuts the anvil, the decorative hammer and the animated furnace out of tools/src/Anvil_and_hammer.aseprite and tools/src/Furnace_sheet.aseprite.
Neither file has shadows, so each prop gets one cast from its silhouette (sheared away from the prop, like sunlight from the upper left): <name>_shadow.png, same origin as the prop, with room on the right.
The furnace sheet has five frames side by side, in layers of rows (body, coals, flames, smoke); they are put together here into furnace.png (5 frames, 48x72, feet on the bottom row) so the game just plays them."""
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

def shadow(img, pad=20, k=0.45, m=0.22):
    w, h = img.size; sh = Image.new('RGBA', (w + pad, h), (0, 0, 0, 0)); sp = sh.load(); px = img.load(); yb = h - 1
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 8:
                sx = round(x + k * (yb - y)); sy = round(yb - m * (yb - y))
                for dx in (0, 1):
                    for dy in (0, 1):
                        if 0 <= sx + dx < w + pad and 0 <= sy + dy < h: sp[sx + dx, sy + dy] = (47, 56, 48, 125)
    return sh

A = layers('tools/src/Anvil_and_hammer.aseprite')   # 1 anvil, 2 decorative hammer (0 is a hidden sketch)
anvil = A[1].crop((5, 0, 28, 16)); hammer = A[2].crop((37, 5, 44, 16))
anvil.save('assets/props/anvil.png'); shadow(anvil, 14).save('assets/props/anvil_shadow.png')
hammer.save('assets/props/hammer.png'); shadow(hammer, 8).save('assets/props/hammer_shadow.png')

F = layers('tools/src/Furnace_sheet.aseprite')[0]; TOP = 8   # headroom for the smoke above the chimney
frames = Image.new('RGBA', (48 * 5, 72), (0, 0, 0, 0)); bodies = Image.new('RGBA', (48, 72), (0, 0, 0, 0))
for f in range(5):
    cell = lambda y0, y1: F.crop((f * 48, y0, f * 48 + 48, y1 + 1))
    fr = Image.new('RGBA', (48, 72), (0, 0, 0, 0))
    fr.alpha_composite(cell(30, 63), (0, 30 + TOP))                  # body: posts, the dark window, the chimney
    win = (9, 49 + TOP, 31, 57 + TOP)                                # the window's inside (22x8): the coal bed lies on its floor, the flames stand in front of it and are kept inside the frame
    layer = Image.new('RGBA', (48, 72), (0, 0, 0, 0)); layer.alpha_composite(cell(115, 120), (0, 51 + TOP)); layer.alpha_composite(cell(177, 184), (0, 47 + TOP))   # coals first, flames on top
    fr.alpha_composite(layer.crop(win), (win[0], win[1]))
    fr.alpha_composite(cell(193, 226), (0, 226 - 193 - 189 + 193 - 226 + 37 + 0 - 0 + 0)) if False else fr.alpha_composite(cell(193, 226), (0, 37 - 33 + 0))   # smoke rising from the chimney top
    frames.alpha_composite(fr, (f * 48, 0))
    if f == 0: bodies.alpha_composite(cell(30, 63), (0, 30 + TOP))
frames.save('assets/props/furnace.png'); shadow(bodies, 22).save('assets/props/furnace_shadow.png')
print('ok')
