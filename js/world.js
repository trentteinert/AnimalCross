'use strict';
const TS = 16, CX = 32 * TS, CY = 32 * TS, MAP_MIN = 32, MAP_MAX = 200;
let MW = 64, MH = 64, PW = MW * TS, PH = MH * TS; // map size in tiles / pixels; maps can be any size from MAP_MIN to MAP_MAX
function setMapSize(w, h) { MW = w; MH = h; PW = w * TS; PH = h * TS; DECK = new Uint8Array(w * h); SITE = new Uint8Array(w * h); INT = new Uint8Array(w * h); }
// Generator constants: only used to author the DEFAULT island. A saved map (maps/island.json) replaces all of this.
let SITE = new Uint8Array(MW * MH); // dig sites: 0 = none, 1-4 = zone (see SITES in data.js)
let INT = new Uint8Array(MW * MH);  // house interiors: 0 none, 1-5 floors (teal, oak, dark wood, ceramic, carpet), 6 wall, 7 wall with a window
let DECK = new Uint8Array(MW * MH); // wooden / stone decking laid over the tiles (piers, bridges, boardwalks): 0 = none, 1-3 = plank styles, 4-6 = the same with rails
let LASTD = 0, MAPDATA = null;

function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
function vn(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
let GRID = null, DISTG = null;
function buildDist() { // distance (in tiles) from every land tile to the nearest water tile
  DISTG = new Uint8Array(MW * MH).fill(255); const q = [];
  for (let i = 0; i < GRID.length; i++) { const t = GRID[i]; if (t <= 1 || t === 6) { DISTG[i] = 0; q.push(i); } }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MW, y = (i / MW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; const j = ny * MW + nx; if (DISTG[j] === 255) { DISTG[j] = DISTG[i] + 1; q.push(j); } }
  }
}
function typeAt(px, py) {
  const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) { LASTD = 0; return 0; }
  const i = ty * MW + tx; if (DECK[i] || INT[i]) { LASTD = -1; return 7; }
  LASTD = DISTG[i]; return GRID[i];
}
const intAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? 0 : INT[y * MW + x];
const siteAt = (x, y) => { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return tx < 0 || ty < 0 || tx >= MW || ty >= MH ? 0 : SITE[ty * MW + tx]; };
const isWater = (x, y) => { const t = typeAt(x, y); return t === 0 || t === 1 || t === 6; };

const W = { terrain: null, sites: [], objs: [], solids: [], trees: [], bushes: [], patches: [], shore: [], lamps: [], notes: [], fires: [], glows: [], lilies: [], theme: 'day', spawn: { x: 0, y: 0 }, hub: { x: 0, y: 0 }, stall: null, board: null };

