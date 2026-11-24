#!/usr/bin/env python3
"""The expanded museum (tools/src/Museum_expanded.aseprite): the building, its furniture, the display cases and the exhibits.
  * the ground (floors, carpets, frames, void) becomes the tile set + the map's tile grid; floors and carpets are where you can walk
  * every object layer becomes a prop (assets/museum/decor.png + decor.json): plants, bookshelves, benches, the welcome desk, the curators, windows, the exhibits' pedestals and cases
  * the display cases are NOT kept as one picture with their object: the case (its base) and what stands in it are found again by matching your layers against the case and item art, so each case is
    an object with an `item` that can be shown or hidden (assets/museum/props.json has the empty and the full version of every case)
  * the pieces of the permanent exhibits (statue parts, monument stages, ritual stones, vases) are objects with `show` = the find that makes them appear
Run AFTER tools/museum_interior_export.py and tools/tiers_export.py:  python3 tools/museum_expanded_export.py"""
import sys, json, hashlib, re, time
sys.path.insert(0, 'tools')
from ase_lib import read, stack, kids, leaves
from PIL import Image

DX, DY = 9, -4
VOID = (22, 23, 26, 255)
EW, EH, L, I = read('tools/src/Museum_expanded.aseprite')
def sh(im): o = Image.new('RGBA', im.size); o.paste(im, (DX, DY)); return o
S = {i: sh(im) for i, im in I.items()}
nm = lambda i: L[i]['name']

# ------------------------------------------------------------------------------------------------ which layers are which
PROP = {6: 'rope', 7: 'noentry', 28: 'curator', 34: 'curator', 29: 'desk', 39: 'exit_sign'}   # layers of the rooms that are objects, not ground
CABINET = [31, 32, 33]
ROOMLAYERS = [i for i in range(3, 39) if L[i]['type'] == 0 and L[i]['vis'] and i in S and i not in PROP and i not in CABINET]
WALKNAME = re.compile(r'^Layer (3|15|61|16|75|76)( |$)')   # floors and carpets (the frames and the wall are not walkable)
walk_layers = [i for i in ROOMLAYERS if WALKNAME.match(nm(i))]

