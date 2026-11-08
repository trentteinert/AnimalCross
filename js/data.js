'use strict';
// ---- shared helpers -------------------------------------------------------
const $ = s => document.querySelector(s);
const EDIT = /[?&]edit(&|$)/.test(location.search);
const MAP_DRAFT_KEY = 'littleisland.map.draft';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
function pickW(w) {
  let t = 0; for (const x of w) t += x;
  let r = Math.random() * t;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return w.length - 1;
}

// ---- catalog --------------------------------------------------------------
const RAR = [
  { n: 'Common', c: '#d7e0ea' }, { n: 'Uncommon', c: '#8fe09a' },
  { n: 'Rare', c: '#78bfff' }, { n: 'Legendary', c: '#ffcf5a' }
];
const CATS = [{ id: 'fish', n: 'Relics' }];
const ITEMS = [], ITEM = {};
function add(cat, id, name, r, v, sz, cols, shape, o) {
  o = o || {};
  const it = { id, cat, name, r, v, sz, cols, shape, where: o.where || null, time: o.time || 'any', desc: o.desc || '', junk: !!o.junk };
  ITEMS.push(it); ITEM[id] = it;
}
// artifacts (category id stays 'fish' internally; they are dug up at dig sites: zones dunes / ruins / jungle / tomb)
add('fish', 'shard', 'Pottery Shard', 0, 5, [4, 8], ['#c8864a', '#e8b078'], 'shard', { where: ['dunes', 'ruins', 'jungle'], desc: 'Part of somebody\'s favourite bowl.' });
add('fish', 'arrowhead', 'Flint Arrowhead', 0, 6, [3, 7], ['#8a8a96', '#c8c8d4'], 'arrow', { where: ['dunes', 'jungle'], desc: 'Still sharp enough to be rude.' });
add('fish', 'bead', 'Clay Bead', 0, 8, [1, 2], ['#b8643a', '#e8a878'], 'bead', { where: ['dunes', 'ruins'], desc: 'One bead from a very long necklace.' });
add('fish', 'needle', 'Bone Needle', 0, 9, [6, 12], ['#e8dcc0', '#b8a888'], 'needle', { where: ['ruins', 'tomb'], desc: 'Someone mended their favourite cloak with this.' });
add('fish', 'nail', 'Rusty Nail', 0, 1, null, ['#8a5a3a', '#5a3a28'], 'nail', { where: ['dunes', 'ruins', 'jungle'], junk: true, desc: 'Not that old, honestly.' });
add('fish', 'bronzecoin', 'Bronze Coin', 1, 22, [2, 4], ['#b87a3a', '#e0a860'], 'coin', { where: ['ruins', 'dunes'], desc: 'The face on it looks bored.' });
add('fish', 'claypot', 'Clay Pot', 1, 28, [10, 24], ['#c4683a', '#e89a68'], 'pot', { where: ['dunes', 'ruins'], desc: 'Missing a lid and possibly some soup.' });
add('fish', 'seal', 'Stone Seal', 1, 30, [3, 6], ['#8a8478', '#b8b0a0'], 'seal', { where: ['ruins', 'jungle'], desc: 'Used to stamp very important letters.' });
add('fish', 'jade', 'Jade Charm', 1, 34, [3, 6], ['#4fb88a', '#a8f0cc'], 'amulet', { where: ['jungle'], desc: 'Cool to the touch, even in the sun.' });
add('fish', 'dagger', 'Bronze Dagger', 1, 30, [14, 30], ['#c08a40', '#e8c070'], 'dagger', { where: ['dunes', 'ruins'], desc: 'Ceremonial, probably. Please hold it politely.' });
add('fish', 'oillamp', 'Oil Lamp', 1, 26, [8, 14], ['#d4a040', '#f0d070'], 'lamp', { where: ['tomb', 'ruins'], desc: 'Rub it. Nothing happens. Rub it again.' });
add('fish', 'mask', 'Ceremonial Mask', 2, 95, [18, 30], ['#d8a83a', '#4fb88a'], 'mask', { where: ['jungle', 'ruins'], desc: 'It watches you work.' });
add('fish', 'urn', 'Painted Urn', 2, 85, [25, 50], ['#c85a3a', '#f0d8a0'], 'urn', { where: ['dunes', 'ruins'], desc: 'The paintings tell a story. A long one.' });
add('fish', 'scroll', 'Sealed Scroll', 2, 100, [20, 40], ['#e8d8a8', '#b8643a'], 'scroll', { where: ['tomb', 'dunes'], desc: 'Still sealed. Resist the urge.' });
add('fish', 'goldring', 'Gold Ring', 2, 110, [2, 3], ['#f0c030', '#fff0a0'], 'ring', { where: ['tomb', 'ruins'], desc: 'Someone is still looking for this.' });
add('fish', 'fossil', 'Trilobite Fossil', 2, 90, [4, 10], ['#a89880', '#d8c8a8'], 'fossil', { where: ['dunes', 'jungle'], desc: 'Older than anything else in your bag.' });
add('fish', 'tablet', 'Clay Tablet', 2, 105, [10, 20], ['#b88a58', '#e0b880'], 'tablet', { where: ['ruins'], desc: 'A receipt for forty goats.' });
add('fish', 'catstatue', 'Cat Figurine', 2, 120, [8, 14], ['#2a2a30', '#f0c030'], 'statue', { where: ['tomb'], desc: 'Looks smug. Has every right to.' });
add('fish', 'crown', 'Lost Crown', 3, 520, [18, 26], ['#f0c030', '#d8402f'], 'crown', { where: ['tomb'], desc: 'Someone important is having a bad day.' });
add('fish', 'idol', 'Stone Idol', 3, 420, [40, 90], ['#8a8478', '#b8b0a0'], 'statue', { where: ['jungle', 'ruins'], desc: 'Heavy, ancient, and slightly judgemental.' });
add('fish', 'deathmask', 'Golden Death Mask', 3, 600, [20, 32], ['#ffd23f', '#3a7ad8'], 'mask', { where: ['tomb'], desc: 'Do not wear it. Do not even think about it.' });
add('fish', 'crystalskull', 'Crystal Skull', 3, 560, [14, 20], ['#c8f0ff', '#78bfff'], 'skull', { where: ['jungle', 'tomb'], desc: 'Gleams like it knows something.' });

