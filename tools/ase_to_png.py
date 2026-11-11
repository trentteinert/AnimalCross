#!/usr/bin/env python3
"""Flattens the visible layers of frame 0 of an .aseprite file (RGBA, raw or zlib cels) into a PNG.
usage: python3 tools/ase_to_png.py in.aseprite out.png"""
import struct, sys, zlib
from PIL import Image

def flatten(path):
    d = open(path, 'rb').read(); magic, nframes, W, H, depth = struct.unpack_from('<HHHHH', d, 4)
    if magic != 0xA5E0 or depth != 32: raise SystemExit('not an RGBA aseprite file')
    off = 128; fbytes, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, off); p = off + 16
    layers, cels = [], []
    for _ in range(new or old):
        csz, ct = struct.unpack_from('<IH', d, p); body = p + 6
        if ct == 0x2004: layers.append(struct.unpack_from('<H', d, body)[0] & 1)          # visible flag
        elif ct == 0x2005:
            li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, body)
            if ctype == 2:
                w, h = struct.unpack_from('<HH', d, body + 16); cels.append((li, x, y, op, Image.frombytes('RGBA', (w, h), zlib.decompress(d[body + 20:p + csz]))))
            elif ctype == 0:
                w, h = struct.unpack_from('<HH', d, body + 16); cels.append((li, x, y, op, Image.frombytes('RGBA', (w, h), d[body + 20:body + 20 + w * h * 4])))
        p += csz
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for li, x, y, op, im in sorted(cels, key=lambda c: c[0]):
        if layers[li]: out.alpha_composite(im, (x, y))
    return out
if __name__ == '__main__': flatten(sys.argv[1]).save(sys.argv[2])
