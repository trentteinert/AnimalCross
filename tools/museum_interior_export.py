#!/usr/bin/env python3
"""Museum inside: the room, its props and every display item.
Sources (tools/src):
  Museum_interior.aseprite  the room (640x320). Moved by (+9, -4) so the marble lines up with the game's 16 pixel grid.
  Artifacts_1x1 / _2x1 / _2x2 / _3x2.aseprite   one display case each (base, pillow, glass) and every item that goes in it.

Writes
  assets/museum/tileset.png + tileset.json   16x16 tiles of the room, plus a template the game and the editor use to build a room of any size
                                             (the left and right ends, top wall and bottom with the exit corridor are kept; the middle repeats).
  assets/museum/props.png + props.json       cases (base and pillow, glass kept apart so an item sits between them), stage, wall panels, window, arch, rope...
  assets/museum/items.png + items.json       every display item, already placed in its case: centred left to right on the base, and at the height you
                                             set in Museum_interior.aseprite (its hidden Displays layers are matched to each item by their pixels).
                                             Groups in an artifact file become one item (a pair of jugs, four rings), except Busts (two separate busts).
                                             The permanent exhibits keep their build stages (sculpture parts, monument bottom / middle, ritual stones).
  maps/museum.json                           a room with every item on display.
Run:  python3 tools/museum_interior_export.py"""
import hashlib, json, re, struct, zlib
from PIL import Image, ImageChops

SRC = 'tools/src/'

def read(path):   # layers (with parent, path, visibility) and one picture per layer (first frame), full canvas size
    d = open(path, 'rb').read(); W, H = struct.unpack_from('<HH', d, 8); off = 128
    fb, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, off); n = new or old; p = off + 16; L = []; I = {}
    for _ in range(n):
        csz, ct = struct.unpack_from('<IH', d, p); b = p + 6
        if ct == 0x2004:
            f, t, lv = struct.unpack_from('<HHH', d, b); bm, op = struct.unpack_from('<HB', d, b + 10); nl = struct.unpack_from('<H', d, b + 16)[0]
            L.append({'flags': f, 'type': t, 'lv': lv, 'blend': bm, 'op': op, 'name': d[b + 18:b + 18 + nl].decode('utf8', 'replace').strip()})
        elif ct == 0x2005:
            li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, b); w, h = struct.unpack_from('<HH', d, b + 16)
            if ctype in (0, 2):
                raw = d[b + 20:b + 20 + w * h * 4] if ctype == 0 else zlib.decompressobj().decompress(d[b + 20:p + csz])
                full = Image.new('RGBA', (W, H)); full.alpha_composite(Image.frombytes('RGBA', (w, h), raw).crop((max(0, -x), max(0, -y), w, h)), (max(0, x), max(0, y))); I[li] = full
        p += csz
    st = []
    for i, l in enumerate(L):
        while st and L[st[-1]]['lv'] >= l['lv']: st.pop()
        l['parent'] = st[-1] if st else None; l['vis'] = bool(l['flags'] & 1) and all(L[j]['flags'] & 1 for j in st)
        if l['type'] == 1: st.append(i)
    return W, H, L, I

def kids(L, g): return [i for i, l in enumerate(L) if l['parent'] == g]
def leaves(L, g):   # every picture layer under a group, bottom to top
    out = []
    for i in kids(L, g): out += leaves(L, i) if L[i]['type'] == 1 else [i]
    return out
def stack(I, ids, W, H, L=None):   # layers over each other; with L, each layer's blend mode (multiply / screen) and opacity
    o = Image.new('RGBA', (W, H))
    for i in ids:
        if i not in I: continue
        mode = L[i]['blend'] if L else 0; op = L[i]['op'] / 255 if L else 1
        if mode in (1, 2):
            top = I[i]; bl = (ImageChops.multiply if mode == 1 else ImageChops.screen)(o.convert('RGB'), top.convert('RGB')); m = top.getchannel('A').point(lambda v: round(v * op))
            res = Image.composite(bl, o.convert('RGB'), m).convert('RGBA'); res.putalpha(ImageChops.lighter(o.getchannel('A'), m)); o = res
        elif op < 1: t = I[i].copy(); t.putalpha(t.getchannel('A').point(lambda v: round(v * op))); o.alpha_composite(t)
        else: o.alpha_composite(I[i])
    return o