// dig sites: painted onto the map (SITE layer), fixed for everybody, each one unlocks at a player level
const SITES = [null,
  { id: 'dunes', n: 'Desert Dunes', lv: 1, col: '#e0b060' },
  { id: 'ruins', n: 'Temple Ruins', lv: 5, col: '#b0a48e' },
  { id: 'jungle', n: 'Jungle Dig', lv: 10, col: '#5fa04a' },
  { id: 'tomb', n: 'Sunken Tomb', lv: 15, col: '#7a64b0' }];
const WH = { dunes: 'desert dunes dig sites', ruins: 'temple ruins dig sites', jungle: 'jungle dig sites', tomb: 'tomb dig sites' };
function whereText(it) {
  let s = it.where ? it.where.map(w => WH[w]).join(' & ') : 'Somewhere'; s = s[0].toUpperCase() + s.slice(1);
  if (it.time === 'night') s += ' - at night'; if (it.time === 'day') s += ' - by day';
  return s;
}

function makeInst(it) {
  const o = { id: it.id, sz: null, val: it.v, big: false };
  if (it.sz) {
    let u = (Math.random() + Math.random()) / 2;
    if (Math.random() < 0.06) u = Math.min(1, u + 0.35);
    o.sz = Math.round((it.sz[0] + u * (it.sz[1] - it.sz[0])) * 10) / 10;
    o.big = u > 0.82;
    o.val = Math.max(1, Math.round(it.v * (0.75 + 0.5 * u)));
  }
  return o;
}
function fmtSz(inst) {
  if (inst.sz == null) return '';
  return (inst.sz >= 10 ? Math.round(inst.sz) : inst.sz.toFixed(1)) + ' cm';
}
// ctx: {where, night, rain, luck}; only: optional filter
function rollItem(cat, ctx, only) {
  const night = !!ctx.night, luck = ctx.luck || 0, rain = !!ctx.rain;
  const pool = ITEMS.filter(i => i.cat === cat && (!only || only(i)) &&
    (!ctx.where || !i.where || i.where.includes(ctx.where)) &&
    (i.time === 'any' || (i.time === 'night') === night) &&
    !(i.id === 'glowberry' && !(night || rain)));
  const rm = rain ? 1.3 : 1;
  const w = [60, 28 * (1 + luck * 0.25), 10 * (1 + luck * 0.5) * rm, 2 * (1 + luck * 0.8) * rm];
  const t0 = pickW(w);
  const order = [];
  for (let t = t0; t <= 3; t++) order.push(t);
  for (let t = t0 - 1; t >= 0; t--) order.push(t);
  for (const t of order) {
    const g = pool.filter(i => i.r === t);
    if (g.length) return makeInst(pick(g));
  }
  return makeInst(pool[0]);
}

