'use strict';
// Loads the painted sprite sheets (assets/) and builds the character renderer and prop sprites from them.
// Character sheets: 4 walk frames x 8 directions, one cell = 24x38 px, feet on the bottom row.
// Direction order (rows): down, down-left, left, up-left, up, up-right, right, down-right.
const ASSET = { img: {}, props: null, ok: false };

function loadAssets(cb) {
  const list = { hero_uv: 'assets/chars/hero_uv.png', hero_skin: 'assets/chars/hero_skin.png', fills: 'assets/tiles/fills.png' };
  let left = Object.keys(list).length + 1; const failed = [];
  const done = () => { if (--left === 0) { ASSET.ok = !failed.length; cb(failed); } };
  for (const k in list) { const im = new Image(); im.onload = () => { ASSET.img[k] = im; done(); }; im.onerror = () => { failed.push(k); done(); }; im.src = list[k]; }
  fetch('assets/chars/hero_roles.json').then(r => r.json()).then(j => { ASSET.heroRoles = j; done(); }).catch(() => { ASSET.heroRoles = {}; done(); });
}
function recolorCanvas(c, fn) {
  const id = c.g.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { const o = fn(d[i], d[i + 1], d[i + 2]); d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; }
  c.g.putImageData(id, 0, 0); return c;
}
const lumOf = (r, g, b) => (0.3 * r + 0.59 * g + 0.11 * b) / 255;
// ---- the hero : pixel-art "rigging" by UV lookup ----------------------------------------------------------------------
// assets/chars/hero_uv.png holds the animation (4 directions x idle + 4 walk frames, cell 32x48, feet centre at (16, 47)), but not as colours:
// every pixel stores a coordinate (R = x, G = y) into the skin texture assets/chars/hero_skin.png. Sprites are built by looking those
// coordinates up, so editing the skin (or recolouring it live) changes every frame of every animation.
const HERO_ROW = { d: 0, l: 1, r: 2, u: 3 }, HERO = { base: null, data: null, uv: null, roles: {}, tint: {}, cache: {}, skins: {} };
const heroLum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
function heroInit() {
  const k = mk(64, 64); k.g.drawImage(ASSET.img.hero_skin, 0, 0); HERO.base = k.g.getImageData(0, 0, 64, 64).data;
  const u = mk(160, 192); u.g.drawImage(ASSET.img.hero_uv, 0, 0); HERO.uv = u.g.getImageData(0, 0, 160, 192).data;
  HERO.roles = ASSET.heroRoles || {}; HERO.tint = S.look = cleanLook(S.look); heroApply();   // the player's look lives in the save (S.look)
}
const heroPix = (role, k) => { const q = HERO.roles[role][k]; return (q[1] * 64 + q[0]) * 4; };
function heroRoleColor(role) { // the role's middle-brightness colour in the original skin (what the colour picker starts at)
  const l = HERO.roles[role] || []; if (!l.length) return [128, 128, 128];
  const cs = l.map((q, k) => { const i = heroPix(role, k); return [HERO.base[i], HERO.base[i + 1], HERO.base[i + 2]]; }).sort((a, b) => heroLum(a) - heroLum(b)); return cs[Math.floor(cs.length / 2)];
}
function heroBuild(tint) { // a skin = the original skin with the chosen colour per role; each pixel keeps its brightness relation to the role's middle shade
  const d = new Uint8ClampedArray(HERO.base);
  for (const role in tint) {
    const l = HERO.roles[role], hex = tint[role]; if (!l || !hex) continue;
    const t = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), rl = Math.max(1, heroLum(heroRoleColor(role)));
    l.forEach((q, k) => { const i = heroPix(role, k), f = heroLum([HERO.base[i], HERO.base[i + 1], HERO.base[i + 2]]) / rl; for (let c = 0; c < 3; c++) d[i + c] = clamp(Math.round(t[c] * f), 0, 255); });
  }
  return d;
}
function heroApply() { HERO.data = heroBuild(HERO.tint); HERO.cache = {}; saveState(); }   // the local player's skin
function heroSprite(dir, frame, tint) { // frame 0 = idle, 1..4 = walk cycle. `tint` is another player's look (their skins are cached by look)
  let data = HERO.data, cache = HERO.cache;
  if (tint) {
    const key = JSON.stringify(tint); let sk = HERO.skins[key];
    if (!sk) { if (Object.keys(HERO.skins).length > 48) HERO.skins = {}; sk = HERO.skins[key] = { data: heroBuild(tint), cache: {} }; }
    data = sk.data; cache = sk.cache;
  }
  const key = dir + frame; if (cache[key]) return cache[key];
  const c = mk(32, 48), id = c.g.createImageData(32, 48), o = id.data, row = HERO_ROW[dir] || 0;
  for (let y = 0; y < 48; y++) for (let x = 0; x < 32; x++) {
    const i = ((row * 48 + y) * 160 + frame * 32 + x) * 4; if (!HERO.uv[i + 3]) continue;
    const j = (HERO.uv[i + 1] * 64 + HERO.uv[i]) * 4, k = (y * 32 + x) * 4; o[k] = data[j]; o[k + 1] = data[j + 1]; o[k + 2] = data[j + 2]; o[k + 3] = data[j + 3];
  }
  c.g.putImageData(id, 0, 0); c.ax = 16; c.ay = 49; return cache[key] = c;
}
const LOOK_ROLES = [['hair', 'Hair'], ['eyes', 'Eyes'], ['skin', 'Skin'], ['shirt', 'Shirt'], ['jeans', 'Jeans'], ['boots', 'Boots']];
function cleanLook(l) { const o = {}; if (l && typeof l === 'object') for (const [r] of LOOK_ROLES) if (typeof l[r] === 'string' && /^#[0-9a-fA-F]{6}$/.test(l[r])) o[r] = l[r].toLowerCase(); return o; }
const SHIRTS = ['#7a9a4a', '#c9503f', '#3f6fb0', '#e0b43a', '#8a5aa8', '#e8e0d0', '#2f8a7a', '#d9738a'], JEANS = ['#4f6f9a', '#34455f', '#6b5a4a', '#3a3a44', '#7a8a6a'], BOOTS = ['#a8641e', '#4a3326', '#2a2a30', '#7a2f2a'];
function randLook() { return { hair: pick(HAIRC), eyes: pick(['#4a3326', '#2f5a8a', '#3a7a4a', '#2a2a30']), skin: pick(SKIN), shirt: pick(SHIRTS), jeans: pick(JEANS), boots: pick(BOOTS) }; }   // wandering diggers get a random outfit
