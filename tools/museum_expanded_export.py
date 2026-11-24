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
PROP = {6: 'rope', 7: 'noentry', 17: 'arch', 18: 'arch', 25: 'arch_narrow', 28: 'curator', 34: 'curator', 29: 'desk', 39: 'exit_sign'}   # layers of the rooms that are objects, not ground
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
    if kind == 'arch': put('arch' if b[2] - b[0] >= 33 else 'arch_narrow', (b[0] + b[2]) // 2, b[3])
    elif kind == 'arch_narrow': put('arch_narrow', (b[0] + b[2]) // 2, b[3])
    elif kind == 'rope': put('stanchion', (b[0] + b[2]) // 2, b[3])
    elif kind == 'noentry': put('noentry', (b[0] + b[2]) // 2, b[3])
    elif kind == 'exit_sign': put('exit_sign', (b[0] + b[2]) // 2, b[3])
    elif kind == 'curator': place([i], 'curator', 'Curator', 0.7)
    elif kind == 'desk': place([i], 'welcome_desk', 'Welcome desk', 0.5)
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
for ex_i, exid in ((113, 'cerimonial_vase'), (114, 'painted_cerimonial_vase')):
    im = S[ex_i]; seen = set(); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] and (x, y) not in seen:
                comp = [(x, y)]; seen.add((x, y)); st = [(x, y)]
                while st:
                    a, c = st.pop()
                    for da in (-2, -1, 0, 1, 2):
                        for dc in (-2, -1, 0, 1, 2):
                            q = (a + da, c + dc)
                            if 0 <= q[0] < im.width and 0 <= q[1] < im.height and px[q][3] and q not in seen: seen.add(q); st.append(q); comp.append(q)
                x0 = min(p[0] for p in comp); x1 = max(p[0] for p in comp) + 1; y0 = min(p[1] for p in comp); y1 = max(p[1] for p in comp) + 1
                sub = Image.new('RGBA', (x1 - x0, y1 - y0))
                for p in comp: sub.putpixel((p[0] - x0, p[1] - y0), px[p])
                n = reg(sub, 'vase_' + ('painted' if 'painted' in exid else 'plain'), 'Ceremonial vase', 0); put(n, (x0 + x1) // 2, y1, show=exid, sy=S[110].getbbox()[3] - oy + 0.3)   # (drawn over the pedestals)
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
json.dump({'v': 1, 'w': mw, 'h': mh, 'theme': 'museum', 'tiles': tiles, 'deck': zero, 'site': zero, 'pit': zero, 'pier': None, 'structs': [], 'spawn': {'x': 544 - ox, 'y': 556 - oy}, 'passages': [[a_ - ox, b_ - oy, c_ - ox, d_ - oy] for a_, b_, c_, d_ in PASS], 'objects': objs}, open('maps/museum.json', 'w'), separators=(',', ':'))
open('js/museumver.js', 'w').write("const MUSEUM_V = '%s';   // written by the museum export scripts: changes whenever the museum's pictures do\n" % time.strftime('%Y%m%d%H%M%S'))
print('maps/museum.json', mw, 'x', mh, len(objs), 'objects;', len(DECOR), 'decor pictures')
