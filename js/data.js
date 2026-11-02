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
const CATS = [{ id: 'fish', n: 'Fish' }, { id: 'forage', n: 'Forage' }, { id: 'bug', n: 'Bugs' }, { id: 'beach', n: 'Beach' }];
const ITEMS = [], ITEM = {};
function add(cat, id, name, r, v, sz, cols, shape, o) {
  o = o || {};
  const it = { id, cat, name, r, v, sz, cols, shape, where: o.where || null, time: o.time || 'any', desc: o.desc || '', junk: !!o.junk };
  ITEMS.push(it); ITEM[id] = it;
}
// fish
add('fish', 'minnow', 'Minnow', 0, 5, [4, 8], ['#9db8c9', '#6c8ea6'], 'fish', { where: ['pond', 'sea'], desc: 'Mostly a snack for bigger fish.' });
add('fish', 'sardine', 'Sardine', 0, 6, [10, 16], ['#b9c9d8', '#6f8aa3'], 'fish', { where: ['sea', 'deep'], desc: 'Travels in a crowd, caught alone.' });
add('fish', 'bluegill', 'Bluegill', 0, 9, [12, 24], ['#5f8fb8', '#e0894a'], 'fish', { where: ['pond'], desc: 'Has strong opinions about worms.' });
add('fish', 'perch', 'Perch', 0, 10, [15, 30], ['#7ea34f', '#e0a34a'], 'fish', { where: ['pond'], desc: 'Stripes for a very serious look.' });
add('fish', 'boot', 'Old Boot', 0, 1, null, ['#7a5a3a', '#4d3825'], 'boot', { where: ['pond', 'sea'], junk: true, desc: 'Left foot. Someone is missing it.' });
add('fish', 'carp', 'Carp', 1, 18, [30, 70], ['#c28b48', '#e8c27a'], 'fish', { where: ['pond'], desc: 'Looks permanently unimpressed.' });
add('fish', 'mackerel', 'Mackerel', 1, 20, [25, 45], ['#4f86a8', '#8fc2d9'], 'fish', { where: ['sea', 'deep'], desc: 'Fast, shiny, and a little smug.' });
add('fish', 'trout', 'Trout', 1, 30, [25, 50], ['#8fa86a', '#e8a0a0'], 'fish', { where: ['pond'], desc: 'Likes cool, quiet water.' });
add('fish', 'snapper', 'Red Snapper', 1, 34, [30, 60], ['#d9584a', '#f0a090'], 'fish', { where: ['sea', 'deep'], desc: 'Blushes when you look at it.' });
add('fish', 'catfish', 'Catfish', 1, 28, [40, 90], ['#6b6b72', '#a0a0a8'], 'fish', { where: ['pond'], time: 'night', desc: 'Only comes out when it is dark.' });
add('fish', 'koi', 'Koi', 2, 90, [35, 80], ['#f0f0e8', '#e8643c'], 'fish', { where: ['pond'], desc: 'Rumored to be lucky.' });
add('fish', 'pike', 'Pike', 2, 70, [60, 110], ['#5d7a3a', '#c8d070'], 'fish', { where: ['pond'], desc: 'All teeth, no small talk.' });
add('fish', 'tuna', 'Bluefin Tuna', 2, 110, [80, 180], ['#2f5f9a', '#b8c8d8'], 'fish', { where: ['deep'], desc: 'Built like a torpedo.' });
add('fish', 'lanternfish', 'Lanternfish', 2, 120, [10, 20], ['#2a3a5a', '#ffe08a'], 'fish', { where: ['deep'], time: 'night', desc: 'Carries its own tiny lamp.' });
add('fish', 'moonfin', 'Moonfin', 2, 100, [20, 40], ['#b8c8f0', '#f0f4ff'], 'fish', { where: ['sea', 'deep'], time: 'night', desc: 'Glows a little under moonlight.' });
add('fish', 'goldkoi', 'Golden Koi', 3, 400, [40, 70], ['#ffc83c', '#fff0a0'], 'fish', { where: ['pond'], desc: 'People will ask you about this one.' });
add('fish', 'mola', 'Sunfish', 3, 600, [150, 300], ['#9aa8b8', '#d0d8e0'], 'fish', { where: ['deep'], desc: 'Mostly head. Mostly napping.' });
// cave fish (only bite in cave pools)
add('fish', 'cavefish', 'Blind Cavefish', 0, 12, [6, 12], ['#d8c8c0', '#b89a90'], 'fish', { where: ['cave'], desc: 'Has never seen the sun.' });
add('fish', 'cavetetra', 'Pale Tetra', 0, 14, [4, 9], ['#e8e0f0', '#a89ac0'], 'fish', { where: ['cave'], desc: 'Nearly see-through.' });
add('fish', 'glowfin', 'Glowfin', 1, 42, [10, 22], ['#7affc8', '#2f8f86'], 'fish', { where: ['cave'], desc: 'Lights the way home.' });
add('fish', 'crystaleel', 'Crystal Eel', 2, 130, [60, 140], ['#a8e8ff', '#78bfff'], 'fish', { where: ['cave'], desc: 'Sparkles when it swims.' });
add('fish', 'ghostfin', 'Ghostfin', 2, 150, [20, 40], ['#e8f0ff', '#9ab0e0'], 'fish', { where: ['cave'], desc: 'You are not sure it was there.' });
add('fish', 'emberpike', 'Ember Pike', 3, 520, [80, 140], ['#f06a3a', '#ffd23f'], 'fish', { where: ['cave'], desc: 'Warm to the touch. Do not ask why.' });
// forage
add('forage', 'apple', 'Apple', 0, 4, null, ['#d8402f', '#5c8f3a'], 'fruit', { where: ['tree'], desc: 'Crisp and a little tart.' });
add('forage', 'orange', 'Orange', 0, 5, null, ['#f08a2a', '#5c8f3a'], 'fruit', { where: ['tree'], desc: 'Sunshine with a peel.' });
add('forage', 'pear', 'Pear', 0, 4, null, ['#b8c84a', '#5c8f3a'], 'fruit', { where: ['tree'], desc: 'Soft, sweet, and easily bruised.' });
add('forage', 'plum', 'Plum', 0, 5, null, ['#7a3f8a', '#5c8f3a'], 'fruit', { where: ['tree'], desc: 'Dusty purple and very juicy.' });
add('forage', 'acorn', 'Acorn', 0, 2, null, ['#a8743a', '#6b4423'], 'acorn', { where: ['tree'], desc: 'Squirrels are watching you.' });
add('forage', 'branch', 'Fallen Branch', 0, 3, null, ['#8a5f3a', '#6b4423'], 'branch', { where: ['tree'], desc: 'A good walking stick, probably.' });
add('forage', 'fig', 'Fig', 1, 9, null, ['#6b3f5f', '#5c8f3a'], 'fruit', { where: ['tree'], desc: 'Fancy fruit, honestly.' });
add('forage', 'nest', 'Bird Nest', 2, 45, null, ['#b89a5a', '#7a6232'], 'nest', { where: ['tree'], desc: 'Empty, thankfully. Very cozy.' });
add('forage', 'goldapple', 'Golden Apple', 3, 150, null, ['#ffd23f', '#5c8f3a'], 'fruit', { where: ['tree'], desc: 'Heavier than it looks.' });
add('forage', 'blueberry', 'Blueberry', 0, 3, null, ['#4a5fc0', '#5c8f3a'], 'berry', { where: ['bush'], desc: 'Tiny and very blue.' });
add('forage', 'raspberry', 'Raspberry', 0, 4, null, ['#d8305f', '#5c8f3a'], 'berry', { where: ['bush'], desc: 'Falls apart if you stare at it.' });
add('forage', 'blackberry', 'Blackberry', 0, 4, null, ['#3a2a4a', '#5c8f3a'], 'berry', { where: ['bush'], desc: 'Stains your fingers purple.' });
add('forage', 'elderberry', 'Elderberry', 1, 8, null, ['#5a3a7a', '#5c8f3a'], 'berry', { where: ['bush'], desc: 'Dark, tangy, and good in jam.' });
add('forage', 'glowberry', 'Glowberry', 2, 60, null, ['#7affc8', '#3a9a7a'], 'berry', { where: ['bush'], desc: 'Glows faintly. Tastes like mint. Found at night or in rain.' });
// bugs
add('bug', 'cabbage', 'Cabbage White', 0, 5, [2, 5], ['#f4f4ee', '#c8c8c0'], 'bug', { time: 'day', desc: 'Plain, polite, everywhere.' });
add('bug', 'sulphur', 'Sulphur', 0, 6, [3, 6], ['#f0dc4a', '#d0b030'], 'bug', { time: 'day', desc: 'A small yellow flicker.' });
add('bug', 'hawkmoth', 'Hawk Moth', 0, 8, [4, 9], ['#b8a080', '#8a7050'], 'bug', { time: 'night', desc: 'Hovers like a tiny hummingbird.' });
add('bug', 'monarch', 'Monarch', 1, 16, [8, 12], ['#f08a2a', '#2a2020'], 'bug', { time: 'day', desc: 'Has traveled farther than you.' });
add('bug', 'swallowtail', 'Swallowtail', 1, 20, [7, 11], ['#f4e060', '#2a2a30'], 'bug', { time: 'day', desc: 'Comes with its own little tails.' });
add('bug', 'luna', 'Luna Moth', 1, 40, [8, 12], ['#a8e8a0', '#6ac070'], 'bug', { time: 'night', desc: 'Pale green and silent.' });
add('bug', 'morpho', 'Blue Morpho', 2, 80, [8, 14], ['#3a8cf0', '#1a3a8a'], 'bug', { time: 'day', desc: 'Flashes electric blue in the sun.' });
add('bug', 'sunsetmoth', 'Sunset Moth', 2, 90, [6, 10], ['#f06a3a', '#f0c83a'], 'bug', { time: 'day', desc: 'Looks painted by a sunset.' });
add('bug', 'emperor', 'Purple Emperor', 3, 300, [7, 10], ['#8a5ad8', '#3a2a6a'], 'bug', { time: 'day', desc: 'Rules the meadow, apparently.' });
add('bug', 'ghostmoth', 'Ghost Moth', 3, 350, [6, 10], ['#e8f0ff', '#9ab0e0'], 'bug', { time: 'night', desc: 'Probably not a ghost.' });
// beach
add('beach', 'cockle', 'Cockle Shell', 0, 3, [2, 5], ['#e8d8b8', '#c8b088'], 'shell', { desc: 'Ridged and ordinary. Still nice.' });
add('beach', 'scallop', 'Scallop', 0, 4, [3, 8], ['#f0b8a0', '#d88a70'], 'shell', { desc: 'A tiny fan of pink.' });
add('beach', 'hermit', 'Hermit Crab', 0, 7, [2, 6], ['#d8784a', '#f0c8a0'], 'crab', { desc: 'Politely asks you to leave.' });
add('beach', 'glass', 'Sea Glass', 0, 5, [1, 4], ['#7fd8b0', '#b8f0d8'], 'glass', { desc: 'Frosted by years of waves.' });
add('beach', 'driftwood', 'Driftwood', 0, 3, [10, 40], ['#a8825a', '#c8a47a'], 'wood', { desc: 'Silver and smooth.' });
add('beach', 'starfish', 'Starfish', 1, 15, [5, 15], ['#f08a4a', '#f8c8a0'], 'star', { desc: 'Five arms, zero rush.' });
add('beach', 'sanddollar', 'Sand Dollar', 1, 12, [4, 9], ['#f4ecd8', '#d0c4a8'], 'dollar', { desc: 'Spent by the sea.' });
add('beach', 'conch', 'Conch', 1, 14, [8, 20], ['#f0a888', '#f8e0d0'], 'conch', { desc: 'Hold it up. You can hear the island.' });
add('beach', 'oldcoin', 'Old Coin', 1, 25, [2, 4], ['#c8a43a', '#f0d878'], 'coin', { desc: 'Nobody remembers whose face this is.' });
add('beach', 'blueglass', 'Blue Sea Glass', 1, 18, [1, 4], ['#4a9ae8', '#a8d4f8'], 'glass', { desc: 'Rarer than green. Prettier too.' });
add('beach', 'bottle', 'Message Bottle', 2, 55, [15, 28], ['#8ad0c0', '#e8e0c0'], 'bottle', { desc: 'The note says: "hi". That is all.' });
add('beach', 'redglass', 'Red Sea Glass', 2, 90, [1, 4], ['#e0453a', '#f8a098'], 'glass', { desc: 'Very rare. Very shiny.' });
add('beach', 'pearl', 'Pearl', 2, 120, [1, 3], ['#f8f4ec', '#d8d0e8'], 'pearl', { desc: 'Smooth and quietly proud.' });
add('beach', 'relic', 'Ancient Relic', 3, 500, [8, 16], ['#6fb8a0', '#c8a43a'], 'relic', { desc: 'Older than the first lamp post. Probably.' });

