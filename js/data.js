'use strict';
// ---- shared helpers -------------------------------------------------------
const $ = s => document.querySelector(s);
const EDIT = /[?&]edit(&|$)/.test(location.search);
// features switched off for now (their code and map data are kept; the editor still shows dig sites): flip to true to bring them back
const FEATURES = { npcs: false, sites: true, fx: false, groundDetail: false, light: true, shadows: false, rim: true };   // fx = day/night tint, rain, clouds, vignette, water ripples, light glows: off so the art is seen exactly as painted; groundDetail = the generated grass tufts, soft tonal patches and tiny flowers on the ground
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
const ARTIFACTS = [   // collectible finds: each one is found with a "% intact" (how well it survived the dig). `art` is its picture in the museum art (assets/museum/pieces.json for a piece of a set, items.json for a whole display item): every ring, jug and arrowhead is a find of its own
  { id: 'jug', art: 'clay_jug', name: 'Clay Jug', r: 0, desc: 'Plain, sturdy, and probably leaked.' },
  { id: 'ancient_bowl', art: 'ancient_bowl', name: 'Ancient Bowl', r: 0, desc: 'Deep enough for soup and a long story.' },
  { id: 'ancient_urn', art: 'ancient_urn', name: 'Ancient Urn', r: 0, desc: 'Holds nothing now, but it holds on.' },
  { id: 'ancient_decorative_vase', art: 'ancient_decorative_vase', name: 'Decorative Vase', r: 0, desc: 'Painted with somebody\'s favourite pattern.' },
  { id: 'clay_token', art: 'clay_token', name: 'Clay Token', r: 0, desc: 'A tally of something. Beans, probably.' },
  { id: 'bone_flute', art: 'bone_flute', name: 'Bone Flute', r: 0, desc: 'Still plays one note. A sad one.' },
  { id: 'serving_plater', art: 'serving_plater', name: 'Serving Platter', r: 0, desc: 'Built for a feast nobody remembers.' },
  { id: 'ancient_tablet', art: 'ancient_tablet', name: 'Stone Tablet', r: 0, desc: 'A shopping list, or a law. Hard to say.' },
  { id: 'ancient_sickle', art: 'ancient_sickle', name: 'Ancient Sickle', r: 0, desc: 'Harvested a great many Tuesdays.' },
  { id: 'decorative_wooden_comb', art: 'decorative_wooden_comb', name: 'Wooden Comb', r: 0, desc: 'Several teeth short of a comb.' },
  { id: 'cylindrical_standing_totem', art: 'cylindrical_standing_totem', name: 'Round Totem', r: 0, desc: 'Tall, round and quietly smug.' },
  { id: 'horned_standing_totem', art: 'horned_standing_totem', name: 'Horned Totem', r: 0, desc: 'Hard to forgive those horns.' },
  { id: 'open_candleholder', art: 'open_candleholder', name: 'Open Candleholder', r: 0, desc: 'Open to suggestions, and candles.' },
  { id: 'caged_candleholder', art: 'caged_candleholder', name: 'Caged Candleholder', r: 0, desc: 'The candle was probably the dangerous one.' },
  { id: 'empty_stand', art: 'empty_stand', name: 'Empty Stands', r: 0, desc: 'Whatever stood on these has left.' },
  { id: 'bowl', art: 'ancient_decorative_bowl', name: 'Decorative Bowl', r: 1, desc: 'Somebody cared how their soup looked.' },
  { id: 'painted_clay_jug', art: 'painted_clay_jug', name: 'Painted Clay Jug', r: 1, desc: 'Painted by hand, then used for water.' },
  { id: 'merchant_scale', art: 'merchant_scale', name: 'Merchant Scale', r: 1, desc: 'Honest, mostly.' },
  { id: 'fancy_broach', art: 'fancy_broach', name: 'Fancy Brooch', r: 1, desc: 'Pinned to someone who mattered.' },
  { id: 'signet_ring', art: 'signet_ring', name: 'Signet Ring', r: 1, desc: 'Sealed a great many letters.' },
  { id: 'mysterious_hat', art: 'mysterious_hat', name: 'Mysterious Hat', r: 1, desc: 'Nobody knows why it is pointed.' },
  { id: 'ceremonial_dagger', art: 'ceremonial_dagger', name: 'Ceremonial Dagger', r: 1, desc: 'For ceremonies, not for cake.' },
  { id: 'ceremonial_cutlass', art: 'ceremonial_cutlass', name: 'Ceremonial Cutlass', r: 1, desc: 'Far too ornate to have seen a fight.' },
  { id: 'small_arrowhead', art: 'small_arrowhead', name: 'Small Arrowhead', r: 1, desc: 'Small, sharp, and decorative at heart.' },
  { id: 'meadium_arrowhead', art: 'meadium_arrowhead', name: 'Medium Arrowhead', r: 1, desc: 'Good for birds, in a pinch.' },
  { id: 'large_arrowhead_2', art: 'large_arrowhead_2', name: 'Large Arrowhead', r: 1, desc: 'Meant for something that was larger.' },
  { id: 'large_arrow_head', art: 'large_arrow_head', name: 'Long Arrowhead', r: 1, desc: 'Longer than it ever needed to be.' },
  { id: 'layer_15_4', art: 'layer_15_4', name: 'Twin Staves', r: 1, desc: 'Two of them. Nobody knows what for.' },
  { id: 'layer_15_5', art: 'layer_15_5', name: 'Staff and Idol', r: 1, desc: 'The idol is not impressed either.' },
  { id: 'bust', art: 'bust', name: 'Marble Bust', r: 1, desc: 'Very serious about its nose.' },
  { id: 'bust_2', art: 'bust_2', name: 'Noble Bust', r: 1, desc: 'Looks like it has opinions on taxes.' },
  { id: 'cerimonial_vase', art: 'cerimonial_vase', name: 'Ceremonial Vase', r: 1, desc: 'Plain, patient, and waiting for flowers.' },
  { id: 'painted_cerimonial_vase', art: 'painted_cerimonial_vase', name: 'Painted Ceremonial Vase', r: 1, desc: 'Painted for an occasion long since over.' },
  { id: 'coin', art: 'ancient_coin', name: 'Stamped Coin', r: 2, desc: 'The stamp is a little crooked.' },
  { id: 'sun_mask', art: 'sun_mask', name: 'Sun Mask', r: 2, desc: 'It smiles like it knows the weather.' },
  { id: 'decorative_thrown', art: 'decorative_thrown', name: 'Decorative Throne', r: 2, desc: 'Not comfortable. Definitely important.' },
  { id: 'emerald_ring', art: 'emerald_ring', name: 'Emerald Ring', r: 2, desc: 'Green as a pond in summer.' },
  { id: 'saphire_ring', art: 'saphire_ring', name: 'Sapphire Ring', r: 2, desc: 'Deep blue, like a good puddle.' },
  { id: 'ruby_ring', art: 'ruby_ring', name: 'Ruby Ring', r: 2, desc: 'Red enough to be a warning.' },
  { id: 'diamond_ring', art: 'diamond_ring', name: 'Diamond Ring', r: 2, desc: 'Sparkles with no help at all.' },
  { id: 'emerald_amulet', art: 'emerald_amulet', name: 'Emerald Amulet', r: 2, desc: 'A green that keeps secrets.' },
  { id: 'saphire_amulet', art: 'saphire_amulet', name: 'Sapphire Amulet', r: 2, desc: 'The blue of a calm lake.' },
  { id: 'ruby_amulet', art: 'ruby_amulet', name: 'Ruby Amulet', r: 2, desc: 'Red and, somehow, still warm.' },
  { id: 'diamond_amulet', art: 'diamond_amulet', name: 'Diamond Amulet', r: 2, desc: 'Clear as a promise.' }];