// ---- terrain rendering (dual-grid autotiling, see tiles.js) -------------------
const LVL = [0, 1, 2, 3, 4, 5, 2];
const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? 0 : GRID[ty * MW + tx];
function renderTerrain() {
  const A = atlasFor(W.theme), c = mk(PW, PH);
  if (W.theme === 'interior') { c.g.fillStyle = '#17131a'; c.g.fillRect(0, 0, PW, PH); drawInterior(c); return c; }
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) c.g.drawImage(A, Math.floor(hash2(tx, ty, 21) * 3) * 16, 0, 16, 16, tx * 16, ty * 16, 16, 16);
  for (let L = 1; L <= 6; L++) for (let j = 0; j <= MH; j++) for (let i = 0; i <= MW; i++) {
    const t = [tileAt(i - 1, j - 1), tileAt(i, j - 1), tileAt(i - 1, j), tileAt(i, j)]; let m = 0;
    for (let k = 0; k < 4; k++) if (L === 6 ? t[k] === 6 : LVL[t[k]] >= L) m |= 1 << k;
    if (!m) continue; const hv = hash2(i, j, 30 + L), col = m === 15 ? 32 + (hv > 0.9 ? 3 : Math.floor(hv / 0.9 * 3)) : m + 16 * (hv > 0.5 ? 1 : 0);
    c.g.drawImage(A, col * 16, L * 16, 16, 16, i * 16 - 8, j * 16 - 8, 16, 16);
  }
  decorate(c); drawSites(c); drawDeck(c); drawInterior(c); return c;
}
function drawInterior(c) { // floors; thin wall trims beside them; wall fronts (3 cells tall) wherever a wall has floor to its south
  const img = ASSET.img.interior; if (!img) return; const g2 = c.g;
  const isW = (x, y) => intAt(x, y) >= 6, isF = (x, y) => { const v = intAt(x, y); return v >= 1 && v <= 5; }, capLike = (x, y) => isW(x, y) && !isF(x, y + 1);
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const id = INT[ty * MW + tx]; if (id < 1 || id > 5) continue;
    g2.drawImage(img, (id - 1) * 16, 0, 16, 16, tx * 16, ty * 16, 16, 16);
    if (isW(tx, ty - 1)) { g2.fillStyle = 'rgba(30,20,20,0.20)'; g2.fillRect(tx * 16, ty * 16, 16, 2); g2.fillStyle = 'rgba(30,20,20,0.09)'; g2.fillRect(tx * 16, ty * 16 + 2, 16, 2); }
  }
  // Thin trims. Every vertical run of wall keeps one x offset (hugging the floor on its inside, centred if floor is on both sides) and every
  // horizontal run keeps one y offset, so corners, T-junctions and crossings always meet: each bar simply stretches to the far edge of the
  // bar it meets when nothing continues in that direction.
  const faceAt = (x, y) => isW(x, y) && isF(x, y + 1);   // a wall front
  const runX = (x, y) => { // x offset of the vertical bar for this whole run of wall: 9 = hugs its east side, 0 = its west side, 5 = centred
    let E = false, Wf = false, FL = false, FR = false;
    for (const sgn of [-1, 1]) for (let k = sgn === 1 ? 0 : 1; k <= 12 && isW(x, y + sgn * k); k++) {
      const cy = y + sgn * k; E = E || isF(x + 1, cy) || isF(x + 1, cy - 1) || isF(x + 1, cy + 1); Wf = Wf || isF(x - 1, cy) || isF(x - 1, cy - 1) || isF(x - 1, cy + 1);
      if (!faceAt(x, cy)) { FL = FL || faceAt(x - 1, cy); FR = FR || faceAt(x + 1, cy); }   // (a front that closes the run does not count)
    }
    if (FL !== FR) return FL ? 0 : 9;                   // a wall front beside the run: the bar touches it
    return E && !Wf ? 9 : Wf && !E ? 0 : 5;           // otherwise it hugs the floor on its inside
  };
  const runY = (x, y) => { // y offset of the horizontal bar for this whole run: 0 if there is floor above any of it, otherwise centred
    let up = false;
    for (const sgn of [-1, 1]) for (let k = sgn === 1 ? 0 : 1; k <= 12 && capLike(x + sgn * k, y); k++) up = up || isF(x + sgn * k, y - 1);
    return up ? 0 : 5;
  };
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    if (!isW(tx, ty) || isF(tx, ty + 1)) continue; const ox = tx * 16, oy = ty * 16;
    const left = capLike(tx - 1, ty), right = capLike(tx + 1, ty), up = isW(tx, ty - 1), down = isW(tx, ty + 1), hs = left || right, vs = up || down;
    const vx = runX(tx, ty), hy = runY(tx, ty);
    const fl1 = (nx, ny) => { const v = intAt(nx, ny); return v >= 1 && v <= 5 ? v : 0; }, fl = (nx, ny) => fl1(nx, ny) || (isW(nx, ny) ? fl1(nx, ny - 1) || fl1(nx, ny + 1) : 0), under = (id, sx, sy, w, h) => g2.drawImage(img, (id - 1) * 16 + sx, sy, w, h, ox + sx, oy + sy, w, h);
    const vy0 = up ? 0 : hs ? hy : 0, vy1 = down ? 16 : hs ? hy + 7 : 16;
    if (vs) { const Wf = fl(tx - 1, ty), Ef = fl(tx + 1, ty); const yl = left ? hy : vy1, yr = right ? hy : vy1; if (Wf && vx > 0 && yl > vy0) under(Wf, 0, vy0, vx, yl - vy0); if (Ef && vx + 7 < 16 && yr > vy0) under(Ef, vx + 7, vy0, 16 - vx - 7, yr - vy0); }   // a half-tile wall keeps the floor on either side of it, no black bar
    if (hs) { const Nf = fl1(tx, ty - 1); if (Nf && hy > 0) under(Nf, 0, 0, 16, hy); }
    if (vs) {
      const y0 = vy0, y1 = vy1;
      if (!up && !hs) { if (faceAt(tx - 1, ty) && faceAt(tx + 1, ty)) { g2.fillStyle = 'rgb(213,200,175)'; g2.fillRect(ox, oy - 32, 16, 32); } else g2.drawImage(img, 64, 16, 7, 32, ox + vx, oy - 32, 7, 32); }   // the top end of a wall rises to the height of a wall front (a pillar between two fronts fills the gap)
      g2.drawImage(img, 64, 16 + 32, 7, y1 - y0, ox + vx, oy + y0, 7, y1 - y0);
    }
    if (hs) { const x0 = left ? 0 : vs ? vx : 0, x1 = right ? 16 : vs ? vx + 7 : 16; g2.drawImage(img, 80 + (tx % 3) * 16 + x0, 16, x1 - x0, 7, ox + x0, oy + hy, x1 - x0, 7); }
    if (!hs && !vs) g2.drawImage(img, 64, 16 + 32, 7, 7, ox + 5, oy + 5, 7, 7);
  }
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) { // wall fronts, drawn last so they hide what is behind them
    const id = INT[ty * MW + tx]; if (id < 6 || !isF(tx, ty + 1)) continue;
    g2.drawImage(img, (tx % 3) * 16, 16, 16, 48, tx * 16, (ty + 1) * 16 - 48, 16, 48);
    if (id === 7) g2.drawImage(img, 48, 16, 16, 48, tx * 16, (ty + 1) * 16 - 48, 16, 48);
  }
}
function serializeInt() { const rows = []; for (let ty = 0; ty < MH; ty++) { let r = ''; for (let tx = 0; tx < MW; tx++) r += INT[ty * MW + tx]; rows.push(r); } return rows; }
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
const deckAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? 0 : DECK[y * MW + x];
function nearDeck(x, y, r) { const tx = Math.floor(x / TS), ty = Math.floor(y / TS), n = Math.ceil(r / TS); for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) if (deckAt(tx + dx, ty + dy)) return true; return false; }
function drawDeck(c) { // tile-based decking: planks run along the walkway, open edges get a beam, rails and pilings appear by themselves
  const wat = (x, y) => { if (deckAt(x, y)) return false; const t = tileAt(x, y); return t <= 1 || t === 6; };
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) { // pass 1: shadow and pilings under the planks
    const id = DECK[ty * MW + tx]; if (!id) continue; const ox = tx * TS, oy = ty * TS, st = STRUCT_STYLES[(id - 1) % 3];
    c.g.fillStyle = 'rgba(14,34,60,0.28)'; c.g.fillRect(ox + 2, oy + 3, TS, TS);
    if (!deckAt(tx, ty + 1)) { // the deck stands up off the ground: a front face with slats under its south edge, and a shadow below that
      c.g.fillStyle = 'rgba(14,34,60,0.3)'; c.g.fillRect(ox + 2, oy + TS + 5, TS, 4);
      RC(c, ox, oy + TS, TS, 6, st.beam); RC(c, ox, oy + TS, TS, 1, st.beamHi); RC(c, ox, oy + TS + 5, TS, 1, st.post);
      for (let x = 0; x < TS; x += 4) RC(c, ox + x, oy + TS + 1, 1, 4, st.lo);
      if (wat(tx, ty + 1)) for (const px of [ox + 1, ox + TS - 5]) { RC(c, px, oy + TS + 1, 4, 9, st.post); RC(c, px, oy + TS + 1, 4, 1, st.beamHi); }
    }
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
    const H = 9; // railings stand up off the deck: tall capped posts with a top rail and a lower rail between them
    const post = (x, yb) => { RC(c, x, yb - H, 2, H + 1, st.post); RC(c, x - 1, yb - H - 1, 4, 2, st.beamHi); RC(c, x - 1, yb - H + 1, 4, 1, st.beam); };
    const hrail = (x0, x1, yb) => { RC(c, x0, yb - H + 2, x1 - x0, 2, st.hi); RC(c, x0, yb - H + 4, x1 - x0, 1, st.post); RC(c, x0, yb - 4, x1 - x0, 1, st.hi); RC(c, x0, yb - 3, x1 - x0, 1, st.post); };
    const vrail = (x, y0, y1) => { RC(c, x, y0 - H + 2, 2, y1 - y0, st.hi); RC(c, x + 1, y0 - H + 2, 1, y1 - y0, st.post); RC(c, x, y0 - 4, 1, y1 - y0, st.hi); };
    const has = (x, y, dx, dy) => deckAt(x, y) >= 4 && wat(x + dx, y + dy); // does that tile carry a rail on the same side? (so a run of rails shares its posts)
    if (wat(tx, ty - 1)) { hrail(ox + 1, ox + TS + 1, oy + 3); post(ox + 1, oy + 3); if (!has(tx + 1, ty, 0, -1)) post(ox + TS + 1, oy + 3); }
    if (wat(tx, ty + 1)) { hrail(ox + 1, ox + TS + 1, oy + TS); post(ox + 1, oy + TS); if (!has(tx + 1, ty, 0, 1)) post(ox + TS + 1, oy + TS); }
    if (wat(tx - 1, ty)) { vrail(ox - 1, oy + 4, oy + TS + 4); post(ox, oy + TS + 4); if (!has(tx, ty - 1, -1, 0)) post(ox, oy + 4); }
    if (wat(tx + 1, ty)) { vrail(ox + TS - 1, oy + 4, oy + TS + 4); post(ox + TS - 1, oy + TS + 4); if (!has(tx, ty - 1, 1, 0)) post(ox + TS - 1, oy + 4); }
  }
}
const siteAtT = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? 0 : SITE[y * MW + x];
function drawSites(c) { // roped-off excavation squares: disturbed soil, a string border and a stake at each corner
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const z = SITE[ty * MW + tx]; if (!z) continue; const ox = tx * TS, oy = ty * TS, col = SITES[z].col;
    c.g.fillStyle = 'rgba(70,44,22,0.30)'; c.g.fillRect(ox, oy, TS, TS);
    for (let i = 0; i < 4; i++) { const px = ox + 1 + Math.floor(hash2(tx, ty, 90 + i) * 14), py = oy + 1 + Math.floor(hash2(tx, ty, 95 + i) * 14); RC(c, px, py, 2, 1, hash2(tx, ty, 99 + i) < 0.5 ? 'rgba(110,76,40,0.7)' : 'rgba(200,160,100,0.55)'); }
    c.g.fillStyle = 'rgba(30,20,10,0.16)'; c.g.fillRect(ox, oy, TS, 1); c.g.fillRect(ox, oy, 1, TS);
    const U = siteAtT(tx, ty - 1) === z, D = siteAtT(tx, ty + 1) === z, L = siteAtT(tx - 1, ty) === z, R = siteAtT(tx + 1, ty) === z;
    if (!U) { RC(c, ox, oy, TS, 1, '#efe2c0'); RC(c, ox, oy + 1, TS, 1, 'rgba(60,40,20,0.35)'); }
    if (!D) { RC(c, ox, oy + TS - 1, TS, 1, '#efe2c0'); RC(c, ox, oy + TS, TS, 1, 'rgba(60,40,20,0.35)'); }
    if (!L) { RC(c, ox, oy, 1, TS, '#efe2c0'); RC(c, ox + 1, oy, 1, TS, 'rgba(60,40,20,0.35)'); }
    if (!R) { RC(c, ox + TS - 1, oy, 1, TS, '#efe2c0'); RC(c, ox + TS, oy, 1, TS, 'rgba(60,40,20,0.35)'); }
    for (const [sx, sy, open] of [[ox, oy, !U && !L], [ox + TS - 1, oy, !U && !R], [ox, oy + TS - 1, !D && !L], [ox + TS - 1, oy + TS - 1, !D && !R]]) if (open) { RC(c, sx - 1, sy - 4, 3, 6, '#5a3a1a'); RC(c, sx - 1, sy - 4, 3, 2, col); RC(c, sx, sy - 4, 1, 1, '#ffffff'); }
  }
}
function buildSiteRegions() { // one record per painted dig site (connected tiles of one zone): bounding box + tile list, used for the signs and level locks
  W.sites = []; const seen = new Uint8Array(MW * MH);
  for (let i = 0; i < SITE.length; i++) {
    if (!SITE[i] || seen[i]) continue; const z = SITE[i], q = [i], tiles = []; seen[i] = 1; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let h = 0; h < q.length; h++) {
      const j = q[h], x = j % MW, y = (j / MW) | 0; tiles.push(j); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; const k = ny * MW + nx; if (SITE[k] === z && !seen[k]) { seen[k] = 1; q.push(k); } }
    }
    W.sites.push({ zone: z, tiles, x0: x0 * TS, y0: y0 * TS, x1: (x1 + 1) * TS, y1: (y1 + 1) * TS });
  }
}
function serializeSite() { const rows = []; for (let ty = 0; ty < MH; ty++) { let r = ''; for (let tx = 0; tx < MW; tx++) r += SITE[ty * MW + tx]; rows.push(r); } return rows; }
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
// ---- the map file --------------------------------------------------------------------
// { v:1, w:64, h:64, tiles:[64 rows of 64 digits], pier:{x0,y0,x1,y1} in tiles | null, spawn:{x,y} in px,
//   objects:[{k:'tree',kind,x,y} {k:'bush',kind,x,y} {k:'deco',v,x,y} {k:'rock'|'lamp'|'bench'|'stall'|'board'|'fountain',x,y} {k:'note',x,y,text} {k:'patch',x,y}] }
function blankMap(cave) { // a plain starter map: a grass island in the sea (or a rock chamber for caves); nothing is placed yet
  setMapSize(64, 64); GRID = new Uint8Array(MW * MH);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const d = Math.hypot((x - 32) / 22, (y - 32) / 20); GRID[y * MW + x] = cave ? (d < 0.7 ? 3 : 0) : d < 0.55 ? 3 : d < 0.72 ? 2 : d < 0.9 ? 1 : 0; }
  return { v: 1, w: 64, h: 64, theme: cave ? 'cave' : 'day', tiles: serializeTiles(), deck: serializeDeck(), site: serializeSite(), int: serializeInt(), pier: null, structs: [], spawn: { x: 32 * TS, y: 32 * TS }, objects: [] };
}
const generateDefaultMap = () => blankMap(false), generateDefaultCave = () => blankMap(true);
function serializeTiles() { const rows = []; for (let ty = 0; ty < MH; ty++) { let s = ''; for (let tx = 0; tx < MW; tx++) s += GRID[ty * MW + tx]; rows.push(s); } return rows; }
function serializeMap() { return { v: 1, w: MW, h: MH, tiles: serializeTiles(), deck: serializeDeck(), site: serializeSite(), pier: null, theme: MAPDATA.theme || 'day', structs: [], spawn: MAPDATA.spawn, objects: MAPDATA.objects }; }
function validMap(m) {
  if (!(m && m.v === 1 && Array.isArray(m.tiles) && m.spawn && Array.isArray(m.objects))) return false;
  const w = m.w || 64, h = m.h || 64; if (!Number.isInteger(w) || !Number.isInteger(h) || w < MAP_MIN || h < MAP_MIN || w > MAP_MAX || h > MAP_MAX) return false;
  return m.tiles.length === h && m.tiles.every(r => typeof r === 'string' && r.length === w);
}

