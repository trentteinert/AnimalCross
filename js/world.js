'use strict';
const TS = 16, CX = 32 * TS, CY = 32 * TS, MAP_MIN = 32, MAP_MAX = 200;
let MW = 64, MH = 64, PW = MW * TS, PH = MH * TS; // map size in tiles / pixels; maps can be any size from MAP_MIN to MAP_MAX
function setMapSize(w, h) { MW = w; MH = h; PW = w * TS; PH = h * TS; DECK = new Uint8Array(w * h); }
// Generator constants: only used to author the DEFAULT island. A saved map (maps/island.json) replaces all of this.
const POND = { x: 43 * TS, y: 25 * TS, r: 4 * TS };
const PLAZA = { x: 32 * TS, y: 30 * TS, r: 5.2 * TS };
const PATHS = [[31, 35, 31, 52, 1.3], [36, 30, 39, 28.5, 1.2], [28, 30, 14, 31.5, 1.2], [32, 25, 32, 12, 1.2]];
let DECK = new Uint8Array(MW * MH); // wooden / stone decking laid over the tiles (piers, bridges, boardwalks): 0 = none, 1-3 = plank styles, 4-6 = the same with rails
let STRUCTS = [], LASTD = 0, MAPDATA = null; // STRUCTS: piers and bridges (px rects laid over the tile grid)

function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
function vn(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function coastD(px, py) {
  const dx = (px - CX) / TS, dy = (py - CY) / TS, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), ca = Math.cos(a), sa = Math.sin(a);
  const R = 22 + (vn(ca * 1.7 + 10, sa * 1.7 + 10, 3) - 0.5) * 4 + (vn(ca * 4 + 3, sa * 4 + 3, 5) - 0.5) * 2;
  return R - r + (vn(px / 10, py / 10, 9) - 0.5) * 1.2;
}
function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy; let t = l2 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
}

// ---- tile grid -------------------------------------------------------------
// 0 deep, 1 sea shallow, 2 sand, 3 grass, 4 path, 5 cobble, 6 pond, 7 pier (pier is a rectangle laid over the grid)
let GRID = null, DISTG = null;
function genType(px, py) { // only used to author the default island
  const d = coastD(px, py);
  if (d <= -3) return 0; if (d <= 0) return 1;
  const pr = Math.hypot(px - POND.x, (py - POND.y) * 1.25) + (vn(px / 9, py / 9, 2) - 0.5) * 12;
  if (pr < POND.r) return 6; if (pr < POND.r + 22) return 2;
  if (Math.hypot(px - PLAZA.x, py - PLAZA.y) + (vn(px / 7, py / 7, 6) - 0.5) * 5 < PLAZA.r) return 5;
  if (d > 2.2) for (const s of PATHS) if (segDist(px, py, s[0] * TS, s[1] * TS, s[2] * TS, s[3] * TS) < s[4] * TS + (vn(px / 8, py / 8, 8) - 0.5) * 6) return 4;
  return d <= 3.5 ? 2 : 3;
}
function genGrid() {
  setMapSize(64, 64); GRID = new Uint8Array(MW * MH);
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) GRID[ty * MW + tx] = genType(tx * TS + TS / 2, ty * TS + TS / 2);
  for (let pass = 0; pass < 2; pass++) { // remove single-tile specks so edges stay clean
    const cp = GRID.slice();
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = cp[y * MW + x], n = [x > 0 ? cp[y * MW + x - 1] : 0, x < MW - 1 ? cp[y * MW + x + 1] : 0, y > 0 ? cp[(y - 1) * MW + x] : 0, y < MH - 1 ? cp[(y + 1) * MW + x] : 0];
      if (!n.includes(t)) { const cnt = {}; n.forEach(v => cnt[v] = (cnt[v] || 0) + 1); GRID[y * MW + x] = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; }
    }
  }
  buildDist();
}
function buildDist() { // distance (in tiles) from every land tile to the nearest water tile
  DISTG = new Uint8Array(MW * MH).fill(255); const q = [];
  for (let i = 0; i < GRID.length; i++) { const t = GRID[i]; if (t <= 1 || t === 6) { DISTG[i] = 0; q.push(i); } }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MW, y = (i / MW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; const j = ny * MW + nx; if (DISTG[j] === 255) { DISTG[j] = DISTG[i] + 1; q.push(j); } }
  }
}
function typeAt(px, py) {
  for (const s of STRUCTS) if (px >= s.x0 && px < s.x1 && py >= s.y0 && py < s.y1) { LASTD = -1; return 7; }
  const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) { LASTD = 0; return 0; }
  const i = ty * MW + tx; if (DECK[i]) { LASTD = -1; return 7; }
  LASTD = DISTG[i]; return GRID[i];
}
const isWater = (x, y) => { const t = typeAt(x, y); return t === 0 || t === 1 || t === 6; };

const W = { terrain: null, objs: [], solids: [], trees: [], bushes: [], clutter: [], patches: [], bugs: [], shore: [], lamps: [], notes: [], fires: [], glows: [], lilies: [], theme: 'day', spawn: { x: 0, y: 0 }, hub: { x: 0, y: 0 }, stall: null, board: null };