const WH = { cave: 'cave pools', pond: 'the pond', sea: 'the shoreline', deep: 'deep water off the pier', tree: 'fruit trees', bush: 'berry bushes' };
function whereText(it) {
  let s;
  if (it.cat === 'bug') s = 'Flower patches';
  else if (it.cat === 'beach') s = 'Digging at the beach';
  else s = it.where ? it.where.map(w => WH[w]).join(' & ') : 'Somewhere';
  s = s[0].toUpperCase() + s.slice(1);
  if (it.time === 'night') s += ' - at night';
  if (it.time === 'day') s += ' - by day';
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
    { n: 'Twig Rod', rng: 22, cost: 0, lv: 1, spd: 1, luck: 0, d: 'Basic. Short casts.' },
    { n: 'Bamboo Rod', rng: 34, cost: 80, lv: 2, spd: 1.3, luck: 0.6, d: 'Faster bites, longer casts.' },
    { n: 'Glass Rod', rng: 48, cost: 320, lv: 6, spd: 1.7, luck: 1.4, d: 'Quick bites, long casts, rarer fish.' },
    { n: 'Golden Rod', rng: 64, cost: 1300, lv: 12, spd: 2.2, luck: 2.4, d: 'Casts clear across the water.' }],
  net: [
    { n: 'Hand Net', cost: 0, fly: 0.45, luck: 0, d: 'Okay if they sit still.' },
    { n: 'Bamboo Net', cost: 70, lv: 2, fly: 0.6, luck: 0.6, d: 'Wider hoop, better reach.' },
    { n: 'Silk Net', cost: 300, lv: 5, fly: 0.78, luck: 1.4, d: 'Catches most fliers.' },
    { n: 'Moon Net', cost: 1200, lv: 10, fly: 0.95, luck: 2.4, d: 'Almost never misses.' }],
  shovel: [
    { n: 'Wooden Shovel', cost: 0, spd: 1, luck: 0, d: 'Slow but honest.' },
    { n: 'Iron Shovel', cost: 90, lv: 2, spd: 1.3, luck: 0.6, d: 'Digs faster, finds more.' },
    { n: 'Steel Shovel', cost: 340, lv: 5, spd: 1.6, luck: 1.4, d: 'Quick work, rarer finds.' },
    { n: 'Gilded Shovel', cost: 1400, lv: 10, spd: 2, luck: 2.4, d: 'Treasure seems to find you.' }],
  bag: [
    { n: 'Pocket', cost: 0, cap: 8, d: 'Holds 8 things.' },
    { n: 'Satchel', cost: 60, lv: 1, cap: 14, d: 'Holds 14 things.' },
    { n: 'Backpack', cost: 240, lv: 3, cap: 22, d: 'Holds 22 things.' },
    { n: 'Big Pack', cost: 800, lv: 8, cap: 34, d: 'Holds 34 things.' }]
};
const TOOL_LABEL = { rod: 'Fishing Rod', net: 'Bug Net', shovel: 'Shovel', bag: 'Bag' };
// ---- fishing shop catalogue ---------------------------------------------------
const GEAR = {
  reel: [{ n: 'Brass Reel', d: 'Reel in 12% faster.', cost: 100, lv: 1, v: 0.12 }, { n: 'Steel Reel', d: 'Reel in 25% faster.', cost: 380, lv: 6, v: 0.25 }, { n: 'Gold Reel', d: 'Reel in 40% faster.', cost: 1400, lv: 14, v: 0.4 }],
  line: [{ n: 'Nylon Line', d: 'Fish slip away 25% slower.', cost: 60, lv: 2, v: 0.25 }, { n: 'Braided Line', d: 'Fish slip away 50% slower.', cost: 260, lv: 7, v: 0.5 }, { n: 'Silk Line', d: 'Fish barely slip away.', cost: 900, lv: 15, v: 0.75 }]
};
const BOBBERS = [
  { id: 'cork', n: 'Cork Bobber', d: 'A longer window to hook a bite.', cost: 90, lv: 3, col: '#e8483a', win: 0.5 },
  { id: 'feather', n: 'Feather Float', d: 'Longer window and a steadier reel.', cost: 160, lv: 5, col: '#78bfff', win: 0.3, decay: 0.6 },
  { id: 'spinner', n: 'Spinner', d: 'Bites 15% sooner.', cost: 220, lv: 3, col: '#c8d0d8', wait: 0.85 },
  { id: 'lead', n: 'Lead Bobber', d: 'The reel bar barely drops.', cost: 200, lv: 6, col: '#7c8290', decay: 0.4 }];
