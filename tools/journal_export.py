#!/usr/bin/env python3
"""Cuts the journal artwork (tools/src/Journal.aseprite, 256x160, one layer per piece) into separate PNGs in assets/ui/journal/
and writes journal.json: where each piece sits in the 256x160 book, plus the slot rectangles found in the grid pieces.
Text that was painted into the art is removed here, because the game draws all text itself (so it scales to any screen).
usage: python3 tools/journal_export.py [in.aseprite] [out_dir]"""
import json, os, struct, sys, zlib
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'src', 'Journal.aseprite')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'assets', 'ui', 'journal')
TEXT = (89, 66, 55)        # the dark brown of the painted text: the same shade the game's text now uses
PANEL, PAGE, LINE, CELL = (225, 198, 180), (214, 178, 153), (196, 154, 128), (214, 178, 153)

def read_layers(path):
    d = open(path, 'rb').read(); _, magic, nframes, W, H, depth = struct.unpack_from('<IHHHHH', d, 0)
    assert magic == 0xA5E0 and depth == 32, 'not an RGBA aseprite file'
    fbytes, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, 128); p = 144; layers, cels = [], {}
    for _ in range(new or old):
        csz, ct = struct.unpack_from('<IH', d, p); body = p + 6
        if ct == 0x2004:
            n = struct.unpack_from('<H', d, body + 16)[0]; layers.append(d[body + 18:body + 18 + n].decode('utf8', 'replace'))
        elif ct == 0x2005:
            li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, body)
            if ctype in (0, 2):
                w, h = struct.unpack_from('<HH', d, body + 16)
                raw = d[body + 20:body + 20 + w * h * 4] if ctype == 0 else zlib.decompressobj().decompress(d[body + 20:p + csz])   # (the file's zlib streams lack their final checksum, so the plain one-shot call refuses them)
                if w * h <= 256 * 160 * 2: cels[li] = (x, y, Image.frombytes('RGBA', (w, h), raw))
        p += csz
    return W, H, layers, cels

def full(cel, W, H):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); im.alpha_composite(cel[2], (cel[0], cel[1])); return im

def recolour(im, src, dst, box=None):
    px = im.load(); x0, y0, x1, y1 = box or (0, 0, im.width, im.height)
    for y in range(y0, y1):
        for x in range(x0, x1):
            if px[x, y][:3] == src and px[x, y][3]: px[x, y] = dst + (255,)

def clear(im, box):
    px = im.load()
    for y in range(box[1], box[3]):
        for x in range(box[0], box[2]): px[x, y] = (0, 0, 0, 0)

def cells(im, colour, lo=5, hi=14):
    """rectangles (x, y, w, h) of the slots: connected blocks of `colour` that are small and squarish, grown by one pixel for their border"""
    px = im.load(); W, H = im.size; seen = set(); out = []
    for y in range(H):
        for x in range(W):
            if (x, y) in seen or px[x, y][:3] != colour or not px[x, y][3]: continue
            st = [(x, y)]; seen.add((x, y)); xs, ys = [x], [y]
            while st:
                cx, cy = st.pop()
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and px[nx, ny][:3] == colour and px[nx, ny][3]: seen.add((nx, ny)); st.append((nx, ny)); xs.append(nx); ys.append(ny)
            w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
            if lo <= w <= hi and lo <= h <= hi: out.append([min(xs) - 1, min(ys) - 1, w + 2, h + 2])
    return sorted(out, key=lambda r: (r[1], r[0]))

# name -> layer index in the file
PIECES = {
    'back_r': 0, 'back_l': 1, 'edge_r': 2, 'edge_l': 3, 'block_r': 4, 'block_l': 5, 'tab_left': 6, 'tab_time': 8, 'tab_dot': 9,
    'rib_gear': 12, 'icon_gear': 13, 'bookmark': 14, 'rib_log': 15, 'icon_log': 16, 'rib_bag': 17, 'icon_bag': 23, 'rib_com': 18, 'icon_com': 20, 'rib_tasks': 21, 'icon_tasks': 22,
    'lines_r': 25, 'lines_l': 26, 'page_r': 27, 'page_l': 28,
    'bag_left': 61, 'bag_portrait': 62, 'bag_clouds': 63, 'bag_slots': 64, 'bag_equip': 65, 'bag_edit': 66, 'bag_inv': 60, 'bag_right': 56,
    'clog_grid': 69, 'clog_right': 70, 'clog_box': 71, 'clog_card': 72,
    'com_left': 36, 'com_right': 37, 'com_bg': 38, 'com_plaque': 40, 'com_slots': 43, 'com_plaques': 44, 'com_prog': 45, 'com_runes': 46, 'dino0': 48, 'dino1': 49, 'dino2': 50, 'dino3': 51, 'dino4': 52,
}
SIDE = {'bag_left': 'l', 'bag_portrait': 'l', 'bag_clouds': 'l', 'bag_slots': 'l', 'bag_equip': 'l', 'bag_edit': 'l', 'bag_inv': 'l', 'bag_right': 'r', 'clog_grid': 'l', 'clog_right': 'r', 'clog_box': 'r', 'clog_card': 'r',
        'com_left': 'l', 'com_bg': 'l', 'com_plaque': 'l', 'com_prog': 'l', 'com_runes': 'l', 'dino0': 'l', 'dino1': 'l', 'dino2': 'l', 'dino3': 'l', 'dino4': 'l', 'com_right': 'r', 'com_slots': 'r', 'com_plaques': 'r'}

def main():
    W, H, names, cels = read_layers(SRC); os.makedirs(OUT, exist_ok=True); man = {'size': [W, H], 'pieces': {}}
    for name, idx in PIECES.items():
        im = full(cels[idx], W, H)
        if name == 'tab_left': recolour(im, TEXT, (209, 161, 122))                                   # the baked-in "TASKS" label
        elif name in ('clog_grid',): clear(im, (0, 0, W, 36))                                           # the painted SITE tabs and page glyphs above the grid
        elif name in ('clog_right', 'com_left', 'com_right'): clear(im, (0, 0, W, 28))                  # stray glyph bits above the panels
        elif name == 'bag_right':
            clear(im, (0, 0, W, 36)); recolour(im, TEXT, PANEL, (0, 36, W, H))                          # the "STATS:" label, and the three painted example rows
            px = im.load(); xs = [x for x in range(W) if px[x, 98][:3] == LINE and px[x, 98][3]]
            for x in range(min(xs), max(xs) + 1): px[x, 108] = LINE + (255,)                            # a seventh row line, to match the others
        bb = im.getbbox(); crop = im.crop(bb); crop.save(os.path.join(OUT, name + '.png'))
        ent = {'x': bb[0], 'y': bb[1], 'w': crop.width, 'h': crop.height}
        if name in SIDE: ent['side'] = SIDE[name]
        if name in ('clog_grid', 'bag_inv', 'bag_right', 'com_slots', 'com_prog'):
            ent['cells'] = cells(im, CELL if name != 'com_slots' else (134, 92, 69), 5 if name != 'com_prog' else 3, 40 if name == 'com_slots' else 14)
        man['pieces'][name] = ent
    json.dump(man, open(os.path.join(OUT, 'journal.json'), 'w'), indent=1)
    print('wrote', len(man['pieces']), 'pieces to', OUT)
    for k, v in man['pieces'].items():
        if 'cells' in v: print(' ', k, len(v['cells']), 'cells', v['cells'][:3])

if __name__ == '__main__': main()