// ---- terrain rendering (dual-grid autotiling, see tiles.js) -------------------
const LVL = [0, 1, 2, 3, 4, 5, 2];
const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? 0 : GRID[ty * MW + tx];
function renderTerrain() {
  const A = atlasFor(W.theme), c = mk(PW, PH);
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) c.g.drawImage(A, Math.floor(hash2(tx, ty, 21) * 3) * 16, 0, 16, 16, tx * 16, ty * 16, 16, 16);
  for (let L = 1; L <= 6; L++) for (let j = 0; j <= MH; j++) for (let i = 0; i <= MW; i++) {
    const t = [tileAt(i - 1, j - 1), tileAt(i, j - 1), tileAt(i - 1, j), tileAt(i, j)]; let m = 0;
    for (let k = 0; k < 4; k++) if (L === 6 ? t[k] === 6 : LVL[t[k]] >= L) m |= 1 << k;
    if (!m) continue; const hv = hash2(i, j, 30 + L), col = m === 15 ? 32 + (hv > 0.9 ? 3 : Math.floor(hv / 0.9 * 3)) : m + 16 * (hv > 0.5 ? 1 : 0);
    c.g.drawImage(A, col * 16, L * 16, 16, 16, i * 16 - 8, j * 16 - 8, 16, 16);
  }
  decorate(c); for (const s of STRUCTS) drawStruct(c, s); drawDeck(c); return c;
}
function decorate(c) { // every decision is a per-tile hash so editing one tile never reshuffles the rest of the map
  const tufts = [0, 1, 2].map(k => { const t = mk(7, 5); RC(t, 1, 2, 1, 3, '#5e8438'); RC(t, 3, k & 1, 1, 5 - (k & 1), '#6a9040'); RC(t, 5, 2 - (k >> 1), 1, 3 + (k >> 1), '#5e8438'); PX(t, 3, k & 1, '#8fb853'); return t; });
  for (let i = 0; i < 160; i++) { // very soft tonal patches so big meadows are not one flat colour
    const x = hash2(i, 1, 501) * PW, y = hash2(i, 2, 501) * PH, tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    if (GRID[ty * MW + tx] !== 3 || DISTG[ty * MW + tx] < 4) continue;
    EL(c, Math.round(x), Math.round(y), 10 + hash2(i, 3, 501) * 10, 7 + hash2(i, 4, 501) * 6, i & 1 ? 'rgba(214,170,64,0.06)' : 'rgba(60,110,50,0.06)');
  }
  for (let ty = 1; ty < MH - 1; ty++) for (let tx = 1; tx < MW - 1; tx++) {
    const t = GRID[ty * MW + tx], ox = tx * TS, oy = ty * TS, d = DISTG[ty * MW + tx], h = k => hash2(tx, ty, 600 + k);
    const same = GRID[ty * MW + tx - 1] === t && GRID[ty * MW + tx + 1] === t && GRID[(ty - 1) * MW + tx] === t && GRID[(ty + 1) * MW + tx] === t;
    if (!same) continue;
    if (t === 3) {
      if (h(0) < 0.34) c.g.drawImage(tufts[Math.floor(h(1) * 3)], ox + 1 + Math.floor(h(2) * 8), oy + 1 + Math.floor(h(3) * 9));
      if (h(4) < 0.05) PX(c, ox + 2 + Math.floor(h(5) * 11), oy + 2 + Math.floor(h(6) * 11), h(7) < 0.5 ? '#f5f0e0' : '#f2d65a');
      if (h(8) < 0.03) RC(c, ox + Math.floor(h(9) * 14), oy + Math.floor(h(10) * 14), 2, 1, h(11) < 0.5 ? '#d8802f' : '#c0482f');
    } else if (t === 2 && d >= 2) {
      if (h(0) < 0.1) { const px = ox + 2 + Math.floor(h(1) * 11), py = oy + 2 + Math.floor(h(2) * 11); RC(c, px, py, 2, 1, '#bfa874'); PX(c, px, py - 1, '#f4ead0'); }
    } else if (t === 4 && h(0) < 0.12) PX(c, ox + 2 + Math.floor(h(1) * 11), oy + 2 + Math.floor(h(2) * 11), '#8e8c86');
  }
}
const STRUCT_STYLES = [
  { a: '#a8723d', b: '#b27c46', hi: '#c99358', lo: '#6e4626', beam: '#6b4423', beamHi: '#8a5a30', post: '#3f2a1a', rail: '#7a5638' },
  { a: '#6e4a30', b: '#7a5238', hi: '#92684a', lo: '#3f2a1a', beam: '#4a3020', beamHi: '#6b4a34', post: '#2a1c14', rail: '#4a3020' },
  { a: '#c9b890', b: '#d2c29c', hi: '#e6d8b4', lo: '#8e7e5a', beam: '#8a7a58', beamHi: '#a8987a', post: '#5a4e38', rail: '#a8987a' }];
