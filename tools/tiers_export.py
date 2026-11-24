#!/usr/bin/env python3
"""Artifact tiers: every find can be a T1 / T2 / T3 version of itself (Bronze / Iron / Ceremonial, Plain / Decorated / Gilded...).
Source: tools/src/Artifact_tiers.aseprite (one layer per artifact per tier, named "<source> / <artifact> / T<n> <variant>") and Artifact_tiers.csv (the legend).
The pieces in the collection log are the same cuts as in museum_interior_export.py: a layer that holds two objects (the twin cutlasses, the longsword and the shield) is cut in two, an arrowhead layer
that holds several copies keeps one. The permanent exhibits (sculpture, monument, ritual site, both ceremonial vases) have no tiers and are left out.
Writes assets/museum/tiers.png + tiers.json: { game id: { names: [T1, T2, T3], t: [[sx, sy, w, h] x3] } }
Run:  python3 tools/tiers_export.py"""
import csv, json, struct, zlib, re
from PIL import Image

def read(path):   # one picture per layer (first frame), full canvas size, by layer name
    d = open(path, 'rb').read(); W, H = struct.unpack_from('<HH', d, 8); off = 128
    fb, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, off); n = new or old; p = off + 16; L = []; I = {}
    for _ in range(n):
        csz, ct = struct.unpack_from('<IH', d, p); b = p + 6
        if ct == 0x2004:
            nl = struct.unpack_from('<H', d, b + 16)[0]; L.append(d[b + 18:b + 18 + nl].decode('utf8', 'replace').strip())
        elif ct == 0x2005:
            li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, b); w, h = struct.unpack_from('<HH', d, b + 16)
            if ctype in (0, 2):
                raw = d[b + 20:b + 20 + w * h * 4] if ctype == 0 else zlib.decompressobj().decompress(d[b + 20:p + csz])
                full = Image.new('RGBA', (W, H)); full.alpha_composite(Image.frombytes('RGBA', (w, h), raw).crop((max(0, -x), max(0, -y), w, h)), (max(0, x), max(0, y))); I[li] = full
        p += csz
    return W, H, L, I

def one_object(im):   # the first (top-left) of the separate shapes drawn in a layer
    px = im.load(); seen = set(); best = None
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] and (x, y) not in seen:
                comp = [(x, y)]; seen.add((x, y)); st = [(x, y)]
                while st:
                    a, b = st.pop()
                    for da in (-1, 0, 1):
                        for db in (-1, 0, 1):
                            q = (a + da, b + db)
                            if 0 <= q[0] < im.width and 0 <= q[1] < im.height and px[q][3] and q not in seen: seen.add(q); st.append(q); comp.append(q)
                if best is None or (min(c[0] for c in comp), min(c[1] for c in comp)) < (min(c[0] for c in best), min(c[1] for c in best)): best = comp
    out = Image.new('RGBA', im.size)
    for c in best: out.putpixel(c, px[c])
    return out

def split_at(im, cut):   # left / right of a column
    bb = im.getbbox(); a = Image.new('RGBA', im.size); b = Image.new('RGBA', im.size)
    a.paste(im.crop((bb[0], bb[1], cut, bb[3])), (bb[0], bb[1])); b.paste(im.crop((cut, bb[1], bb[2], bb[3])), (cut, bb[1])); return a, b