const BAITS = [
  { id: 'worm', n: 'Worms', d: 'Bites 25% sooner.', cost: 25, qty: 20, lv: 1, col: '#d88a8a', wait: 0.75, luck: 0 },
  { id: 'glow', n: 'Glow Worms', d: 'Sooner and luckier.', cost: 90, qty: 20, lv: 7, col: '#8fe09a', wait: 0.65, luck: 0.6 },
  { id: 'deluxe', n: 'Deluxe Bait', d: 'Far sooner, luckier.', cost: 260, qty: 20, lv: 14, col: '#4a7ad8', wait: 0.55, luck: 1.1 },
  { id: 'magic', n: 'Magic Bait', d: 'Very lucky. Legends come easier.', cost: 640, qty: 20, lv: 20, col: '#a98af0', wait: 0.5, luck: 1.8 }];
const GEARS = [
  { id: 'sandals', n: 'Sandals', d: 'Walk 8% faster.', cost: 150, lv: 2 }, { id: 'glove', n: 'Casting Glove', d: 'Cast a little farther.', cost: 200, lv: 3 },
  { id: 'wrist', n: 'Quick Wristband', d: '+0.3 s to hook a bite.', cost: 220, lv: 4 }, { id: 'coin', n: 'Lucky Coin', d: 'Fish sell for 5% more.', cost: 300, lv: 5 },
  { id: 'finder', n: 'Fish Finder', d: 'The "!" shows the bite\'s rarity.', cost: 400, lv: 6 }];