const STRUCT_STYLE_NAMES = ['Driftwood', 'Dark oak', 'Pale stone'];
function structPx(s) { return { t: s.t || 'pier', style: s.style | 0, rails: !!s.rails, posts: s.posts !== false, x0: s.x0 * TS, y0: s.y0 * TS, x1: s.x1 * TS, y1: s.y1 * TS, src: s, isStruct: true }; }
function drawStruct(c, s) { // planks run across the long axis; drawn upright then rotated for horizontal bridges and piers
  const vert = (s.y1 - s.y0) >= (s.x1 - s.x0), w = vert ? s.x1 - s.x0 : s.y1 - s.y0, h = vert ? s.y1 - s.y0 : s.x1 - s.x0, st = STRUCT_STYLES[s.style % 3];
  const wat = (x, y) => { const t = tileAt(Math.floor(x / TS), Math.floor(y / TS)); return t <= 1 || t === 6; };
  const cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2;
  const capA = vert ? wat(cx, s.y0 - 6) : wat(s.x0 - 6, cy), capB = vert ? wat(cx, s.y1 + 6) : wat(s.x1 + 6, cy);
  const tc = mk(w + 8, h + 8), o = 4;
  tc.g.fillStyle = 'rgba(14,34,60,0.28)'; tc.g.fillRect(o + 3, o + 3, w, h);
  for (let y = 0; y < h; y += 4) {
    const k = y >> 2;
    RC(tc, o, o + y, w, 4, k & 1 ? st.b : st.a); RC(tc, o, o + y, w, 1, st.hi); RC(tc, o, o + y + 3, w, 1, st.lo);
    RC(tc, o + 3, o + y + 1, 1, 1, st.post); RC(tc, o + w - 4, o + y + 1, 1, 1, st.post);
    if (hash2(k, 4, 9 + s.style) < 0.35) RC(tc, o + 5 + Math.floor(hash2(k, 5, 9) * Math.max(1, w - 14)), o + y + 1, 5, 1, st.a);
  }
  RC(tc, o, o, 2, h, st.beam); RC(tc, o + w - 2, o, 2, h, st.beam); RC(tc, o + 1, o, 1, h, st.beamHi); RC(tc, o + w - 2, o, 1, h, st.beamHi);
  if (s.rails) for (let y = 0; y <= h - 4; y += 16) for (const x of [o - 1, o + w - 3]) { RC(tc, x, o + y, 4, 4, st.post); RC(tc, x, o + y, 4, 1, st.hi); RC(tc, x + 1, o + y + 1, 2, 2, st.rail); }
  if (s.posts) for (let y = 6; y < h; y += 40) for (const x of [o - 2, o + w - 2]) { RC(tc, x, o + y, 4, 6, st.post); RC(tc, x, o + y, 4, 1, st.beamHi); }
  if (capA) RC(tc, o - 2, o - 2, w + 4, 2, st.post); if (capB) RC(tc, o - 2, o + h, w + 4, 2, st.post);
  if (vert) c.g.drawImage(tc, s.x0 - o, s.y0 - o);
  else { c.g.save(); c.g.translate(s.x0 - o, s.y0 + w + o); c.g.rotate(-Math.PI / 2); c.g.drawImage(tc, 0, 0); c.g.restore(); }
}
const deckAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? 0 : DECK[y * MW + x];
function nearDeck(x, y, r) { const tx = Math.floor(x / TS), ty = Math.floor(y / TS), n = Math.ceil(r / TS); for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) if (deckAt(tx + dx, ty + dy)) return true; return false; }
function drawDeck(c) { // tile-based decking: planks run along the walkway, open edges get a beam, rails and pilings appear by themselves
  const wat = (x, y) => { if (deckAt(x, y)) return false; const t = tileAt(x, y); return t <= 1 || t === 6; };
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) { // pass 1: shadow and pilings under the planks
    const id = DECK[ty * MW + tx]; if (!id) continue; const ox = tx * TS, oy = ty * TS, st = STRUCT_STYLES[(id - 1) % 3];
    c.g.fillStyle = 'rgba(14,34,60,0.28)'; c.g.fillRect(ox + 2, oy + 3, TS, TS);
    if (wat(tx, ty + 1)) for (const px of [ox + 1, ox + TS - 5]) { RC(c, px, oy + TS - 2, 4, 8, st.post); RC(c, px, oy + TS - 2, 4, 1, st.beamHi); }
  }
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) { // pass 2: planks and edge beams
    const id = DECK[ty * MW + tx]; if (!id) continue; const ox = tx * TS, oy = ty * TS, st = STRUCT_STYLES[(id - 1) % 3];
    const L = deckAt(tx - 1, ty), R = deckAt(tx + 1, ty), U = deckAt(tx, ty - 1), D = deckAt(tx, ty + 1), horiz = (L || R) && !(U || D);
    if (!horiz) for (let y = 0; y < TS; y += 4) {
      const k = ty * 4 + (y >> 2); RC(c, ox, oy + y, TS, 4, k & 1 ? st.b : st.a); RC(c, ox, oy + y, TS, 1, st.hi); RC(c, ox, oy + y + 3, TS, 1, st.lo);
      if (hash2(tx, k, 9 + id) < 0.35) RC(c, ox + 3 + Math.floor(hash2(tx, k, 5) * 8), oy + y + 1, 4, 1, st.a);
    } else for (let x = 0; x < TS; x += 4) {
      const k = tx * 4 + (x >> 2); RC(c, ox + x, oy, 4, TS, k & 1 ? st.b : st.a); RC(c, ox + x, oy, 1, TS, st.hi); RC(c, ox + x + 3, oy, 1, TS, st.lo);
      if (hash2(k, ty, 9 + id) < 0.35) RC(c, ox + x + 1, oy + 3 + Math.floor(hash2(k, ty, 5) * 8), 1, 4, st.a);
    }
    if (!U) { RC(c, ox, oy, TS, 2, st.beam); RC(c, ox, oy, TS, 1, st.beamHi); }
    if (!D) { RC(c, ox, oy + TS - 2, TS, 2, st.beam); RC(c, ox, oy + TS - 2, TS, 1, st.beamHi); }
    if (!L) { RC(c, ox, oy, 2, TS, st.beam); RC(c, ox, oy, 1, TS, st.beamHi); }
    if (!R) { RC(c, ox + TS - 2, oy, 2, TS, st.beam); RC(c, ox + TS - 2, oy, 1, TS, st.beamHi); }
  }
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) { // pass 3: rails along open edges that face water (so walkway ends stay open)
    const id = DECK[ty * MW + tx]; if (id < 4) continue; const ox = tx * TS, oy = ty * TS, st = STRUCT_STYLES[(id - 1) % 3];
    const post = (x, y) => { RC(c, x, y, 4, 4, st.post); RC(c, x, y, 4, 1, st.hi); RC(c, x + 1, y + 1, 2, 2, st.rail); };
    if (wat(tx, ty - 1)) { RC(c, ox + 2, oy - 1, TS - 4, 2, st.rail); post(ox - 1, oy - 2); post(ox + TS - 3, oy - 2); }
    if (wat(tx, ty + 1)) { RC(c, ox + 2, oy + TS - 1, TS - 4, 2, st.rail); post(ox - 1, oy + TS - 2); post(ox + TS - 3, oy + TS - 2); }
    if (wat(tx - 1, ty)) { RC(c, ox - 1, oy + 2, 2, TS - 4, st.rail); post(ox - 2, oy - 1); post(ox - 2, oy + TS - 3); }
    if (wat(tx + 1, ty)) { RC(c, ox + TS - 1, oy + 2, 2, TS - 4, st.rail); post(ox + TS - 2, oy - 1); post(ox + TS - 2, oy + TS - 3); }
  }
}
function serializeDeck() { const rows = []; for (let ty = 0; ty < MH; ty++) { let r = ''; for (let tx = 0; tx < MW; tx++) r += DECK[ty * MW + tx]; rows.push(r); } return rows; }
function paintFlowers(c) {
  for (const p of W.patches) {
    p.fl = []; const r = rng(((p.x * 73856093) ^ (p.y * 19349663)) >>> 0);
    for (let i = 0; i < 16; i++) {
      const a = r() * 6.28, rr = 4 + r() * 22, fx = Math.round(p.x + Math.cos(a) * rr), fy = Math.round(p.y + Math.sin(a) * rr * 0.8), f = Math.floor(r() * SPR.flower.length);
      if (typeAt(fx, fy) !== 3) continue; p.fl.push({ x: fx, y: fy }); const fs = SPR.flower[f]; c.g.drawImage(fs, fx - (fs.ax != null ? fs.ax : 3), fy - (fs.ay != null ? fs.ay : 6) + 2);
    }
  }
}

