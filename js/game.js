'use strict';
const cv = $('#game'), g = cv.getContext('2d');
let VW = 390, VH = 800, Z = 2, DPR = 1;
const cam = { x: 0, y: 0 };
const DV = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const qs = new URLSearchParams(location.search);
let AREA = 'island', fading = false;
let ME = null, NPCS = [], A = null, held = false, target = null, autoWalk = null, tOff = 0, timeNow = 0;
const PT = [], FL = [], RP = [];
if (qs.has('hour')) { const d = new Date(); tOff = parseFloat(qs.get('hour')) - (d.getHours() + d.getMinutes() / 60); }

// ---- time, weather --------------------------------------------------------
function hourNow() { const d = new Date(); return (((d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 + tOff) % 24) + 24) % 24; }
const isNight = () => { const h = hourNow(); return h >= 19.5 || h < 5.5; };
function isRain() { if (qs.has('rain')) return qs.get('rain') === '1'; return hash2(Math.floor(Date.now() / 1200000), 77) < 0.2; }
const TINT = [[0, [52, 62, 124]], [5, [62, 72, 134]], [6.5, [250, 190, 150]], [8.5, [255, 248, 236]], [16.5, [255, 241, 218]], [18, [255, 205, 150]], [19.5, [204, 132, 142]], [21, [92, 92, 152]], [24, [52, 62, 124]]];
function tintAt(h) {
  for (let i = 1; i < TINT.length; i++) if (h <= TINT[i][0]) { const a = TINT[i - 1], b = TINT[i], k = (h - a[0]) / (b[0] - a[0]); return a[1].map((v, j) => Math.round(v + (b[1][j] - v) * k)); }
  return TINT[0][1];
}

// ---- audio ----------------------------------------------------------------
let AC = null;
function audioInit() { if (AC || !S.sound) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } if (AC && AC.state === 'suspended') AC.resume(); }
function tone(f, d, type, v, t0, f2) {
  const o = AC.createOscillator(), gn = AC.createGain(), t = AC.currentTime + (t0 || 0); o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); gn.gain.setValueAtTime(v || 0.04, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(gn); gn.connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
}
const SFX = {
  ui: [[660, .05]], cast: [[500, .12, 'triangle', .05, 0, 200]], splash: [[300, .15, 'sawtooth', .02, 0, 120]], bite: [[880, .08], [1100, .1, 'square', .05, .09]],
  hook: [[500, .08], [700, .08, 'square', .04, .07]], catch: [[523, .09], [659, .09, 'square', .04, .09], [784, .14, 'square', .04, .18]],
  rare: [[523, .1], [659, .1, 'square', .04, .1], [784, .1, 'square', .04, .2], [1047, .25, 'square', .05, .3]], coin: [[988, .07], [1319, .18, 'square', .04, .07]],
  pop: [[420, .09, 'triangle', .05, 0, 760]], no: [[200, .15, 'square', .04, 0, 140]], level: [[392, .1], [523, .1, 'square', .04, .1], [659, .1, 'square', .04, .2], [784, .28, 'square', .05, .3]],
  dig: [[160, .07, 'square', .04, 0, 90]], shake: [[240, .06, 'triangle', .04, 0, 200]]
};
function sfx(n) { if (!S.sound || !AC) return; const s = SFX[n]; if (!s) return; try { s.forEach(a => tone(a[0], a[1], a[2], a[3], a[4], a[5])); } catch (e) { } }
const vib = ms => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) { } };

// ---- canvas ---------------------------------------------------------------
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 3); const w = innerWidth, h = innerHeight;
  cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
  Z = Math.max(2, Math.round(Math.min(w, h * 0.62) / 190)); VW = w / Z; VH = h / Z;
}

// ---- input ----------------------------------------------------------------
const joy = { id: null, sx: 0, sy: 0, moved: false, t0: 0, vx: 0, vy: 0, mag: 0 };
const keys = {};
const inp = $('#inp'), joyEl = $('#joy'), knob = $('#knob');
inp.addEventListener('pointerdown', e => {
  if (EDIT || joy.id !== null || UI.isOpen) return; audioInit(); $('#emotes').classList.add('hidden');
  joy.id = e.pointerId; joy.sx = e.clientX; joy.sy = e.clientY; joy.moved = false; joy.t0 = performance.now(); joy.vx = joy.vy = joy.mag = 0;
  try { inp.setPointerCapture(e.pointerId); } catch (_) { }
});
inp.addEventListener('pointermove', e => {
  if (EDIT || e.pointerId !== joy.id) return; const dx = e.clientX - joy.sx, dy = e.clientY - joy.sy, d = Math.hypot(dx, dy), R = 46;
  if (d > 12 && !joy.moved) { joy.moved = true; joyEl.style.left = joy.sx + 'px'; joyEl.style.top = joy.sy + 'px'; joyEl.classList.add('on'); }
  if (joy.moved) { joy.vx = dx / (d || 1); joy.vy = dy / (d || 1); joy.mag = d < 8 ? 0 : Math.min(1, (d - 6) / (R - 6)); const k = Math.min(d, R); knob.style.transform = `translate(${joy.vx * k}px,${joy.vy * k}px)`; }
});
function joyEnd(e) {
  if (EDIT || e.pointerId !== joy.id) return;
  if (!joy.moved && performance.now() - joy.t0 < 400 && e.type === 'pointerup') tapWorld(e.clientX, e.clientY);
  joy.id = null; joy.mag = 0; joyEl.classList.remove('on'); knob.style.transform = '';
}
inp.addEventListener('pointerup', joyEnd); inp.addEventListener('pointercancel', joyEnd);
document.addEventListener('contextmenu', e => e.preventDefault());
const actEl = $('#act');
function actDown() { if (held) return; held = true; audioInit(); if (UI.isOpen) return; if (A) A.pressed = true; else startAction(); }
function actUp() { held = false; }
actEl.addEventListener('pointerdown', e => { e.preventDefault(); actDown(); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => actEl.addEventListener(ev, actUp));
// the pop-up mini games take the same press / hold as the action button
const miniBox = $('#mini');
miniBox.addEventListener('pointerdown', e => { if (e.target.id === 'mx') return; if (MINI.mode === 'reel' || MINI.mode === 'tap') { e.preventDefault(); actDown(); } });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => miniBox.addEventListener(ev, actUp));
addEventListener('keydown', e => {
  if (EDIT || (e.target && e.target.tagName === 'INPUT')) return; keys[e.code] = true;
  if (['Space', 'KeyE', 'Enter'].includes(e.code)) { e.preventDefault(); if (!e.repeat) actDown(); }
});
addEventListener('keyup', e => { keys[e.code] = false; if (['Space', 'KeyE', 'Enter'].includes(e.code)) actUp(); });
function inputVec() {
  if (joy.mag > 0) return [joy.vx * joy.mag, joy.vy * joy.mag];
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1; if (keys.KeyW || keys.ArrowUp) y -= 1; if (keys.KeyS || keys.ArrowDown) y += 1;
  const l = Math.hypot(x, y); return l ? [x / l, y / l] : [0, 0];
}

// ---- helpers --------------------------------------------------------------
function dirOf(dx, dy) { return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u'); }
function stepToward(e, tx, ty, sp, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy); if (d < 1) return false;
  const s = Math.min(d, sp * dt); e.dir = dirOf(dx, dy); e.face = faceOf(dx, dy); e.faceDir = e.dir; return moveEnt(e, dx / d * s, dy / d * s);
}
function burst(x, y, col, n, sp, life, grav, sz) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = rnd(0.3, 1) * sp; PT.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.4, g: grav == null ? 60 : grav, life: rnd(0.5, 1) * life, max: life, col, sz: sz || 1 }); }
}
function floater(x, y, txt, col) { FL.push({ x, y, txt, col: col || '#fff', t: 0 }); }
function ripple(x, y, big) { RP.push({ x, y, t: 0, max: big ? 1.1 : 0.9, big }); }
function doEmote(e) {
  ME.bubble = e; ME.bt = 2.6; sfx('pop'); if (e === '👋' && !A) ME.wave = { t: 0 };
  NPCS.forEach(n => { if (Math.hypot(n.x - ME.x, n.y - ME.y) < 90 && Math.random() < 0.4) setTimeout(() => { n.bubble = pick(['👋', '❤️', '😄', '✨']); n.bt = 2.4; }, rnd(700, 1600)); });
}