const BOOSTS = [
  { id: 'lucky', n: 'Lucky Hour', d: '30 minutes of rarer catches.', gem: 20, min: 30 }, { id: 'quick', n: 'Quick Bites', d: '30 minutes: fish bite sooner.', gem: 20, min: 30 },
  { id: 'slots', n: 'Extra Tank Slots', d: '+3 fish tank slots, forever.', gem: 60, once: true }];
// placeholder outfits: they recolour the existing hat and top pieces until real outfit art exists
const OUTFITS = [
  { id: 'wbh', n: 'White Bucket Hat', slot: 'hat', hat: 1, col: '#f4f1e8', r: 1, gem: 200 }, { id: 'rbh', n: 'Red Bucket Hat', slot: 'hat', hat: 1, col: '#c2442f', r: 1, gem: 200 },
  { id: 'nbn', n: 'Navy Beanie', slot: 'hat', hat: 2, col: '#2f4f8a', r: 1, gem: 200 }, { id: 'gbn', n: 'Moss Beanie', slot: 'hat', hat: 2, col: '#4f8a38', r: 1, gem: 200 },
  { id: 'sun', n: 'Sunny Straw Hat', slot: 'hat', hat: 3, col: '#f0d27a', r: 1, gem: 200 }, { id: 'pst', n: 'Rose Straw Hat', slot: 'hat', hat: 3, col: '#e8a0b8', r: 2, gem: 300 },
  { id: 'bhd', n: 'Black Hoodie', slot: 'top', style: 1, col: '#2f2f3a', r: 2, gem: 300 }, { id: 'phd', n: 'Pink Hoodie', slot: 'top', style: 1, col: '#e86fa8', r: 2, gem: 300 },
  { id: 'yov', n: 'Yellow Overalls', slot: 'top', style: 2, col: '#e8c24a', r: 2, gem: 300 }, { id: 'tov', n: 'Teal Overalls', slot: 'top', style: 2, col: '#4aa8a0', r: 2, gem: 300 },
  { id: 'cap', n: 'Captain Coat', slot: 'top', style: 1, col: '#1f3a6a', r: 3, gem: 1200 }, { id: 'lcr', n: 'Gilded Straw Hat', slot: 'hat', hat: 3, col: '#ffd23f', r: 3, gem: 1200 }];