// ---- placement helpers (used when authoring the default map) ---------------------
const okGrass = (x, y, rad) => [[0, 0], [rad, 0], [-rad, 0], [0, rad], [0, -rad]].every(o => typeAt(x + o[0], y + o[1]) === 3);
const okLand = (x, y, rad) => [[0, 0], [rad, 0], [-rad, 0], [0, rad], [0, -rad]].every(o => { const t = typeAt(x + o[0], y + o[1]); return t >= 2 && t !== 6 && t !== 7; });
const distSq = (a, b, c, d) => (a - c) ** 2 + (b - d) ** 2;
function nearAny(x, y, min, list) { for (const o of list) if (distSq(x, y, o.x, o.y) < min * min) return true; return false; }
function onPathOrPlaza(x, y) { return Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r + 22 || PATHS.some(s => segDist(x, y, s[0] * TS, s[1] * TS, s[2] * TS, s[3] * TS) < (s[4] + 1.6) * TS); }

// ---- the map file --------------------------------------------------------------------
// { v:1, w:64, h:64, tiles:[64 rows of 64 digits], pier:{x0,y0,x1,y1} in tiles | null, spawn:{x,y} in px,
//   objects:[{k:'tree',kind,x,y} {k:'bush',kind,x,y} {k:'deco',v,x,y} {k:'rock'|'lamp'|'bench'|'stall'|'board'|'fountain',x,y} {k:'note',x,y,text} {k:'patch',x,y}] }
function freeSpot(tx, ty, pad) { // nearest open grass to a wanted tile position
  for (let rr = 0; rr < 260; rr += 8) for (let a = 0; a < 6.28; a += 0.6) {
    const x = Math.round(tx * TS + Math.cos(a) * rr), y = Math.round(ty * TS + Math.sin(a) * rr);
    if (okGrass(x, y, 20) && !nearAny(x, y, pad || 36, MAPDATA ? MAPDATA.objects : [])) return { x, y };
  }
  return null;
}
const SHOP_SPOTS = [['portal', 32, 13.5, { to: 'cave', sx: 512, sy: 912 }], ['tackle', 27.5, 43.5], ['tank', 38.5, 33], ['leaders', 28, 34.5], ['gemshop', 20, 32.5], ['outfitshop', 22, 23.5]];
function addShops(objects) { // adds any shop that is missing from the list; returns how many were added
  let n = 0; MAPDATA = MAPDATA || { objects };
  for (const sp of SHOP_SPOTS) { if (objects.some(o => o.k === sp[0])) continue; const p = freeSpot(sp[1], sp[2]); if (p) { objects.push(Object.assign({ k: sp[0], x: p.x, y: p.y }, sp[3] || {})); n++; } }
  return n;
}
function generateDefaultMap() {
  genGrid();
  let pty = 40; while (pty < MH - 12 && GRID[pty * MW + 31] > 1) pty++;
  const pier = { t: 'pier', x0: 30, y0: pty - 1, x1: 32, y1: pty + 8, style: 0, rails: false, posts: true };
  STRUCTS = [structPx(pier)];
  const OBJ = [], wr = rng(2024), put = o => { OBJ.push(o); return o; }, of = ks => OBJ.filter(o => ks.includes(o.k)), R = v => Math.round(v * TS);
  put({ k: 'fountain', x: PLAZA.x, y: PLAZA.y + 18 }); put({ k: 'stall', x: R(24.5), y: R(28.5) }); put({ k: 'board', x: R(37.5), y: R(26.5) });
  [[29.5, 25], [34.5, 25]].forEach(p => put({ k: 'bench', x: R(p[0]), y: R(p[1]) }));
  [[27, 26], [37, 29.8], [27, 34], [37, 34], [30, 41], [32.8, 47], [41, 28], [19.5, 31.5], [32.5, 18]].forEach(p => put({ k: 'lamp', x: R(p[0]), y: R(p[1]) }));
  const kinds = ['apple', 'orange', 'pear', 'plum'];
  [[40, 35], [44, 33], [47, 36], [41, 39], [45, 40], [38, 42], [23, 37], [20, 34], [26, 41], [36, 45], [48, 31], [34, 38.5]].forEach((p, i) => { const x = R(p[0]), y = R(p[1]); if (okGrass(x, y, 8)) put({ k: 'tree', kind: kinds[i % 4], x, y }); });
  const bk = ['blueberry', 'raspberry', 'blackberry', 'elderberry'];
  [[22, 28], [19, 26], [24, 22], [28, 21], [35, 21], [39, 23], [20, 37], [28, 37], [46, 29], [41, 31], [34, 41], [24, 33]].forEach((p, i) => { const x = R(p[0]), y = R(p[1]); if (okGrass(x, y, 6)) put({ k: 'bush', kind: bk[i % 4], x, y }); });
  let tries = 0, placed = 0;
  while (placed < 70 && tries++ < 1500) {
    const x = Math.floor(wr() * PW), y = Math.floor(wr() * PH);
    if (!okGrass(x, y, 10) || onPathOrPlaza(x, y)) continue;
    if (nearAny(x, y, 26, of(['tree', 'deco', 'bush', 'lamp']))) continue;
    if (DISTG[Math.floor(y / TS) * MW + Math.floor(x / TS)] < 5) continue;
    put({ k: 'deco', v: Math.floor(wr() * 6), x, y }); placed++;
  }
  tries = 0; placed = 0;
  while (placed < 10 && tries++ < 600) {
    const x = Math.floor(wr() * PW), y = Math.floor(wr() * PH);
    if (!okLand(x, y, 8) || onPathOrPlaza(x, y) || nearAny(x, y, 24, OBJ)) continue;
    put({ k: 'rock', x, y }); placed++;
  }
  [[22, 24.5], [37, 19.5], [26, 41.5], [47, 33.5], [34, 46]].forEach(p => {
    let x = R(p[0]), y = R(p[1]);
    if (!okGrass(x, y, 14)) { let found = false; for (let rr = 8; rr < 120 && !found; rr += 8) for (let a = 0; a < 6.28 && !found; a += 0.5) { const nx = Math.round(x + Math.cos(a) * rr), ny = Math.round(y + Math.sin(a) * rr); if (okGrass(nx, ny, 14)) { x = nx; y = ny; found = true; } } if (!found) return; }
    put({ k: 'patch', x, y });
  });
  [[33.3, 47.5], [29.2, 43.5], [33.4, 39.5], [29.4, 36.6], [35.8, 33.4], [23, 29], [28.2, 49.5], [33.5, 21]].forEach((p, i) => {
    let x = R(p[0]), y = R(p[1]);
    if (!okLand(x, y, 3)) { for (let rr = 6; rr < 60; rr += 6) { let f = false; for (let a = 0; a < 6.28 && !f; a += 0.7) { const nx = Math.round(x + Math.cos(a) * rr), ny = Math.round(y + Math.sin(a) * rr); if (okLand(nx, ny, 3)) { x = nx; y = ny; f = true; } } if (f) break; } }
    put({ k: 'note', x, y, text: NOTES[i] });
  });
  MAPDATA = { objects: OBJ }; addShops(OBJ);
  return { v: 1, w: MW, h: MH, tiles: serializeTiles(), pier: null, structs: [pier], spawn: { x: 31 * TS, y: (pty + 8) * TS - 14 }, objects: OBJ };
}