canvas = Image.new('RGBA', (EW, EH), VOID); floorm = Image.new('L', (EW, EH), 0)
for i in ROOMLAYERS: canvas.alpha_composite(S[i])
for i in walk_layers: floorm.paste(255, mask=S[i].getchannel('A').point(lambda v: 255 if v > 0 else 0))
cols, rows = (EW + DX + 15) // 16, (EH + 15) // 16
used = Image.new('L', (EW, EH), 0)
for i in ROOMLAYERS: used.paste(255, mask=S[i].getchannel('A').point(lambda v: 255 if v else 0))
ub = used.getbbox(); cx0, cy0, cx1, cy1 = max(0, ub[0] // 16 - 2), max(0, ub[1] // 16 - 2), min(cols, (ub[2] + 15) // 16 + 2), min(rows, (ub[3] + 15) // 16 + 2)
ox, oy = cx0 * 16, cy0 * 16
def walkcell(cx, cy): m = floorm.crop((cx * 16, cy * 16, cx * 16 + 16, cy * 16 + 16)); return sum(1 for v in m.get_flattened_data() if v) >= 40 if hasattr(m, 'get_flattened_data') else sum(1 for v in m.getdata() if v) >= 40
walkset = {(c, r) for r in range(cy0, cy1) for c in range(cx0, cx1) if walkcell(c, r)}
# doorways where a carpet runs under a wall's dark edge (two rooms joined by a door in the wall): you can walk through that edge
import numpy as np
carp = np.zeros((EH, EW), bool)
for i in ROOMLAYERS:
    if re.match(r'^Layer (61|16|75|76)( |$)', nm(i)): carp |= np.array(S[i].getchannel('A')) > 0
ca_ = np.array(canvas.convert('RGB')).astype(float); luma = 0.3 * ca_[:, :, 0] + 0.59 * ca_[:, :, 1] + 0.11 * ca_[:, :, 2]
gap = carp & (luma < 100)
PASS = []; seen_g = np.zeros_like(gap)
for yy in range(EH):
    for xx in range(EW):
        if gap[yy, xx] and not seen_g[yy, xx]:
            st_ = [(yy, xx)]; seen_g[yy, xx] = True; pts = []
            while st_:
                a_, b_ = st_.pop(); pts.append((a_, b_))
                for da in (-1, 0, 1):
                    for db in (-1, 0, 1):
                        q = (a_ + da, b_ + db)
                        if 0 <= q[0] < EH and 0 <= q[1] < EW and gap[q] and not seen_g[q]: seen_g[q] = True; st_.append(q)
            if len(pts) >= 6: PASS.append([min(p_[1] for p_ in pts) - 1, min(p_[0] for p_ in pts) - 1, max(p_[1] for p_ in pts) + 2, max(p_[0] for p_ in pts) + 2])
print('doorways through walls:', len(PASS))
_rgb = canvas.convert('RGB')
def _ring(x, y):
    r, g_, b_ = _rgb.getpixel((x, y)); return 0.3 * r + 0.59 * g_ + 0.11 * b_ < 190 and abs(r - g_) < 40 and abs(g_ - b_) < 40 and r > 60
ARCHWALLS = []; WALLS = []
def _dark(x, y):
    r, g_, b_ = _rgb.getpixel((x, y)); return r < 80 and g_ < 90 and b_ < 95
_stairs = [S[i].getbbox() for i in (25, 18)]
for a_, b_, c_, d_ in PASS:
    if any(abs((a_ + c_) / 2 - (q[0] + q[2]) / 2) < 40 and 0 < q[1] - d_ < 120 for q in _stairs):   # the top of a staircase: the stairs have their own wall
        continue
    # the wall's dark top edge exactly (not a pixel more): the rows that are dark beside the doorway
    ym = (b_ + d_) // 2; y0_ = y1_ = ym
    if _dark(a_ - 8, ym):
        while _dark(a_ - 8, y0_ - 1): y0_ -= 1
        while _dark(a_ - 8, y1_ + 1): y1_ += 1
        if y1_ + 1 - y0_ <= 12: b_, d_ = y0_, y1_ + 1
    cx_ = (a_ + c_) // 2; dome = None
    for y in range(d_, d_ + 40):
        if _ring(cx_ - 14, y): dome = y; break
    if dome is None: ARCHWALLS.append({'x': a_, 'y': b_, 'w': c_ - a_, 'h': d_ - b_, 'cx': cx_, 'by': d_ + 46, 'bot': None, 'pw': [a_, c_], 'bandb': d_}); continue
    xl = next(x for x in range(cx_ - 14, cx_ - 80, -1) if not _ring(x, dome + 14) and _ring(x - 1, dome + 14)) - 1 if False else None
    xl = cx_ - 14
    while xl > cx_ - 80 and not _ring(xl, dome + 14): xl -= 1
    xr = cx_ + 14
    while xr < cx_ + 80 and not _ring(xr, dome + 14): xr += 1
    # the mask: the wall's dark top, its face down to the arch and the arch's frame down to its inner edge (the curve), then the frame's straight sides are not covered
    L_ = {}
    for y in range(dome, dome + 30):
        xs_ = [x for x in range(xl - 3, cx_) if _ring(x, y)]
        if xs_: L_[y] = min(xs_)
    ext = min(L_.values()); cut = next(y for y in sorted(L_) if L_[y] == ext)
    bot = []
    for x in range(xl, xr + 1):
        y = dome
        while y < cut and not _ring(x, y): y += 1   # (outside the curve: the wall down to the frame)
        while y < cut and _ring(x, y): y += 1
        bot.append(y)
    for k in range(len(bot)):   # the carpet is over the frame in its own columns: the frame is level there
        if xl + k in range(a_, c_): bot[k] = bot[max(0, a_ - xl - 1)]
    # A wall between two rooms, seen from the south: its dark top (b_..d_) is the top of a wall whose face runs down to the south room's floor. In this view the
    # north room's floor goes on BEHIND the face, down to the wall's foot (as thick as the top). So: the north room is walkable down to the foot (you are hidden
    # behind the face: the game draws the face over you), the foot is solid except under the arch, and the face is drawn over anything north of the foot.
    flo = lambda x, y: (lambda p: p[0] > p[1] + 2)(_rgb.getpixel((x, y)))   # floor and carpet are warmer than the wall's cream, its grey-green dado and its dark top
    f1 = next(y for y in range(d_, d_ + 160) if flo(xl - 4, y) and flo(xr + 4, y)); f0 = f1 - (d_ - b_)
    nx0 = cx_
    lit = lambda x, y: (lambda p: 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2] >= 100)(_rgb.getpixel((x, y)))   # (the north room's floor ends at its dark side frames)
    while lit(nx0 - 1, b_ - 2): nx0 -= 1
    nx1 = cx_
    while lit(nx1, b_ - 2): nx1 += 1
    oL = cx_ - 12
    while not _ring(oL - 1, f1 - 2): oL -= 1
    oR = cx_ + 12
    while not _ring(oR, f1 - 2): oR += 1
    WALLS.append({'x0': nx0 - 10, 'x1': nx1 + 10, 'top': b_, 'f0': f0, 'f1': f1, 'open': [nx0, nx1], 'door': [oL, oR], 'hole': [bot[x - xl] if xl <= x <= xr else dome for x in range(oL, oR)]})
    print('wall between rooms: top', b_, 'foot', f0, f1, 'north room x', nx0, nx1, 'door x', oL, oR)
