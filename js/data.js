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
const CATS = [{ id: 'fish', n: 'Relics' }, { id: 'beach', n: 'Surface finds' }];
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

// dig sites: painted onto the map (SITE layer), fixed for everybody, each one unlocks at a player level
const SITES = [null,
  { id: 'dunes', n: 'Desert Dunes', lv: 1, col: '#e0b060' },
  { id: 'ruins', n: 'Temple Ruins', lv: 5, col: '#b0a48e' },
  { id: 'jungle', n: 'Jungle Dig', lv: 10, col: '#5fa04a' },
  { id: 'tomb', n: 'Sunken Tomb', lv: 15, col: '#7a64b0' }];
const WH = { dunes: 'desert dunes dig sites', ruins: 'temple ruins dig sites', jungle: 'jungle dig sites', tomb: 'tomb dig sites', tree: 'fruit trees', bush: 'berry bushes' };
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
    { n: 'Hand Trowel', rng: 22, cost: 0, lv: 1, spd: 1, luck: 0, d: 'Basic. Shallow digs.' },
    { n: 'Mason Pick', rng: 34, cost: 80, lv: 2, spd: 1.3, luck: 0.6, d: 'Quicker strikes, deeper digs.' },
    { n: 'Steel Pick', rng: 48, cost: 320, lv: 6, spd: 1.7, luck: 1.4, d: 'Fast, deep, and good at finding rare relics.' },
    { n: 'Golden Pick', rng: 64, cost: 1300, lv: 12, spd: 2.2, luck: 2.4, d: 'Reaches the deepest layers.' }],
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
const TOOL_LABEL = { rod: 'Pick', net: 'Bug Net', shovel: 'Shovel', bag: 'Bag' };
// ---- dealer / equipment catalogue ---------------------------------------------------
const GEAR = {
  reel: [{ n: 'Soft Brush', d: 'Brush clean 12% faster.', cost: 100, lv: 1, v: 0.12 }, { n: 'Fine Brush', d: 'Brush clean 25% faster.', cost: 380, lv: 6, v: 0.25 }, { n: 'Gilded Brush', d: 'Brush clean 40% faster.', cost: 1400, lv: 14, v: 0.4 }],
  line: [{ n: 'Padded Gloves', d: 'Finds crack 25% slower.', cost: 60, lv: 2, v: 0.25 }, { n: 'Archivist Gloves', d: 'Finds crack 50% slower.', cost: 260, lv: 7, v: 0.5 }, { n: 'Silk Gloves', d: 'Finds barely crack at all.', cost: 900, lv: 15, v: 0.75 }]
};
const BOBBERS = [
  { id: 'cork', n: 'Survey Flag', d: 'A longer window to spot a find.', cost: 90, lv: 3, col: '#e8483a', win: 0.5 },
  { id: 'feather', n: 'Camel-hair Brush', d: 'Longer window and a steadier brush.', cost: 160, lv: 5, col: '#78bfff', win: 0.3, decay: 0.6 },
  { id: 'spinner', n: 'Metal Detector', d: 'Finds turn up 15% sooner.', cost: 220, lv: 3, col: '#c8d0d8', wait: 0.85 },
  { id: 'lead', n: 'Foam Padding', d: 'The brush bar barely drops.', cost: 200, lv: 6, col: '#7c8290', decay: 0.4 }];
const BAITS = [
  { id: 'worm', n: 'Test Probes', d: 'Finds turn up 25% sooner.', cost: 25, qty: 20, lv: 1, col: '#d88a8a', wait: 0.75, luck: 0 },
  { id: 'glow', n: 'Soil Samples', d: 'Sooner and luckier.', cost: 90, qty: 20, lv: 7, col: '#8fe09a', wait: 0.65, luck: 0.6 },
  { id: 'deluxe', n: 'Survey Maps', d: 'Far sooner, luckier.', cost: 260, qty: 20, lv: 14, col: '#4a7ad8', wait: 0.55, luck: 1.1 },
  { id: 'magic', n: 'Old Treasure Map', d: 'Very lucky. Legends come easier.', cost: 640, qty: 20, lv: 20, col: '#a98af0', wait: 0.5, luck: 1.8 }];
