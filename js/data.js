'use strict';
// ---- shared helpers -------------------------------------------------------
const $ = s => document.querySelector(s);
const EDIT = /[?&]edit(&|$)/.test(location.search);
// features switched off for now (their code and map data are kept; the editor still shows dig sites): flip to true to bring them back
const FEATURES = { npcs: false, sites: true, fx: false, groundDetail: false };   // fx = day/night tint, rain, clouds, vignette, water ripples, light glows: off so the art is seen exactly as painted; groundDetail = the generated grass tufts, soft tonal patches and tiny flowers on the ground
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

// ---- the loop: what comes out of the ground, what it takes to dig, and what you can make ------------------------------------------
const RAR = [{ n: 'Common', c: '#d7e0ea' }, { n: 'Uncommon', c: '#8fe09a' }, { n: 'Rare', c: '#78bfff' }];
const ARTIFACTS = [   // collectible finds: each one is found with a "% intact" (how well it survived the dig)
  { id: 'jug', name: 'Clay Jug', r: 0, desc: 'Plain, sturdy, and probably leaked.' },
  { id: 'bowl', name: 'Decorative Bowl', r: 1, desc: 'Somebody cared how their soup looked.' },
  { id: 'coin', name: 'Stamped Coin', r: 2, desc: 'The stamp is a little crooked.' }];
const SALVAGE = [     // crafting materials: found while digging (scrap comes from processing extra commons at camp)
  { id: 'nails', name: 'Rusty Nails', desc: 'Iron, if you squint.' },
  { id: 'boot', name: 'Worn Boot', desc: 'Only the one. Of course.' },
  { id: 'fabric', name: 'Torn Fabric', desc: 'Used to be a flag, or a sock.' },
  { id: 'scrap', name: 'Scrap', desc: 'What a spare common find is worth at camp.' }];
const ITEM = {}; ARTIFACTS.concat(SALVAGE).forEach(i => ITEM[i.id] = i);
const MATTOCKS = [   // spd: dig speed. tier: the deepest dig site tier it can work
  { n: 'Bronze Mattock', tier: 1, spd: 1, col: '#c08a40' },
  { n: 'Iron Mattock', tier: 2, spd: 1.4, col: '#8a919c' },
  { n: 'Steel Mattock', tier: 3, spd: 1.9, col: '#cfd9e6' }];
const BRUSHES = [    // pres: percentage points added to how intact finds are
  { n: 'Brush', pres: 0, spd: 1, col: '#c9a46a' },
  { n: 'Specialty Brush', pres: 14, spd: 1.7, col: '#e8d9a2' }];
const RECIPES = [    // unlocked by finding the artifact named in `unlock` (first find of it)
  { id: 'brush2', kind: 'brush', to: 1, name: 'Specialty Brush', d: 'Finds come up 14% more intact.', cost: { fabric: 3, scrap: 2 }, unlock: 'jug' },
  { id: 'mattock2', kind: 'mattock', to: 1, name: 'Iron Mattock', d: 'Digs faster and opens tier 2 sites.', cost: { nails: 5, boot: 1, scrap: 3 }, unlock: 'bowl' },
  { id: 'mattock3', kind: 'mattock', to: 2, name: 'Steel Mattock', d: 'Digs fastest and opens tier 3 sites.', cost: { nails: 8, boot: 2, fabric: 3, scrap: 5 }, unlock: 'coin' }];
const SITES = [null,   // painted onto the map (SITE layer); a site opens when your mattock tier reaches its tier
  { id: 'meadow', n: 'Meadow Dig', tier: 1, col: '#7a5a3a' },
  { id: 'hillside', n: 'Hillside Dig', tier: 2, col: '#6e5238' },
  { id: 'deep', n: 'Deep Dig', tier: 3, col: '#5e4632' }];
// The character creator only offers these colours: earthy, natural, and all readable against the cream panels and the green grass.
const SKIN = ['#f6d3b3', '#e9b98f', '#d49a6a', '#b57a4a', '#8a5a36', '#5e3b24'];
const HAIRC = ['#2b1d1a', '#4a3022', '#6e4a2c', '#a8512f', '#c2652f', '#d8a24a', '#9a968c', '#d9d2bc'];
const PALETTE = {
  hair: HAIRC, skin: SKIN,
  eyes: ['#513b30', '#7a5a2f', '#3f6f9a', '#4a7a4a', '#6b7480', '#2a2a30'],
  shirt: ['#b4533a', '#d9a441', '#3f6fb0', '#2f8a7a', '#8a3a4a', '#4a4f5c', '#b8905a', '#3f6a3f'],
  jeans: ['#4f6f9a', '#34455f', '#3a3a44', '#6b5a4a', '#8f7a52', '#3f5a3f'],
  boots: ['#a8641e', '#4a3326', '#2a2a30', '#7a2f2a', '#6b6b70', '#5a5a3a']
};

// ---- save state -----------------------------------------------------------
const SAVE_KEY = 'littledig.loop.v1';
function defaultState() {
  return {
    name: 'trent', created: false, look: {}, sound: true, lefty: false, fx: true,
    mats: { nails: 0, boot: 0, fabric: 0, scrap: 0 },   // salvage and scrap
    arts: [],                                            // artifacts you hold: { id, pct }
    col: {},                                             // collection record: id -> { n: found, best: best % intact }
    gear: { mattock: 0, brush: 0 },                      // indexes into MATTOCKS / BRUSHES
    stats: { digs: 0, dry: 0 }
  };
}
let S = defaultState();
function loadState() {
  try {
    if (/[?&]reset/.test(location.search)) { localStorage.removeItem(SAVE_KEY); return; }
    const j = localStorage.getItem(SAVE_KEY);
    if (!j) { const old = JSON.parse(localStorage.getItem('littledig.proto.v1') || 'null'); if (old) { for (const k of ['name', 'created', 'look', 'sound', 'lefty']) if (old[k] !== undefined) S[k] = old[k]; if (/^digger#/.test(S.name)) S.name = 'trent'; } return; }   // a fresh game keeps the name and look from the earlier save
    const o = JSON.parse(j), d = defaultState();
    S = Object.assign(d, o);
    S.mats = Object.assign(d.mats, o.mats || {}); S.gear = Object.assign(d.gear, o.gear || {});
    S.look = Object.assign(d.look, o.look || {});
    S.stats = Object.assign(d.stats, o.stats || {}); if (!Array.isArray(S.arts)) S.arts = []; if (!S.col || typeof S.col !== 'object') S.col = {};
    if (/^digger#/.test(S.name)) S.name = 'trent';   // old auto-generated names
  } catch (e) { }
}
let saveTimer = 0;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }, 400);
}
function badName(n) {
  if (!/^[A-Za-z0-9_.#-]{3,14}$/.test(n)) return 'Use 3-14 letters, numbers, . _ - or #';
  const l = n.toLowerCase();
  for (const w of ['fuck', 'shit', 'nazi', 'rape', 'bitch', 'admin', 'mod_']) if (l.includes(w)) return 'Please pick a different name';
  return '';
}
