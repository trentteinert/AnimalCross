"""House interior art. The wall, door, painting, trims and the teal floor are cut straight out of the hand-drawn sheet
(tools/src/interior_sheet_user.png); the extra floors, the window and the furniture are drawn here in the same flat style.
  assets/tiles/interior.png   192x64 atlas:
     (  0..79, 0..15)  floors, 16x16 each: teal (yours), oak, dark wood, ceramic, carpet
     (  0, 16) 48x48   plain wall front (3 cells wide, 3 cells tall; repeats every 3 cells)
     ( 48, 16) 16x48   window, drawn over a wall front
     ( 64, 16)  7x48   vertical wall trim (yours)         ( 80, 16) 48x7  horizontal wall trim (yours)
  assets/props/furniture.png/json  furniture sprites, bottom-centre anchored, with collision boxes
Run: python3 tools/make_interior_tiles.py"""
from PIL import Image
import json, random

OUT = (86, 66, 64, 255)
def C(r, g, b, a=255): return (r, g, b, a)
USER = Image.open('tools/src/interior_sheet_user.png').convert('RGBA')

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

def floor(kind):
    t = Img(16, 16); r = random.Random(kind)
    if kind == 'teal': t.im.paste(USER.crop((64 + 16, 64 + 16, 64 + 32, 64 + 32)), (0, 0))
    elif kind == 'oak':
        t.rc(0, 0, 16, 16, C(214, 178, 132))
        for row in range(2): y = row * 8; t.rc(0, y + 7, 16, 1, C(190, 152, 108)); t.rc(5 + row * 6, y, 1, 7, C(190, 152, 108)); t.rc(0, y, 16, 1, C(226, 192, 148))
    elif kind == 'dark':
        t.rc(0, 0, 16, 16, C(126, 92, 72))
        for row in range(2): y = row * 8; t.rc(0, y + 7, 16, 1, C(104, 74, 58)); t.rc(10 - row * 6, y, 1, 7, C(104, 74, 58)); t.rc(0, y, 16, 1, C(142, 106, 84))
    elif kind == 'ceramic':
        t.rc(0, 0, 16, 16, C(232, 233, 236))
        for k in (7, 15): t.rc(0, k, 16, 1, C(205, 208, 214)); t.rc(k, 0, 1, 16, C(205, 208, 214))
    else:  # carpet
        t.rc(0, 0, 16, 16, C(172, 112, 114))
        for _ in range(14): t.px(r.randrange(16), r.randrange(16), C(156, 98, 102))
    return t

def window():  # 16x48, drawn over the wall front
    t = Img(16, 48); F, G, H, S = C(235, 237, 233), C(164, 221, 219), C(214, 240, 238), C(213, 213, 213)
    t.rc(2, 12, 12, 21, F); t.rc(3, 13, 10, 19, G); t.rc(7, 13, 2, 19, F); t.rc(3, 21, 10, 2, F)
    t.rc(4, 14, 2, 2, H); t.rc(10, 24, 2, 2, H); t.rc(1, 33, 14, 2, C(231, 231, 231)); t.rc(1, 35, 14, 1, S); return t

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

def stairs_up():
    s = Img(34, 40); TR, RI, SH = C(224, 190, 142), C(184, 146, 102), C(150, 116, 84)
    s.rc(2, 0, 30, 40, RI); s.rc(2, 0, 30, 3, SH)
    for i in range(5): y = 3 + i * 7; s.rc(2, y, 30, 3, TR); s.rc(2, y, 30, 1, C(240, 212, 170)); s.rc(2, y + 3, 30, 4, RI); s.rc(2, y + 6, 30, 1, C(160, 124, 88))
    s.rc(0, 0, 3, 40, C(239, 226, 200)); s.rc(31, 0, 3, 40, C(239, 226, 200)); s.rc(0, 0, 1, 40, C(213, 200, 175)); s.rc(33, 0, 1, 40, C(213, 200, 175))
    s.rc(0, 34, 4, 6, C(150, 116, 84)); s.rc(30, 34, 4, 6, C(150, 116, 84)); return s
