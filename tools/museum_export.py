#!/usr/bin/env python3
"""Cuts the museum art into what the game uses.
EXTERIOR (tools/src/Museum_exterior.aseprite, 215x167): assets/props/museum_building.png (the building: base and steps, columns, frieze, roof, pediment),
  museum_door.png (the doors, so they can open) and museum_sign.png (the hanging GRAND OPENING banner, so it can sway). Same size and origin: 215x167.
  Left out: the flattened copy of the whole building (layer 9, it would be drawn twice), the faint outline box and some hidden scraps.
INTERIOR: moved to tools/museum_interior_export.py. (Old notes, for the first interior file:)
  * everything is moved by (+9, -4) so the floor lines up with the game's 16 pixel grid (it started at 39, 84).
  * the room is cut into a tile set (assets/museum/tileset.png, 16x16 tiles, tileset.json): the wall, frame and void tiles that occur, plus the marble floor in
    quarters (each 32x32 marble tile of your art becomes four 16x16 tiles; there are 19 different ones). maps/museum.json is the room built from those tiles.
  * the things in the room are separate props (assets/museum/props.png + props.json): display cases in 7 sizes (base and glass kept apart so a find can sit between them),
    the stage with its rope and podium, the information board, wall panels (fossil panel, scorpion panel, plain plaque), the two windows and the back alcove.
  Fixed on the way: 1-3 tiny transparent specks in most marble tiles (they showed the floor underneath; filled from the tile under them), one stray misplaced pair of floor tiles (layer 7, fully hidden),
  the old man (layer 93) and two copies (101, 102) that were switched off.
Run:  python3 tools/museum_export.py"""
import hashlib, json, os, struct, zlib
from PIL import Image

def read(path):
    d = open(path, 'rb').read(); W, H = struct.unpack_from('<HH', d, 8); off = 128
    fb, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, off); n = new or old; p = off + 16; layers = []; imgs = {}
    for _ in range(n):
        csz, ct = struct.unpack_from('<IH', d, p); b = p + 6
        if ct == 0x2004:
            f, t, l = struct.unpack_from('<HHH', d, b); bm, op = struct.unpack_from('<HB', d, b + 10); nl = struct.unpack_from('<H', d, b + 16)[0]; layers.append({'flags': f, 'type': t, 'lv': l, 'blend': bm, 'opacity': op, 'name': d[b + 18:b + 18 + nl].decode()})   # blend: 0 normal, 1 multiply, 2 screen
        elif ct == 0x2005:
            li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, b); w, h = struct.unpack_from('<HH', d, b + 16)
            if ctype in (0, 2):
                raw = d[b + 20:b + 20 + w * h * 4] if ctype == 0 else zlib.decompressobj().decompress(d[b + 20:p + csz])
                full = Image.new('RGBA', (W, H), (0, 0, 0, 0)); full.alpha_composite(Image.frombytes('RGBA', (w, h), raw).crop((max(0, -x), max(0, -y), w, h)), (max(0, x), max(0, y))); imgs[li] = full
        p += csz
    return W, H, layers, imgs

# ---------------------------------------------------------------------------------------------------------------- exterior
W, H, L, I = read('tools/src/Museum_exterior.aseprite')
def stack(imgs, ids, W, H, L=None):   # layers over each other; with L given, each layer's own blend mode (multiply, screen) and opacity are applied
    o = Image.new('RGBA', (W, H))
    for i in ids:
        mode = L[i]['blend'] if L else 0; op = (L[i]['opacity'] / 255) if L else 1
        if mode in (1, 2):
            from PIL import ImageChops
            top = imgs[i]; bl = (ImageChops.multiply if mode == 1 else ImageChops.screen)(o.convert('RGB'), top.convert('RGB')); m = top.getchannel('A').point(lambda v: round(v * op))
            res = Image.composite(bl, o.convert('RGB'), m).convert('RGBA'); res.putalpha(Image.eval(ImageChops.lighter(o.getchannel('A'), m), lambda v: v)); o = res
        elif op < 1: t = imgs[i].copy(); t.putalpha(t.getchannel('A').point(lambda v: round(v * op))); o.alpha_composite(t)
        else: o.alpha_composite(imgs[i])
    return o
# The building is cut into three pieces that are drawn at different depths, so you can stand on the porch and steps in front of the walls but go behind everything when you walk round the back:
#   ground (the porch floor and steps, rows 134 and below of layer 5: always under you), back (the wall face and plinth sides, frieze, roof, pediment: you are in front of it when you are south of the wall, behind it when you are north),
#   cols (the columns and their shading: you are in front of them on the steps and behind them when you are on the porch between them).
# The doors (layer 7) and the banner (layers 16, 17) are separate so they can open and sway; the flattened copy of everything (layer 9... "Layer 9") and the faint outline box are left out.
FOOT = 134
l5 = I[5]; wall = Image.new('RGBA', (W, H)); ground = l5.copy(); wall.paste(l5.crop((11, 0, 203, FOOT)), (11, 0)); ground.paste((0, 0, 0, 0), (11, 0, 203, FOOT))   # the wall face is the back; the porch floor, the steps and the plinth's side stairs are all ground
back = Image.new('RGBA', (W, H))
for im in [wall] + [I[i] for i in (11, 12, 14, 15)]: back.alpha_composite(im)
back.save('assets/props/museum_back.png'); ground.save('assets/props/museum_ground.png'); stack(I, [8, 9, 10], W, H).save('assets/props/museum_cols.png'); I[7].save('assets/props/museum_door.png'); stack(I, [16, 17], W, H).save('assets/props/museum_sign.png')
# cols = the columns and the frieze over them (the column tops tuck behind the frieze); the game draws the banner after them
# collision: the layer called "collision" (any spelling that starts with "coll") in Museum_exterior.aseprite: red marks are solid, green marks are walkable (anything not red is walkable).
col = [i for i, l in enumerate(L) if l['name'].strip().lower().startswith('coll') and i in I]
cm = Image.new('RGBA', (W, H)); cp = cm.load()
if col:
    src = I[col[0]].load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = src[x, y]
            if a > 8 and r > 180 and g < 140 and b < 140: cp[x, y] = (255, 0, 0, 255)
    print('collision layer found:', cm.getbbox())
else:
    for (x0, y0, x1, y1) in ((8, 100, 89, 148), (125, 100, 207, 148), (89, 100, 125, 134)):
        for y in range(y0, y1):
            for x in range(x0, x1): cp[x, y] = (255, 0, 0, 255)
cm.save('assets/props/museum_col.png')
print('exterior', W, H, 'door bbox', I[7].getbbox(), 'sign bbox', stack(I, [16, 17], W, H).getbbox())

# the inside of the museum (room, cases, display items, maps/museum.json) is exported by tools/museum_interior_export.py