const ART_BY_R = [0, 1, 2].map(r => ARTIFACTS.filter(a => a.r === r));   // a find first picks its rarity (by dig site tier and depth), then which one of that rarity
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
  { n: 'Brush', pres: 0, spd: 1, wide: 1, col: '#c9a46a' },
  { n: 'Specialty Brush', pres: 14, spd: 1.7, wide: 1.25, col: '#e8d9a2' }];
const BAG_BASE = 6;   // inventory slots you start with. Each artifact you hold takes a slot, and each kind of salvage takes one slot however many you carry
const BAGS = [        // backpack upgrades sold by the merchant, bought in order; `add` slots on top of the one before
  { n: 'Satchel', add: 4, cost: 40, d: '+4 inventory slots' },
  { n: 'Rucksack', add: 8, cost: 120, d: '+8 inventory slots' }];
const bagCap = () => BAG_BASE + BAGS.slice(0, S.bag | 0).reduce((a, b) => a + b.add, 0);
const bagUsed = () => S.arts.length + Object.keys(S.mats).filter(k => (S.mats[k] | 0) > 0).length;
const bagFits = id => bagUsed() < bagCap() || (id in S.mats && (S.mats[id] | 0) > 0);   // room for one more of this: a new artifact or a new kind of salvage needs a free slot; more of a salvage you already carry does not
const SELL_ART = [6, 20, 50];   // what the merchant pays for an artifact by rarity, scaled by how intact it is
const sellArt = a => Math.max(1, Math.round(SELL_ART[ITEM[a.id].r] * (0.4 + 0.6 * a.pct / 100)));
const BUY_MAT = { nails: 5, fabric: 6, boot: 10, scrap: 8 }, SELL_MAT = { nails: 2, fabric: 3, boot: 5, scrap: 4 };   // general supplies: what one costs, and what the merchant pays for one
const RECIPES = [    // unlocked by finding the artifact named in `unlock` (first find of it)
  { id: 'brush2', kind: 'brush', to: 1, name: 'Specialty Brush', d: 'Finds come up 14% more intact.', cost: { fabric: 3, scrap: 2 }, unlock: 'jug' },
  { id: 'mattock2', kind: 'mattock', to: 1, name: 'Iron Mattock', d: 'Digs faster and opens tier 2 sites.', cost: { nails: 5, boot: 1, scrap: 3 }, unlock: 'bowl' },
  { id: 'mattock3', kind: 'mattock', to: 2, name: 'Steel Mattock', d: 'Digs fastest and opens tier 3 sites.', cost: { nails: 8, boot: 2, fabric: 3, scrap: 5 }, unlock: 'coin' }];
const SITES = [{ id: 'wild', n: 'Open ground', tier: 0 },   // 0 = ordinary ground: you can dig almost anywhere, but only the marked sites below (painted onto the map, SITE layer) have good odds; a site opens when your mattock tier reaches its tier
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
    name: 'trent', created: false, look: {}, sound: true, lefty: false, fx: true, light: true, objShadow: false, rim: true,
    mats: { nails: 0, boot: 0, fabric: 0, scrap: 0 },   // salvage and scrap
    arts: [],                                            // artifacts you hold: { id, pct }
    col: {},                                             // collection record: id -> { n: found, best: best % intact }
    gear: { mattock: 0, brush: 0 },                      // indexes into MATTOCKS / BRUSHES
    stats: { digs: 0, dry: 0 },
    coins: 0,                                            // money, from selling finds to the merchant
    bag: 0                                               // how many backpack upgrades you own (index into BAGS)
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
    S.coins = Math.max(0, o.coins | 0); S.bag = clamp(o.bag | 0, 0, BAGS.length);
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