def stairs_down():
    s = Img(34, 34); TR, RI = [C(224, 190, 142), C(206, 172, 126), C(180, 148, 108), C(150, 122, 92)], [C(184, 146, 102), C(168, 132, 94), C(142, 114, 84), C(116, 92, 70)]
    s.rc(2, 0, 30, 9, C(38, 32, 38)); s.rc(2, 9, 30, 25, C(60, 50, 52))
    for i in range(4): y = 9 + (3 - i) * 6 + 0; y = 8 + i * 6; s.rc(2, y, 30, 3, TR[3 - i]); s.rc(2, y + 3, 30, 3, RI[3 - i])
    s.rc(2, 32, 30, 2, C(224, 190, 142))
    s.rc(0, 0, 3, 34, C(239, 226, 200)); s.rc(31, 0, 3, 34, C(239, 226, 200)); s.rc(0, 0, 1, 34, C(213, 200, 175)); s.rc(33, 0, 1, 34, C(213, 200, 175))
    s.rc(0, 28, 4, 6, C(150, 116, 84)); s.rc(30, 28, 4, 6, C(150, 116, 84)); return s

BUILD = [('bed', bed, [-15, -22, 30, 22]), ('sofa', sofa, [-20, -12, 40, 12]), ('armchair', armchair, [-10, -12, 20, 12]), ('table', table, [-17, -14, 34, 14]),
         ('chair', chair, [-6, -8, 12, 8]), ('shelf', shelf, [-14, -12, 28, 12]), ('counter', counter, [-17, -14, 34, 14]), ('fridge', fridge, [-9, -10, 18, 10]),
         ('plant', plant, [-5, -5, 10, 5]), ('lamp', lamp, [-4, -4, 8, 4]), ('tv', tv, [-15, -10, 30, 10]), ('stairs_up', stairs_up, None), ('stairs_down', stairs_down, None)]

def atlas():
    a = Image.new('RGBA', (192, 64), (0, 0, 0, 0))
    for i, k in enumerate(['teal', 'oak', 'dark', 'ceramic', 'carpet']): a.paste(floor(k).im, (i * 16, 0))
    a.paste(USER.crop((0, 64, 48, 112)), (0, 16))                 # plain wall front
    a.paste(window().im, (48, 16))
    a.paste(USER.crop((128, 0, 135, 48)), (64, 16))               # vertical trim
    a.paste(USER.crop((128, 64, 176, 71)), (80, 16))              # horizontal trim
    return a

def main():
    atlas().save('assets/tiles/interior.png')
    for name, fn, box in BUILD: add(name, fn(), box)
    # the hand-drawn door and painting, exactly as drawn (no outline added)
    for name, rect, box in [('painting', (16, 11, 32, 26), None), ('door', (80, 11, 96, 48), None)]:
        im = Img(rect[2] - rect[0], rect[3] - rect[1]); im.im.paste(USER.crop(rect), (0, 0)); SPRITES[name] = (im, im.w // 2, box)
    gap = 2; W = sum(i.w + gap for i, _, _ in SPRITES.values()) + gap; H = max(i.h for i, _, _ in SPRITES.values()) + gap * 2
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0)); meta = {}; x = gap
    for name, (img, ax, box) in SPRITES.items():
        sheet.alpha_composite(img.im, (x, gap)); meta[name] = {'x': x, 'y': gap, 'w': img.w, 'h': img.h, 'ax': ax, 'box': box}; x += img.w + gap
    sheet.save('assets/props/furniture.png'); json.dump(meta, open('assets/props/furniture.json', 'w'))
    print('interior.png', atlas().size, 'furniture', sheet.size, len(meta))
if __name__ == '__main__': main()
