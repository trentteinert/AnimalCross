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
CELL = (214, 178, 153)

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
    'cal_nameplate': 31, 'cal_grid': 33, 'tasks_panel': 34, 'tab_sel': None, 'tab_idle': None,
    'com_left': 36, 'com_right': 37, 'com_bg': 38, 'com_plaque': 39, 'com_slots': 42, 'com_plaques': 43, 'com_prog': 44, 'com_runes': 45,
    'dino0': 47, 'dino1': 48, 'dino2': 49, 'dino3': 50, 'dino4': 51,
    'bag_inv': 54, 'edit_panel': 55, 'bag_portrait': 56, 'bag_clouds': 57, 'bag_slots': 58, 'bag_equip': 59, 'bag_edit': 60,
    'clog_grid': 63, 'clog_right': 64, 'clog_box': 65, 'clog_card': 66,
}
SIDE = {'bag_portrait': 'l', 'bag_clouds': 'l', 'bag_slots': 'l', 'bag_equip': 'l', 'bag_edit': 'l', 'bag_inv': 'l', 'edit_panel': 'l', 'clog_grid': 'l', 'clog_right': 'r', 'clog_box': 'r', 'clog_card': 'r',
        'com_left': 'l', 'com_bg': 'l', 'com_plaque': 'l', 'com_prog': 'l', 'com_runes': 'l', 'dino0': 'l', 'dino1': 'l', 'dino2': 'l', 'dino3': 'l', 'dino4': 'l', 'com_right': 'r', 'com_slots': 'r', 'com_plaques': 'r',
        'tasks_panel': 'l', 'cal_grid': 'r', 'cal_nameplate': 'r'}
TEXT2 = (96, 70, 62)   # the dark brown of the painted text in the calendar and task layers

def erase_text(im, colour, box=None):
    """paints out every pixel of `colour` with the most common neighbouring colour that is not text, and returns the rectangles the text covered (before it was removed)"""
    px = im.load(); W, H = im.size; x0, y0, x1, y1 = box or (0, 0, W, H); todo = [(x, y) for y in range(y0, y1) for x in range(x0, x1) if px[x, y][:3] == colour and px[x, y][3]]
    spots = list(todo)
    for _ in range(4):
        left = []
        for x, y in todo:
            n = {}
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < W and 0 <= yy < H and px[xx, yy][3] and px[xx, yy][:3] != colour: n[px[xx, yy]] = n.get(px[xx, yy], 0) + 1
            if n: px[x, y] = max(n, key=n.get)
            else: left.append((x, y))
        todo = left
        if not todo: break
    return spots

def clusters(spots, gap=3):
    """groups text pixels that sit close together into rectangles (x, y, w, h): one per word"""
    pts = sorted(spots); out = []
    for x, y in pts:
        for r in out:
            if r[0] - gap <= x <= r[2] + gap and r[1] - gap <= y <= r[3] + gap: r[0] = min(r[0], x); r[1] = min(r[1], y); r[2] = max(r[2], x); r[3] = max(r[3], y); break
        else: out.append([x, y, x, y])
    return [[r[0], r[1], r[2] - r[0] + 1, r[3] - r[1] + 1] for r in out]

def runs(im, x, y0, y1, colours, minlen=8):
    """vertical runs at column x whose colour is in `colours` and are at least minlen tall: (start, length)"""
    px = im.load(); out = []; start = None
    for y in range(y0, y1 + 1):
        ok = y < y1 and px[x, y][3] and px[x, y][:3] in colours
        if ok and start is None: start = y
        if not ok and start is not None:
            if y - start >= minlen: out.append((start, y - start))
            start = None
    return out

def pencil():
    """a little pixel pencil (8x8) for the edit button on the character portrait, drawn here so it survives re-cutting the book"""
    pal = {'O': (89, 66, 55), 'E': (217, 115, 138), 'Y': (224, 180, 58), 'S': (176, 128, 30), 'W': (225, 198, 180), 'G': (58, 42, 30)}
    rows = ['......OO', '.....OEEO', '....OEEO.', '...OYYO..', '..OYSYO..', '.OYSYO...', '.OWYO....', 'OGWO.....']
    im = Image.new('RGBA', (8, 8), (0, 0, 0, 0)); px = im.load()
    for y, r in enumerate(rows):
        for x, c in enumerate(r[:8]):
            if c in pal: px[x, y] = pal[c] + (255,)
    return im

