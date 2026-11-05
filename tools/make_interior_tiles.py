"""Generates the modern-ish house interior art:
  assets/tiles/interior.png      16px tile atlas  (row 0 floors, row 1 wall faces, row 2 wall tops by neighbour mask)
  assets/props/furniture.png/json furniture sprites (bottom-centre anchored) + collision boxes
Layout of interior.png (16x16 cells):
  row 0:  oak A, oak B, dark wood A, dark wood B, ceramic A, ceramic B, carpet A, carpet B
  row 1:  wall face: mid, left end, right end, single, window, doorway (open), door (closed)
  row 2:  wall top, 16 cells indexed by mask  N*1 + E*2 + S*4 + W*8  (bit set = the neighbour is wall)
Run: python3 tools/make_interior_tiles.py"""
from PIL import Image
import json, random

OUT = (47, 41, 41, 255)
def C(r, g, b, a=255): return (r, g, b, a)
CAP, CAP_HI, CAP_LO = C(88, 94, 108), C(122, 130, 146), C(64, 68, 80)
P1, P2, PSH = C(228, 220, 206), C(217, 208, 193), C(190, 180, 166)
BBH, BB, BBL = C(252, 249, 242), C(240, 235, 225), C(206, 198, 186)
WOOD = {'oak': (C(204, 164, 116), C(192, 152, 106), C(224, 186, 138), C(160, 122, 84)),
        'dark': (C(126, 90, 68), C(112, 78, 58), C(146, 108, 84), C(86, 60, 46)),
        'tile': (C(232, 232, 235), C(214, 216, 222), C(246, 246, 248), C(180, 184, 196)),
        'carpet': (C(104, 148, 160), C(92, 134, 148), C(126, 170, 180), C(70, 108, 122))}

class Img:
    def __init__(self, w, h): self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); self.p = self.im.load(); self.w, self.h = w, h
    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h: self.p[x, y] = c
    def rc(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w): self.px(xx, yy, c)
    def outline(self, col=OUT):
        src = self.im.copy(); sp = src.load()
        for y in range(self.h):
            for x in range(self.w):
                if sp[x, y][3] == 0 and any(0 <= x + dx < self.w and 0 <= y + dy < self.h and sp[x + dx, y + dy][3] > 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): self.p[x, y] = col
        return self

# ---------------------------------------------------------------------------------------------- tiles
def floor_tile(kind, v):
    a, b, hi, lo = WOOD[kind]; t = Img(16, 16); rnd = random.Random(hash((kind, v)) & 0xffff)
    if kind in ('oak', 'dark'):
        t.rc(0, 0, 16, 16, a)
        for row in range(2):
            y0 = row * 8; joint = ((5 if v == 0 else 11) + row * 7) % 16
            t.rc(0, y0, 16, 1, hi); t.rc(0, y0 + 7, 16, 1, lo)
            t.rc(joint, y0, 1, 8, lo)
            for _ in range(5): t.px(rnd.randrange(16), y0 + 1 + rnd.randrange(6), b)
    elif kind == 'tile':
        t.rc(0, 0, 16, 16, a)
        for ty in range(2):
            for tx in range(2):
                chk = (tx + ty + v) % 2; x0, y0 = tx * 8, ty * 8
                t.rc(x0, y0, 8, 8, b if chk else a); t.rc(x0, y0, 8, 1, hi); t.rc(x0, y0, 1, 8, hi); t.rc(x0 + 7, y0, 1, 8, lo); t.rc(x0, y0 + 7, 8, 1, lo)
    else:  # carpet
        t.rc(0, 0, 16, 16, a)
        for _ in range(26): t.px(rnd.randrange(16), rnd.randrange(16), b if rnd.random() < 0.6 else hi)
        if v == 1:
            for k in range(0, 16, 4): t.px(k + 1, 3, lo); t.px(k + 3, 9, lo); t.px(k + 1, 13, lo)
    return t

