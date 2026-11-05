"""Builds a walk cycle for the hero from the 4-view reference (tools/src/hero_ref.png: left, front, right, back).
The art is whatever hero_ref.png currently holds, so recolours can be dropped in. tools/src/hero_ref_v1.png is the original
version; it only tells the script which pixels are skin / jeans / boots / sleeves (by position) so the far leg and the arm gap
can be shaded from the colours the art actually uses.
Every pixel comes from the reference: parts (head, body, arms, legs) are moved, sheared or stretched, never redrawn,
and the palette is untouched (the far leg only uses darker colours that already exist in the reference).
Output: assets/chars/hero_walk.png  = 5 columns (idle + 4 walk frames) x 4 rows (down, left, right, up), cell 32x48,
feet centre at (16, 47).   Run: python3 tools/make_hero_walk.py"""
from PIL import Image
import numpy as np
from collections import deque

CW, CH, CX, OY = 32, 48, 16, 16          # cell size, feet centre x, sprite y -> cell y offset
src = Image.open('tools/src/hero_ref.png').convert('RGBA'); A = np.array(src)
ROLE = np.array(Image.open('tools/src/hero_ref_v1.png').convert('RGBA'))   # original colours = what each pixel is

def components():
    a = A[..., 3] > 0; lab = np.zeros(a.shape, int); n = 0
    for y in range(64):
        for x in range(64):
            if a[y, x] and not lab[y, x]:
                n += 1; q = deque([(y, x)]); lab[y, x] = n
                while q:
                    cy, cx = q.popleft()
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < 64 and 0 <= nx < 64 and a[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; q.append((ny, nx))
    return lab
LAB = components()
def fig(i): return {(int(x), int(y)): tuple(int(v) for v in A[y, x]) for y, x in zip(*np.where(LAB == i))}

# colours of the current art, found by position from the original reference (so recolours keep working)
def vote(old, y0=0, y1=63):
    from collections import Counter
    c = Counter(tuple(int(v) for v in A[y, x][:3]) for y in range(y0, y1 + 1) for x in range(64) if tuple(int(v) for v in ROLE[y, x][:3]) == old and ROLE[y, x][3] and A[y, x][3])
    return c.most_common(1)[0][0] if c else old
PANT, PANT_DK = vote((108, 135, 141), 44, 63), vote((95, 110, 113), 44, 63)        # jeans and their shaded side
BOOT_LIGHT = vote((166, 131, 119), 59, 63); BOOT_MID = vote((142, 111, 101), 59, 63); BOOT_DARK = vote((127, 99, 87), 59, 63)
BOOT_MAP = {BOOT_LIGHT: BOOT_MID, vote((163, 132, 118), 59, 63): BOOT_MID, BOOT_MID: BOOT_DARK}   # the far leg's boot is one shade darker
SKIN = {vote(c) for c in [(208, 169, 137), (236, 191, 154), (192, 151, 118)]}
SLEEVE = vote((235, 223, 204), 33, 43) + (255,)                                                   # sleeve colour behind a swinging forearm

def shift(px, dx=0, dy=0): return {(x + dx, y + dy): c for (x, y), c in px.items()}
def where(px, f): return {k: v for k, v in px.items() if f(*k)}
def merge(*ls):
    out = {}
    for l in ls: out.update(l)
    return out
def drop_rows(px, rows):  # remove rows, pulling everything below them up (a bent / lifted leg gets shorter)
    rows = sorted(rows); out = {}
    for (x, y), c in px.items():
        if y in rows: continue
        out[(x, y - sum(1 for r in rows if r < y))] = c
    return out
def dup_row(px, row, n=1):  # repeat a row n times, pushing everything below down
    out = {}
    for (x, y), c in px.items():
        if y > row: out[(x, y + n)] = c
        else: out[(x, y)] = c
        if y == row:
            for k in range(1, n + 1): out[(x, y + k)] = c
    return out
def shear(px, y0, y1, s, rigid_from=None):  # lean a column: dx grows from 0 at y0 to s at y1; rows from rigid_from down move as one block
    out = {}
    for (x, y), c in px.items():
        t = (min(y, rigid_from if rigid_from is not None else y1) - y0) / max(1, (y1 - y0)); out[(x + int(round(s * max(0, min(1, t)))), y)] = c
    return out
def far_leg(px): return {k: ((PANT_DK + (255,)) if c[:3] == PANT else (BOOT_MAP.get(c[:3], c[:3]) + (255,))) for k, c in px.items()}

def render(layers, cx, dy_all=0):
    cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); pix = cell.load()
    for layer in layers:
        for (x, y), c in layer.items():
            X, Y = x - cx + CX, y - OY + dy_all
            if 0 <= X < CW and 0 <= Y < CH: pix[X, Y] = c
    return cell

