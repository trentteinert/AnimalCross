#!/usr/bin/env python3
"""Helpers for reading Aseprite files (layers, blend modes, one picture per layer) used by the museum export scripts."""
import struct, zlib
from PIL import Image, ImageChops

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