// ---- targets --------------------------------------------------------------
const SHOPK = ['portal', 'stall', 'board', 'tackle', 'gemshop', 'outfitshop', 'tank', 'leaders'];
const ICON = { portal: 'portal', tackle: 'tackle', gemshop: 'gem', outfitshop: 'shirt', tank: 'tank', leaders: 'trophy', water: 'rod', tree: 'tree', bush: 'bush', bug: 'bug', clutter: 'beach', stall: 'stall', board: 'board', note: 'board', npc: 'wave' };
const HINT = { portal: 'Press to go through', tackle: 'Press to enter the fishing shop', gemshop: 'Press to open the gem shop', outfitshop: 'Press to see today\'s outfits', tank: 'Press to open the fish tank', leaders: 'Press to see the leaderboard', water: 'Press to cast your line', tree: 'Press to shake the tree and catch the fruit', bush: 'Press to pick berries', bug: 'Press to catch it, then tap fast', clutter: 'Press to dig here', stall: 'Press to open the market', board: 'Press to read the board', note: 'Press to read the note', npc: 'Press to wave hello' };
function findTarget() {
  if (A || UI.isOpen) return null;
  const px = ME.x, py = ME.y, fv = DV[ME.dir]; let best = null;
  const consider = (kind, ref, x, y, dist, range, bias) => {
    if (dist > range) return; const dx = x - px, dy = y - py, d = Math.hypot(dx, dy) || 1;
    const sc = dist - (dx / d * fv[0] + dy / d * fv[1]) * 5 + (bias || 0);
    if (!best || sc < best.sc) best = { kind, ref, sc, dist, dir: dirOf(dx, dy) };
  };
  for (const o of W.objs) {
    if (Math.abs(o.x - px) > 60 || Math.abs(o.y - py) > 60) continue;
    if (o.k === 'tree' && o.fruit) consider('tree', o, o.x, o.y, distToBox(px, py, o), o.ia);
    else if (o.k === 'bush' && o.berry) consider('bush', o, o.x, o.y, distToBox(px, py, o), o.ia);
    else if (SHOPK.includes(o.k)) consider(o.k, o, o.x, o.y, distToBox(px, py, o), o.ia);
    else if (o.k === 'note') consider('note', o, o.x, o.y, Math.hypot(o.x - px, o.y - py), o.ia);
    else if (o.k === 'clutter') consider('clutter', o, o.x, o.y, Math.hypot(o.x - px, o.y - py), o.ia);
  }
  for (const b of W.bugs) if (!b.leave) consider('bug', b, b.x, b.y, Math.hypot(b.x - px, b.y - py), 34);
  for (const n of NPCS) consider('npc', n, n.x, n.y, Math.hypot(n.x - px, n.y - py), 22, 14);
  let wb = null;
  for (const dn of ['u', 'd', 'l', 'r']) {
    const v = DV[dn];
    for (let dd = 6; dd <= 24; dd += 2) if (isWater(px + v[0] * dd, py - 2 + v[1] * dd)) { const sc = dd * 0.8 - (dn === ME.dir ? 8 : 0); if (!wb || sc < wb.sc) wb = { dn, dd, sc }; break; }
  }
  if (wb && (!best || wb.sc < best.sc + 2)) best = { kind: 'water', ref: null, sc: wb.sc, dist: wb.dd, dir: wb.dn };
  return best;
}
function tapWorld(sx, sy) {
  if (UI.isOpen || A) return; const wx = sx / Z + cam.x, wy = sy / Z + cam.y; let best = null, bd = 1e9;
  const cand = W.objs.filter(o => (o.k === 'tree' && o.fruit) || (o.k === 'bush' && o.berry) || o.k === 'clutter' || SHOPK.includes(o.k) || o.k === 'note').concat(W.bugs, NPCS);
  for (const o of cand) {
    const cy = o.k === 'bug' ? o.y - o.z : o.k === 'tree' ? o.y - 24 : SHOPK.includes(o.k) ? o.y - 16 : o.y - 8, d = Math.hypot(wx - o.x, wy - cy), rad = o.k === 'tree' ? 24 : SHOPK.includes(o.k) ? 26 : 13;
    if (d < rad && d < bd) { best = o; bd = d; }
  }
  if (best) autoWalk = { ref: best, x: best.x, y: best.y + (best.k === 'tree' || best.k === 'bush' ? 4 : 0), stuck: 0 };
  else if (isWater(wx, wy)) autoWalk = { water: true, x: wx, y: wy, stuck: 0 };
  else autoWalk = { x: wx, y: wy, stuck: 0 };
}

// ---- gains, xp, quests ----------------------------------------------------
function questEvent(ev, n) {
  const q = curQuest(); if (q.ev !== ev) return; S.qprog += n || 1;
  if (S.qprog >= q.need) {
    S.qprog = 0; S.quest++; const gold = q.loop ? 25 : 10, xp = q.loop ? 25 : 15;
    S.gold += gold; UI.toast('Goal complete! +' + gold + 'g', 'gold'); setTimeout(() => addXP(xp), 400); sfx('level');
  }
  UI.refresh();
}
function addXP(n) {
  S.xp += n; floater(ME.x, ME.y - 40, '+' + n + ' xp', '#8fe0ff'); let up = false;
  while (S.xp >= needXP(S.lv)) { S.xp -= needXP(S.lv); S.lv++; up = true; }
  if (up) {
    sfx('level'); UI.banner('Level ' + S.lv, S.created ? 'Nice work!' : 'You are getting the hang of this'); burst(ME.x, ME.y - 16, '#ffe08a', 24, 70, 1.1, 40, 2);
    if (!S.created) setTimeout(() => { if (!S.created && !UI.isOpen) UI.openCreator(true); }, 1900);
  }
  UI.refresh();
}
function gain(list, src) {
  const free = Math.max(0, bagCap() - bagCount()), kept = list.slice(0, free); let xp = 0;
  kept.forEach(inst => {
    const it = ITEM[inst.id], b = S.book[inst.id] || (S.book[inst.id] = { n: 0, best: 0 });
    inst.isNew = b.n === 0; if (inst.sz && inst.sz > b.best) { if (b.n > 0) inst.isBest = true; b.best = inst.sz; }
    b.n++; S.bag.push(inst); xp += 4 + 5 * it.r; S.stats.total++;
    if (it.cat === 'fish' && inst.sz && (!S.stats.big || inst.sz > S.stats.big.sz)) S.stats.big = { id: inst.id, sz: inst.sz };
    if (!S.stats.rare || it.r > ITEM[S.stats.rare.id].r || (it.r === ITEM[S.stats.rare.id].r && it.v > ITEM[S.stats.rare.id].v)) S.stats.rare = { id: inst.id };
  });
  if (!kept.length) return;
  const top = kept.reduce((a, b) => ITEM[b.id].r > ITEM[a.id].r ? b : a), rr = ITEM[top.id].r;
  setHold(kept); if (list.length > kept.length) UI.toast('Bag full: some items were left behind', 'info');
  sfx(rr >= 2 ? 'rare' : 'catch'); vib(rr >= 2 ? [20, 40, 30] : 20);
  burst(ME.x, ME.y - 26, RAR[rr].c, 8 + rr * 8, 60 + rr * 15, 0.9, 50, rr >= 2 ? 2 : 1);
  if (src === 'fish') S.stats.fish++;
  questEvent(src, 1); questEvent('any', kept.length); addXP(xp); UI.refresh();
  if (src === 'fish' && S.stats.fish === 1) setTimeout(() => UI.toast('Drag anywhere to walk around the island', 'info'), 2600);
}
const bagFull = () => bagCount() >= bagCap();
// the catch is held up over the player's head for a few seconds
function setHold(kept) {
  const groups = []; kept.forEach(i => { const g = groups.find(x => x.id === i.id); if (g) { g.n++; g.val += i.val; g.isNew = g.isNew || i.isNew; } else groups.push({ id: i.id, n: 1, val: i.val, inst: i, isNew: i.isNew }); });
  groups.sort((a, b) => ITEM[b.id].r - ITEM[a.id].r);
  ME.hold = { groups, t: 0, dur: ITEM[groups[0].id].r >= 2 ? 4 : 2.8 };
}
function readNote(o) {
  const first = !S.notes.includes(o.idx); if (first) { S.notes.push(o.idx); addXP(3); }
  UI.note(o.text, o.idx, W.notes.length, first); sfx('ui'); UI.refresh();
}