function carve(set, x0, y0, x1, y1, w, t) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) if (dx * dx + dy * dy <= w * w + 0.5) set(Math.round(x + dx), Math.round(y + dy), t); } }
function smoothGrid() {
  for (let pass = 0; pass < 2; pass++) {
    const cp = GRID.slice();
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = cp[y * MW + x], n = [x > 0 ? cp[y * MW + x - 1] : 0, x < MW - 1 ? cp[y * MW + x + 1] : 0, y > 0 ? cp[(y - 1) * MW + x] : 0, y < MH - 1 ? cp[(y + 1) * MW + x] : 0];
      if (!n.includes(t)) { const cnt = {}; n.forEach(v => cnt[v] = (cnt[v] || 0) + 1); GRID[y * MW + x] = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; }
    }
  }
}
function generateDefaultCave() { // rock (0) with carved chambers (3), a stone path (4), gravel ledges (2) and glowing pools (6)
  setMapSize(64, 64); GRID = new Uint8Array(MW * MH); STRUCTS = [];
  const set = (x, y, t) => { if (x > 1 && y > 1 && x < MW - 2 && y < MH - 1) GRID[y * MW + x] = t; };
  const blob = (cx, cy, rx, ry, t, seed) => { for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const dx = (x - cx) / rx, dy = (y - cy) / ry, n = (vn(x / 4.5, y / 4.5, seed) - 0.5) * 0.55; if (dx * dx + dy * dy + n < 1) set(x, y, t); } };
  blob(32, 30, 17, 12, 3, 11); blob(14, 16, 6.5, 5.5, 3, 12); blob(50, 15, 5.5, 5.5, 3, 13); blob(47, 45, 6.5, 5, 3, 14);
  carve(set, 32, 40, 32, 62, 1.5, 3); carve(set, 23, 24, 15, 18, 1.5, 3); carve(set, 41, 24, 49, 17, 1.5, 3); carve(set, 40, 37, 46, 43, 1.5, 3);
  blob(24, 29, 4.5, 3.2, 6, 21); blob(41, 33, 5, 3.6, 6, 22); blob(14, 16, 2.8, 2.2, 6, 23); blob(50, 15, 2.8, 2.4, 6, 24); blob(47, 45, 3, 2.3, 6, 25);
  carve(set, 32, 61, 32, 35, 1, 4); carve(set, 32, 36, 36, 32, 1, 4);
  smoothGrid();
  const cp = GRID.slice(); for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) if (cp[y * MW + x] === 3 && [cp[y * MW + x - 1], cp[y * MW + x + 1], cp[(y - 1) * MW + x], cp[(y + 1) * MW + x]].includes(0)) GRID[y * MW + x] = 2;
  buildDist();
  const OBJ = [], r = rng(515), put = o => { OBJ.push(o); return o; }, R = v => Math.round(v * TS);
  put({ k: 'portal', style: 'exit', to: 'island', sx: 512, sy: 224, x: R(32), y: R(60) });
  [[29.5, 55], [34.5, 55]].forEach(p => put({ k: 'lamp', x: R(p[0]), y: R(p[1]) }));
  put({ k: 'campfire', x: R(36.5), y: R(37) }); put({ k: 'logseat', x: R(36.5), y: R(39.5) }); put({ k: 'barrel', x: R(40), y: R(38.5) });
  put({ k: 'note', x: R(30.5), y: R(52), text: 'Cave pools hold fish you will not find outside. Look for the glow.' }); put({ k: 'note', x: R(27), y: R(34), text: 'Crystal eels and ghostfins like the dark. Good bait helps.' });
  const floor = (x, y) => GRID[y * MW + x] === 3 && DISTG[y * MW + x] >= 2;
  const placeMany = (n, make, min) => { let tries = 0, got = 0; while (got < n && tries++ < 2500) { const tx = 3 + Math.floor(r() * (MW - 6)), ty = 3 + Math.floor(r() * (MH - 6)); if (!floor(tx, ty)) continue; const x = R(tx) + Math.floor(r() * 12) + 2, y = R(ty) + Math.floor(r() * 12) + 6; if (nearAny(x, y, min, OBJ) || Math.abs(tx - 32) < 3 && ty > 34) continue; put(make(x, y)); got++; } };
  MAPDATA = { objects: OBJ };
  placeMany(16, (x, y) => ({ k: 'stalagmite', x, y }), 34); placeMany(12, (x, y) => ({ k: 'crystal', kind: r() < 0.5 ? 'blue' : 'purple', x, y }), 40); placeMany(12, (x, y) => ({ k: 'mushroom', kind: r() < 0.5 ? 'cyan' : 'pink', x, y }), 40); placeMany(8, (x, y) => ({ k: 'rock', x, y }), 40);
  return { v: 1, w: MW, h: MH, theme: 'cave', tiles: serializeTiles(), pier: null, structs: [], spawn: { x: R(32), y: R(57) }, objects: OBJ };
}
function serializeTiles() { const rows = []; for (let ty = 0; ty < MH; ty++) { let s = ''; for (let tx = 0; tx < MW; tx++) s += GRID[ty * MW + tx]; rows.push(s); } return rows; }
function serializeMap() { return { v: 1, w: MW, h: MH, tiles: serializeTiles(), deck: serializeDeck(), pier: null, theme: MAPDATA.theme || 'day', structs: [], spawn: MAPDATA.spawn, objects: MAPDATA.objects }; }
function validMap(m) {
  if (!(m && m.v === 1 && Array.isArray(m.tiles) && m.spawn && Array.isArray(m.objects))) return false;
  const w = m.w || 64, h = m.h || 64; if (!Number.isInteger(w) || !Number.isInteger(h) || w < MAP_MIN || h < MAP_MIN || w > MAP_MAX || h > MAP_MAX) return false;
  return m.tiles.length === h && m.tiles.every(r => typeof r === 'string' && r.length === w);
}