print('archwalls', [(q['x'], q['y'], q['w'], q['h']) for q in ARCHWALLS])
for q in ARCHWALLS:   # the wall face beside a doorway is wall: its tiles are not floor (only the tiles the doorway itself runs through are)
    if q['bot'] is None: continue
    for cc in range(q['x'] // 16, (q['x'] + q['w'] - 1) // 16 + 1):
        if cc * 16 + 16 > q['pw'][0] and cc * 16 < q['pw'][1]: continue
        for rr in range((q['bandb'] + 15) // 16, (q['y'] + q['h'] - 1) // 16 + 1): walkset.discard((cc, rr))   # (only the cells south of the dark top edge)
for a_, b_, c_, d_ in PASS:
    for cc in range(a_ // 16, (c_ - 1) // 16 + 1):
        for rr in range(b_ // 16, (d_ - 1) // 16 + 1): walkset.add((cc, rr))

# ------------------------------------------------------------------------------------------------ the tile set (and the template the editor builds rooms from: the first file's west wing)
tset, tid = [], {}
def tile_id(t, w):
    k = (hashlib.md5(t.tobytes()).hexdigest(), w)
    if k not in tid: tid[k] = len(tset); tset.append(t)
    return tid[k]
grid = {}
for cy in range(cy0, cy1):
    for cx in range(cx0, cx1): grid[(cx, cy)] = tile_id(canvas.crop((cx * 16, cy * 16, cx * 16 + 16, cy * 16 + 16)), (cx, cy) in walkset)
vw, vh, VL, VI = read('tools/src/Museum_interior_v1.aseprite')
def shv(im): o = Image.new('RGBA', im.size); o.paste(im, (DX, DY)); return o
SV = {i: shv(im) for i, im in VI.items()}; clean = stack(SV, [1, 3, 4, 5], vw, vh); pxv = clean.load(); room_ = stack(SV, [1, 3, 4, 5], vw, vh)
for x in range(350 + DX, 412 + DX):
    for y in range(0, 80): pxv[x, y] = room_.getpixel((200, y))
walkc = {(c, r) for c in range(3, 27) for r in range(5, 17)} | {(c, r) for c in (27, 28) for r in (13, 14)}
tmpl = [[tile_id(clean.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)), (c, r) in walkc) for c in range(32)] for r in range(20)]
vt = tile_id(Image.new('RGBA', (16, 16), VOID), False)
for r in range(20): tmpl[r][0] = tmpl[r][1] = vt
for c in range(32): tmpl[19][c] = vt
walk = sorted(v for k, v in tid.items() if k[1])
COLS = 16; ts = Image.new('RGBA', (COLS * 16, ((len(tset) + COLS - 1) // COLS) * 16))
for i, t in enumerate(tset): ts.paste(t, ((i % COLS) * 16, (i // COLS) * 16))
ts.save('assets/museum/tileset.png')
json.dump({'size': 16, 'cols': COLS, 'count': len(tset), 'walk': walk, 'tmpl': {'cols': 32, 'rows': 20, 'grid': tmpl, 'minW': 4, 'minH': 5, 'w': 12, 'h': 6},
           'note': 'ids are cells of the museum drawn in Museum_expanded.aseprite (tools/museum_expanded_export.py); tmpl is a plain room, used to build rooms in the editor'}, open('assets/museum/tileset.json', 'w'), separators=(',', ':'))
print('tiles', len(tset), 'walkable', len(walk), 'map', cx1 - cx0, 'x', cy1 - cy0)

# ------------------------------------------------------------------------------------------------ props
DECOR = {}; HASH = {}   # name -> picture ; picture hash -> name
SOLID = {}              # name -> how much of the bottom of the picture blocks you (0 = nothing)
LABEL = {}
objs = []
def reg(im, name, label=None, solid=0):   # a cropped picture as a prop (the same picture twice is one prop)
    k = hashlib.md5(im.tobytes()).hexdigest() + str(im.size)
    if k in HASH: return HASH[k]
    n = name; q = 2
    while n in DECOR: n = '%s_%d' % (name, q); q += 1
    DECOR[n] = im; HASH[k] = n; SOLID[n] = solid; LABEL[n] = label or n.replace('_', ' ')
    return n
def put(n, x, y, **extra):
    o = {'k': 'mprop', 'n': n, 'x': int(x - ox), 'y': int(y - oy)}; o.update(extra); objs.append(o)
def place(layer_ids, name, label=None, solid=0, blend=False, **extra):   # layers drawn together as one prop, where they were drawn
    im = stack(S, layer_ids, EW, EH, L if blend else None); b = im.getbbox()
    if not b: return None
    n = reg(im.crop(b), name, label, solid); put(n, (b[0] + b[2]) // 2, b[3], **extra); return n

# arches, ropes, signs and the exit sign: the same pictures as before (assets/museum/props.json)
for i, kind in PROP.items():
    if not L[i]['vis'] or i not in S or i == 17: continue   # (layer 17, the first arch of the east wing, is hidden behind the big window in the picture)
    b = S[i].getbbox()
    if kind == 'rope': put('stanchion', (b[0] + b[2]) // 2, b[3])
    elif kind == 'noentry': put('noentry', (b[0] + b[2]) // 2, b[3])
    elif kind == 'exit_sign': put('exit_sign', (b[0] + b[2]) // 2, b[3])
    elif kind == 'curator': place([i], 'curator', 'Curator', 0.7)
    elif kind == 'desk': place([i], 'welcome_desk', 'Welcome desk', 0.5)

# the two stairs you can walk up (layer 25: welcome centre, layer 18: east wing): their steps and the carpet over them stay in the ground, exactly as drawn (the carpet is over the steps and the
# wall frame over both). What is left of them is an invisible marker prop (where the doorway is, for the stairs' ramp and the wall that hides you) and the curved top of the frame, which is drawn over you.
import numpy as np
for i, nmx in ((25, 'arch_welcome'), (18, 'arch_east')):
    sb = S[i].getbbox(); walls = [30] if i == 25 else [j for j in ROOMLAYERS if j > i and S[j].getpixel((sb[0] + 1, sb[1] + 1))[3] > 0]   # (the wall with the doorway cut out)
    cov = np.zeros((EH, EW), bool)
    for j in walls: cov |= np.array(S[j].getchannel('A')) > 0
    hole = np.zeros((EH, EW), bool); hole[sb[1]:sb[3], sb[0]:sb[2]] = ~cov[sb[1]:sb[3], sb[0]:sb[2]]
    ys = np.where(hole.any(axis=1))[0]; ht = int(ys.min()); bx = (sb[0] - 2, ht - 3, sb[2] + 2, sb[3]); w_, h_ = bx[2] - bx[0], bx[3] - bx[1]
    left = {}
    for y in range(ht, sb[3]):
        xs = np.where(hole[y])[0]
        if len(xs): left[y] = int(xs.min())
    ext = min(left.values()); cut = next(y for y in sorted(left) if left[y] == ext) + 5
    near = np.zeros((EH, EW), bool)
    for dy in range(-2, 3):
        for dx in range(-2, 3): near |= np.roll(np.roll(hole, dy, 0), dx, 1)
    ca = np.array(canvas.convert('RGB')).astype(float); lum = 0.3 * ca[:, :, 0] + 0.59 * ca[:, :, 1] + 0.11 * ca[:, :, 2]
    ring = near & ~hole & cov & (lum < 190)
    tip = Image.new('RGBA', (w_, h_)); tp = tip.load()
    for y in range(bx[1], min(cut, bx[3])):
        for x in range(bx[0], bx[2]):
            if ring[y, x]: tp[x - bx[0], y - bx[1]] = tuple(canvas.getpixel((x, y)))
    mk_ = Image.new('RGBA', (w_, h_)); mk_.putpixel((0, 0), (0, 0, 0, 1))   # (a nearly invisible dot: the sprite is never empty)
    DECOR[nmx] = mk_; SOLID[nmx] = 0; LABEL[nmx] = 'Stairs'
    # the wall the stairs go up through, the same as the wall between the west rooms: drawn over you while you are north of its foot (on the upper stairs and in the
    # corridor behind it, seen through the arch), no collider on its dark top, its foot solid except in the doorway
    cx_ = (sb[0] + sb[2]) // 2; y = sb[1] - 40   # the wall's dark top: the first dark rows going down the middle of the corridor (the carpet runs down to it)
    while not _dark(cx_, y): y += 1
    b_ = y
    while _dark(cx_, y): y += 1
    d_ = y
    hx = np.where(hole.any(axis=0))[0]; hx0, hx1 = int(hx.min()), int(hx.max()) + 1
    flo2 = lambda x, y: (lambda p: 2 < p[0] - p[1] < 12)(_rgb.getpixel((x, y)))   # the marble floor (not the cream wall, the grey-green or red dado, the carpet)
    f1 = next(y for y in range(d_, sb[3] + 40) if flo2(hx0 - 6, y) and flo2(hx1 + 5, y)); f0 = f1 - (d_ - b_)
    lit = lambda x, y: (lambda p: 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2] >= 100)(_rgb.getpixel((x, y)))
    nx0 = cx_
    while lit(nx0 - 1, b_ - 2): nx0 -= 1
    nx1 = cx_
    while lit(nx1, b_ - 2): nx1 += 1
    dx_ = [x for x in range(hx0, hx1) if hole[f1 - 1, x]]; oL, oR = min(dx_), max(dx_) + 1
    def _top(x):   # the opening's top in this column: up from the floor line while it is open
        y = f1 - 1
        while hole[y - 1, x]: y -= 1
        return y
    tops = [_top(x) for x in range(oL, oR)]
    WALLS.append({'x0': min(nx0 - 10, hx0 - 5), 'x1': max(nx1 + 10, hx1 + 5), 'top': b_, 'f0': f0, 'f1': f1, 'open': [nx0, nx1], 'door': [oL, oR], 'hole': tops, 'deep': [oL - 4, oR + 4, sb[3] + 2]})   # deep: the arch over the stairs is in front of you all the way down the stairs
    print('stairs wall', nmx, 'top', b_, d_, 'foot', f0, f1, 'corridor x', nx0, nx1, 'door x', oL, oR)
    put(nmx, (sb[0] + sb[2]) // 2, sb[3])
place(CABINET, 'display_cabinet', 'Display cabinet', 0.5, blend=True)

# windows (the glass is drawn in with its screen blend)
for g in (182, 186, 40):
    ids = [i for i in leaves(L, g) if L[i]['vis'] and i in S]
    if ids: place(ids, 'window_big' if g == 40 else 'window', 'Big window' if g == 40 else 'Window', 0, blend=True)

# furniture and plants
FUR = {191: ('plant_palm', 'Palm plant'), 192: ('plant_palm', 'Palm plant'), 193: ('plant_orange', 'Orange plant'), 198: ('plant_leafy', 'Leafy plant'), 199: ('plant_leafy', 'Leafy plant'),
       200: ('plant_fern', 'Fern'), 201: ('plant_fern', 'Fern'), 202: ('plant_fern', 'Fern'), 203: ('bench', 'Bench'), 204: ('sofa', 'Sofa')}
for i in leaves(L, 190):
    if not (L[i]['vis'] and i in S): continue
    if i in FUR: place([i], FUR[i][0], FUR[i][1], 0.6)
    else: place([i], 'bookshelf', 'Bookshelf', 0.4)   # 194-197: the tall bookshelves

# ------------------------------------------------------------------------------------------------ the display cases: found again by matching, so a case and what is in it are separate
pj = json.load(open('assets/museum/props.json')); pimg = Image.open('assets/museum/props.png').convert('RGBA')
def pcrop(n, over=False):
    d = pj[n]; x = d['ox'] if over else d['sx']; y = d['oy'] if over and 'oy' in d else d['sy']; return pimg.crop((x, y, x + d['w'], y + d['h']))
CASES = {n: (pcrop(n), pcrop(n + '_empty')) for n in ('case_1x1', 'case_2x1', 'case_2x2', 'case_3x2')}
ij = json.load(open('assets/museum/items.json')); iimg = Image.open('assets/museum/items.png').convert('RGBA'); tj = json.load(open('assets/museum/tiers.json')); timg = Image.open('assets/museum/tiers.png').convert('RGBA')
art2id = {m.group(2): m.group(1) for m in re.finditer(r"\{ id: '(\w+)', art: '(\w+)'", open('js/data.js').read())}
CANDS = []   # (item id, case, tier (0 = the picture as it was first drawn), picture, ix, iy)
for iid, d in ij.items():
    if d['case'] not in CASES or iid == 'empty_stand' and False: continue
    base = iimg.crop((d['sx'], d['sy'], d['sx'] + d['w'], d['sy'] + d['h'])); CANDS.append((iid, d['case'], 0, base, d['ix'], d['iy']))
    parts = d.get('parts')
    if parts and all(art2id.get(q['k']) in tj for q in parts):
        for t in range(3):
            comp = Image.new('RGBA', (d['w'], d['h']))
            for q in parts:
                sx, sy, w, h = tj[art2id[q['k']]]['f'][t]; comp.alpha_composite(timg.crop((sx, sy, sx + w, sy + h)), (q['dx'], q['dy']))
            CANDS.append((iid, d['case'], t + 1, comp, d['ix'], d['iy']))
import numpy as np
def arr(im): return np.array(im.convert('RGBA'))
# every picture that can stand in a case: whole display items (the sets), and every piece of a set on its own (each is its own find, and can be in a case alone), each in its three tiers and as first drawn
pj2 = json.load(open('assets/museum/pieces.json')); pim = Image.open('assets/museum/pieces.png').convert('RGBA')
CANDS = []   # (id, kind 'set' | 'piece', case or None, tier, picture array, ix, iy)
for iid, d in ij.items():
    if d['case'] not in CASES: continue
    CANDS.append((iid, 'set', d['case'], 0, arr(iimg.crop((d['sx'], d['sy'], d['sx'] + d['w'], d['sy'] + d['h']))), d['ix'], d['iy']))
    parts = d.get('parts')
    if parts and all(art2id.get(q['k']) in tj for q in parts):
        for t in range(3):
            comp = Image.new('RGBA', (d['w'], d['h']))
            for q in parts:
                sx, sy, w, h = tj[art2id[q['k']]]['f'][t]; comp.alpha_composite(timg.crop((sx, sy, sx + w, sy + h)), (q['dx'], q['dy']))
            CANDS.append((iid, 'set', d['case'], t + 1, arr(comp), d['ix'], d['iy']))
for gid, d in tj.items():
    for t in range(3):
        sx, sy, w, h = d['f'][t]; CANDS.append((gid, 'piece', None, t + 1, arr(timg.crop((sx, sy, sx + w, sy + h))), 0, 0))
def best_place(layarr, unexpl, cand, around=None):   # where (and how well) a candidate picture fits what is drawn above the case's base
    ca = cand; m = ca[:, :, 3] > 0; n = int(m.sum()); H, W = layarr.shape[:2]; h, w = ca.shape[:2]; best = (0, 0, 0)
    if n == 0: return best
    ys = range(-3, H - h + 4) if around is None else [around[1] + d for d in range(-2, 3)]; xs = range(-3, W - w + 4) if around is None else [around[0] + d for d in range(-2, 3)]
    for py in ys:
        for px in xs:
            y0, x0 = max(py, 0), max(px, 0); y1, x1 = min(py + h, H), min(px + w, W)
            if y1 <= y0 or x1 <= x0: continue
            cs = ca[y0 - py:y1 - py, x0 - px:x1 - px]; ls = layarr[y0:y1, x0:x1]; cm = cs[:, :, 3] > 0
            hit = int((np.all(cs == ls, axis=2) & cm).sum()); frac = hit / n
            if frac < 0.8: continue
            ue = unexpl[y0:y1, x0:x1]; expl = int((ue & cm).sum()) / max(1, int(unexpl.sum())); sc = frac * expl
            if sc > best[0]: best = (sc, px, py)
    return best
case_objs = []; unmatched = []; extra_items = []
for g in (120, 126, 146):
    for i in leaves(L, g):
        if not (L[i]['vis'] and i in S) or L[i]['blend'] == 1: continue
        im = S[i]; b = im.getbbox(); lay = im.crop(b); lw, lh = lay.size; la = arr(lay); best = None
        for cn, (full, empty) in CASES.items():   # which case: the lower part (drawers and legs) is the same in every version; the biggest case the layer is tall enough for
            if full.width != lw: continue
            ea = arr(empty); ys_ = np.where(ea[:, :, 3] > 0)[0]; bh = int(ys_.max() - ys_.min() + 1); top = int(ys_.min())
            if lh < bh - 1: continue
            cut = top + int((empty.height - top) * 0.55); lower = ea.copy(); lower[:cut] = 0; m = lower[:, :, 3] > 0
            y0 = lh - empty.height; sl = np.zeros_like(lower)
            for yy in range(empty.height):
                if 0 <= yy + y0 < lh: sl[yy] = la[yy + y0]
            sc = float((np.all(sl == lower, axis=2) & m).sum()) / max(1, int(m.sum()))
            if sc >= 0.8 and (best is None or bh > best[4]): best = (sc, cn, None, None, bh)
        if not best: unmatched.append((i, nm(i), b)); continue
        cn = best[1]; full, empty = CASES[cn]; ea = arr(empty); fa = arr(full); y0 = lh - full.height
        fl = np.zeros((lh, lw, 4), np.uint8)   # the case's own pixels placed under the layer's bottom edge
        for yy in range(full.height):
            if 0 <= yy + y0 < lh: fl[yy + y0] = fa[yy]
        el = np.zeros((lh, lw, 4), np.uint8)
        for yy in range(empty.height):
            if 0 <= yy + y0 < lh: el[yy + y0] = ea[yy]
        unexpl_full = (la[:, :, 3] > 0) & ~np.all(la == fl, axis=2); unexpl_empty = (la[:, :, 3] > 0) & ~np.all(la == el, axis=2)
        if int(unexpl_empty.sum()) <= 2: case_objs.append((i, cn, 'empty', None, 0, b, None)); continue   # nothing but the base: an empty display
        if int(unexpl_full.sum()) <= 2: case_objs.append((i, cn, 'full', None, 0, b, None)); continue     # the case with its pillow and nothing on it
        un = unexpl_full; found_ = None; sbest = 0.0
        for iid, kind, ccn, t, ca, ix, iy in CANDS:
            if kind == 'set' and ccn != cn: continue
            if not (0.6 * int(un.sum()) <= int((ca[:, :, 3] > 0).sum()) <= 1.5 * int(un.sum())): continue
            sc, px, py = best_place(la, un, ca, (ix, y0 + iy) if kind == 'set' else None)
            if sc > sbest + 1e-9: sbest = sc; found_ = (iid, kind, t, px - 0, py - y0)
        if found_ and sbest >= 0.75: case_objs.append((i, cn, 'full', found_[0], found_[2], b, found_))
        else:   # art that is not any of the finds (yet): what stands in the case is kept as it is drawn, a picture of its own on top of the case
            case_objs.append((i, cn, 'full', None, 0, b, None)); unmatched.append((i, nm(i), b, 'item kept as drawn', round(sbest, 2)))
            ia = np.zeros_like(la); ia[un] = la[un]; sub = Image.fromarray(ia, 'RGBA'); sb = sub.getbbox()
            if sb: extra_items.append((reg(sub.crop(sb), 'case_item', 'Case item (not matched)', 0), b[0] + sb[0] + (sb[2] - sb[0]) // 2, b[1] + sb[3], b[3]))
for i, cn, kind, item, tier, b, f_ in case_objs:
    ex = {}
    if kind == 'empty': ex['bare'] = 1
    if item: ex['item'] = item
    if f_ and f_[1] == 'piece': ex['ix'] = int(f_[3]); ex['iy'] = int(f_[4])   # a single piece stands where it was drawn
    put(cn, (b[0] + b[2]) // 2, b[3], **ex)
for n_, x_, y_, cb_ in extra_items: put(n_, x_, y_, sy=cb_ - oy + 0.3)
print('cases', len(case_objs), 'empty', sum(1 for c in case_objs if c[2] == 'empty'), 'with an item', sum(1 for c in case_objs if c[3]), 'sets', sum(1 for c in case_objs if c[6] and c[6][1] == 'set'), 'pieces', sum(1 for c in case_objs if c[6] and c[6][1] == 'piece'), 'unmatched:', unmatched)

# ------------------------------------------------------------------------------------------------ the permanent exhibits
def layer_by(name, nth=0, group=None): return [i for i in range(len(L)) if L[i]['name'] == name and (group is None or L[i]['parent'] == group)][nth]
STATUE = {62: 'ex_statue_head', 61: 'ex_statue_torso', 63: 'ex_statue_left_arm', 64: 'ex_statue_right_arm', 65: 'ex_statue_left_leg', 66: 'ex_statue_right_leg'}
pedestal = 56; shadow = 58
b = S[pedestal].getbbox(); base_y = b[3]
place([pedestal], 'statue_pedestal', 'Statue pedestal', 0.5, sy=base_y - oy); place([shadow], 'statue_shadow', None, 0, sy=base_y - oy + 0.1)
for k, (i, exid) in enumerate(STATUE.items() and [(i, e) for i, e in STATUE.items()]):
    place([i], 'statue_' + exid[10:], 'Statue ' + exid[10:].replace('_', ' '), 0, show=exid, sy=base_y - oy + 0.2 + k * 0.01)
# monument exhibit: tray, plants, glass, and the three stages
mon = {'tray': 72, 'leaves': 73, 'glass1': 74, 'wreath': 79, 'glass2': 80}; mb = S[mon['tray']].getbbox(); my = mb[3] - oy
place([72], 'monument_tray', 'Monument case', 0.5, sy=my)
place([73], 'monument_leaves', None, 0, sy=my + 0.1); place([79], 'monument_wreath', None, 0, sy=my + 0.1)
for i, exid, z in ((78, 'ex_monument_base', 0.2), (77, 'ex_monument_middle', 0.21), (76, 'ex_monument_top', 0.22)): place([i], 'monument_' + exid[12:], 'Monument ' + exid[12:], 0, show=exid, sy=my + z)
place([74], 'monument_glass_a', None, 0, sy=my + 0.5); place([80], 'monument_glass_b', None, 0, sy=my + 0.5)
# ritual site: tray, ornament, stones, glass
rb = S[93].getbbox(); ry = rb[3] - oy
place([93], 'ritual_tray', 'Ritual site case', 0.5, sy=ry); place([94], 'ritual_ornament', None, 0, sy=ry + 0.1)
RIT = {105: 'ex_ritual_center'}; RIT.update({96 + q: 'ex_ritual_stone%d' % (9 - q) for q in range(9)})
for k, (i, exid) in enumerate(RIT.items()): place([i], 'ritual_' + exid[10:], 'Ritual ' + exid[10:].replace('_', ' '), 0, show=exid, sy=ry + 0.2 + k * 0.01)
place([106], 'ritual_dots', None, 0, sy=ry + 0.5); place([107], 'ritual_glass', None, 0, sy=ry + 0.5)
# the ceremonial vases stand on four pedestals: every separate vase in the two layers is one object
for i in (110, 111, 109): place([i], 'vase_pedestal', 'Vase pedestal', 0.4)
b108 = S[108].getbbox(); pimg108 = S[108].crop(b108)
# the two vase layers both hold copies (the painted one is in both): the vases as drawn (both layers over each other) are split into the separate vases, and each is
# the plain or the painted vase by its look (the painted one has the red pattern)
both = stack(S, [113, 114], EW, EH); ba = np.array(both); xs_ = np.where((ba[:, :, 3] > 0).any(axis=0))[0]; runs = []; r0 = rp = int(xs_[0])
for x in xs_[1:]:
    if x > rp + 2: runs.append((r0, rp + 1)); r0 = int(x)
    rp = int(x)
runs.append((r0, rp + 1))
for x0, x1 in runs:
    sub_ = ba[:, x0:x1]; m_ = sub_[:, :, 3] > 0; ys_ = np.where(m_.any(axis=1))[0]; y0, y1 = int(ys_.min()), int(ys_.max()) + 1
    painted = int(((sub_[:, :, 0] > 150) & (sub_[:, :, 1] < 110) & m_).sum()) > 10; exid = 'painted_cerimonial_vase' if painted else 'cerimonial_vase'
    n = reg(both.crop((x0, y0, x1, y1)), 'vase_painted' if painted else 'vase_plain', 'Painted ceremonial vase' if painted else 'Ceremonial vase', 0)
    put(n, (x0 + x1) // 2, y1, show=exid, sy=S[110].getbbox()[3] - oy + 0.3)   # (drawn over the pedestals)
print('vases', [(x0, x1) for x0, x1 in runs])
# the other pedestal sprite (two pedestals in one layer)
place([108], 'vase_pedestal_pair', 'Vase pedestals', 0.4)

# ------------------------------------------------------------------------------------------------ sheet and map
names = list(DECOR); xs = ys = shh = 0; pos = []
for n in names:
    im = DECOR[n]
    if xs + im.width > 512: xs = 0; ys += shh + 1; shh = 0
    pos.append((xs, ys)); xs += im.width + 1; shh = max(shh, im.height)
sheet = Image.new('RGBA', (512, ys + shh)); meta = {}
for n, (px_, py_) in zip(names, pos):
    im = DECOR[n]; sheet.paste(im, (px_, py_)); meta[n] = {'sx': px_, 'sy': py_, 'w': im.width, 'h': im.height, 'ax': im.width // 2, 'ay': im.height, 'solid': SOLID[n], 'label': LABEL[n]}
sheet.save('assets/museum/decor.png'); json.dump(meta, open('assets/museum/decor.json', 'w'), separators=(',', ':'))
mw, mh = cx1 - cx0, cy1 - cy0; chars = lambda row: ''.join(chr(48 + v) for v in row)
tiles = [chars([grid[(cx0 + x, cy0 + y)] for x in range(mw)]) for y in range(mh)]; zero = ['0' * mw] * mh
objs.append({'k': 'mexit', 'x': 544 - ox, 'y': 620 - oy, 'to': 'island'})
json.dump({'v': 1, 'w': mw, 'h': mh, 'theme': 'museum', 'tiles': tiles, 'deck': zero, 'site': zero, 'pit': zero, 'pier': None, 'structs': [], 'spawn': {'x': 544 - ox, 'y': 556 - oy}, 'walls': [dict(q, x0=q['x0'] - ox, x1=q['x1'] - ox, top=q['top'] - oy, f0=q['f0'] - oy, f1=q['f1'] - oy, open=[q['open'][0] - ox, q['open'][1] - ox], door=[q['door'][0] - ox, q['door'][1] - ox], hole=[v - oy for v in q['hole']], **({'deep': [q['deep'][0] - ox, q['deep'][1] - ox, q['deep'][2] - oy]} if q.get('deep') else {})) for q in WALLS], 'archwalls': [dict(q, x=q['x'] - ox, y=q['y'] - oy, cx=q['cx'] - ox, by=q['by'] - oy, bot=q['bot'] and [v - oy for v in q['bot']], pw=[q['pw'][0] - ox, q['pw'][1] - ox], bandb=q['bandb'] - oy) for q in ARCHWALLS], 'passages': [[a_ - ox, b_ - oy, c_ - ox, d_ - oy] for a_, b_, c_, d_ in PASS], 'objects': objs}, open('maps/museum.json', 'w'), separators=(',', ':'))
open('js/museumver.js', 'w').write("const MUSEUM_V = '%s';   // written by the museum export scripts: changes whenever the museum's pictures do\n" % time.strftime('%Y%m%d%H%M%S'))
print('maps/museum.json', mw, 'x', mh, len(objs), 'objects;', len(DECOR), 'decor pictures')