// ---- activities -----------------------------------------------------------
function faceTo(t) { if (t.dir) ME.dir = t.dir; }
function startAction() {
  if (A || UI.isOpen || !target) return; const t = target; faceTo(t); ME.hold = null;
  if (t.kind === 'note') { readNote(t.ref); return; }
  if (t.kind === 'stall') { held = false; UI.openMarket(); return; }
  if (t.kind === 'portal') { held = false; goArea(t.ref.to, t.ref.sx, t.ref.sy); return; }
  if (t.kind === 'tackle') { held = false; UI.openTackle('sell'); return; }
  if (t.kind === 'tank') { held = false; UI.openTank(); return; }
  if (t.kind === 'gemshop') { held = false; UI.openGems(); return; }
  if (t.kind === 'outfitshop') { held = false; UI.openOutfits(); return; }
  if (t.kind === 'leaders') { held = false; UI.openLeaders('me'); return; }
  if (t.kind === 'board') { held = false; UI.openBoard(); return; }
  if (t.kind === 'npc') { doEmote('👋'); const n = t.ref; setTimeout(() => { n.bubble = '❤️'; n.bt = 2.4; }, 800); questEvent('wave', 1); return; }
  if (bagFull()) { UI.toast('Bag full! Sell at the market stall', 'info'); sfx('no'); return; }
  const rod = TOOLS.rod[S.tools.rod], net = TOOLS.net[S.tools.net], sh = TOOLS.shovel[S.tools.shovel];
  if (t.kind === 'water') { A = { k: 'fish', ph: 'charge', t: 0, pw: 0, pd: 1, on: held, dir: t.dir, d0: t.dist, p: 0, idle: 0, rt: 0 }; return; }
  if (t.kind === 'tree') { A = { k: 'catch', ref: t.ref, kind: t.ref.kind, t: 0, total: 6, spawned: 0, next: 0.5, fr: [], caught: 0, bonusCaught: 0, bx: 0.5, tx: 0.5, bonusAt: Math.random() < 0.16 + S.tools.net * 0.02 ? Math.floor(rnd(1, 6)) : -1 }; return; }
  if (t.kind === 'bush') { A = { k: 'berries', ref: t.ref, kind: t.ref.kind, t: 0, berries: genBerries(Math.random() < 0.12 + S.tools.net * 0.02), got: 0, bonusGot: 0 }; return; }
  if (t.kind === 'bug') {
    const bug = t.ref, r = bug.it.r || 0, net = TOOLS.net[S.tools.net], need = Math.max(5, Math.round((7 + r * 3 + (bug.st === 'rest' ? 0 : 3)) * (1.3 - net.fly * 0.5)));
    bug.hold = true; A = { k: 'net', ph: 'tap', t: 0, dir: ME.dir, ref: bug, fill: 0.15, per: 0.9 / need, drain: 0.16 + r * 0.06, tl: 5.5, flash: 0, done: false, ok: false }; sfx('cast'); return;
  }
  if (t.kind === 'clutter') { A = { k: 'dig', ref: t.ref, t: 0, dur: 1.2 / sh.spd, stroke: 0 }; return; }
}
function genBerries(bonus) { // 7 berries pop up one after another at spread-out spots on the bush
  const out = []; let tries = 0;
  while (out.length < 7 && tries++ < 200) { const x = rnd(30, 170), y = rnd(36, 190); if (out.every(b => Math.hypot(b.x - x, b.y - y) > 36)) out.push({ x, y, t0: 0, life: 1.7, shown: false, done: false }); }
  out.forEach((b, i) => { b.t0 = 0.3 + i * 0.55 + rnd(0, 0.25); }); if (bonus) out[Math.floor(rnd(2, out.length))].inst = rollItem('forage', { where: 'bush', night: isNight(), rain: isRain(), luck: 1 }, i => ['elderberry', 'glowberry'].includes(i.id));
  return out;
}
function endAct(msg) { A = null; if (msg) UI.toast(msg, 'info'); }
const walkSp = () => 58 * (S.gearOwned.includes('sandals') ? 1.08 : 1);
const boostOn = id => !!(S.boosts[id] && S.boosts[id] > Date.now());
function castFish() { // release: the charge bar decides how far the bobber lands
  const rod = TOOLS.rod[S.tools.rod], v = DV[A.dir]; let bd = A.d0 + 4 + A.pw * rod.rng + (S.gearOwned.includes('glove') ? 8 : 0);
  while (bd > A.d0 && !isWater(ME.x + v[0] * bd, ME.y - 2 + v[1] * bd)) bd -= 2;
  const bx = ME.x + v[0] * bd, by = ME.y - 2 + v[1] * bd, ty = typeAt(bx, by);
  const bait = S.baitSel && S.bait[S.baitSel] > 0 ? BAITS.find(b => b.id === S.baitSel) : null, bob = BOBBERS.find(b => b.id === S.bobberSel);
  if (bait) { S.bait[bait.id]--; if (S.bait[bait.id] <= 0) { delete S.bait[bait.id]; S.baitSel = null; UI.toast(bait.n + ' ran out', 'info'); } UI.refresh(); }
  Object.assign(A, { ph: 'cast', t: 0, bx, by, where: ty === 6 ? (typeof AREA !== 'undefined' && AREA === 'cave' ? 'cave' : 'pond') : ty === 0 ? 'deep' : 'sea',
    wait: (S.stats.fish === 0 ? 1.4 : rnd(2.2, 5.2)) * (bait ? bait.wait : 1) * (bob && bob.wait ? bob.wait : 1) * (boostOn('quick') ? 0.7 : 1) / rod.spd,
    win: 1.2 + S.tools.rod * 0.12 + (bob && bob.win || 0) + (S.gearOwned.includes('wrist') ? 0.3 : 0), luck: rod.luck + (bait ? bait.luck : 0) + (boostOn('lucky') ? 1.5 : 0), decay: bob && bob.decay || 1 });
  sfx('cast');
}
// Stardew-style reel: keep the green bar on the fish until the meter fills. Rarer / bigger fish = smaller bar, jumpier fish.
function startReel() {
  const it = ITEM[A.item.id], first = S.stats.fish === 0;
  const szn = it.sz && A.item.sz ? clamp((A.item.sz - it.sz[0]) / Math.max(1, it.sz[1] - it.sz[0]), 0, 1) : 0.5;
  const d = first ? 0 : it.r * 0.25 + szn * 0.2; // 0 (easy) .. ~0.95 (hard)
  const reelV = S.gear.reel ? GEAR.reel[S.gear.reel - 1].v : 0;
  A.ph = 'reel'; A.t = 0; A.d = d; A.bsz = clamp(0.38 - d * 0.18 + S.tools.rod * 0.02 + reelV * 0.1, 0.15, 0.5);
  A.bp = 0.25; A.bv = 0; A.fp = 0.6; A.ft = 0.6; A.fr = 0; A.p = 0.3; A.hit = false;
}
function rollFish(where, luck) {
  if (S.stats.fish === 0) { const inst = makeInst(ITEM.carp); inst.sz = 52; inst.val = 22; return inst; }
  if (Math.random() < 0.05 && where !== 'deep') return makeInst(ITEM.boot);
  return rollItem('fish', { where, night: isNight(), rain: isRain(), luck }, i => !i.junk);
}
function updateAct(dt) {
  if (!A) return; A.t += dt; const pressed = A.pressed; A.pressed = false;
  const mv = inputVec(), moving = Math.hypot(mv[0], mv[1]) > 0.4;
  switch (A.k) {
    case 'fish': {
      if (A.ph === 'charge') {
        if (!A.on) { if (pressed) A.on = true; if (moving) { endAct(); return; } break; }
        A.pw += A.pd * dt * 1.1; if (A.pw >= 1) { A.pw = 1; A.pd = -1; } else if (A.pw <= 0) { A.pw = 0; A.pd = 1; }
        if (!held) castFish();
      } else if (A.ph === 'cast') { if (A.t >= 0.4) { A.ph = 'wait'; A.t = 0; ripple(A.bx, A.by, true); burst(A.bx, A.by, '#dff4f8', 6, 30, 0.5, 80); sfx('splash'); } }
      else if (A.ph === 'wait') {
        if (pressed) { endAct('Too soon! Reeled it back in'); return; } if (moving) { endAct(); return; }
        A.rt -= dt; if (A.rt <= 0) { ripple(A.bx, A.by); A.rt = rnd(0.9, 1.6); }
        if (A.t >= A.wait) { A.ph = 'bite'; A.t = 0; A.item = rollFish(A.where, A.luck); sfx('bite'); vib(40); ripple(A.bx, A.by, true); }
      } else if (A.ph === 'bite') {
        if (pressed) { startReel(); sfx('hook'); vib(25); }
        else if (A.t > A.win) { endAct('It got away...'); }
        else if (Math.random() < dt * 8) ripple(A.bx, A.by);
      } else if (A.ph === 'reel') {
        const lineV = S.gear.line ? GEAR.line[S.gear.line - 1].v : 0, d = A.d, h = A.bsz / 2;
        A.fr -= dt; if (A.fr <= 0) { A.fr = rnd(0.6, 1.5) / (1 + d * 0.8); A.ft = rnd(0.05, 0.95); }
        A.fp += (A.ft - A.fp) * Math.min(1, dt * (1.2 + d * 3)); A.fp = clamp(A.fp + (it => it.r >= 2 ? rnd(-1, 1) * dt * d * 0.5 : 0)(ITEM[A.item.id]), 0, 1);
        A.bv += (held ? 3.2 : -2.4) * dt; A.bv *= Math.pow(0.12, dt); A.bp += A.bv * dt;
        if (A.bp < h) { A.bp = h; A.bv = Math.max(0, -A.bv * 0.3); } if (A.bp > 1 - h) { A.bp = 1 - h; A.bv = 0; }
        A.hit = Math.abs(A.fp - A.bp) <= h;
        A.p += A.hit ? dt * 0.3 / (1 + d * 0.5) : -dt * 0.14 * (1 - lineV) * A.decay;
        A.p = clamp(A.p, 0, 1.01); if (A.p <= 0) { endAct('It got away...'); return; }
        if (Math.random() < dt * 6) ripple(A.bx + rnd(-3, 3), A.by + rnd(-2, 2));
        if (A.p >= 1) { A.ph = 'pull'; A.t = 0; sfx('pop'); }
      } else if (A.ph === 'pull') { if (A.t >= 0.5) { const it = A.item; endAct(); gain([it], 'fish'); } }
      break;
    }
    case 'catch': { // fruit tree: shake it, then catch the falling fruit in a basket
      const kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      if (kx) { A.tx = clamp(A.tx + kx * dt * 0.9, 0.08, 0.92); MINI.ptr = A.tx; } else A.tx = clamp(MINI.ptr, 0.08, 0.92);
      A.bx += (A.tx - A.bx) * Math.min(1, dt * 14); A.ref.shake = 0.5;
      while (A.spawned < A.total && A.t >= A.next) {
        const f = { x: rnd(18, MNW - 18), y: -10, vy: rnd(40, 70) };
        if (A.spawned === A.bonusAt) f.inst = rollItem('forage', { where: 'tree', night: isNight(), luck: 0.8 }, i => !['apple', 'orange', 'pear', 'plum'].includes(i.id) && i.where.includes('tree'));
        A.fr.push(f); A.spawned++; A.next += rnd(0.35, 0.8); sfx('shake');
      }
      for (let i = A.fr.length - 1; i >= 0; i--) {
        const f = A.fr[i]; f.vy += 160 * dt; f.y += f.vy * dt;
        if (f.y >= MNH - 36 && f.y <= MNH - 16 && Math.abs(f.x - A.bx * MNW) < 26) { if (f.inst) { A.bonusCaught++; A.bonus = f.inst; } else A.caught++; A.fr.splice(i, 1); sfx('pop'); vib(10); }
        else if (f.y > MNH + 12) A.fr.splice(i, 1);
      }
      if (A.spawned >= A.total && !A.fr.length) {
        const t = A.ref, list = []; for (let i = 0; i < A.caught; i++) list.push(makeInst(ITEM[A.kind])); if (A.bonus && A.bonusCaught) list.push(A.bonus);
        t.fruit = false; t.regrow = timeNow + 70; t.shake = 0.8;
        for (let i = 0; i < 5; i++) burst(t.x + rnd(-12, 12), t.y - rnd(20, 34), ITEM[A.kind].cols[0], 1, 20, 0.9, 140, 2);
        endAct(list.length ? null : 'Missed them all! The tree needs time to grow more.'); if (list.length) gain(list, 'tree');
      }
      break;
    }
    case 'berries': { // bush: berries pop up one by one, tap them before they drop
      A.ref.shake = 0.3;
      for (const b of A.berries) { if (!b.shown && A.t >= b.t0) b.shown = true; if (b.shown && !b.done && A.t >= b.t0 + b.life) b.done = true; }
      for (const tp of MINI.taps) {
        let best = null, bd = 24; for (const b of A.berries) if (b.shown && !b.done) { const d = Math.hypot(b.x - tp.x, b.y - tp.y); if (d < bd) { bd = d; best = b; } }
        if (best) { best.done = true; if (best.inst) { A.bonusGot++; A.bonus = best.inst; } else A.got++; sfx('pop'); vib(10); burst(A.ref.x + rnd(-6, 6), A.ref.y - 8, '#8fc25a', 3, 16, 0.6, 40, 1); }
      }
      MINI.taps.length = 0;
      if (A.berries.every(b => b.done)) {
        const b = A.ref, list = []; for (let i = 0; i < A.got; i++) list.push(makeInst(ITEM[A.kind])); if (A.bonus && A.bonusGot) list.push(A.bonus);
        b.berry = false; b.regrow = timeNow + 50; endAct(list.length ? null : 'They all dropped! Try again later.'); if (list.length) gain(list, 'bush');
      }
      break;
    }
    case 'net': {
      if (A.ph === 'tap') { // butterfly: tap to fill the bar before the time runs out or the bar drains empty
        const bb = A.ref; if (!bb || bb.leave || !W.bugs.includes(bb)) { if (bb) bb.hold = false; endAct('It flew off.'); return; }
        A.flash = Math.max(0, A.flash - dt);
        if (pressed) { A.fill += A.per; A.flash = 0.12; sfx('ui'); vib(6); }
        else if (A.t > 0.6) A.fill -= A.drain * dt;
        if (A.fill >= 1) { A.ph = 'swing'; A.t = 0; sfx('cast'); }
        else if (A.fill <= 0 || A.t >= A.tl) { bb.hold = false; bb.flee = 1.4; bb.st = 'fly'; bb.t = 1.4; bb.tx = bb.x + rnd(-40, 40); bb.ty = bb.y + rnd(-30, 10); sfx('no'); endAct('It fluttered away!'); }
        break;
      }
      if (A.t >= 0.2 && !A.done) {
        A.done = true; const bb = A.ref; bb.hold = false;
        if (W.bugs.includes(bb)) { A.ok = true; W.bugs.splice(W.bugs.indexOf(bb), 1); A.res = bb.inst; burst(bb.x, bb.y - bb.z, bb.it.cols[0], 8, 40, 0.7, 20, 1); }
      }
      if (A.t >= 0.45) { const r = A.res, ok = A.ok; endAct(ok ? null : 'It fluttered away!'); if (r) gain([r], 'bug'); }
      break;
    }
    case 'dig': {
      const sh = TOOLS.shovel[S.tools.shovel], s = Math.floor(A.t / (A.dur / 3));
      if (s > A.stroke && s <= 3) { A.stroke = s; sfx('dig'); burst(A.ref.x, A.ref.y - 4, '#d8c08a', 8, 36, 0.6, 120, 1); vib(10); }
      if (A.t >= A.dur) {
        const type = A.ref.type, map = { seaweed: ['glass', 'blueglass', 'redglass', 'hermit', 'bottle', 'pearl', 'starfish'], shell: ['cockle', 'scallop', 'starfish', 'sanddollar', 'conch', 'pearl'], wood: ['driftwood', 'oldcoin', 'relic', 'bottle', 'hermit'], crab: ['hermit', 'pearl', 'oldcoin', 'starfish', 'conch'] };
        const ctx = { luck: sh.luck, rain: isRain(), night: isNight() };
        const inst = Math.random() < 0.2 ? rollItem('beach', ctx) : rollItem('beach', ctx, i => map[type].includes(i.id));
        removeClutter(A.ref); endAct(); gain([inst], 'beach');
      }
      break;
    }
  }
}
function actState() {
  if (!A) return null;
  switch (A.k) {
    case 'fish': return { icon: 'rod', prog: A.ph === 'charge' && A.on ? A.pw : 0, alert: A.ph === 'bite', hint: { charge: A.on ? 'Release to cast!' : 'Press and hold to charge your cast', cast: 'Casting...', wait: 'Waiting for a bite... (press to reel in)', bite: 'Bite! Press now!', reel: 'Hold to lift the bar. Keep it on the fish!', pull: 'Got it!' }[A.ph] };
    case 'catch': return { icon: 'tree', prog: 0, hint: 'Catch the falling fruit!' };
    case 'berries': return { icon: 'bush', prog: 0, hint: 'Tap the berries!' };
    case 'net': return { icon: 'bug', prog: A.ph === 'tap' ? A.fill : 0, hint: A.ph === 'tap' ? 'Tap fast!' : 'Swish!' };
    case 'dig': return { icon: 'beach', prog: A.t / A.dur, hint: 'Digging...' };
  }
}

