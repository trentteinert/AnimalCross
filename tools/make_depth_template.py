#!/usr/bin/env python3
"""Template for the dig sites' depth tiles (the sunken ground you walk down into, with ramps/stairs).
Writes tools/src/Depth_tiles_template.aseprite (layers: Reference = how the placeholder art looks now, Guide = the slots, then empty layers Floors / Walls / Ramps to paint on)
and tools/src/Depth_tiles_template.png (a flat preview).  One grid cell = one 16x16 tile; one unit of depth = 8px (PIT_U in js/world.js).
Run:  python3 tools/make_depth_template.py"""
import struct, zlib
from PIL import Image, ImageDraw, ImageFont

W, H = 256, 144
STRATA = ['#8f6439', '#a77d4b', '#7d532e', '#9a7040']; FLOOR = {1: '#5f4329', 2: '#4e3622'}
def hexc(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)

# slots: (group, name, x, y, w, h)
SLOTS = []
def row(group, name, xs, y, w, h): [SLOTS.append((group, '%s %d' % (name, i + 1) if len(xs) > 1 else name, x, y, w, h)) for i, x in enumerate(xs)]
row('Floors', 'floor 1 down', [0, 16, 32, 48], 12, 16, 16)
row('Floors', 'floor 2 down', [88, 104, 120, 136], 12, 16, 16)
row('Walls', 'north wall 1 down', [0, 16, 32, 48], 44, 16, 8)
row('Walls', 'north wall 2 down', [88, 104, 120, 136], 44, 16, 16)
row('Walls', 'side wall left', [0], 80, 8, 16); row('Walls', 'side wall right', [16], 80, 8, 16)
for i, (n, x) in enumerate([('ramp down-east', 0), ('ramp down-west', 24), ('ramp down-south', 48), ('ramp down-north', 72)]): row('Ramps', n, [x], 112, 16, 24)
TITLES = [(0, 'FLOORS: 1 down x4 | 2 down x4'), (32, 'NORTH WALL FACE: 1 down 16x8 | 2 down 16x16 (top row = lit lip)'), (68, 'SIDE WALLS (edge-on): left | right'), (100, 'RAMPS / STAIRS 16x24, low end sits 8px lower: east | west | south | north')]

def reference():
    im = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(im)
    for g, n, x, y, w, h in SLOTS:
        if n.startswith('floor'):
            dep = 1 if '1 down' in n else 2; d.rectangle([x, y, x + w - 1, y + h - 1], fill=hexc(FLOOR[dep]))
        elif n.startswith('north wall'):
            for yy in range(h): d.line([x, y + yy, x + w - 1, y + yy], fill=hexc(STRATA[(yy >> 1) & 3]))
            d.line([x, y, x + w - 1, y], fill=(255, 235, 200, 255))
        elif n.startswith('side wall'): d.rectangle([x, y, x + w - 1, y + h - 1], fill=(40, 28, 18, 255))
        elif n.startswith('ramp'):
            r = n.split('-')[1]
            if r in ('east', 'west'):
                for k in range(16):
                    t = (k + .5) / 16 if r == 'east' else 1 - (k + .5) / 16; off = round(t * 8)
                    d.rectangle([x + k, y + off, x + k, y + off + 15], fill=hexc('#8a6a40' if (k >> 2) & 1 else '#7a5a34'))
            else:
                for k in range(16):
                    t = (k + .5) / 16 if r == 'south' else 1 - (k + .5) / 16; ys = y + k + round(t * 8)
                    d.rectangle([x, ys, x + 15, ys + 1], fill=hexc('#8a6a40' if (k >> 2) & 1 else '#7a5a34'))
    return im
def guide():
    im = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(im); f = ImageFont.load_default()
    for y, t in TITLES: d.text((0, y), t, fill=(255, 255, 255, 255), font=f)
    for g, n, x, y, w, h in SLOTS:
        c = {'Floors': (80, 200, 255, 255), 'Walls': (255, 170, 60, 255), 'Ramps': (255, 90, 200, 255)}[g]; d.rectangle([x - 1, y - 1, x + w, y + h], outline=c)
    return im

def chunk(t, data): return struct.pack('<IH', len(data) + 6, t) + data
def layer(name, vis=True): n = name.encode(); return chunk(0x2004, struct.pack('<HHHHHHB3x', 3 if vis else 2, 0, 0, 0, 0, 0, 255) + struct.pack('<H', len(n)) + n)
def cel(li, im): return chunk(0x2005, struct.pack('<HhhBHh5x', li, 0, 0, 255, 2, 0) + struct.pack('<HH', im.width, im.height) + zlib.compress(im.tobytes()))
def write(path, layers):   # layers bottom to top: (name, image or None)
    chunks = b''.join(layer(n) for n, _ in layers) + b''.join(cel(i, im) for i, (n, im) in enumerate(layers) if im is not None)
    frame = struct.pack('<IHHHH2xI', 16 + len(chunks), 0xF1FA, 0, 100, 0, 0)
    frame = struct.pack('<IHHH', 16 + len(chunks), 0xF1FA, len(layers) + sum(1 for _, im in layers if im is not None), 100) + b'\0\0' + struct.pack('<I', len(layers) + sum(1 for _, im in layers if im is not None)) + chunks
    hdr = struct.pack('<IHHHHHIHIIB3xHBBhhHH', 128 + len(frame), 0xA5E0, 1, W, H, 32, 1, 100, 0, 0, 0, 0, 1, 1, 0, 0, 16, 16) + bytes(84)
    open(path, 'wb').write(hdr + frame)

ref, gd = reference(), guide(); blank = Image.new('RGBA', (W, H))
write('tools/src/Depth_tiles_template.aseprite', [('Reference (placeholder art now)', ref), ('Guide (slots, do not paint)', gd), ('Floors', blank), ('Walls', blank), ('Ramps', blank)])
prev = Image.new('RGBA', (W, H), (92, 118, 70, 255)); prev.alpha_composite(ref); prev.alpha_composite(gd); prev.resize((W * 4, H * 4), Image.NEAREST).save('tools/src/Depth_tiles_template.png')
print('tools/src/Depth_tiles_template.aseprite + .png', W, 'x', H, len(SLOTS), 'slots')