const SOLIDS = { tree: [[-4, -4, 8, 5], 22], bush: [[-6, -4, 12, 4], 16], rock: [[-7, -4, 14, 4]], lamp: [[-2, -3, 4, 3]], bench: [[-12, -6, 24, 6]], stall: [[-22, -9, 44, 9], 18], board: [[-9, -5, 18, 5], 14], fountain: [[-23, -14, 46, 14]], tackle: [[-22, -9, 44, 9], 18], gemshop: [[-22, -9, 44, 9], 18], outfitshop: [[-22, -9, 44, 9], 18], tank: [[-20, -5, 40, 5], 18], leaders: [[-12, -4, 24, 4], 16], portal: [[-20, -6, 40, 6], 22], stalagmite: [[-5, -4, 10, 4]], campfire: [[-6, -4, 12, 4]], tent: [[-16, -5, 32, 5]], logseat: [[-12, -4, 24, 4]], crate: [[-6, -5, 12, 5]], barrel: [[-5, -4, 10, 4]], signpost: [[-3, -3, 6, 3]], fence: [[-25, -3, 50, 3]] };
function instantiate(s) {
  let o;
  switch (s.k) {
    case 'tree': if (!SPR.tree[s.kind]) return; o = { k: 'tree', kind: s.kind, fruit: true, regrow: 0, shake: 0 }; W.trees.push(o); break;
    case 'bush': if (!SPR.bush[s.kind]) return; o = { k: 'bush', kind: s.kind, berry: true, regrow: 0, shake: 0 }; W.bushes.push(o); break;
    case 'deco': o = { k: 'deco', spr: SPR.deco[(s.v | 0) % SPR.deco.length] }; break;
    case 'rock': o = { k: 'rock', spr: SPR.rocks ? SPR.rocks[Math.floor(hash2(s.x, s.y, 5) * SPR.rocks.length)] : SPR.rock }; break;
    case 'lamp': o = { k: 'lamp', spr: SPR.lamp }; W.lamps.push(o); break;
    case 'bench': o = { k: 'bench', spr: SPR.bench }; break;
    case 'stall': o = { k: 'stall', spr: SPR.stall }; W.stall = o; break;
    case 'board': o = { k: 'board', spr: SPR.board }; W.board = o; break;
    case 'fountain': o = { k: 'fountain', spr: SPR.fountain }; break;
    case 'note': o = { k: 'note', idx: W.notes.length, text: s.text || '', spr: SPR.note[0], ia: 18 }; W.notes.push(o); break;
    case 'tackle': o = { k: 'tackle', spr: SPR.tackle }; break;
    case 'gemshop': o = { k: 'gemshop', spr: SPR.gemshop }; break;
    case 'outfitshop': o = { k: 'outfitshop', spr: SPR.outfitshop }; break;
    case 'tank': o = { k: 'tank', spr: SPR.tank }; break;
    case 'leaders': o = { k: 'leaders', spr: SPR.leaders }; break;
    case 'portal': o = { k: 'portal', to: s.to || 'island', sx: s.sx || 0, sy: s.sy || 0, style: s.style, spr: s.style === 'exit' ? SPR.portalExit : SPR.portalCave }; break;
    case 'crystal': o = { k: 'crystal', spr: s.kind === 'purple' ? SPR.crystalP : SPR.crystalB }; W.glows.push(o); o.gc = s.kind === 'purple' ? '176,112,240' : '95,168,255'; break;
    case 'mushroom': o = { k: 'mushroom', spr: s.kind === 'pink' ? SPR.mushroomP : SPR.mushroom }; W.glows.push(o); o.gc = s.kind === 'pink' ? '232,111,168' : '95,216,208'; break;
    case 'stalagmite': o = { k: 'stalagmite', spr: SPR.stalagmite }; break;
    case 'campfire': o = { k: 'campfire', spr: SPR.campfire }; W.fires.push(o); break;
    case 'tent': o = { k: 'tent', spr: s.kind === 'green' ? SPR.tentGreen : SPR.tentRed }; break;
    case 'logseat': o = { k: 'logseat', spr: SPR.logseat }; break;
    case 'crate': o = { k: 'crate', spr: SPR.crate }; break;
    case 'barrel': o = { k: 'barrel', spr: SPR.barrel }; break;
    case 'signpost': o = { k: 'signpost', spr: SPR.signpost }; break;
    case 'fence': o = { k: 'fence', spr: SPR.fence }; break;
    case 'patch': W.patches.push({ x: s.x, y: s.y, fl: [], timer: 0, target: 3, src: s }); return;
    default: return;
  }
  const sd = SOLIDS[s.k]; o.x = s.x; o.y = s.y; o.src = s;
  if (sd) { o.box = sd[0]; if (sd[1]) o.ia = sd[1]; }
  W.objs.push(o); if (o.box) W.solids.push(o);
}
function rebuildObjects() {
  W.objs = []; W.solids = []; W.trees = []; W.bushes = []; W.lamps = []; W.notes = []; W.fires = []; W.glows = []; W.patches = []; W.clutter = []; W.stall = null; W.board = null;
  MAPDATA.objects.forEach(instantiate);
}
function rebuildAll() {
  STRUCTS = (MAPDATA.structs || []).map(structPx); buildDist(); rebuildObjects(); W.terrain = renderTerrain(); paintFlowers(W.terrain); buildLilies();
  let sx = 0, sy = 0, n = 0; for (let i = 0; i < GRID.length; i++) if (GRID[i] === 5) { sx += (i % MW) * TS + 8; sy += ((i / MW) | 0) * TS + 8; n++; }
  W.hub = n ? { x: sx / n, y: sy / n } : { x: W.spawn.x, y: W.spawn.y };
}
function computeShore() { // standing points along the coast for fishing NPCs
  W.shore = []; const D = [[1, 0, 'r'], [-1, 0, 'l'], [0, 1, 'd'], [0, -1, 'u']];
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    if (GRID[ty * MW + tx] !== 2) continue;
    for (const d of D) { const n = tileAt(tx + d[0], ty + d[1]); if (n <= 1 || n === 6) { W.shore.push({ x: tx * TS + 8, y: ty * TS + 8, dir: d[2] }); break; } }
  }
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) { // standing points along the edges of the decking
    if (!DECK[ty * MW + tx]) continue;
    for (const d of D) { const nx = tx + d[0], ny = ty + d[1], n = tileAt(nx, ny); if (!deckAt(nx, ny) && (n <= 1 || n === 6)) { W.shore.push({ x: tx * TS + 8, y: ty * TS + 8, dir: d[2] }); break; } }
  }
  for (const t of STRUCTS) {
    const cxm = (t.x0 + t.x1) / 2, cym = (t.y0 + t.y1) / 2;
    if ((t.y1 - t.y0) >= (t.x1 - t.x0)) W.shore.push({ x: cxm - 8, y: t.y1 - 10, dir: 'd' }, { x: cxm + 4, y: t.y1 - 26, dir: 'd' });
    else W.shore.push({ x: t.x1 - 10, y: cym - 8, dir: 'r' }, { x: t.x1 - 26, y: cym + 4, dir: 'r' });
  }
}
function loadMap(map) {
  setMapSize(map.w || 64, map.h || 64); GRID = new Uint8Array(MW * MH);
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) GRID[ty * MW + tx] = Math.min(6, Math.max(0, map.tiles[ty].charCodeAt(tx) - 48));
  MAPDATA = map; W.theme = map.theme || 'day'; buildDist();
  if (!map.structs) map.structs = map.pier ? [{ t: 'pier', x0: map.pier.x0, y0: map.pier.y0, x1: map.pier.x1, y1: map.pier.y1, style: 0, rails: false, posts: true }] : [];
  map.pier = null;
  if (Array.isArray(map.deck) && map.deck.length === MH && map.deck.every(r => typeof r === 'string' && r.length === MW)) for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) DECK[y * MW + x] = Math.min(6, Math.max(0, map.deck[y].charCodeAt(x) - 48));
  for (const q of map.structs) { const id = (q.style | 0) % 3 + 1 + (q.rails ? 3 : 0); for (let y = q.y0; y < q.y1; y++) for (let x = q.x0; x < q.x1; x++) if (x >= 0 && y >= 0 && x < MW && y < MH) DECK[y * MW + x] = id; } // old pier / bridge rectangles become deck tiles
  map.structs = []; STRUCTS = [];
  W.spawn = { x: map.spawn.x, y: map.spawn.y };
  rebuildAll(); computeShore();
}
function initWorld(map, editing) {
  loadMap(map);
  if (!editing && W.theme !== 'cave') for (let i = 0; i < 14; i++) spawnClutter(true);
}