def key(im):   # a picture's pixels, cropped, as a lookup key
    b = im.getbbox(); return hashlib.md5(im.crop(b).tobytes()).hexdigest() + str(b[2] - b[0]) + 'x' + str(b[3] - b[1]) if b else None

# ------------------------------------------------------------------------------------------------ the props' source: the first interior file
W, H, L, I = read(SRC + 'Museum_interior_v1.aseprite'); DX, DY = 9, -4
def sh(im): o = Image.new('RGBA', im.size); o.paste(im, (DX, DY)); return o
S = {i: sh(im) for i, im in I.items()}
byname = lambda n: next(i for i, l in enumerate(L) if l['name'] == n)
room = stack(S, [1, 3, 4, 5], W, H)
withArch = stack(S, [1, 2, 3, 4, 5], W, H)
clean = room.copy(); px = clean.load()
for x in range(350 + DX, 412 + DX):   # the arch is a prop (so it can go anywhere): the wall behind it is filled from a plain stretch of wall
    for y in range(0, 80): px[x, y] = room.getpixel((200, y))
arch = Image.new('RGBA', (W, H)); ap = arch.load(); wa = withArch.load()
for y in range(H):
    for x in range(W):
        if wa[x, y] != px[x, y]: ap[x, y] = wa[x, y]

# ------------------------------------------------------------------------------------------------ the museum: Museum_interior.aseprite (west wing, east wing, welcome center, the ? room and the season exhibit)
NW, NH, NL, NI = read(SRC + 'Museum_interior.aseprite')
nid = lambda name, nth=0: [i for i, l in enumerate(NL) if l['name'] == name][nth]
VOID = (22, 23, 26, 255)
# every room is a floor layer and a frame layer; their arches, no-entry signs and ropes are separate layers (props, placed where you drew them)
ROOMS = {'west': (4, 5), 'season': (9, 10), 'east': (14, 15), 'welcome': (20, 21), 'what': (23, 24)}
FIX = {'season': (0, -5)}   # the season exhibit was drawn 5px off the 16px grid the other rooms sit on (copy and paste): moved up 5px
def nshift(im, dx, dy): o = Image.new('RGBA', im.size); o.paste(im, (DX + dx, DY + dy)); return o
layers = {}
for r, (fl, fr) in ROOMS.items(): dx, dy = FIX.get(r, (0, 0)); layers[r] = (nshift(NI[fl], dx, dy), nshift(NI[fr], dx, dy))
canvas = Image.new('RGBA', (NW, NH), VOID); floorm = Image.new('L', (NW, NH), 0)
for i in sorted(i for r in ROOMS.values() for i in r):   # in the file's order: later layers are on top
    r = next(k for k, v in ROOMS.items() if i in v); a, b = layers[r]; im = a if i == ROOMS[r][0] else b; canvas.alpha_composite(im)
for r in ROOMS:
    floorm.paste(255, mask=layers[r][0].getchannel('A').point(lambda v: 255 if v > 0 else 0))
# props: arches, signs, ropes. Their layers go (pixel for pixel) where you drew them, so the wall behind each is filled from a plain stretch of the same wall
PR = {'west': {'arch': 3, 'noentry': 6, 'rope': 7}, 'east': {'arch': 12, 'arch2': 13, 'noentry': 16, 'rope': 17}, 'welcome': {'arch': 19}}
ARCHBB = {}; ARCHES = {}; orig = canvas.copy()
for r, d in PR.items():
    for k, i in d.items():
        if k.startswith('arch'):
            bb = NI[i].getbbox(); ft = layers[r][0].getbbox()[1] - 0   # floor top of that room (shifted)
            x0, y0, x1, y1 = bb[0] + DX, bb[1] + DY, bb[2] + DX, bb[3] + DY; ref = layers[r][0].getbbox()[0] + 48   # a plain wall column of the same room
            ARCHES[(r, k)] = (x0, y0, x1, y1)
            for x in range(x0 - 3, x1 + 3):
                for y in range(y0 - 3, ft): canvas.putpixel((x, y), canvas.getpixel((ref, y)))