def main():
    W, H, names, cels = read_layers(SRC); os.makedirs(OUT, exist_ok=True); man = {'size': [W, H], 'pieces': {}}
    for name, idx in PIECES.items():
        if idx is None: continue   # cut out of another piece below
        im = full(cels[idx], W, H); extra = {}
        if name == 'tab_left': recolour(im, TEXT, (209, 161, 122))                                    # the baked-in "TASKS" label
        elif name == 'clog_grid': clear(im, (0, 0, W, 36))                                              # the painted SITE tabs and page glyphs above the grid
        elif name in ('clog_right', 'com_left', 'com_right'): clear(im, (0, 0, W, 28))                  # stray glyph bits above the panels
        elif name == 'tasks_panel':
            spots = erase_text(im, TEXT2); extra['labels'] = [r for r in clusters(spots) if r[1] < 52]   # TODAY and WEEK: the game writes them (rectangles are where the painted words were)
            fills = {(214, 178, 153), (225, 198, 180)}; ys = runs(im, 60, 40, 128, fills, 9); xs = [x for x in range(W) if im.getpixel((x, ys[0][0] + 5))[3] and im.getpixel((x, ys[0][0] + 5))[:3] in fills | {(196, 154, 128)}]
            extra['rows'] = [[min(xs), y, max(xs) - min(xs) + 1, h] for y, h in ys]
            # the two little tabs (TODAY dark = chosen, WEEK light = not) are cut out as their own pieces so the game can swap which one looks chosen
            px = im.load(); top = min(y for y in range(H) for x in range(W) if px[x, y][3]); strip = (top, 51)
            dark = [x for x in range(W) for y in range(*strip) if px[x, y][:3] == (136, 96, 75) and px[x, y][3]]; dx1 = max(dark); cols = sorted({x for x in range(W) for y in range(*strip) if px[x, y][3]})
            a = [x for x in cols if x <= dx1 + 0]; b = [x for x in cols if x > dx1]
            for nm, cs in (('tab_sel', a), ('tab_idle', b)):
                t = im.crop((min(cs), strip[0], max(cs) + 1, strip[1])); t.save(os.path.join(OUT, nm + '.png')); man['pieces'][nm] = {'x': min(cs), 'y': strip[0], 'w': t.width, 'h': t.height}
            clear(im, (0, 0, W, strip[1]))
        elif name == 'cal_grid': erase_text(im, TEXT2)                                                   # the numbers 1 to 30
        bb = im.getbbox(); crop = im.crop(bb); crop.save(os.path.join(OUT, name + '.png'))
        ent = {'x': bb[0], 'y': bb[1], 'w': crop.width, 'h': crop.height}; ent.update(extra)
        if name in SIDE: ent['side'] = SIDE[name]
        if name in ('clog_grid', 'bag_inv', 'com_prog'): ent['cells'] = cells(im, CELL, 3 if name == 'com_prog' else 5, 14)
        if name == 'cal_grid': ent['cells'] = cells(im, (196, 154, 128), 8, 20)
        man['pieces'][name] = ent
    for f in os.listdir(OUT):   # drop pieces from earlier versions of the file that no longer exist
        if f.endswith('.png') and f[:-4] not in PIECES and f[:-4] not in ('tab_sel', 'tab_idle', 'edit_pencil'): os.remove(os.path.join(OUT, f))
    pencil().save(os.path.join(OUT, 'edit_pencil.png'))
    json.dump(man, open(os.path.join(OUT, 'journal.json'), 'w'), indent=1)
    print('wrote', len(man['pieces']), 'pieces to', OUT)
    for k, v in man['pieces'].items():
        for f in ('cells', 'rows', 'labels'):
            if f in v: print(' ', k, f, len(v[f]), v[f][:4])

if __name__ == '__main__': main()