const SOLIDS = { tree: [[-4, -4, 8, 5], 22], bush: [[-6, -4, 12, 4], 16], rock: [[-7, -4, 14, 4]], lamp: [[-2, -3, 4, 3]], bench: [[-12, -6, 24, 6]], stall: [[-22, -9, 44, 9], 18], board: [[-9, -5, 18, 5], 14], fountain: [[-23, -14, 46, 14]], tackle: [[-22, -9, 44, 9], 18], gemshop: [[-22, -9, 44, 9], 18], outfitshop: [[-22, -9, 44, 9], 18], tank: [[-20, -5, 40, 5], 18], leaders: [[-12, -4, 24, 4], 16], portal: [[-20, -6, 40, 6], 22], stalagmite: [[-5, -4, 10, 4]], campfire: [[-6, -4, 12, 4]], tent: [[-16, -5, 32, 5]], logseat: [[-12, -4, 24, 4]], crate: [[-6, -5, 12, 5]], barrel: [[-5, -4, 10, 4]], signpost: [[-3, -3, 6, 3]], fence: [[-25, -3, 50, 3]] };
function instantiate(s) {
  let o;
  switch (s.k) {
    case 'tree': if (!SPR.tree[s.kind]) return; o = { k: 'tree', kind: s.kind, fruit: true, shake: 0 }; W.trees.push(o); break;
    case 'bush': if (!SPR.bush[s.kind]) return; o = { k: 'bush', kind: s.kind, berry: true, shake: 0 }; W.bushes.push(o); break;
    case 'deco': o = { k: 'deco', spr: SPR.deco[(s.v | 0) % SPR.deco.length] }; break;
    case 'rock': o = { k: 'rock', spr: SPR.rocks ? SPR.rocks[Math.floor(hash2(s.x, s.y, 5) * SPR.rocks.length)] : SPR.rock }; break;
    case 'lamp': o = { k: 'lamp', spr: SPR.lamp }; W.lamps.push(o); break;
    case 'bench': o = { k: 'bench', spr: SPR.bench }; break;
    case 'fountain': o = { k: 'fountain', spr: SPR.fountain }; break;
    case 'tackle': o = { k: 'tackle', spr: SPR.tackle }; break;
    case 'furn': if (!SPR.furn || !SPR.furn[s.f]) return; o = { k: 'furn', f: s.f, spr: SPR.furn[s.f] }; break;
    case 'portal': o = { k: 'portal', to: s.to || 'island', sx: s.sx || 0, sy: s.sy || 0, style: s.style, auto: s.style === 'stairsUp' || s.style === 'stairsDown', spr: s.style === 'door' && SPR.furn ? SPR.furn.door : s.style === 'stairsUp' && SPR.furn ? SPR.furn.stairs_up : s.style === 'stairsDown' && SPR.furn ? SPR.furn.stairs_down : s.style === 'exit' ? SPR.portalExit : SPR.portalCave }; break;
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
    case 'patch': W.patches.push({ x: s.x, y: s.y, fl: [], src: s }); return;
    default: return;
  }
  const fb = s.k === 'furn' ? ASSET.furn[s.f] && ASSET.furn[s.f].box : null, sd = s.k === 'furn' ? (fb ? [fb] : null) : s.k === 'portal' && (s.style === 'stairsUp' || s.style === 'stairsDown') ? null : s.k === 'portal' && s.style === 'door' ? [[-10, -3, 20, 3], 18] : SOLIDS[s.k]; o.x = s.x; o.y = s.y; o.src = s;
  if (sd) { o.box = sd[0]; if (sd[1]) o.ia = sd[1]; }
  W.objs.push(o); if (o.box) W.solids.push(o);
}
function rebuildObjects() {
  W.objs = []; W.solids = []; W.trees = []; W.bushes = []; W.lamps = []; W.fires = []; W.glows = []; W.patches = []; 
  MAPDATA.objects.forEach(instantiate);
}
function rebuildAll() {
  buildDist(); rebuildObjects(); W.terrain = renderTerrain(); paintFlowers(W.terrain); buildLilies(); buildSiteRegions();
  let sx = 0, sy = 0, n = 0; for (let i = 0; i < GRID.length; i++) if (GRID[i] === 5) { sx += (i % MW) * TS + 8; sy += ((i / MW) | 0) * TS + 8; n++; }
  W.hub = n ? { x: sx / n, y: sy / n } : { x: W.spawn.x, y: W.spawn.y };
}
function computeShore() { // standing points at the dig sites (used by wandering diggers): stand on a site tile, face the next site tile
  W.shore = []; const D = [[1, 0, 'r'], [-1, 0, 'l'], [0, 1, 'd'], [0, -1, 'u']];
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const z = SITE[ty * MW + tx]; if (!z) continue;
    for (const d of D) if (siteAtT(tx + d[0], ty + d[1]) === z) { W.shore.push({ x: tx * TS + 8, y: ty * TS + 8, dir: d[2], zone: z }); break; }
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
  map.structs = [];
  if (Array.isArray(map.int) && map.int.length === MH && map.int.every(r => typeof r === 'string' && r.length === MW)) for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) INT[y * MW + x] = Math.min(7, Math.max(0, map.int[y].charCodeAt(x) - 48));
  if (Array.isArray(map.site) && map.site.length === MH && map.site.every(r => typeof r === 'string' && r.length === MW)) for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) SITE[y * MW + x] = Math.min(4, Math.max(0, map.site[y].charCodeAt(x) - 48));
  W.spawn = { x: map.spawn.x, y: map.spawn.y };
  rebuildAll(); computeShore();
}
function initWorld(map) { loadMap(map); }

// ---- collision --------------------------------------------------------------------------------------
function blockedAt(x, y) {
  if (x < 10 || y < 10 || x > PW - 10 || y > PH - 10) return true;
  for (const o of [[-3, 0], [3, 0], [-3, -3], [3, -3]]) { const t = typeAt(x + o[0], y + o[1]); if (t <= 1 || t === 6) return true; const w = intAt(Math.floor((x + o[0]) / TS), Math.floor((y + o[1]) / TS)); if (w >= 6) return true; }
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