def arch_prop(i, x0, y0, x1, y1):   # the doorway as drawn (dark hole in the wall plus the translucent stairs layer on top), as a picture you can place anywhere
    comp = orig.copy(); comp.alpha_composite(nshift(NI[i], 0, 0)); box = (x0 - 3, y0 - 3, x1 + 3, y1 + 3); a = comp.crop(box); f = canvas.crop(box); out = Image.new('RGBA', a.size)
    pa, pf, po = a.load(), f.load(), out.load()
    for y in range(a.height):
        for x in range(a.width):
            if pa[x, y] != pf[x, y]: po[x, y] = pa[x, y]
    return out
ARCHPIC = {'arch': arch_prop(3, *ARCHES[('west', 'arch')]), 'arch_narrow': arch_prop(19, *ARCHES[('welcome', 'arch')])}
# a cell is walkable where the floor layer covers a good part of it
def walkcell(cx, cy): m = floorm.crop((cx * 16, cy * 16, cx * 16 + 16, cy * 16 + 16)); return sum(1 for v in m.getdata() if v) >= 40
cols, rows = (NW + DX + 15) // 16, (NH + 15) // 16
used = Image.new('L', (NW, NH), 0)
for r, (a, b) in layers.items(): used.paste(255, mask=a.getchannel('A').point(lambda v: 255 if v else 0)); used.paste(255, mask=b.getchannel('A').point(lambda v: 255 if v else 0))
ub = used.getbbox(); cx0, cy0, cx1, cy1 = max(0, ub[0] // 16 - 2), max(0, ub[1] // 16 - 2), min(cols, (ub[2] + 15) // 16 + 2), min(rows, (ub[3] + 15) // 16 + 2)
walkset = {(c, r) for r in range(rows) for c in range(cols) if walkcell(c, r)}
tset, tid, grid = [], {}, {}
for cy in range(rows):
    for cx in range(cols):
        t = canvas.crop((cx * 16, cy * 16, cx * 16 + 16, cy * 16 + 16)); k = (hashlib.md5(t.tobytes()).hexdigest(), (cx, cy) in walkset)
        if k not in tid: tid[k] = len(tset); tset.append(t)
        grid[(cx, cy)] = tid[k]
# the template for rooms built in the editor is the first file's room (west wing as it was drawn, 32x20 cells), added to the same tile set
walkc = {(c, r) for c in range(3, 27) for r in range(5, 17)} | {(c, r) for c in (27, 28) for r in (13, 14)}
def tile_id(t, w):
    k = (hashlib.md5(t.tobytes()).hexdigest(), w)
    if k not in tid: tid[k] = len(tset); tset.append(t)
    return tid[k]
tmpl = [[tile_id(clean.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)), (c, r) in walkc) for c in range(32)] for r in range(20)]
for r in range(20):   # the old canvas edge (column 0, the strip under the room) was see-through: plain void now
    tmpl[r][0] = tmpl[r][1] = tile_id(Image.new('RGBA', (16, 16), VOID), False)