function dailyOutfits() { // three outfits that swap at local midnight
  const d = new Date(), seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(), r = rng(seed * 7 + 3), pool = OUTFITS.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out = [pool.find(o => o.r === 1), pool.find(o => o.r === 2), pool.find(o => o.r === 3)]; return out;
}
function msToMidnight() { const d = new Date(), n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); return n - d; }
const HATS = [{ id: 0, n: 'No hat', cost: 0 }, { id: 1, n: 'Bucket Hat', cost: 40 }, { id: 2, n: 'Beanie', cost: 60 }, { id: 3, n: 'Straw Hat', cost: 90 }];
const STYLES = [{ id: 0, n: 'Tee', cost: 0 }, { id: 1, n: 'Hoodie', cost: 80 }, { id: 2, n: 'Overalls', cost: 120 }];
const PREMIUM = [
  { n: 'Moonlit Cloak', gem: 120, col: '#6f7fd8' }, { n: 'Koi Kimono', gem: 180, col: '#e8643c' },
  { n: 'Lantern Hat', gem: 90, col: '#f2b84b' }, { n: 'Lucky Bait (30 min)', gem: 30, col: '#8fe09a' }];
const SKIN = ['#f6d3b3', '#e9b98f', '#d49a6a', '#b57a4a', '#8a5a36', '#5e3b24'];
const HAIRC = ['#2b1d1a', '#5a3a22', '#8a5a2f', '#d8a24a', '#e8d27a', '#c2442f', '#6f5ad8', '#e86fa8'];
const SHIRTC = ['#d8604a', '#e8a23a', '#8fbf4a', '#4aa8a0', '#4a7ad8', '#8a5ad8', '#e86fa8', '#e8e0d0'];
const HAIRS = ['Messy', 'None'];
const BUILDS = ['Girl', 'Boy', 'Nonbinary'];