// ---- player ---------------------------------------------------------------
function updateMe(dt) {
  const v = inputVec(), mag = Math.hypot(v[0], v[1]);
  ME.moving = false;
  if (mag > 0.4) UI.hideNote();
  if (ME.wave) { ME.wave.t += dt; if (ME.wave.t > 1.3 || mag > 0.3) ME.wave = null; }
  if (ME.hold) { const h = ME.hold; h.t += dt; if (h.t > h.dur || (h.t > 0.6 && mag > 0.3)) ME.hold = null; else if (h.t < 0.6) return; }
  if (A && !(A.k === 'fish' && (A.ph === 'charge' || A.ph === 'wait' || A.ph === 'bite'))) { ME.t += 0; return; }
  if (UI.isOpen) return;
  if (mag > 0.05 && (!A || A.k === 'fish' && (A.ph === 'charge' || A.ph === 'wait' || A.ph === 'bite') && mag > 0.4)) {
    if (A) { endAct(); }
    autoWalk = null; const sp = walkSp() * Math.min(1, mag);
    const nd = dirOf(v[0], v[1]); if (nd !== ME.dir && Math.abs(Math.abs(v[0]) - Math.abs(v[1])) > 0.25 || !DV[ME.dir]) ME.dir = nd; else if (Math.abs(Math.abs(v[0]) - Math.abs(v[1])) <= 0.25) { /* keep */ } else ME.dir = nd;
    ME.face = faceOf(v[0], v[1]); ME.faceDir = ME.dir; ME.moving = moveEnt(ME, v[0] * sp * dt, v[1] * sp * dt); ME.t += dt;
  } else if (autoWalk && !A) {
    const a = autoWalk, tg = target;
    if (a.ref && tg && tg.ref === a.ref) { autoWalk = null; startAction(); return; }
    if (a.water && tg && tg.kind === 'water') { autoWalk = null; startAction(); return; }
    const d = Math.hypot(a.x - ME.x, a.y - ME.y); if (d < 3) { autoWalk = null; return; }
    const m = stepToward(ME, a.x, a.y, walkSp(), dt); ME.moving = m; ME.t += dt; a.stuck = m ? 0 : a.stuck + 1; if (a.stuck > 14) autoWalk = null;
  }
}