def face(kind):  # kind: mid left right single window door_open door_closed
    t = Img(16, 16)
    t.rc(0, 0, 16, 16, P1)
    for x in range(0, 16, 4): t.rc(x, 3, 1, 8, P2)                       # faint vertical panelling
    t.rc(0, 0, 16, 1, OUT); t.rc(0, 1, 16, 2, PSH)                        # where the wall top meets the face
    t.rc(0, 11, 16, 1, BBH); t.rc(0, 12, 16, 2, BB); t.rc(0, 14, 16, 1, BBL); t.rc(0, 15, 16, 1, OUT)   # skirting board and the line it sits on
    if kind in ('left', 'single'): t.rc(0, 0, 1, 16, OUT)
    if kind in ('right', 'single'): t.rc(15, 0, 1, 16, OUT)
    if kind == 'window':
        t.rc(3, 3, 10, 9, BBH); t.rc(4, 4, 8, 7, C(148, 188, 214)); t.rc(7, 4, 2, 7, BBH); t.rc(4, 7, 8, 1, BBH)
        t.rc(5, 5, 2, 1, C(214, 236, 248)); t.rc(9, 8, 2, 1, C(214, 236, 248)); t.rc(2, 12, 12, 1, BBH); t.rc(3, 11, 10, 1, BBL)
    if kind in ('door_open', 'door_closed'):
        t.rc(1, 3, 14, 12, BBH); t.rc(2, 4, 12, 11, C(40, 34, 40) if kind == 'door_open' else C(150, 98, 72))
        if kind == 'door_open':
            for y in range(4, 15): t.rc(2, y, 12, 1, C(40 + (y - 4) * 2, 34 + (y - 4) * 2, 40 + (y - 4) * 2))
        else:
            t.rc(4, 6, 3, 4, C(128, 80, 58)); t.rc(9, 6, 3, 4, C(128, 80, 58)); t.rc(4, 11, 3, 3, C(128, 80, 58)); t.rc(9, 11, 3, 3, C(128, 80, 58)); t.px(11, 10, C(238, 206, 120)); t.px(11, 11, C(238, 206, 120))
        t.rc(1, 15, 14, 1, OUT)
    return t

def cap(mask):
    t = Img(16, 16); N, E, S, W = [bool(mask >> i & 1) for i in range(4)]
    t.rc(0, 0, 16, 16, CAP)
    if not N: t.rc(0, 1, 16, 1, CAP_HI)
    if not W: t.rc(1, 0, 1, 16, CAP_HI)
    if not E: t.rc(14, 0, 1, 16, CAP_LO)
    if not S: t.rc(0, 14, 16, 1, CAP_LO)
    if not N: t.rc(0, 0, 16, 1, OUT)
    if not S: t.rc(0, 15, 16, 1, OUT)
    if not W: t.rc(0, 0, 1, 16, OUT)
    if not E: t.rc(15, 0, 1, 16, OUT)
    return t

def atlas():
    a = Img(16 * 16, 16 * 3)
    for i, (k, v) in enumerate([(k, v) for k in ('oak', 'dark', 'tile', 'carpet') for v in (0, 1)]): a.im.paste(floor_tile(k, v).im, (i * 16, 0))
    for i, k in enumerate(['mid', 'left', 'right', 'single', 'window', 'door_open', 'door_closed']): a.im.paste(face(k).im, (i * 16, 16))
    for m in range(16): a.im.paste(cap(m).im, (m * 16, 32))
    return a.im