const ONB = [
  { txt: 'Catch a fish', ev: 'fish', need: 1, hint: 'Walk to the water. The button shows a rod.' },
  { txt: 'Shake a fruit tree', ev: 'tree', need: 1, hint: 'Find a fruit tree and hold the button.' },
  { txt: 'Pick some berries', ev: 'bush', need: 1, hint: 'Berry bushes are scattered around the island.' },
  { txt: 'Net a butterfly', ev: 'bug', need: 1, hint: 'Look for flower patches with butterflies.' },
  { txt: 'Dig up something at the beach', ev: 'beach', need: 1, hint: 'Poke at seaweed, shells and driftwood on the sand.' },
  { txt: 'Sell your haul at the stall', ev: 'sell', need: 1, hint: 'The market stall is west of the fountain.' }
];
const NOTES = [
  'Welcome to the island! Hold the rod button to charge a cast, release to throw. When the bobber dips, press again, then keep the green bar on the fish.',
  'Bigger fish live in deeper water. Try the far end of the pier, or the pond out east.',
  'Press the button at a fruit tree to shake it, then catch the falling fruit in your basket. Trees grow their fruit back after a little while.',
  'Your bag fills up fast. Sell at the market stall just west of the fountain.',
  'Butterflies by day, moths by night. Wait for one to land, then swing your net.',
  'Poke at seaweed, shells and driftwood on the beach. You never know what is buried.',
  'Level up to design your character. Hats and tops are sold at the market stall.',
  'The island follows your real clock. Some fish and moths only come out at night, or in the rain.'
];
function curQuest() { return S.quest < ONB.length ? ONB[S.quest] : { txt: 'Collect 10 things', ev: 'any', need: 10, hint: 'Keep exploring. Everything counts.', loop: true }; }
const needXP = lv => 45 + (lv - 1) * 40;

// ---- save state -----------------------------------------------------------
const SAVE_KEY = 'littleisland.proto.v1';
function defaultState() {
  return {
    gold: 0, xp: 0, lv: 1, bag: [], book: {}, tools: { rod: 0, net: 0, shovel: 0, bag: 0 },
    look: { b: 1, hair: 0, hc: 1, skin: 1, shirt: 4, style: 0, hat: 0, pc: 0 },
    name: 'fisher#' + (1000 + Math.floor(Math.random() * 9000)), created: false,
    owned: { hat: [0], style: [0] }, quest: 0, qprog: 0, stats: { fish: 0, total: 0, earned: 0, big: null, rare: null }, notes: [], sound: true, lefty: false, fx: true,
    gems: 0, tank: [], tankSlots: 6, bait: {}, baitSel: null, gear: { reel: 0, line: 0 }, bobbers: [], bobberSel: null, gearOwned: [], boosts: {}, outfits: []
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
    S.owned = Object.assign(d.owned, o.owned || {});
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
