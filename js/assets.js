'use strict';
// Loads the painted sprite sheets (assets/) and builds the character renderer and prop sprites from them.
// Character sheets: 4 walk frames x 8 directions, one cell = 24x38 px, feet on the bottom row.
// Direction order (rows): down, down-left, left, up-left, up, up-right, right, down-right.
const ASSET = { img: {}, props: null, furn: {}, ok: false };
const CW = 24, CH = 40;
const FACE_OF_DIR = { d: 0, l: 2, u: 4, r: 6 };
const PANTSC = ['#9a5a3a', '#3f5f94', '#4b4b66', '#6b6b52', '#8a3a30', '#2f6a5a', '#c9b890', '#2a2a34'];

function loadAssets(cb) {
  const list = { body: 'assets/chars/body.png', hair: 'assets/chars/hair.png', top: 'assets/chars/top.png', pants: 'assets/chars/pants.png', hero_uv: 'assets/chars/hero_uv.png', hero_skin: 'assets/chars/hero_skin.png', interior: 'assets/tiles/interior.png', furniture: 'assets/props/furniture.png', fito: 'assets/chars/fito.png', act_gather: 'assets/chars/act_gather.png', act_net: 'assets/chars/act_net.png', act_fish: 'assets/chars/act_fish.png', act_emote: 'assets/chars/act_emote.png', fills: 'assets/tiles/fills.png', props: 'assets/props/props.png' };
  let left = Object.keys(list).length + 3; const failed = [];
  const done = () => { if (--left === 0) { ASSET.ok = !failed.length; cb(failed); } };
  for (const k in list) { const im = new Image(); im.onload = () => { ASSET.img[k] = im; done(); }; im.onerror = () => { failed.push(k); done(); }; im.src = list[k]; }
  fetch('assets/chars/hero_roles.json').then(r => r.json()).then(j => { ASSET.heroRoles = j; done(); }).catch(() => { ASSET.heroRoles = {}; done(); });
  fetch('assets/props/furniture.json').then(r => r.json()).then(j => { ASSET.furn = j; done(); }).catch(() => { ASSET.furn = {}; done(); });
  fetch('assets/props/props.json').then(r => r.json()).then(j => { ASSET.props = j; done(); }).catch(() => { failed.push('props.json'); done(); });
}
function prop(name, anchorMid) {
  const r = ASSET.props[name], c = mk(r.w, r.h); c.g.drawImage(ASSET.img.props, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  c.ax = Math.round(r.w / 2); c.ay = anchorMid ? Math.round(r.h / 2) : r.h; return c;
}
function recolorCanvas(c, fn) {
  const id = c.g.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { const o = fn(d[i], d[i + 1], d[i + 2]); d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; }
  c.g.putImageData(id, 0, 0); return c;
}
const lumOf = (r, g, b) => (0.3 * r + 0.59 * g + 0.11 * b) / 255;
function rampFn(hex, lo, hi, dk, lt) { // recolour by brightness: darkest -> shade(hex, dk), brightest -> shade(hex, lt)
  const A = hexRGB(shade(hex, dk)), B = hexRGB(shade(hex, lt));
  return (r, g, b) => { const t = clamp((lumOf(r, g, b) - lo) / (hi - lo), 0, 1); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; };
}
const isCream = (r, g, b) => r > 170 && g > 160 && b > 120;
function topFn(hex, style) {
  const f = rampFn(hex, 0.18, 0.55, -70, 34), f2 = rampFn(hex, 0.18, 0.55, 40, 90);
  return (r, g, b) => isCream(r, g, b) ? (style === 1 ? f(r * 0.75, g * 0.75, b * 0.75) : style === 2 ? f2(r, g, b) : [r, g, b]) : f(r, g, b);
}
const faceOf = (dx, dy) => Math.round(((Math.atan2(dy, dx) * 180 / Math.PI - 90 + 360) % 360) / 45) % 8;
const faceIdx = e => (e.face != null && e.faceDir === e.dir) ? e.face : (FACE_OF_DIR[e.dir] || 0);

const charCache2 = new Map();
function charSprite(look, face, fr) {
  if (typeof face === 'string') face = FACE_OF_DIR[face] || 0;
  const key = [look.skin, look.hair, look.hc, look.shirt, look.topc || '', look.style, look.hat, look.hatc || '', look.pc | 0, face, fr].join();
  let s = charCache2.get(key); if (s) return s;
  const c = mk(CW, CH), sx = fr * CW, sy = face * CH;
  const layer = (img, fn) => { const t = mk(CW, CH); t.g.drawImage(img, sx, sy, CW, CH, 0, 0, CW, CH); if (fn) recolorCanvas(t, fn); c.g.drawImage(t, 0, 0); };
  const skinRamp = rampFn(SKIN[look.skin], 0.34, 0.72, -40, 22);
  layer(ASSET.img.body, (r, g, b) => lumOf(r, g, b) < 0.33 ? [44, 26, 22] : skinRamp(r, g, b)); // keep the eyes dark whatever the skin tone
  // clothing, hair and hat layers are intentionally disabled: bare animated body only
  c.ax = 12; c.ay = CH - 1; charCache2.set(key, c); return c;
}
// ---- painted action frames (fishing, net, digging, picking, waving, hold-up): 48x48 cells, 8 frames x 12 rows ----
// rows = 3 animations x 4 directions (d, l, r, u). Only the body/skin pixels are tinted; rods, nets, fish and apples keep their own colours.
const AROW = { d: 0, l: 1, r: 2, u: 3 };
const actCache = new Map();
function actSprite(look, sheet, row, col, noItem) {
  const key = [sheet, row, col, look.skin, noItem ? 1 : 0].join();
  let s = actCache.get(key); if (s) return s;
  const c = mk(48, 48); c.g.drawImage(ASSET.img['act_' + sheet], col * 48, row * 48, 48, 48, 0, 0, 48, 48);
  const id = c.g.getImageData(0, 0, 48, 48), d = id.data, ramp = rampFn(SKIN[look.skin], 0.34, 0.72, -40, 22);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue; let r = d[i], g_ = d[i + 1], b = d[i + 2];
    if (noItem && g_ > 205 && r > 232) { r = 206; g_ = 145; b = 102; }                // the shell baked into the hold-up pose becomes skin
    const dark = r < 128 && g_ < 78;                                                  // eyes, rod: left as drawn
    const skin = !dark && r >= g_ && g_ >= b - 4 && r - b > 40 && r - g_ < 90 && r > 90;
    if (skin) { const o = ramp(r, g_, b); d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; } else { d[i] = r; d[i + 1] = g_; d[i + 2] = b; }
  }
  c.g.putImageData(id, 0, 0); c.ax = 24; c.ay = 48; c.sheet = sheet; c.row = row; c.col = col;
  c.tip = sheet === 'fish' && typeof ACT_TIPS !== 'undefined' ? ACT_TIPS.fish[row * 8 + col] : null;
  actCache.set(key, c); return c;
}
// ---- the hero (angela branch): pixel-art "rigging" by UV lookup ----------------------------------------------------------------------
// assets/chars/hero_uv.png holds the animation (4 directions x idle + 4 walk frames, cell 32x48, feet centre at (16, 47)), but not as colours:
// every pixel stores a coordinate (R = x, G = y) into the skin texture assets/chars/hero_skin.png. Sprites are built by looking those
// coordinates up, so editing the skin (or recolouring it live) changes every frame of every animation.
const HERO_ROW = { d: 0, l: 1, r: 2, u: 3 }, HERO = { base: null, data: null, uv: null, roles: {}, tint: {}, cache: {} };
const heroLum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
function heroInit() {
  const k = mk(64, 64); k.g.drawImage(ASSET.img.hero_skin, 0, 0); HERO.base = k.g.getImageData(0, 0, 64, 64).data;
  const u = mk(160, 192); u.g.drawImage(ASSET.img.hero_uv, 0, 0); HERO.uv = u.g.getImageData(0, 0, 160, 192).data;
  HERO.roles = ASSET.heroRoles || {}; try { HERO.tint = JSON.parse(localStorage.getItem('angela.look') || '{}') || {}; } catch (e) { HERO.tint = {}; }
  heroApply();
}
const heroPix = (role, k) => { const q = HERO.roles[role][k]; return (q[1] * 64 + q[0]) * 4; };
function heroRoleColor(role) { // the role's middle-brightness colour in the original skin (what the colour picker starts at)
  const l = HERO.roles[role] || []; if (!l.length) return [128, 128, 128];
  const cs = l.map((q, k) => { const i = heroPix(role, k); return [HERO.base[i], HERO.base[i + 1], HERO.base[i + 2]]; }).sort((a, b) => heroLum(a) - heroLum(b)); return cs[Math.floor(cs.length / 2)];
}
function heroApply() { // the live skin = the original skin with the chosen colour per role; each pixel keeps its brightness relation to the role's middle shade
  const d = new Uint8ClampedArray(HERO.base);
  for (const role in HERO.tint) {
    const l = HERO.roles[role], hex = HERO.tint[role]; if (!l || !hex) continue;
    const t = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), rl = Math.max(1, heroLum(heroRoleColor(role)));
    l.forEach((q, k) => { const i = heroPix(role, k), f = heroLum([HERO.base[i], HERO.base[i + 1], HERO.base[i + 2]]) / rl; for (let c = 0; c < 3; c++) d[i + c] = clamp(Math.round(t[c] * f), 0, 255); });
  }
  HERO.data = d; HERO.cache = {};
}
function heroSprite(dir, frame) { // frame 0 = idle, 1..4 = walk cycle
  const key = dir + frame; if (HERO.cache[key]) return HERO.cache[key];
  const c = mk(32, 48), id = c.g.createImageData(32, 48), o = id.data, row = HERO_ROW[dir] || 0;
  for (let y = 0; y < 48; y++) for (let x = 0; x < 32; x++) {
    const i = ((row * 48 + y) * 160 + frame * 32 + x) * 4; if (!HERO.uv[i + 3]) continue;
    const j = (HERO.uv[i + 1] * 64 + HERO.uv[i]) * 4, k = (y * 32 + x) * 4; o[k] = HERO.data[j]; o[k + 1] = HERO.data[j + 1]; o[k + 2] = HERO.data[j + 2]; o[k + 3] = HERO.data[j + 3];
  }
  c.g.putImageData(id, 0, 0); c.ax = 16; c.ay = 49; return HERO.cache[key] = c;
}
function digPose(dir, f, now, hit) { // [sheet, row, col] for each dig phase (player and wandering diggers): crouch frames from the gather sheet
  const D = AROW[dir] || 0;
  switch (f.ph) {
    case 'charge': return ['gather', D, 0];
    case 'cast': return ['gather', D, 1 + Math.min(2, Math.floor(f.t / 0.14))];
    case 'wait': return ['gather', D, 3];
    case 'bite': return ['gather', D, 2 + (Math.floor(now * 14) % 2)];
    case 'reel': return ['gather', D, 2 + (Math.floor(now * (hit ? 10 : 5)) % 2)];
    case 'pull': return ['gather', D, 4];
  }
  return null;
}
function drawHat(c, look, face) { // hats are still drawn in code: they sit over the head of the painted body
  const m = look.hatc, side = face === 2 ? -1 : face === 6 ? 1 : 0, x = 12 + side, T = CH - 31; // T = top row of the head
  if (look.hat === 1) { const col = m || '#e8d8a0'; RC(c, x - 6, T - 4, 12, 5, col); RC(c, x - 6, T - 4, 12, 1, shade(col, 24)); RC(c, x - 8, T, 16, 2, shade(col, -34)); }
  if (look.hat === 2) { const col = m || '#c2442f'; RC(c, x - 7, T - 4, 14, 6, col); RC(c, x - 7, T, 14, 2, shade(col, -50)); RC(c, x - 1, T - 6, 3, 2, '#f5e9cf'); }
  if (look.hat === 3) { const col = m || '#e8c46a'; RC(c, x - 5, T - 5, 10, 5, col); RC(c, x - 5, T - 2, 10, 1, shade(col, -60)); RC(c, x - 10, T - 1, 20, 3, shade(col, -20)); RC(c, x - 10, T - 1, 20, 1, shade(col, 24)); }
}
function randLook() { return { b: Math.floor(rnd(0, 3)), hair: Math.random() < 0.85 ? 0 : 1, hc: Math.floor(rnd(0, 8)), skin: Math.floor(rnd(0, 6)), shirt: Math.floor(rnd(0, 8)), style: Math.floor(rnd(0, 3)), hat: Math.random() < 0.3 ? Math.floor(rnd(1, 4)) : 0, pc: Math.floor(rnd(0, 8)) }; }