const GEARS = [
  { id: 'sandals', n: 'Sandals', d: 'Walk 8% faster.', cost: 150, lv: 2 }, { id: 'glove', n: 'Digging Gloves', d: 'Dig a little deeper.', cost: 200, lv: 3 },
  { id: 'wrist', n: 'Quick Wristband', d: '+0.3 s to spot a find.', cost: 220, lv: 4 }, { id: 'coin', n: 'Lucky Coin', d: 'Relics sell for 5% more.', cost: 300, lv: 5 },
  { id: 'finder', n: 'Field Lens', d: 'The "!" shows the find\'s rarity.', cost: 400, lv: 6 }];
const BOOSTS = [
  { id: 'lucky', n: 'Lucky Hour', d: '30 minutes of rarer finds.', gem: 20, min: 30 }, { id: 'quick', n: 'Sharp Eyes', d: '30 minutes: finds turn up sooner.', gem: 20, min: 30 },
  { id: 'slots', n: 'Extra Display Cases', d: '+3 museum case slots, forever.', gem: 60, once: true }];
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
  { n: 'Lantern Hat', gem: 90, col: '#f2b84b' }, { n: 'Lucky Probe (30 min)', gem: 30, col: '#8fe09a' }];
const SKIN = ['#f6d3b3', '#e9b98f', '#d49a6a', '#b57a4a', '#8a5a36', '#5e3b24'];
const HAIRC = ['#2b1d1a', '#5a3a22', '#8a5a2f', '#d8a24a', '#e8d27a', '#c2442f', '#6f5ad8', '#e86fa8'];
const SHIRTC = ['#d8604a', '#e8a23a', '#8fbf4a', '#4aa8a0', '#4a7ad8', '#8a5ad8', '#e86fa8', '#e8e0d0'];
const HAIRS = ['Messy', 'None'];
const BUILDS = ['Girl', 'Boy', 'Nonbinary'];

const ONB = [
  { txt: 'Dig up a relic', ev: 'fish', need: 1, hint: 'Find a roped-off dig site. Stand at its edge and hold the button.' },
  { txt: 'Shake a fruit tree', ev: 'tree', need: 1, hint: 'Find a fruit tree and press the button.' },
  { txt: 'Pick some berries', ev: 'bush', need: 1, hint: 'Berry bushes are scattered around camp.' },
  { txt: 'Net a butterfly', ev: 'bug', need: 1, hint: 'Look for flower patches with butterflies.' },
  { txt: 'Dig up something on the sand', ev: 'beach', need: 1, hint: 'Poke at seaweed, shells and driftwood on the sand.' },
  { txt: 'Sell your finds at the market', ev: 'sell', need: 1, hint: 'The market stall is west of the fountain.' }
];
const NOTES = [
  'Welcome to camp! Stand at the edge of a dig site and HOLD the button to charge your swing. Release to strike. Stronger swings dig deeper and turn up rarer relics.',
  'When you hear a clink, press to uncover it, then brush carefully. Keep the green bar on the relic or it will crack!',
  'Press the button at a fruit tree to shake it, then catch the falling fruit in your basket. Trees grow their fruit back after a little while.',
  'Your bag fills up fast. Sell at the market stall just west of the fountain. The antiquities dealer buys relics.',
  'Butterflies by day, moths by night. Wait for one to land, then swing your net.',
  'Poke at seaweed, shells and driftwood on the beach. You never know what is buried.',
  'Level up to design your character. Hats and tops are sold at the market stall.',
  'Different dig sites hold different eras: dunes, temple ruins, the jungle and the tombs. Some finds only turn up at night.'
];
function curQuest() { return S.quest < ONB.length ? ONB[S.quest] : { txt: 'Collect 10 things', ev: 'any', need: 10, hint: 'Keep exploring. Everything counts.', loop: true }; }
const needXP = lv => 45 + (lv - 1) * 40;

// ---- save state -----------------------------------------------------------
const SAVE_KEY = 'littledig.proto.v1';
function defaultState() {
  return {
    gold: 0, xp: 0, lv: 1, bag: [], book: {}, tools: { rod: 0, net: 0, shovel: 0, bag: 0 },
    look: { b: 1, hair: 0, hc: 1, skin: 1, shirt: 4, style: 0, hat: 0, pc: 0 },
    name: 'digger#' + (1000 + Math.floor(Math.random() * 9000)), created: false,
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