// ---- beach clutter ---------------------------------------------------------------------
function spawnClutter(initial) {
  for (let n = 0; n < 160; n++) {
    const tx = Math.floor(rnd(1, MW - 1)), ty = Math.floor(rnd(1, MH - 1)), i = ty * MW + tx;
    if (GRID[i] !== 2 || DISTG[i] < 2 || DISTG[i] > 3) continue;
    const x = Math.round(tx * TS + rnd(3, 13)), y = Math.round(ty * TS + rnd(4, 14));
    if (nearDeck(x, y, 24) || STRUCTS.some(t => x > t.x0 - 24 && x < t.x1 + 24 && y > t.y0 - 24 && y < t.y1 + 24)) continue;
    if (nearAny(x, y, 26, W.clutter) || (!initial && typeof ME !== 'undefined' && ME && distSq(x, y, ME.x, ME.y) < 60 * 60)) continue;
    if (!okLand(x, y, 4)) continue;
    const type = pick(['seaweed', 'shell', 'wood', 'crab']);
    const o = { k: 'clutter', type, x, y, spr: SPR.clutter[type], ia: 18 }; W.objs.push(o); W.clutter.push(o); return o;
  }
  return null;
}
function removeClutter(o) {
  W.objs.splice(W.objs.indexOf(o), 1); W.clutter.splice(W.clutter.indexOf(o), 1);
  W.pendingClutter = (W.pendingClutter || []).concat([performance.now() / 1000 + rnd(25, 45)]);
}