// ---- props from the new tileset ---------------------------------------------------------------------
function buildFurniture() { // house furniture: sprites cut from furniture.png, anchored at the bottom centre
  SPR.furn = {}; for (const k in ASSET.furn) { const r = ASSET.furn[k], c = mk(r.w, r.h); c.g.drawImage(ASSET.img.furniture, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); c.ax = r.ax; c.ay = r.h; SPR.furn[k] = c; }
}
function buildPropSprites() {
  const P = n => prop(n), tint = (c, fn) => { const t = mk(c.width, c.height); t.g.drawImage(c, 0, 0); t.ax = c.ax; t.ay = c.ay; return recolorCanvas(t, fn); };
  const green = tint(P('tree_red'), (r, g, b) => (g < 0.45 * r && r > 120) ? [g + 14, r * 0.88, b * 0.9] : [r, g, b]);
  const withFruit = (base, col, seed) => {
    const c = mk(base.width, base.height); c.g.drawImage(base, 0, 0); c.ax = base.ax; c.ay = base.ay; const rr = rng(seed), d = base.g.getImageData(0, 0, base.width, base.height).data;
    for (let n = 0, t = 0; n < 9 && t < 300; t++) { const x = 3 + Math.floor(rr() * (base.width - 7)), y = 3 + Math.floor(rr() * base.height * 0.5); if (d[(y * base.width + x) * 4 + 3] && d[((y + 1) * base.width + x + 1) * 4 + 3]) { RC(c, x, y, 2, 2, col); PX(c, x, y, shade(col, 70)); n++; } }
    return c;
  };
  SPR.tree = {
    apple: [withFruit(green, '#e8402f', 11), green], orange: [withFruit(green, '#f59a2a', 22), green],
    pear: [withFruit(P('tree_yellow'), '#8ad060', 33), P('tree_yellow')], plum: [withFruit(P('tree_red'), '#8a4fb0', 44), P('tree_red')]
  };
  SPR.deco = [P('tree_orange'), P('tree_red'), P('tree_yellow'), green, P('pine_a'), P('pine_b')];
  const bare = c => tint(c, (r, g, b) => { const l = lumOf(r, g, b) * 255; return [l + (r - l) * 0.3 - 8, l + (g - l) * 0.55, l + (b - l) * 0.3 - 8]; });
  const bushOf = n => { const f = P(n); return [f, bare(f)]; };
  SPR.bush = { blueberry: bushOf('bush_lavender'), raspberry: bushOf('bush_red'), blackberry: bushOf('bush_redflower'), elderberry: bushOf('bush_yellow') };
  SPR.rocks = [P('rock_s'), P('rock_m'), P('rock_l'), P('rock_moss')]; SPR.rock = SPR.rocks[1];
  SPR.lamp = P('lamp'); SPR.bench = P('bench'); SPR.logseat = P('log');
  SPR.lily = [prop('lily_1', true), prop('lily_flower', true), prop('lily_2', true)];
  SPR.flower = ['fl_white', 'fl_white2', 'fl_yellow', 'fl_pink', 'fl_pink2', 'fl_purple', 'fl_blue', 'fl_blue2', 'flower_a', 'flower_b'].map(P);
}