// ---- NPC players (stand-ins for real multiplayer) -------------------------
const NNAMES = ['mossy', 'kelpie', 'pipsqueak', 'fernfox', 'tidy88', 'lilac', 'noodle', 'bramble', 'sunny', 'quill', 'marlow', 'poppy', 'otter_k', 'dune'];
const PHRASES = ['nice!', 'hi!', '👋', 'wow, big one!', '🎣', 'what a view', 'so peaceful', 'anyone seen the golden koi?', '🦋', 'gg', '🍎', 'brb, selling', '✨'];
function makeNPC(i) {
  let x, y, tries = 0; do { const a = Math.random() * 6.28, r = rnd(20, 120); x = W.hub.x + Math.cos(a) * r; y = W.hub.y + 30 + Math.sin(a) * r * 0.6; } while (blockedAt(x, y) && tries++ < 40);
  return { k: 'npc', name: NNAMES[i % NNAMES.length] + (Math.random() < 0.5 ? Math.floor(rnd(2, 99)) : ''), lv: Math.floor(rnd(3, 34)), look: randLook(), x, y, dir: 'd', t: rnd(0, 9), moving: false, mode: 'idle', mt: rnd(0.5, 4), tx: 0, ty: 0, stuck: 0, bubble: null, bt: 0, rod: null, after: null, fs: null };
}
function npcThink(n) {
  const r = Math.random(); n.fs = null; n.rod = null;
  if (r < 0.42 && W.shore.length) { const s = pick(W.shore); n.mode = 'go'; n.tx = s.x; n.ty = s.y; n.after = { m: 'fish', dir: s.dir, casts: Math.floor(rnd(1, 4)) }; }
  else if (r < 0.7) { for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, rr = rnd(20, 160); n.tx = W.hub.x + Math.cos(a) * rr; n.ty = W.hub.y + Math.sin(a) * rr * 0.8; if (!blockedAt(n.tx, n.ty)) break; } n.mode = 'go'; n.after = { m: 'idle' }; }
  else if (r < 0.85) { const ts = W.trees.filter(t => t.fruit); if (ts.length) { const t = pick(ts); n.mode = 'go'; n.tx = t.x; n.ty = t.y + 9; n.after = { m: 'shake', ref: t }; } else { n.mode = 'idle'; n.mt = rnd(3, 7); } }
  else { n.mode = 'idle'; n.mt = rnd(3, 8); if (Math.random() < 0.6) { n.bubble = pick(PHRASES); n.bt = 2.8; } }
}
function updateNPC(n, dt) {
  n.bt = Math.max(0, n.bt - dt); if (n.bt === 0) n.bubble = null; n.moving = false;
  if (n.mode === 'idle') { n.mt -= dt; if (n.mt <= 0) npcThink(n); }
  else if (n.mode === 'go') {
    const m = stepToward(n, n.tx, n.ty, 40, dt); n.moving = m; n.t += dt; n.stuck = m ? 0 : n.stuck + dt;
    if (Math.hypot(n.tx - n.x, n.ty - n.y) < 4 || n.stuck > 1.2) {
      const a = n.after || { m: 'idle' };
      if (a.m === 'fish') { n.dir = a.dir; n.mode = 'fish'; const v = DV[a.dir]; let d = rnd(16, 30); while (d > 8 && !isWater(n.x + v[0] * d, n.y - 2 + v[1] * d)) d -= 2; n.fs = { ph: 'cast', t: 0, bx: n.x + v[0] * d, by: n.y - 2 + v[1] * d, p: 0, casts: a.casts, wait: rnd(3, 9) }; n.rod = n.fs; }
      else if (a.m === 'shake') { n.mode = 'shake'; n.mt = 1.2; n.dir = 'u'; n.sref = a.ref; }
      else { n.mode = 'idle'; n.mt = rnd(2, 7); }
    }
  } else if (n.mode === 'fish') {
    const f = n.fs; f.t += dt;
    if (f.ph === 'cast' && f.t > 0.4) { f.ph = 'wait'; f.t = 0; ripple(f.bx, f.by, true); }
    else if (f.ph === 'wait' && f.t > f.wait) { f.ph = 'bite'; f.t = 0; ripple(f.bx, f.by, true); }
    else if (f.ph === 'bite' && f.t > 0.7) { f.ph = 'reel'; f.t = 0; }
    else if (f.ph === 'reel') { f.p = Math.min(1, f.t / 1.2); if (f.t > 1.2) { f.ph = 'pull'; f.t = 0; } }
    else if (f.ph === 'pull' && f.t > 0.4) { if (Math.random() < 0.5) { n.bubble = pick(['🐟', 'got one!', '🎣']); n.bt = 2; } f.casts--; if (f.casts <= 0) npcThink(n); else { f.ph = 'cast'; f.t = 0; f.p = 0; f.wait = rnd(3, 9); } }
  } else if (n.mode === 'shake') {
    n.mt -= dt; if (n.sref && n.mt < 0.7 && n.mt + dt >= 0.7) { n.sref.shake = 0.8; burst(n.sref.x, n.sref.y - 30, '#e6b830', 5, 20, 1, 30, 2); }
    if (n.mt <= 0) npcThink(n);
  }
}

