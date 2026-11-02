"""Slice the painted action sheets (tools/src/sheet_*.webp: 3 animations x 4 directions x 8 frames each)
into clean, aligned 48x48 frames. Every frame is placed so the feet centre sits at (24, 46) and is sampled on one
fixed native-pixel grid per sheet, so frames of one animation never jitter against each other.
Output: assets/chars/act_<sheet>.png (8 frames x 12 rows) and assets/chars/act_<sheet>.json
Run:  python3 tools/make_action_sheets.py"""
from PIL import Image
import numpy as np, json, os
from scipy import ndimage

FW, FH, AX, AY = 48, 48, 24, 46          # frame size and the feet anchor inside it
SHEETS = {  # name: (file, source pixels per native pixel)
    'gather': ('tools/src/sheet_gather.webp', 4.1),
    'net':    ('tools/src/sheet_net.webp', 2.6),
    'fish':   ('tools/src/sheet_fish.webp', 3.5),
    'emote':  ('tools/src/sheet_emote.webp', 4.1),
}
DIRS = ['d', 'l', 'r', 'u']

def runs(m):
    r = []; s = None
    for i, v in enumerate(m):
        if v and s is None: s = i
        if not v and s is not None: r.append((s, i - 1)); s = None
    if s is not None: r.append((s, len(m) - 1))
    return r

def skin_mask(rgb):  # body/skin/shorts tones (tan to brown), not blue nets, teal fish, red apples
    r, g, b = [rgb[..., i].astype(int) for i in range(3)]
    return (r >= g) & (g >= b - 4) & (r - b > 40) & (r - g < 90) & (r > 90)

def extract(path):
    im = Image.open(path).convert('RGBA'); a = np.array(im); H, W = a.shape[:2]
    alpha = a[..., 3] > 40
    rows = runs(alpha.any(1)); assert len(rows) == 12, (path, len(rows))
    # connected pieces (dilated so a held item / butterfly stays with its owner), each assigned to a cell by its centroid
    lab, n = ndimage.label(ndimage.binary_dilation(alpha, iterations=2))
    cellw = W / 8.0; frames = {}
    for i in range(1, n + 1):
        ys, xs = np.where((lab == i) & alpha)
        if len(xs) < 12: continue
        r = next((k for k, (y0, y1) in enumerate(rows) if y0 - 4 <= ys.mean() <= y1 + 4), None)
        if r is None: continue
        c = min(7, int(xs.mean() // cellw)); frames.setdefault((r, c), []).append((i, ys, xs))
    out = {}
    for (r, c), parts in frames.items():
        m = np.zeros((H, W), bool)
        for i, ys, xs in parts: m[ys, xs] = True
        ys, xs = np.where(m); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        out[(r, c)] = (a[y0:y1].copy()[:, x0:x1] * m[y0:y1, x0:x1, None], (x0, y0, x1, y1))
    return out

def anchors(crop, S):
    """feet centre of one frame in crop pixels: x = centre of the skin-coloured pixels in the lowest legs, y = lowest skin row"""
    rgb, al = crop[..., :3], crop[..., 3] > 40
    sk = skin_mask(rgb) & al
    if sk.sum() < 20: sk = al
    ys, xs = np.where(sk); fy = ys.max() + 1
    low = ys > fy - 3.2 * S
    return xs[low].mean(), fy

def render(crop, ax_src, ay_src, S):
    """sample one frame on the fixed native grid (box average of alpha-weighted colour, then threshold)"""
    h, w = crop.shape[:2]; res = Image.new('RGBA', (FW, FH), (0, 0, 0, 0)); px = res.load()
    al = crop[..., 3] / 255.0; rgb = crop[..., :3].astype(float); sk = skin_mask(crop[..., :3]).astype(float) * al
    for Y in range(FH):
        sy0 = ay_src + (Y - (AY + 1)) * S; sy1 = sy0 + S
        for X in range(FW):
            sx0 = ax_src + (X - AX - 0.5) * S; sx1 = sx0 + S
            ya, yb, xa, xb = int(np.floor(sy0)), int(np.ceil(sy1)), int(np.floor(sx0)), int(np.ceil(sx1))
            ya, xa = max(ya, 0), max(xa, 0); yb, xb = min(yb, h), min(xb, w)
            if yb <= ya or xb <= xa: continue
            cell = al[ya:yb, xa:xb]; wsum = cell.sum()
            area = (yb - ya) * (xb - xa); skf = sk[ya:yb, xa:xb].sum() / max(wsum, 1e-6)
            if wsum < (0.45 if skf > 0.5 else 0.2) * S * S: continue  # thin tool lines (net handles) survive a lower bar than the body
            col = (rgb[ya:yb, xa:xb] * cell[..., None]).sum((0, 1)) / wsum
            px[X, Y] = (int(col[0]), int(col[1]), int(col[2]), 255)
    return res

def main():
    manifest = {'frame': [FW, FH], 'anchor': [AX, AY], 'sheets': {}}
    for name, (path, S) in SHEETS.items():
        fr = extract(path)
        # per row (direction x animation): steady feet anchors so the body does not wobble between frames
        sheet = Image.new('RGBA', (FW * 8, FH * 12), (0, 0, 0, 0)); info = []
        for r in range(12):
            an = {c: anchors(fr[(r, c)][0], S) for c in range(8) if (r, c) in fr}
            mx = float(np.median([v[0] for v in an.values()])); my = float(np.median([v[1] for v in an.values()]))
            for c, (fx, fy) in an.items():
                ax_ = mx + float(np.clip(fx - mx, -1.2 * S, 1.2 * S)); ay_ = my + float(np.clip(fy - my, -1.0 * S, 1.0 * S))
                sheet.alpha_composite(render(fr[(r, c)][0], ax_, ay_, S), (c * FW, r * FH))
            info.append({'dir': DIRS[r % 4], 'anim': r // 4})
        sheet.save(f'assets/chars/act_{name}.png')
        manifest['sheets'][name] = {'file': f'assets/chars/act_{name}.png', 'cols': 8, 'rows': info}
        print(name, 'ok')
    json.dump(manifest, open('assets/chars/act_sheets.json', 'w'), indent=1)

if __name__ == '__main__': main()