# ---------------------------------------------------------------------------------------------- furniture
SPRITES = {}   # name -> (Img, anchor x, collision box [x, y, w, h] relative to the bottom-centre anchor, or None)
def add(name, img, box):
    img.outline(); SPRITES[name] = (img, img.w // 2, box)

def bed():
    s = Img(30, 40)
    s.rc(0, 0, 30, 40, C(150, 104, 76)); s.rc(0, 0, 30, 6, C(112, 78, 58)); s.rc(0, 0, 30, 1, C(146, 108, 84))
    s.rc(2, 6, 26, 32, C(240, 238, 232)); s.rc(4, 8, 10, 6, C(252, 250, 246)); s.rc(16, 8, 10, 6, C(252, 250, 246)); s.rc(4, 13, 10, 1, C(214, 210, 202)); s.rc(16, 13, 10, 1, C(214, 210, 202))
    s.rc(2, 16, 26, 22, C(96, 150, 164)); s.rc(2, 16, 26, 2, C(132, 184, 196)); s.rc(2, 24, 26, 1, C(78, 126, 140)); s.rc(2, 36, 26, 2, C(78, 126, 140))
    s.rc(0, 36, 2, 4, C(112, 78, 58)); s.rc(28, 36, 2, 4, C(112, 78, 58)); return s
def sofa():
    s = Img(40, 22)
    s.rc(0, 0, 40, 10, C(104, 120, 148)); s.rc(0, 0, 40, 2, C(132, 148, 176)); s.rc(0, 8, 40, 2, C(84, 98, 124))
    s.rc(0, 6, 6, 14, C(92, 106, 134)); s.rc(34, 6, 6, 14, C(92, 106, 134)); s.rc(0, 6, 6, 2, C(124, 140, 168)); s.rc(34, 6, 6, 2, C(124, 140, 168))
    for x in (6, 17, 28): s.rc(x, 10, 11, 8, C(128, 144, 172)); s.rc(x, 10, 11, 1, C(152, 168, 196)); s.rc(x, 17, 11, 1, C(98, 112, 140))
    s.rc(0, 20, 40, 2, C(70, 80, 100)); s.rc(2, 20, 3, 2, C(60, 44, 36)); s.rc(35, 20, 3, 2, C(60, 44, 36)); return s
def armchair():
    s = Img(20, 22)
    s.rc(0, 0, 20, 9, C(176, 124, 96)); s.rc(0, 0, 20, 2, C(204, 152, 120)); s.rc(0, 5, 5, 15, C(156, 108, 84)); s.rc(15, 5, 5, 15, C(156, 108, 84))
    s.rc(5, 9, 10, 8, C(190, 138, 108)); s.rc(5, 9, 10, 1, C(214, 162, 130)); s.rc(0, 19, 20, 3, C(120, 80, 62)); return s
def table():
    s = Img(34, 22)
    s.rc(0, 0, 34, 12, C(200, 160, 112)); s.rc(0, 0, 34, 2, C(224, 188, 140)); s.rc(0, 10, 34, 2, C(158, 120, 84))
    for x in (1, 29): s.rc(x, 12, 4, 10, C(150, 112, 80)); s.rc(x, 12, 1, 10, C(176, 138, 100))
    return s
def chair():
    s = Img(12, 20)
    s.rc(1, 0, 10, 9, C(184, 142, 100)); s.rc(1, 0, 10, 2, C(208, 168, 126)); s.rc(3, 3, 6, 4, C(160, 120, 84))
    s.rc(0, 9, 12, 4, C(196, 154, 112)); s.rc(0, 12, 12, 1, C(150, 112, 80))
    for x in (1, 9): s.rc(x, 13, 2, 7, C(150, 112, 80))
    return s
def shelf():
    s = Img(28, 38)
    s.rc(0, 0, 28, 38, C(150, 108, 78)); s.rc(0, 0, 28, 2, C(176, 134, 100)); s.rc(2, 3, 24, 33, C(104, 74, 54))
    cols = [C(196, 76, 64), C(84, 134, 190), C(232, 190, 80), C(98, 160, 110), C(176, 120, 180), C(236, 232, 220)]
    for r in range(4):
        y = 4 + r * 8
        x = 3; k = r
        while x < 24:
            w = 2 + (k * 7 + r * 3) % 3; h = 5 + (k * 5) % 3; s.rc(x, y + 7 - h, w, h, cols[(k + r) % 6]); x += w + (1 if k % 3 else 0); k += 1
        s.rc(2, y + 7, 24, 1, C(150, 108, 78))
    return s
def counter():
    s = Img(34, 26)
    s.rc(0, 0, 34, 8, C(238, 238, 240)); s.rc(0, 0, 34, 2, C(255, 255, 255)); s.rc(0, 7, 34, 1, C(190, 192, 200)); s.rc(20, 2, 9, 4, C(176, 196, 210)); s.rc(24, 0, 1, 2, C(150, 156, 164))
    s.rc(0, 8, 34, 16, C(242, 238, 230)); s.rc(16, 8, 1, 16, C(206, 200, 190))
    for x in (4, 20): s.rc(x, 10, 10, 12, C(232, 226, 216)); s.rc(x, 10, 10, 1, C(252, 250, 244))
    s.rc(13, 14, 1, 4, C(150, 156, 164)); s.rc(18, 14, 1, 4, C(150, 156, 164)); s.rc(0, 24, 34, 2, C(120, 112, 104)); return s
def fridge():
    s = Img(18, 36)
    s.rc(0, 0, 18, 36, C(226, 230, 234)); s.rc(0, 0, 18, 2, C(250, 252, 255)); s.rc(0, 13, 18, 1, C(160, 166, 176)); s.rc(14, 4, 2, 6, C(150, 156, 166)); s.rc(14, 17, 2, 9, C(150, 156, 166))
    s.rc(0, 34, 18, 2, C(150, 154, 162)); s.rc(16, 2, 2, 32, C(196, 200, 208)); return s
def plant():
    s = Img(16, 26)
    for (x, y, r) in [(8, 6, 5), (4, 10, 4), (12, 10, 4), (8, 12, 4)]:
        for yy in range(-r, r + 1):
            for xx in range(-r, r + 1):
                if xx * xx + yy * yy <= r * r: s.px(x + xx, y + yy, C(84, 140, 92) if (xx + yy) % 3 else C(110, 172, 112))
    s.rc(7, 12, 2, 6, C(70, 110, 76)); s.rc(3, 17, 10, 8, C(190, 110, 84)); s.rc(3, 17, 10, 2, C(214, 136, 104)); s.rc(4, 24, 8, 1, C(140, 78, 60)); return s
def lamp():
    s = Img(12, 34)
    s.rc(2, 0, 8, 2, C(250, 232, 178)); s.rc(1, 2, 10, 8, C(246, 224, 168)); s.rc(0, 8, 12, 2, C(222, 196, 138)); s.rc(5, 10, 2, 20, C(110, 100, 96)); s.rc(2, 30, 8, 3, C(90, 82, 80)); return s
def tv():
    s = Img(30, 26)
    s.rc(0, 0, 30, 16, C(34, 38, 46)); s.rc(2, 2, 26, 12, C(46, 52, 66)); s.rc(4, 3, 8, 1, C(96, 120, 160)); s.rc(5, 4, 4, 1, C(96, 120, 160))
    s.rc(12, 16, 6, 2, C(60, 62, 70)); s.rc(0, 18, 30, 8, C(122, 90, 70)); s.rc(0, 18, 30, 1, C(150, 116, 92)); s.rc(14, 21, 2, 2, C(210, 190, 150)); return s
def painting():
    s = Img(14, 12)
    s.rc(0, 0, 14, 12, C(150, 108, 78)); s.rc(1, 1, 12, 10, C(196, 220, 232)); s.rc(1, 6, 12, 5, C(120, 168, 120)); s.rc(8, 2, 3, 3, C(250, 230, 150)); s.rc(3, 7, 4, 2, C(86, 130, 90)); return s
def door():
    s = Img(20, 30)
    s.rc(0, 0, 20, 30, BBH); s.rc(2, 2, 16, 28, C(150, 98, 72)); s.rc(4, 4, 5, 10, C(128, 80, 58)); s.rc(11, 4, 5, 10, C(128, 80, 58)); s.rc(4, 16, 5, 10, C(128, 80, 58)); s.rc(11, 16, 5, 10, C(128, 80, 58))
    s.rc(15, 15, 2, 2, C(238, 206, 120)); s.rc(0, 28, 20, 2, C(190, 182, 170)); return s

BUILD = [('bed', bed, [-15, -22, 30, 22]), ('sofa', sofa, [-20, -12, 40, 12]), ('armchair', armchair, [-10, -12, 20, 12]), ('table', table, [-17, -14, 34, 14]),
         ('chair', chair, [-6, -8, 12, 8]), ('shelf', shelf, [-14, -12, 28, 12]), ('counter', counter, [-17, -14, 34, 14]), ('fridge', fridge, [-9, -10, 18, 10]),
         ('plant', plant, [-5, -5, 10, 5]), ('lamp', lamp, [-4, -4, 8, 4]), ('tv', tv, [-15, -10, 30, 10]), ('painting', painting, None), ('door', door, None)]

def main():
    atlas().save('assets/tiles/interior.png')
    for name, fn, box in BUILD: add(name, fn(), box)
    gap = 2; W = sum(i.w + gap for i, _, _ in SPRITES.values()) + gap; H = max(i.h for i, _, _ in SPRITES.values()) + gap * 2
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0)); meta = {}; x = gap
    for name, (img, ax, box) in SPRITES.items():
        sheet.alpha_composite(img.im, (x, gap)); meta[name] = {'x': x, 'y': gap, 'w': img.w, 'h': img.h, 'ax': ax, 'box': box}; x += img.w + gap
    sheet.save('assets/props/furniture.png'); json.dump(meta, open('assets/props/furniture.json', 'w'))
    print('interior.png', Image.open('assets/tiles/interior.png').size, 'furniture', sheet.size, len(meta))
if __name__ == '__main__': main()