// ---- update ---------------------------------------------------------------
function tick(dt) {
  timeNow = performance.now() / 1000;
  const night = isNight(); updateMe(dt);
  target = findTarget(); updateAct(dt); if (A) target = null;
  if (ME.bt > 0) { ME.bt -= dt; if (ME.bt <= 0) ME.bubble = null; }
  UI.setMini(A);
  const st = actState();
  if (st) { UI.setAct(st.icon, st.prog, st.alert); UI.setHint(st.hint); }
  else if (target) { UI.setAct(ICON[target.kind], 0, false); UI.setHint(HINT[target.kind]); }
  else { UI.setAct(null, 0, false); UI.setHint(UI.isOpen ? '' : curQuest().hint); }
  updateWorld(dt, timeNow, night); NPCS.forEach(n => updateNPC(n, dt));
  for (let i = PT.length - 1; i >= 0; i--) { const p = PT[i]; p.life -= dt; if (p.life <= 0) { PT.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  for (let i = FL.length - 1; i >= 0; i--) { FL[i].t += dt; if (FL[i].t > 1.3) FL.splice(i, 1); }
  for (let i = RP.length - 1; i >= 0; i--) { RP[i].t += dt; if (RP[i].t > RP[i].max) RP.splice(i, 1); }
  // the camera eases toward the player instead of being locked to them (snaps on teleports / first frame)
  const ctx_ = clamp(ME.x - VW / 2, 0, Math.max(0, PW - VW)), cty_ = clamp(ME.y - VH / 2 - 10, 0, Math.max(0, PH - VH));
  if (Math.hypot(ctx_ - cam.x, cty_ - cam.y) > 120) { cam.x = ctx_; cam.y = cty_; }
  else { const k = 1 - Math.exp(-dt * 3.5); cam.x += (ctx_ - cam.x) * k; cam.y += (cty_ - cam.y) * k; if (Math.abs(ctx_ - cam.x) < 0.02) cam.x = ctx_; if (Math.abs(cty_ - cam.y) < 0.02) cam.y = cty_; }
}

// ---- render ---------------------------------------------------------------
function lineG(x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); g.fillStyle = col;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy, n = 0;
  for (; n++ < 200;) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function drawFishing(e, f, cx, cy, now, tip) {
  const s = e.dir === 'l' ? -1 : 1; const hx = e.x + 6 * s, hy = e.y - 14; let tx = e.x + 14 * s, ty = e.y - 27; if (e.dir === 'u') { tx = e.x + 10 * s; ty = e.y - 32; } if (e.dir === 'd') { tx = e.x + 11 * s; ty = e.y - 26; }
  if (f.ph === 'charge') {
    if (f.on) { const bx0 = Math.round(e.x - 13 - cx), by0 = Math.round(e.y - 48 - cy); g.fillStyle = '#101826'; g.fillRect(bx0 - 1, by0 - 1, 28, 6); g.fillStyle = f.pw > 0.85 ? '#e8483a' : '#f2b632'; g.fillRect(bx0, by0, Math.round(26 * f.pw), 4); } return; }
  if (tip) { tx = e.x + tip[0] - 24; ty = e.y + tip[1] - 48; } // the rod is part of the painted frame: the line starts at its tip
  else { if (f.ph === 'cast') ty += Math.sin(Math.min(1, f.t / 0.4) * Math.PI) * 7; lineG(hx - cx, hy - cy, tx - cx, ty - cy, '#7a5028'); lineG(hx - cx, hy - cy - 1, tx - cx, ty - cy - 1, '#a8743a'); }
  let bx = f.bx, by = f.by, arc = 0;
  if (f.ph === 'cast') { const u = Math.min(1, f.t / 0.4); bx = tx + (f.bx - tx) * u; by = ty + (f.by - ty) * u; arc = Math.sin(u * Math.PI) * 14; }
  else if (f.ph === 'reel' || f.ph === 'pull') { const u = f.ph === 'reel' ? f.p * 0.7 : 0.7 + 0.3 * Math.min(1, f.t / 0.5); bx = f.bx + (e.x - f.bx) * u; by = f.by + (e.y - 6 - f.by) * u; arc = f.ph === 'pull' ? Math.sin(Math.min(1, f.t / 0.5) * Math.PI) * 14 : 0; }
  let bob = f.ph === 'bite' ? 2 + Math.sin(now * 40) : f.ph === 'wait' ? Math.sin(now * 3) * 0.6 : 0;
  const by2 = by - arc, sag = f.ph === 'cast' ? 2 : 5; g.fillStyle = 'rgba(245,245,235,0.85)';
  for (let i = 0; i <= 12; i++) { const u = i / 12; g.fillRect(Math.round(tx + (bx - tx) * u - cx), Math.round(ty + (by2 - ty) * u + Math.sin(u * Math.PI) * sag - cy), 1, 1); }
  if (f.ph === 'pull' && f.item) { const ic = itemIcon(f.item.id); g.drawImage(ic, Math.round(bx - 9 - cx), Math.round(by2 - 12 - cy)); return; }
  g.fillStyle = '#f5f5f0'; g.fillRect(Math.round(bx - 1 - cx), Math.round(by2 - 1 + bob - cy), 3, 2); g.fillStyle = '#e8483a'; g.fillRect(Math.round(bx - 1 - cx), Math.round(by2 - 3 + bob - cy), 3, 2);
  if (f.ph === 'reel') { g.fillStyle = 'rgba(20,40,70,0.45)'; const r = 3 + Math.sin(now * 12) * 1.5; g.fillRect(Math.round(bx - r - cx), Math.round(by + 2 - cy), Math.round(r * 2), 2); }
  if (f.ph === 'bite') { g.fillStyle = '#fff'; g.font = 'bold 9px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.fillStyle = (f.item && S.gearOwned.includes('finder')) ? RAR[ITEM[f.item.id].r].c : '#e8483a'; g.fillText('!', Math.round(e.x - cx), Math.round(e.y - 42 - cy + Math.sin(now * 20))); g.textAlign = 'left'; }
}
function mePose(now) { // which painted action frame the player is in right now (null = normal walking sprite)
  const D = AROW[ME.dir] || 0;
  if (ME.hold) return ['gather', 4 + D, 7, true];
  if (A) switch (A.k) {
    case 'fish': return fishPose(ME.dir, A, now, A.hit);
    case 'net': return A.ph === 'tap' ? ['net', D, A.flash > 0 ? 1 : 0] : ['net', 8 + D, 1 + Math.min(2, Math.floor(A.t / 0.15))];
    case 'dig': { const u = A.t / A.dur; return ['gather', D, u < 0.85 ? Math.min(3, Math.floor(u * 6)) : 4]; }
    case 'catch': return ['emote', 4 + D, 1];
    case 'berries': return ['gather', 8 + D, 1 + (Math.floor(A.t * 6) % 3)];
  }
  if (ME.wave) return ['emote', D, 1 + (Math.floor(ME.wave.t * 8) % 3)];
  return null;
}
function drawChar(e, cx, cy, now) {
  const look = e === ME ? S.look : e.look, fr = e.moving ? Math.floor(e.t * 8) % 4 : 1, holding = e === ME && ME.hold, pose = e === ME ? mePose(now) : (e.rod && !e.moving ? fishPose(e.dir, e.rod, now, false) : null),
    spr = pose ? actSprite(look, pose[0], pose[1], pose[2], pose[3]) : charSprite(look, faceIdx(e), fr);
  g.drawImage(shadowSpr(14, 5), Math.round(e.x - 7 - cx), Math.round(e.y - 3 - cy));
  let off = 0; if (A && e === ME && A.k === 'catch') off = Math.sin(now * 40) * 0.5;
  g.drawImage(spr, Math.round(e.x - spr.ax - cx + off), Math.round(e.y - spr.ay - cy));
  if (holding) {
    const h = ME.hold, m = h.groups[0], ic = itemIcon(m.id), u = Math.min(1, h.t / 0.24), k = 1.70158 + 1, eb = 1 + k * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2);
    const fade = clamp((h.dur - h.t) / 0.35, 0, 1), sz = Math.round(ic.width * 2 * eb), bob = Math.round(Math.sin(now * 4) * 1), top = Math.round(e.y - 38 - sz + bob - cy);
    g.globalAlpha = fade;
    if (ITEM[m.id].r >= 2) { g.fillStyle = 'rgba(255,240,170,0.9)'; for (let i = 0; i < 4; i++) { const a = now * 2 + i * 1.57, rr = sz * 0.55 + 4; g.fillRect(Math.round(e.x - cx + Math.cos(a) * rr), Math.round(top + sz / 2 + Math.sin(a) * rr * 0.7), 2, 2); } }
    g.drawImage(ic, Math.round(e.x - sz / 2 - cx), top, sz, sz);
    h.groups.slice(1, 3).forEach((gr, i) => { const ic2 = itemIcon(gr.id), sd = i === 0 ? -1 : 1; g.drawImage(ic2, Math.round(e.x + sd * (sz / 2 + 14) - ic2.width / 2 - cx), Math.round(e.y - 50 - cy + bob)); });
    g.globalAlpha = 1;
  }
  const f = e === ME ? (A && A.k === 'fish' ? A : null) : e.rod; if (f) drawFishing(e, f, cx, cy, now, spr.tip);
}
function drawBug(b, cx, cy) {
  const z = b.z, open = Math.sin(b.ph * (b.st === 'rest' ? 1 : 1)) > 0 || b.st === 'rest' && Math.sin(b.ph) > 0.3, [a, c2] = b.it.cols, x = Math.round(b.x - cx), y = Math.round(b.y - z - cy);
  if (z > 2.5) { g.fillStyle = 'rgba(20,24,34,0.22)'; g.fillRect(x - 2, Math.round(b.y - cy), 4, 1); }
  if (b.night) { g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x - 4, y - 3, 9, 7); }
  g.fillStyle = a; if (open) { g.fillRect(x - 4, y - 3, 3, 4); g.fillRect(x + 2, y - 3, 3, 4); g.fillStyle = c2; g.fillRect(x - 3, y, 2, 2); g.fillRect(x + 2, y, 2, 2); } else { g.fillRect(x - 2, y - 3, 2, 4); g.fillRect(x + 1, y - 3, 2, 4); g.fillStyle = c2; g.fillRect(x - 2, y + 1, 1, 1); g.fillRect(x + 2, y + 1, 1, 1); }
  g.fillStyle = '#2a2020'; g.fillRect(x, y - 3, 1, 5);
}
const snapDev = v => Math.round(v * DPR * Z) / (DPR * Z); // snap a fractional native-pixel offset to whole device pixels
function drawEnt(o, cx, cy, now) {
  switch (o.k) {
    case 'me': case 'npc': if (o === ME) { g.save(); g.translate(snapDev(o.x - Math.round(o.x)), snapDev(o.y - Math.round(o.y))); drawChar(o, cx, cy, now); g.restore(); } else drawChar(o, cx, cy, now); break;
    case 'bug': drawBug(o, cx, cy); break;
    case 'tree': case 'bush': {
      const spr = o.k === 'tree' ? SPR.tree[o.kind][o.fruit ? 0 : 1] : SPR.bush[o.kind][o.berry ? 0 : 1];
      g.drawImage(shadowSpr(o.k === 'tree' ? 28 : 18, o.k === 'tree' ? 9 : 5), Math.round(o.x - (o.k === 'tree' ? 14 : 9) - cx), Math.round(o.y - 5 - cy));
      const sh = o.shake > 0 ? Math.round(Math.sin(now * 45) * Math.min(1.6, o.shake * 3)) : 0, X = Math.round(o.x - spr.ax - cx + sh), Y = Math.round(o.y - spr.ay - cy);
      if (o.k === 'tree' && sh === 0) drawSway(spr, X, Y, now, 1, Math.round(spr.height * 0.58)); else g.drawImage(spr, X, Y); break;
    }
    case 'fountain': {
      const spr = o.spr; g.drawImage(spr, Math.round(o.x - spr.ax - cx), Math.round(o.y - spr.ay - cy));
      g.fillStyle = 'rgba(190,235,250,0.9)'; for (let i = 0; i < 10; i++) { const ph = (now * 1.1 + i / 10) % 1, a = i * 0.628; g.fillRect(Math.round(o.x + Math.cos(a) * ph * 9 - cx), Math.round(o.y - 38 - Math.sin(ph * Math.PI) * 7 + ph * ph * 10 - cy), 1, 1); }
      break;
    }
    case 'tank': {
      g.drawImage(shadowSpr(46, 8), Math.round(o.x - 23 - cx), Math.round(o.y - 4 - cy)); const sp = o.spr, X = Math.round(o.x - sp.ax - cx), Y = Math.round(o.y - sp.ay - cy);
      g.drawImage(sp, X, Y); S.tank.slice(0, 8).forEach((f, i) => { const ic = itemIcon(f.id), d = Math.cos(now * 0.5 + i * 1.7) > 0 ? 1 : -1, fx = X + 22 + Math.sin(now * 0.5 + i * 1.7) * 11 - 5, fy = Y + 10 + (i % 3) * 4 + Math.sin(now * 1.3 + i) * 0.8; g.save(); if (d < 0) { g.translate(Math.round(fx) + 10, 0); g.scale(-1, 1); g.drawImage(ic, 0, Math.round(fy), 10, 10); } else g.drawImage(ic, Math.round(fx), Math.round(fy), 10, 10); g.restore(); });
      g.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 3; i++) { const ph = (now * 0.4 + i / 3) % 1; g.fillRect(X + 9 + i * 12, Math.round(Y + 19 - ph * 12), 1, 1); }
      break;
    }
    case 'campfire': g.drawImage(shadowSpr(26, 8), Math.round(o.x - 13 - cx), Math.round(o.y - 5 - cy)); drawCampfire(o, cx, cy, now); break;
    case 'note': {
      const read = S.notes.includes(o.idx), spr = SPR.note[read ? 1 : 0]; g.drawImage(spr, Math.round(o.x - spr.ax - cx), Math.round(o.y - spr.ay - cy));
      if (!read) { const b = Math.round(Math.sin(now * 5) * 1.5), px = Math.round(o.x - cx), py = Math.round(o.y - 27 - cy + b); g.fillStyle = '#2a1c1c'; g.fillRect(px - 2, py - 1, 4, 7); g.fillRect(px - 2, py + 7, 4, 4); g.fillStyle = '#f2b84b'; g.fillRect(px - 1, py, 2, 5); g.fillRect(px - 1, py + 8, 2, 2); }
      break;
    }
    default: {
      const spr = o.spr; if (!spr) return;
      if (o.k === 'deco' || o.k === 'rock') g.drawImage(shadowSpr(o.k === 'rock' ? 16 : 26, o.k === 'rock' ? 5 : 8), Math.round(o.x - (o.k === 'rock' ? 8 : 13) - cx), Math.round(o.y - 4 - cy));
      if (o.k === 'stall') g.drawImage(shadowSpr(48, 8), Math.round(o.x - 24 - cx), Math.round(o.y - 4 - cy));
      if (o.k === 'deco') drawSway(spr, Math.round(o.x - spr.ax - cx), Math.round(o.y - spr.ay - cy), now, 1, Math.round(spr.height * (SPR.deco.indexOf(spr) >= 4 ? 0.7 : 0.58)));
      else g.drawImage(spr, Math.round(o.x - spr.ax - cx), Math.round(o.y - spr.ay - cy));
      if (o === (target && target.ref) && (o.k === 'clutter' || o.k === 'tree' || o.k === 'bush' || o.k === 'stall' || o.k === 'board')) { }
    }
  }
}
function drawMarker(cx, cy, now) {
  if (!target) return; let x, y;
  if (target.kind === 'water') { const v = DV[target.dir]; x = ME.x + v[0] * (target.dist + 6); y = ME.y - 2 + v[1] * (target.dist + 6); g.fillStyle = 'rgba(255,255,255,0.8)'; const t = (now * 1.6) % 1; for (let i = 0; i < 8; i++) { const a = i * 0.785; g.fillRect(Math.round(x + Math.cos(a) * (3 + t * 5) - cx), Math.round(y + Math.sin(a) * (1.5 + t * 2.5) - cy), 1, 1); } return; }
  const o = target.ref; x = o.x; y = o.y - (o.k === 'tree' ? 50 : o.k === 'bug' ? 14 + o.z : o.k === 'stall' ? 38 : o.k === 'board' ? 30 : o.k === 'npc' ? 34 : o.k === 'bush' ? 22 : 14);
  const bob = Math.round(Math.sin(now * 6) * 1.5), px = Math.round(x - cx), py = Math.round(y - cy + bob); g.fillStyle = '#2a1c1c'; g.fillRect(px - 3, py - 1, 7, 2); g.fillRect(px - 2, py + 1, 5, 2); g.fillRect(px - 1, py + 3, 3, 1);
  g.fillStyle = '#f2b84b'; g.fillRect(px - 2, py, 5, 1); g.fillRect(px - 1, py + 1, 3, 1); g.fillRect(px, py + 2, 1, 1);
}
function render(now) {
  const cx = Math.round(cam.x), cy = Math.round(cam.y), K = DPR * Z;
  // the world is drawn on whole native pixels, then the whole scene is slid by the camera's fractional part (in device pixels): the camera glides instead of stepping
  g.setTransform(K, 0, 0, K, Math.round((cx - cam.x) * K), Math.round((cy - cam.y) * K)); g.imageSmoothingEnabled = false;
  g.fillStyle = '#2c5a86'; g.fillRect(-2, -2, VW + 4, VH + 4); g.drawImage(W.terrain, -cx, -cy);
  if (fxOn()) { fxWater(cx, cy, now); fxLilies(cx, cy, now); }
  const sb = Math.floor(now * 2);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 70; i++) { const x = cx + hash2(i, sb, 31) * VW, y = cy + hash2(i, sb, 32) * VH; if (hash2(i, sb, 33) < 0.55 && isWater(x, y)) g.fillRect(Math.round(x - cx), Math.round(y - cy), 2, 1); }
  for (const r of RP) {
    const u = r.t / r.max, rx = 2 + u * (r.big ? 10 : 7), ry = rx * 0.5; g.fillStyle = `rgba(235,248,252,${(1 - u) * 0.8})`;
    for (let i = 0; i < 16; i++) { const a = i * 0.3927; g.fillRect(Math.round(r.x + Math.cos(a) * rx - cx), Math.round(r.y + Math.sin(a) * ry - cy), 1, 1); }
  }
  const L = [];
  for (const o of W.objs) if (o.x > cx - 70 && o.x < cx + VW + 70 && o.y > cy - 10 && o.y < cy + VH + 90) L.push(o);
  for (const b of W.bugs) if (b.x > cx - 10 && b.x < cx + VW + 10 && b.y > cy - 10 && b.y < cy + VH + 40) L.push(b);
  L.push(ME); for (const n of NPCS) if (n.x > cx - 30 && n.x < cx + VW + 30 && n.y > cy - 10 && n.y < cy + VH + 60) L.push(n);
  L.sort((a, b) => a.y - b.y); for (const o of L) drawEnt(o, cx, cy, now);
  drawMarker(cx, cy, now);
  for (const p of PT) { g.globalAlpha = clamp(p.life / (p.max * 0.5), 0, 1); g.fillStyle = p.col; g.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.sz, p.sz); } g.globalAlpha = 1;
  // light
  const cave = W.theme === 'cave', h = hourNow(), tc = cave ? [84, 94, 138] : tintAt(h), rain = !cave && isRain();
  g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${tc[0]},${tc[1]},${tc[2]})`; g.fillRect(-2, -2, VW + 4, VH + 4);
  if (rain) { g.fillStyle = 'rgb(196,206,222)'; g.fillRect(-2, -2, VW + 4, VH + 4); }
  g.globalCompositeOperation = 'source-over';
  const fdt = Math.min(0.1, now - (FX.t || now)); FX.t = now;
  if (fxOn() && !cave) { fxClouds(cx, cy, now, clamp(((tc[0] + tc[1] + tc[2]) / 3 - 110) / 140, 0, 1) * (rain ? 0.4 : 1)); fxLeaves(fdt, cx, cy, now); }
  const dark = clamp((255 - (tc[0] + tc[1] + tc[2]) / 3) / 100, 0, 1) + (rain ? 0.15 : 0);
  if (dark > 0.15) {
    g.globalCompositeOperation = 'lighter';
    for (const f of W.fires) { const x = f.x - cx, y = f.y - 8 - cy; if (x < -90 || x > VW + 90 || y < -90 || y > VH + 90) continue; const fl = 0.85 + Math.sin(now * 13 + f.x) * 0.1, rg = g.createRadialGradient(x, y, 2, x, y, 72); rg.addColorStop(0, `rgba(255,170,80,${0.6 * Math.min(1, dark) * fl})`); rg.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = rg; g.fillRect(x - 74, y - 74, 148, 148); }
    for (const gl of W.glows) { const x = gl.x - cx, y = gl.y - 8 - cy; if (x < -60 || x > VW + 60 || y < -60 || y > VH + 60) continue; const pulse = 0.75 + Math.sin(now * 2 + gl.x * 0.1) * 0.2, rg = g.createRadialGradient(x, y, 1, x, y, 40); rg.addColorStop(0, `rgba(${gl.gc},${0.5 * pulse})`); rg.addColorStop(1, `rgba(${gl.gc},0)`); g.fillStyle = rg; g.fillRect(x - 42, y - 42, 84, 84); }
    for (const l of W.lamps) { const x = l.x - cx, y = l.y - 22 - cy; if (x < -60 || x > VW + 60 || y < -60 || y > VH + 60) continue; const rg = g.createRadialGradient(x, y, 2, x, y, 46); rg.addColorStop(0, `rgba(255,190,100,${0.5 * Math.min(1, dark)})`); rg.addColorStop(1, 'rgba(255,190,100,0)'); g.fillStyle = rg; g.fillRect(x - 48, y - 48, 96, 96); }
    g.globalCompositeOperation = 'source-over';
  }
  if (rain) { g.fillStyle = 'rgba(190,215,240,0.55)'; for (let i = 0; i < 90; i++) { const sp = 150 + hash2(i, 3, 5) * 70, x = (hash2(i, 1, 5) * (VW + 40) + now * 30) % (VW + 40) - 20, y = (hash2(i, 2, 5) * VH + now * sp) % VH; g.fillRect(Math.round(x), Math.round(y), 1, 4); } }
  if (fxOn()) fxVignette();
  // text layer
  g.textAlign = 'center'; g.font = '6px "Pixelify Sans", monospace'; g.lineJoin = 'round';
  if (ME.hold) {
    const h = ME.hold, m = h.groups[0], it = ITEM[m.id], rar = RAR[it.r], ic = itemIcon(m.id), u = Math.min(1, h.t / 0.24), sz = ic.width * 2;
    if (u > 0.5) {
      g.globalAlpha = clamp((h.dur - h.t) / 0.35, 0, 1); const x = Math.round(ME.x - cx), by = Math.round(ME.y - 38 - sz - cy) - 4, sw = (s, y, col, f) => { g.font = f; g.lineWidth = 2.4; g.strokeStyle = 'rgba(20,16,24,0.9)'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
      sw('worth ' + m.val + 'g', by, '#ffd877', '6px "Pixelify Sans", monospace');
      const meta = (m.inst.sz != null ? fmtSz(m.inst) + ' · ' : '') + rar.n; sw(meta, by - 8, '#cfd8e8', '6px "Pixelify Sans", monospace');
      sw(it.name + (m.n > 1 ? ' x' + m.n : ''), by - 17, rar.c, 'bold 8px "Pixelify Sans", monospace');
      const tags = []; if (m.isNew) tags.push(['NEW!', '#8fe09a']); if (m.inst.isBest) tags.push(['BEST SIZE!', '#78bfff']); else if (m.inst.big) tags.push(['BIG!', '#ffcf5a']);
      tags.forEach((t, i) => sw(t[0], by - 27 - i * 9, t[1], 'bold 7px "Pixelify Sans", monospace'));
      g.globalAlpha = 1; g.font = '6px "Pixelify Sans", monospace';
    }
  }
  for (const o of L) if (o.k === 'me' || o.k === 'npc') {
    if (o === ME && ME.hold) continue;
    if (o === ME) { g.save(); g.translate(snapDev(o.x - Math.round(o.x)), snapDev(o.y - Math.round(o.y))); }
    const nm = o === ME ? S.name : o.name, lv = o === ME ? S.lv : o.lv, x = Math.round(o.x - cx), y = Math.round(o.y - 38 - cy);
    g.lineWidth = 2.2; g.strokeStyle = 'rgba(20,16,24,0.85)'; const txt = nm + ' lv' + lv, w = g.measureText(txt).width; g.strokeText(txt, x, y); g.fillStyle = o === ME ? '#ffd877' : '#f5e9cf'; g.fillText(nm, x - g.measureText(' lv' + lv).width / 2, y);
    g.fillStyle = '#9fd0ff'; g.fillText(' lv' + lv, x + g.measureText(nm).width / 2, y);
    if (o.bubble) { const bw = Math.max(14, g.measureText(o.bubble).width + 8), by = y - 14; g.fillStyle = '#f5e9cf'; g.fillRect(Math.round(x - bw / 2), by, Math.round(bw), 11); g.fillStyle = '#2a1c1c'; g.fillRect(Math.round(x - bw / 2), by + 11, Math.round(bw), 1); g.fillRect(x - 1, by + 12, 2, 2); g.fillStyle = '#f5e9cf'; g.fillRect(x - 1, by + 11, 2, 2); g.fillStyle = '#2a1c1c'; g.fillText(o.bubble, x, by + 8); }
    if (o === ME) g.restore();
  }
  g.font = 'bold 7px "Pixelify Sans", monospace';
  for (const f of FL) { const u = f.t / 1.3; g.globalAlpha = 1 - u * u; g.lineWidth = 2.4; g.strokeStyle = 'rgba(20,16,24,0.9)'; g.strokeText(f.txt, Math.round(f.x - cx), Math.round(f.y - cy - u * 14)); g.fillStyle = f.col; g.fillText(f.txt, Math.round(f.x - cx), Math.round(f.y - cy - u * 14)); } g.globalAlpha = 1;
  g.textAlign = 'left';
}

// ---- hud clock -------------------------------------------------------------
function updateClock() {
  const h = hourNow(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ap = hh >= 12 ? 'pm' : 'am', h12 = hh % 12 || 12;
  $('#clock').textContent = (isRain() ? '☂ ' : isNight() ? '☾ ' : '☀ ') + h12 + ':' + String(mm).padStart(2, '0') + ap;
  $('#onlineN').textContent = 61 + Math.floor(Math.abs(Math.sin(Date.now() / 90000)) * 24) + NPCS.length;
}
$('#clock').addEventListener('click', () => { tOff += 3; updateClock(); UI.toast('Time travel (prototype): +3 hours', 'info'); });

// ---- boot ------------------------------------------------------------------
let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
  try { tick(dt); render(ts / 1000); } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
const areaDraftKey = a => a === 'island' ? MAP_DRAFT_KEY : MAP_DRAFT_KEY + '.' + a;
const defaultFor = a => a === 'cave' ? generateDefaultCave() : generateDefaultMap();
function goArea(to, sx, sy) { // fade out, load the other map, drop the player at its target spot
  if (fading) return; fading = true; const f = $('#fade'); f.classList.add('on'); sfx('pop');
  setTimeout(() => {
    const done = map => {
      AREA = to; W.bugs = []; initWorld(map, false); ME.x = sx || W.spawn.x; ME.y = sy || W.spawn.y; ME.dir = 'd'; autoWalk = null; A = null; ME.hold = null;
      NPCS = []; for (let i = 0; i < (to === 'cave' ? 3 : 10); i++) NPCS.push(makeNPC(i)); NPCS.forEach(npcThink); FX.leaves = [];
      setTimeout(() => { f.classList.remove('on'); fading = false; if (to === 'cave') UI.toast('A quiet cave. The pools here hold their own fish.', 'info'); }, 140);
    };
    fetch('maps/' + to + '.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(m => done(validMap(m) ? m : defaultFor(to))).catch(() => done(defaultFor(to)));
  }, 330);
}
function loadMapData(cb) {
  AREA = qs.get('area') || 'island';
  const ok = m => validMap(m) ? m : null;
  let draft = null; try { if (qs.get('map') === 'draft' || EDIT) draft = ok(JSON.parse(localStorage.getItem(areaDraftKey(AREA)))); } catch (e) { }
  if (draft) return cb(draft, 'draft');
  fetch('maps/' + AREA + '.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(m => ok(m) ? cb(m, 'file') : cb(defaultFor(AREA), 'default')).catch(() => cb(defaultFor(AREA), 'default'));
}
function boot() {
  loadState(); if (qs.has('gems')) S.gems += Math.max(0, +qs.get('gems') || 0); resize(); addEventListener('resize', resize);
  loadAssets(failed => {
  if (failed.length) console.error('Missing assets:', failed.join(', '));
  buildSprites(); if (ASSET.ok) buildPropSprites(); buildClouds(); if (!EDIT) UI.init();
  setTimeout(() => prepareAtlas(() => loadMapData((map, src) => {
    initWorld(map, EDIT);
    if (EDIT) { startEditor(src); return; }
    ME = { k: 'me', x: W.spawn.x, y: W.spawn.y, dir: 'd', t: 0, moving: false, bubble: null, bt: 0 };
    for (let i = 0; i < 10; i++) NPCS.push(makeNPC(i)); NPCS.forEach(npcThink);
    updateClock(); setInterval(updateClock, 5000);
    $('#loading').classList.add('hidden'); requestAnimationFrame(loop);
    if (S.lv >= 2 && !S.created) setTimeout(() => UI.openCreator(true), 600);
    if (src === 'draft') UI.toast('Playing your draft map', 'info');
    window.__game = { get ME() { return ME; }, get A() { return A; }, S, W, NPCS, get target() { return target; } };
  })), 40);
  });
}
boot();