for c in range(32): tmpl[19][c] = tile_id(Image.new('RGBA', (16, 16), VOID), False)
walk = sorted(v for k, v in tid.items() if k[1])
COLS = 16; ts = Image.new('RGBA', (COLS * 16, ((len(tset) + COLS - 1) // COLS) * 16))
for i, t in enumerate(tset): ts.paste(t, ((i % COLS) * 16, (i // COLS) * 16))
ts.save('assets/museum/tileset.png')
TM = {'cols': 32, 'rows': 20, 'grid': tmpl, 'minW': 4, 'minH': 5, 'w': 12, 'h': 6}
print('tiles', len(tset), 'walkable', len(walk), 'map', cx1 - cx0, 'x', cy1 - cy0)
json.dump({'size': 16, 'cols': COLS, 'count': len(tset), 'walk': walk, 'tmpl': TM, 'note': 'ids are cells of the museum drawn in Museum_interior.aseprite (tools/museum_interior_export.py); tmpl is the west wing, used to build rooms in the editor'}, open('assets/museum/tileset.json', 'w'), separators=(',', ':'))

# ------------------------------------------------------------------------------------------------ cases and their items
CASES = {'case_1x1': 'Artifacts_1x1', 'case_2x1': 'Artifacts_2x1', 'case_2x2': 'Artifacts_2x2', 'case_3x2': 'Artifacts_3x2'}
MGROUP = {'case_1x1': '1*1 (3)', 'case_2x1': '2x1', 'case_2x2': '2x2', 'case_3x2': '3x2'}   # the same case in Museum_interior.aseprite (hidden, with the items placed in it)
SPLIT = {'Busts'}                                                                         # groups whose pictures are separate items
EXHIBITS = {   # permanent exhibits: stages in the order you would build them. 'add' = each stage adds a piece to the last; 'swap' = each stage is its own picture
    'Standing sculpture': ('add', ['Left leg', 'Right leg', 'Torso', 'Left arm', 'Rightarm', 'Head'], ['Shadow'], ['Shadow', 'Completed Sculpture']),
    'Carvel monument': ('swap', [['Carved monument bottom'], ['Carved monument middle']], [], ['Carved monument complete']),
    'Ritual site': ('add', ['Ritual site center', 'Stone I', 'Stone 2', 'Stone 3', 'Stone 4', 'Stone 5', 'Stone 6', 'Stone 7', 'Stone 8', 'Stone 9'], [], None)}
LABEL = {'Decorative thrown': 'Decorative throne', 'Serving plater': 'Serving platter', 'Meadium arrowhead': 'Medium arrowhead', 'Carvel monument': 'Carved monument', 'Cerimonial Vase': 'Ceremonial vases',
         'Fancy Broach': 'Fancy brooch', 'Saphire ring': 'Sapphire ring', 'Saphire amulet': 'Sapphire amulet', 'Bust 2': 'Bust (2)', 'Jugs': 'Clay jugs', 'Gem rings': 'Gem rings', 'Arrow heads': 'Arrowheads'}
slug = lambda s: re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

# where the museum file has each item: picture key -> (bottom row - base top row)
mdy = {}
for cn, gname in MGROUP.items():
    g = next(i for i, l in enumerate(L) if l['name'] == gname and l['type'] == 1); ks = kids(L, g)
    base = next(i for i in ks if L[i]['type'] == 0 and I.get(i) and L[i]['name'].startswith('Layer 28')); btop = I[base].getbbox()[1]; d = {}
    def walkm(gr):
        for i in kids(L, gr):
            im = stack(I, leaves(L, i), W, H) if L[i]['type'] == 1 else I.get(i)
            if im is not None and im.getbbox(): d[key(im)] = d['name:' + L[i]['name'].lower()] = im.getbbox()[3] - btop   # by pixels, and by name when the pixels were changed since
            if L[i]['type'] == 1: walkm(i)
    walkm(g); mdy[cn] = d

props, items = {}, {}
for cn, fn in CASES.items():
    w, h, AL, AI = read(SRC + fn + '.aseprite')
    grp = next(i for i, l in enumerate(AL) if l['type'] == 1 and l['parent'] is None and re.match(r'\d', l['name']))   # the case group (1*1, 2x1, 2x2, 3x2)
    nm = lambda i: AL[i]['name'].lower()
    base = [i for i in kids(AL, grp) if AL[i]['type'] == 0 and (nm(i) == 'base' or (cn != 'case_3x2' and ('pillow' in nm(i) or 'pill ow' in nm(i))))]   # the permanent exhibits (3x2) have no pillow under them for now
    glass = next(i for i in kids(AL, grp) if 'glass' in nm(i))
    bimg = stack(AI, base, w, h); gimg = stack(AI, [glass], w, h); bb = AI[base[0]].getbbox(); gb = gimg.getbbox(); ub = bimg.getbbox()
    x0, y0, x1, y1 = min(ub[0], gb[0]), min(ub[1], gb[1]), max(ub[2], gb[2]), max(ub[3], gb[3])
    props[cn] = {'img': bimg.crop((x0, y0, x1, y1)), 'over': gimg.crop((x0, y0, x1, y1)), 'blend': AL[glass]['blend'], 'op': AL[glass]['op']}
    bx0, btop, bw = bb[0] - x0, bb[1] - y0, bb[2] - bb[0]
    # the items: every other child of the case group (and, for 3x2, the ceremonial vases group next to it)
    src = [i for i in kids(AL, grp) if i not in base and i != glass and 'pill' not in nm(i)] + [i for i, l in enumerate(AL) if l['parent'] is None and l['type'] == 1 and i != grp and leaves(AL, i)]
    entries = []
    for i in src:
        n = AL[i]['name']
        if AL[i]['type'] == 1 and n in SPLIT: entries += [(AL[j]['name'], [j], None) for j in kids(AL, i)]
        elif AL[i]['type'] == 1 and n in EXHIBITS:
            mode, steps, under, done = EXHIBITS[n]; ids = {AL[j]['name']: j for j in leaves(AL, i)}
            if mode == 'add': stg = [[ids[s] for s in under] + sorted(ids[s] for s in steps[:k + 1]) for k in range(len(steps))]
            else: stg = [[ids[s] for s in st] for st in steps]
            entries.append((n, [ids[s] for s in done] if done else stg[-1], stg))
        elif AL[i]['type'] == 1: entries.append((n, leaves(AL, i), None))
        else: entries.append((n, [i], None))
    common = {}
    for n, ids, stg in entries:
        im = stack(AI, ids, w, h); b = im.getbbox(); dy = mdy[cn].get(key(im))
        if dy is None:   # not found as a whole: one of its pictures on its own
            for j in ids:
                dj = mdy[cn].get(key(AI[j]))
                if dj is not None: dy = dj + (b[3] - AI[j].getbbox()[3]); break
        if dy is None: dy = mdy[cn].get('name:' + n.lower())
        if dy is not None: common[dy] = common.get(dy, 0) + 1
        items[slug(n)] = {'name': n, 'case': cn, 'img': im, 'bb': b, 'dy': dy, 'stages': [stack(AI, s, w, h) for s in stg] if stg else None, 'bx0': bx0, 'btop': btop, 'bw': bw}
    fall = max(common, key=common.get) if common else 8
    for k, it in items.items():
        if it['case'] == cn and it['dy'] is None: it['dy'] = fall; print('  no match in the museum file for', it['name'], '- used', fall)

# ------------------------------------------------------------------------------------------------ room props (from Museum_interior.aseprite)
def mp(ids, blend=False, src=None): return stack(src or I, ids, W, H, L if blend else None)
ROOMP = {'case_3x3': ([12, 13], [14]), 'case_3x1': ([47, 48], [49]), 'case_1x2': ([91], [92]),   # the older case sizes (still in the file, kept for the editor)
         'stage': ([115, 118, 120], []), 'board': ([119], []), 'statue': ([117], []), 'panel_fossils': ([127, 128], []), 'panel_scorpion': ([124, 125], []), 'plaque': ([122], []),
         'window': ([7, 8, 9], []), 'stanchion': ([byname('Stairs closed -stansion')], [])}
for n, (b, o) in ROOMP.items():
    bi = mp(b, n == 'window'); oi = mp(o) if o else None; boxes = [x.getbbox() for x in (bi, oi) if x is not None and x.getbbox()]
    x0, y0, x1, y1 = min(q[0] for q in boxes), min(q[1] for q in boxes), max(q[2] for q in boxes), max(q[3] for q in boxes)
    props[n] = {'img': bi.crop((x0, y0, x1, y1)), 'over': oi.crop((x0, y0, x1, y1)) if oi else None, 'blend': L[o[0]]['blend'] if o else 0, 'op': L[o[0]]['op'] if o else 255, 'at': ((x0 + x1) // 2 + DX, y1 + DY)}
def layer_prop(i, dx=0, dy=0):   # a prop cut from one layer of the museum file, exactly as drawn
    im = nshift(NI[i], dx, dy); b = im.getbbox(); return {'img': im.crop(b), 'over': None}, b
for name, i in (('noentry', 6), ('stanchion', 7), ('exit_sign', 25)): props[name] = layer_prop(i)[0]
for name, im in ARCHPIC.items(): bb = im.getbbox(); props[name] = {'img': im.crop(bb), 'over': None}; ARCHBB[name] = bb

# ------------------------------------------------------------------------------------------------ pack the sheets
def pack(pics, width=512):   # shelf packing; returns positions
    x = y = sh_ = 0; pos = []
    for im in pics:
        if x + im.width > width: x = 0; y += sh_ + 1; sh_ = 0
        pos.append((x, y)); x += im.width + 1; sh_ = max(sh_, im.height)
    return pos, y + sh_
pics = []; meta = {}
for n, p in props.items(): pics.append(p['img']); pics.append(p['over']) if p['over'] is not None else None
pos, ph = pack(pics); sheet = Image.new('RGBA', (512, ph)); k = 0
for n, p in props.items():
    im = p['img']; sheet.paste(im, pos[k]); m = {'sx': pos[k][0], 'sy': pos[k][1], 'w': im.width, 'h': im.height, 'ax': im.width // 2, 'ay': im.height, 'over': p['over'] is not None}; k += 1
    if p['over'] is not None: sheet.paste(p['over'], pos[k]); m.update({'ox': pos[k][0], 'oy': pos[k][1], 'overBlend': {0: 'normal', 1: 'multiply', 2: 'screen'}[p['blend']], 'overAlpha': round(p['op'] / 255, 3)}); k += 1
    meta[n] = m
sheet.save('assets/museum/props.png'); json.dump(meta, open('assets/museum/props.json', 'w'), indent=0)

pics = []
for it in items.values():
    b = it['bb'] if not it['stages'] else None
    if it['stages']:   # every stage cut to one frame, so the pieces stay where they belong
        bs = [s.getbbox() for s in it['stages']] + [it['bb']]; b = (min(q[0] for q in bs), min(q[1] for q in bs), max(q[2] for q in bs), max(q[3] for q in bs))
        it['dy'] += b[3] - it['bb'][3]
    it['crop'] = b; pics.append(it['img'].crop(b)); pics += [s.crop(b) for s in it['stages'] or []]
pos, ph = pack(pics); sheet = Image.new('RGBA', (512, ph)); k = 0; out = {}
for sid, it in items.items():
    b = it['crop']; iw, ih = b[2] - b[0], b[3] - b[1]; sheet.paste(pics[k], pos[k])
    ix = it['bx0'] + (it['bw'] - iw) // 2; iy = it['btop'] + it['dy'] - ih   # centred on the base; bottom at the height from the museum file
    o = {'label': LABEL.get(it['name'], it['name']), 'case': it['case'], 'sx': pos[k][0], 'sy': pos[k][1], 'w': iw, 'h': ih, 'ix': ix, 'iy': iy}; k += 1
    if it['stages']:
        o['stages'] = []
        for _ in it['stages']: sheet.paste(pics[k], pos[k]); o['stages'].append([pos[k][0], pos[k][1]]); k += 1
    out[sid] = o
sheet.save('assets/museum/items.png'); json.dump(out, open('assets/museum/items.json', 'w'), indent=0)
for c in CASES: print(c, [s for s, o in out.items() if o['case'] == c])

WALLP_ = {'panel_fossils': -14, 'panel_scorpion': -14, 'plaque': -14, 'window': -10}   # how far their bottom is above the floor's top edge (same as the editor)
import sys
if '--map' not in sys.argv: print('(maps/museum.json left alone; run with --map to rebuild the sample room)'); sys.exit()
# ------------------------------------------------------------------------------------------------ the map: a room with every item on display
ox, oy = cx0 * 16, cy0 * 16
objs = []
def put(n, x, y, item=None):
    o = {'k': 'mprop', 'n': n, 'x': int(x - ox), 'y': int(y - oy)}
    if item: o['item'] = item
    objs.append(o)
def put_layer(n, i, dx=0, dy=0):   # a prop where its layer was drawn
    b = nshift(NI[i], dx, dy).getbbox(); put(n, b[0] + (b[2] - b[0]) // 2, b[3])
def put_arch(n, room, k):
    x0, y0, x1, y1 = ARCHES[(room, k)]; bb = ARCHBB[n]; put(n, x0 - 3 + bb[0] + (bb[2] - bb[0]) // 2, y0 - 3 + bb[3])
put_arch('arch', 'west', 'arch'); put_layer('noentry', 6); put_layer('stanchion', 7)                                  # west wing: the closed stairs
put_arch('arch', 'east', 'arch'); put_layer('noentry', 16); put_layer('stanchion', 17); put_arch('arch', 'east', 'arch2')      # east wing: closed stairs, and the stairs up to the season exhibit
put_arch('arch_narrow', 'welcome', 'arch')                                                                                  # welcome center: the stairs up to the ? room
ids = lambda c: [k for k, o in out.items() if o['case'] == c]
FT = 400   # the wings' floor top
for x, n in ((130, 'panel_fossils'), (204, 'panel_scorpion'), (256, 'plaque'), (300, 'window')): put(n, x, FT + WALLP_[n])
for x, n in ((800, 'panel_fossils'), (880, 'plaque'), (990, 'window')): put(n, x, FT + WALLP_[n])
for i, k in enumerate(ids('case_2x2')): put('case_2x2', 96 + 64 * i, 464, k)                              # west wing: 2x2 cases, 2x1 cases, 1x1 cases
c21 = ids('case_2x1')
for i, k in enumerate(c21[:6]): put('case_2x1', 96 + 56 * i, 528, k)
c11 = ids('case_1x1')
for i, k in enumerate(c11[:10]): put('case_1x1', 96 + 32 * i, 584, k)
for i, k in enumerate(ids('case_3x2')): put('case_3x2', 770 + 60 * i, 480, k)                           # east wing: the permanent exhibits, then more cases
for i, k in enumerate(c21[6:]): put('case_2x1', 700 + 56 * i, 552, k)
for i, k in enumerate(c11[10:]): put('case_1x1', 700 + 36 * i, 584, k)
objs.append({'k': 'mexit', 'x': 544 - ox, 'y': 620 - oy, 'to': 'island'})
mw, mh = cx1 - cx0, cy1 - cy0; chars = lambda row: ''.join(chr(48 + v) for v in row)
tiles = [chars([grid[(cx0 + x, cy0 + y)] for x in range(mw)]) for y in range(mh)]; zero = ['0' * mw] * mh
json.dump({'v': 1, 'w': mw, 'h': mh, 'theme': 'museum', 'tiles': tiles, 'deck': zero, 'site': zero, 'pit': zero, 'pier': None, 'structs': [], 'spawn': {'x': 544 - ox, 'y': 560 - oy}, 'objects': objs}, open('maps/museum.json', 'w'), separators=(',', ':'))
print('maps/museum.json', mw, 'x', mh, 'tiles,', len(objs), 'objects')