# ----------------------------------------------------------------------------------------------- front / back
def front_back(px, cx, back=False):
    arm = lambda x, y: 32 <= y <= 50 and ((y <= 41 and (x <= cx - 3 or x >= cx + 3)) or (y >= 42 and (x <= cx - 4 or x >= cx + 4)))
    head = where(px, lambda x, y: y <= 31); arms = where(px, lambda x, y: y > 31 and arm(x, y))
    body = where(px, lambda x, y: 32 <= y <= 48 and not arm(x, y)); legs = where(px, lambda x, y: y >= 49 and not arm(x, y))
    L = where(legs, lambda x, y: x < cx); R = where(legs, lambda x, y: x > cx); mid = where(legs, lambda x, y: x == cx)
    armL = where(arms, lambda x, y: x < cx); armR = where(arms, lambda x, y: x > cx)
    def hand(a, d):  # hand down / up one pixel
        if d > 0: return dup_row(a, 42)
        if d < 0: return drop_rows(a, [43])
        return a
    def build(body_dy, liftL, liftR, handL, handR):
        up = body_dy < 0
        b = shift(body, 0, body_dy); h = shift(head, 0, body_dy); aL = shift(hand(armL, handL), 0, body_dy); aR = shift(hand(armR, handR), 0, body_dy)
        if up: b = merge(b, where(body, lambda x, y: y == 48))     # keep the hips joined to the legs when the body rises
        lL = drop_rows(L, [55, 56]) if liftL else L; lR = drop_rows(R, [55, 56]) if liftR else R
        return [mid, lL, lR, aL, aR, b, h]
    return [build(0, 0, 0, 0, 0),
            build(+1, 0, 0, 0, 0),               # contact: body dips
            build(-1, 1, 0, +1, -1),             # left foot up, hands swing
            build(+1, 0, 0, 0, 0),
            build(-1, 0, 1, -1, +1)]

# ----------------------------------------------------------------------------------------------- side views
def side(px, cx, f):  # f = -1 faces left, +1 faces right
    head = where(px, lambda x, y: y <= 31)
    arm_skin = where(px, lambda x, y: y >= 40 and px[(x, y)][:3] in SKIN)
    torso = where(px, lambda x, y: 32 <= y <= 43 and (x, y) not in arm_skin)
    leg_src = where(px, lambda x, y: y >= 44 and (x, y) not in arm_skin)
    cols = sorted({x for (x, y) in leg_src if y <= 58}); lx0, lx1 = cols[0], cols[-1]
    for y in range(44, 51):                                   # under the arm there is pants
        for x in range(lx0, lx1 + 1):
            if (x, y) not in leg_src: leg_src[(x, y)] = PANT + (255,)
    fill = {}
    for (x, y) in arm_skin:
        if y <= 43: fill[(x, y)] = SLEEVE
    torso = merge(fill, torso)
    near = leg_src; far = far_leg(leg_src)
    ANK = 58
    def leg(l, s, lift=0):  # lean the leg by s pixels at the ankle; the boot moves as one block; lift shortens the leg
        l2 = shear(l, 43, ANK, s * f, rigid_from=ANK)
        if lift: l2 = drop_rows(l2, [52 + i for i in range(lift)])
        return l2
    def arm(s):
        a = shear(arm_skin, 39, 50, s * f); return a
    def build(dy, near_s, far_s, near_lift, far_lift, arm_s, far_on_top=False):
        t = shift(torso, 0, dy); h = shift(head, 0, dy); a = shift(arm(arm_s), 0, dy)
        if dy < 0: t = merge(t, where(torso, lambda x, y: y == 43))
        n = leg(near, near_s, near_lift); fr = leg(far, far_s, far_lift)
        return [fr, n, t, a, h] if not far_on_top else [n, fr, t, a, h]
    return [build(0, 0, 0, 0, 0, 0),
            build(+1, +4, -4, 0, 0, -3),                   # contact: near leg forward, near arm back
            build(-1, 0, +2, 0, 3, 0),                     # passing: far leg swings through, lifted
            build(+1, -4, +4, 0, 0, +3, far_on_top=True),  # contact: far leg forward
            build(-1, +2, 0, 3, 0, 0)]                     # passing: near leg swings through

def main():
    rows = [('down', front_back(fig(2), 25)), ('left', side(fig(1), 13, -1)), ('right', side(fig(3), 37, +1)), ('up', front_back(fig(4), 50, True))]
    cxs = {'down': 25, 'left': 13, 'right': 37, 'up': 50}
    sheet = Image.new('RGBA', (CW * 5, CH * 4), (0, 0, 0, 0))
    for r, (name, frames) in enumerate(rows):
        for c, layers in enumerate(frames): sheet.alpha_composite(render(layers, cxs[name]), (c * CW, r * CH))
    sheet.save('assets/chars/hero_walk.png'); print('saved', sheet.size)
if __name__ == '__main__': main()