// ---- progression ----------------------------------------------------------
const TOOLS = {
  rod: [
    { n: 'Hand Trowel', rng: 22, cost: 0, lv: 1, spd: 1, luck: 0, d: 'Basic. Shallow digs.' },
    { n: 'Mason Pick', rng: 34, cost: 80, lv: 2, spd: 1.3, luck: 0.6, d: 'Quicker strikes, deeper digs.' },
    { n: 'Steel Pick', rng: 48, cost: 320, lv: 6, spd: 1.7, luck: 1.4, d: 'Fast, deep, and good at finding rare relics.' },
    { n: 'Golden Pick', rng: 64, cost: 1300, lv: 12, spd: 2.2, luck: 2.4, d: 'Reaches the deepest layers.' }],
  bag: [
    { n: 'Pocket', cost: 0, cap: 8, d: 'Holds 8 things.' },
    { n: 'Satchel', cost: 60, lv: 1, cap: 14, d: 'Holds 14 things.' },
    { n: 'Backpack', cost: 240, lv: 3, cap: 22, d: 'Holds 22 things.' },
    { n: 'Big Pack', cost: 800, lv: 8, cap: 34, d: 'Holds 34 things.' }]
};
// ---- dealer / equipment catalogue ---------------------------------------------------
const GEAR = {
  reel: [{ n: 'Soft Brush', d: 'Brush clean 12% faster.', cost: 100, lv: 1, v: 0.12 }, { n: 'Fine Brush', d: 'Brush clean 25% faster.', cost: 380, lv: 6, v: 0.25 }, { n: 'Gilded Brush', d: 'Brush clean 40% faster.', cost: 1400, lv: 14, v: 0.4 }],
  line: [{ n: 'Padded Gloves', d: 'Finds crack 25% slower.', cost: 60, lv: 2, v: 0.25 }, { n: 'Archivist Gloves', d: 'Finds crack 50% slower.', cost: 260, lv: 7, v: 0.5 }, { n: 'Silk Gloves', d: 'Finds barely crack at all.', cost: 900, lv: 15, v: 0.75 }]
};
const SKIN = ['#f6d3b3', '#e9b98f', '#d49a6a', '#b57a4a', '#8a5a36', '#5e3b24'];
const HAIRC = ['#2b1d1a', '#5a3a22', '#8a5a2f', '#d8a24a', '#e8d27a', '#c2442f', '#6f5ad8', '#e86fa8'];

const needXP = lv => 45 + (lv - 1) * 40;

// ---- save state -----------------------------------------------------------
const SAVE_KEY = 'littledig.proto.v1';
function defaultState() {
  return {
    gold: 0, xp: 0, lv: 1, bag: [], book: {}, tools: { rod: 0, bag: 0 }, gear: { reel: 0, line: 0 },
    look: {},
    name: 'digger#' + (1000 + Math.floor(Math.random() * 9000)), created: false,
    stats: { fish: 0, total: 0, earned: 0, big: null, rare: null }, sound: true, lefty: false, fx: true
  };
}
let S = defaultState();
function loadState() {
  try {
    if (/[?&]reset/.test(location.search)) { localStorage.removeItem(SAVE_KEY); return; }
    const j = localStorage.getItem(SAVE_KEY);
    if (!j) return;
    const o = JSON.parse(j), d = defaultState();
    S = Object.assign(d, o);
    S.tools = Object.assign(d.tools, o.tools || {});
    S.look = Object.assign(d.look, o.look || {});
    S.stats = Object.assign(d.stats, o.stats || {});
  } catch (e) { }
}
let saveTimer = 0;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }, 400);
}
const bagCap = () => TOOLS.bag[S.tools.bag].cap;
const bagCount = () => S.bag.length;
function badName(n) {
  if (!/^[A-Za-z0-9_.#-]{3,14}$/.test(n)) return 'Use 3-14 letters, numbers, . _ - or #';
  const l = n.toLowerCase();
  for (const w of ['fuck', 'shit', 'nazi', 'rape', 'bitch', 'admin', 'mod_']) if (l.includes(w)) return 'Please pick a different name';
  return '';
}