// ---- butterflies ----------------------------------------------------------------------------
function spawnBug(patch, night) {
  const inst = rollItem('bug', { night, luck: 0.5, rain: isRain() });
  const it = ITEM[inst.id], f = pick(patch.fl);
  return { k: 'bug', x: patch.x + rnd(-22, 22), y: patch.y + rnd(-14, 14), z: rnd(5, 9), inst, it, st: 'fly', t: rnd(0.5, 2), tx: f.x, ty: f.y, patch, flee: 0, ph: Math.random() * 6, leave: false, night };
}
function updateBugs(dt, now, night) {
  for (const p of W.patches) {
    if (p.fl.length < 3) continue;
    const mine = W.bugs.filter(b => b.patch === p && !b.leave);
    p.target = night ? 2 : 3;
    if (mine.length < p.target && now > p.timer) { W.bugs.push(spawnBug(p, night)); p.timer = now + rnd(3, 8); }
  }
  for (let i = W.bugs.length - 1; i >= 0; i--) {
    const b = W.bugs[i];
    if (b.night !== night && !b.leave) b.leave = true;
    if (b.leave) { b.z += dt * 26; b.x += dt * 14; if (b.z > 70) { W.bugs.splice(i, 1); } continue; }
    if (b.hold) { b.ph += dt * 14; continue; } // being caught in the tapping mini game
    b.t -= dt; b.ph += dt * (b.st === 'rest' ? 2 : 14);
    if (b.st === 'rest') { b.z += (1.5 - b.z) * Math.min(1, dt * 8); if (b.t <= 0) { b.st = 'fly'; b.t = rnd(1.5, 3.5); const f = Math.random() < 0.5 ? pick(b.patch.fl) : { x: b.patch.x + rnd(-26, 26), y: b.patch.y + rnd(-18, 18) }; b.tx = f.x; b.ty = f.y; } }
    else {
      const sp = b.flee > 0 ? 55 : 24, dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
      b.flee = Math.max(0, b.flee - dt);
      if (d < 2 || b.t <= 0) {
        if (Math.random() < 0.6 && b.flee <= 0) { const f = pick(b.patch.fl); b.tx = f.x; b.ty = f.y; b.st = 'rest'; b.t = rnd(1.4, 3.2); b.x = f.x; b.y = f.y - 1; }
        else { b.tx = b.patch.x + rnd(-28, 28); b.ty = b.patch.y + rnd(-20, 20); b.t = rnd(1.2, 3); }
      } else { b.x += dx / d * sp * dt; b.y += dy / d * sp * dt; }
      b.z += (6 + Math.sin(b.ph * 0.5) * 2.5 - b.z) * Math.min(1, dt * 6);
    }
  }
}
function updateWorld(dt, now, night) {
  for (const t of W.trees) { if (!t.fruit && now > t.regrow) t.fruit = true; t.shake = Math.max(0, t.shake - dt); }
  for (const b of W.bushes) { if (!b.berry && now > b.regrow) b.berry = true; b.shake = Math.max(0, b.shake - dt); }
  if (W.pendingClutter) { W.pendingClutter = W.pendingClutter.filter(t => { if (now > t) { spawnClutter(false); return false; } return true; }); }
  updateBugs(dt, now, night);
}

// ---- collision --------------------------------------------------------------------------------------
function blockedAt(x, y) {
  if (x < 10 || y < 10 || x > PW - 10 || y > PH - 10) return true;
  for (const o of [[-3, 0], [3, 0], [-3, -3], [3, -3]]) { const t = typeAt(x + o[0], y + o[1]); if (t <= 1 || t === 6) return true; }
  const x0 = x - 3, x1 = x + 3, y0 = y - 3, y1 = y;
  for (const o of W.solids) {
    if (Math.abs(o.x - x) > 40 || Math.abs(o.y - y) > 30) continue;
    const bx = o.x + o.box[0], by = o.y + o.box[1];
    if (x1 > bx && x0 < bx + o.box[2] && y1 > by && y0 < by + o.box[3]) return true;
  }
  return false;
}
function moveEnt(e, dx, dy) {
  let moved = false;
  if (dx && !blockedAt(e.x + dx, e.y)) { e.x += dx; moved = true; }
  if (dy && !blockedAt(e.x, e.y + dy)) { e.y += dy; moved = true; }
  return moved;
}
function distToBox(x, y, o) {
  const bx = o.x + o.box[0], by = o.y + o.box[1], cx = clamp(x, bx, bx + o.box[2]), cy = clamp(y, by, by + o.box[3]);
  return Math.hypot(x - cx, y - cy);
}
