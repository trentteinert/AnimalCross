#!/usr/bin/env python3
"""The little grass sprites drawn in tools/src/Grass_tiles.aseprite (every layer after the tile set and its three swatches) as a strip for the game:
assets/tiles/grass_detail.png, and their places in it in js/grassdetail.js. The game scatters them over plain grass (js/world.js, groundDetails).
Run:  python3 tools/grass_detail_export.py"""
import sys; sys.path.insert(0, 'tools')
from ase_lib import read
from PIL import Image
W, H, L, I = read('tools/src/Grass_tiles.aseprite')
skip = {'Layer 1', 'Shadow', 'Base midtone', 'High light'}
pics = [I[i].crop(I[i].getbbox()) for i, l in enumerate(L) if l['type'] == 0 and l['vis'] and l['name'] not in skip and i in I and I[i].getbbox()]
x = 0; rects = []; sheet = Image.new('RGBA', (sum(p.width + 1 for p in pics), max(p.height for p in pics)))
for p in pics: sheet.paste(p, (x, 0)); rects.append([x, 0, p.width, p.height]); x += p.width + 1
sheet.save('assets/tiles/grass_detail.png')
open('js/grassdetail.js', 'w').write('// written by tools/grass_detail_export.py: where each little grass sprite is in assets/tiles/grass_detail.png [x, y, w, h]\nconst GRASS_DETAIL = %s;\n' % rects)
print(len(rects), 'grass sprites', sheet.size)