# the legend's artifact name -> the finds (game ids) made from it
MAP = {'Ceremonial dagger': ['ceremonial_dagger'], 'ceremonial cutlass': ['ceremonial_cutlass'], 'Mysterious hat': ['mysterious_hat'], 'Decorative Wooden comb': ['decorative_wooden_comb'],
       'Fancy Broach': ['fancy_broach'], 'Sun mask': ['sun_mask'], 'Ancient decorative bowl': ['bowl'], 'Ancient bowl': ['ancient_bowl'], 'Ancient coin': ['coin'], 'Clay token': ['clay_token'],
       'Signet ring': ['signet_ring'], 'Ancient decorative vase': ['ancient_decorative_vase'], 'Ancient urn': ['ancient_urn'], 'Bust': ['bust'], 'Bust 2': ['bust_2'],
       'cylindrical standing totem': ['cylindrical_standing_totem'], 'Horned standing totem': ['horned_standing_totem'], 'Clay jug': ['jug'], 'Painted clay jug': ['painted_clay_jug'],
       'Bone flute': ['bone_flute'], 'Open candleholder': ['open_candleholder'], 'Caged candleholder': ['caged_candleholder'], 'Serving plater': ['serving_plater'], 'Ancient sickle': ['ancient_sickle'],
       'Ancient Tablet': ['ancient_tablet'], 'Ancient vessel A (source Layer 15-4)': ['cutlass_left', 'cutlass_right'], 'Ancient vessel B (source Layer 15-5)': ['longsword', 'shield'],
       'Merchant scale': ['merchant_scale'], 'Emerald ring': ['emerald_ring'], 'Saphire ring': ['saphire_ring'], 'Ruby ring': ['ruby_ring'], 'Diamond ring': ['diamond_ring'],
       'Ruby amulet': ['ruby_amulet'], 'Diamond amulet': ['diamond_amulet'], 'Saphire amulet': ['saphire_amulet'], 'Emerald amulet': ['emerald_amulet'],
       'Large arrowhead 2': ['large_arrowhead_2'], 'Small arrowhead': ['small_arrowhead'], 'Meadium arrowhead': ['meadium_arrowhead'], 'Large arrow head': ['large_arrow_head'], 'Decorative thrown': ['decorative_thrown']}
SKIP = {'Completed Sculpture', 'Carved monument complete', 'Cerimonial vase', 'Painted cerimonial vase', 'Ritual Stone Circle'}   # the permanent exhibits: one version only
ONE = {'large_arrowhead_2', 'small_arrowhead', 'meadium_arrowhead', 'large_arrow_head'}   # several copies drawn in the layer: keep one

W, H, L, I = read('tools/src/Artifact_tiers.aseprite')
by = {}   # artifact name -> {tier: (variant, picture)}
for i, nm in enumerate(L):
    m = re.match(r'^\S+ / (.+) / T(\d) (.+)$', nm)
    if m and i in I: by.setdefault(m.group(1).strip(), {})[int(m.group(2))] = (m.group(3), I[i])
rows = list(csv.DictReader(open('tools/src/Artifact_tiers.csv'))); known = {r['artifact'].strip() for r in rows}
out = {}
for art, tiers in by.items():
    if art in SKIP: continue
    ids = MAP.get(art)
    if not ids: print('not used:', art); continue
    names = [tiers[t][0] for t in (1, 2, 3)]; pics = [tiers[t][1] for t in (1, 2, 3)]
    if len(ids) == 2:   # two objects in one layer: cut at the empty column between them (found on the first tier, the same cut for the others)
        im = pics[0]; bb = im.getbbox(); cols = [any(im.getpixel((x, y))[3] for y in range(bb[1], bb[3])) for x in range(bb[0], bb[2])]
        gaps = [x for x in range(1, len(cols) - 1) if not cols[x]]; cut = gaps[len(gaps) // 2] + bb[0] if gaps else (bb[0] + bb[2]) // 2
        parts = [split_at(p, cut) for p in pics]
        for k, gid in enumerate(ids): out[gid] = (names, [pp[k] for pp in parts])
    else:
        out[ids[0]] = (names, [one_object(p) if ids[0] in ONE else p for p in pics])
missing = [g for v in MAP.values() for g in v if g not in out]; print('tiered finds:', len(out), 'missing:', missing)

pics = []; keys = []
for gid, (names, ps) in out.items():
    for t, p in enumerate(ps): pics.append(p.crop(p.getbbox())); keys.append((gid, t))
x = y = sh = 0; pos = []
for im in pics:
    if x + im.width > 256: x = 0; y += sh + 1; sh = 0
    pos.append((x, y)); x += im.width + 1; sh = max(sh, im.height)
sheet = Image.new('RGBA', (256, y + sh)); meta = {}
for (gid, t), im, (px, py) in zip(keys, pics, pos):
    sheet.paste(im, (px, py)); meta.setdefault(gid, {'names': out[gid][0], 't': [None, None, None]})['t'][t] = [px, py, im.width, im.height]
sheet.save('assets/museum/tiers.png'); json.dump(meta, open('assets/museum/tiers.json', 'w'), separators=(',', ':'))
print('assets/museum/tiers.png', sheet.size, len(meta), 'finds x 3 tiers')
import time; v = time.strftime('%Y%m%d%H%M%S'); open('js/museumver.js', 'w').write("const MUSEUM_V = '%s';   // written by tools/museum_interior_export.py and tools/tiers_export.py: changes whenever the museum's pictures do\n" % v)
