"""Every frame of an Aseprite file: read_frames(path) -> W, H, layers, frames  (frames: list of {layer index: full-canvas RGBA picture}, durations).
Linked cels (type 1) point at an earlier frame's cel of the same layer."""
import struct, zlib
from PIL import Image
def read_frames(path):
    d = open(path, 'rb').read(); W, H = struct.unpack_from('<HH', d, 8); nf = struct.unpack_from('<H', d, 6)[0]; off = 128; L = []; F = []; durs = []
    for f in range(nf):
        fb, fm, old, dur, _, new = struct.unpack_from('<IHHHHI', d, off); n = new or old; p = off + 16; cels = {}; durs.append(dur)
        for _ in range(n):
            csz, ct = struct.unpack_from('<IH', d, p); b = p + 6
            if ct == 0x2004:
                fl, t, lv = struct.unpack_from('<HHH', d, b); nl = struct.unpack_from('<H', d, b + 16)[0]
                L.append({'flags': fl, 'type': t, 'lv': lv, 'vis': bool(fl & 1), 'name': d[b + 18:b + 18 + nl].decode('utf8', 'replace').strip()})
            elif ct == 0x2005:
                li, x, y, op, ctype, z = struct.unpack_from('<HhhBHh', d, b)
                if ctype == 1: cels[li] = F[struct.unpack_from('<H', d, b + 16)[0]].get(li)
                elif ctype in (0, 2):
                    w, h = struct.unpack_from('<HH', d, b + 16)
                    raw = d[b + 20:b + 20 + w * h * 4] if ctype == 0 else zlib.decompressobj().decompress(d[b + 20:p + csz])
                    full = Image.new('RGBA', (W, H)); full.alpha_composite(Image.frombytes('RGBA', (w, h), raw).crop((max(0, -x), max(0, -y), w, h)), (max(0, x), max(0, y))); cels[li] = full
            p += csz
        F.append(cels); off += fb
    return W, H, L, F, durs
