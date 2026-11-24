'use strict';
const TS = 16, CX = 32 * TS, CY = 32 * TS, MAP_MIN = 16, MAP_MAX = 200;
let MW = 64, MH = 64, PW = MW * TS, PH = MH * TS; // map size in tiles / pixels; maps can be any size from MAP_MIN to MAP_MAX
function setMapSize(w, h) { MW = w; MH = h; PW = w * TS; PH = h * TS; DECK = new Uint8Array(w * h); SITE = new Uint8Array(w * h); PIT = new Uint8Array(w * h); }
// Generator constants: only used to author the DEFAULT island. A saved map (maps/island.json) replaces all of this.
let SITE = new Uint8Array(MW * MH); // dig sites: 0 = none, 1-4 = zone (see SITES in data.js)
// Z dimension: PIT holds the depth of the ground in half-units (0 = ground level, 2 = one unit down, 4 = two down, ...). An odd value is a RAMP: a walkway
// that slopes between its two neighbours (v-1 on its high side, v+1 on its low side). A step of more than half a unit is a wall.
let PIT = new Uint8Array(MW * MH);
const PIT_U = 8;   // pixels of screen height per unit of depth
let DECK = new Uint8Array(MW * MH); // wooden / stone decking laid over the tiles (piers, bridges, boardwalks): 0 = none, 1-3 = plank styles, 4-6 = the same with rails
let LASTD = 0, MAPDATA = null, MGRID = null, MDOOR = null;   // MGRID: the museum interior's tile ids; MDOOR: where the museum's door is on the island (you come out there)

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
  buildDepth();
}
let DEPTHG = null;
function buildDepth() {   // how many tiles into the shallows each water tile is (1 = right at the shore), so wading can slope down gradually
  DEPTHG = new Uint8Array(MW * MH).fill(0); const q = [];
  for (let i = 0; i < GRID.length; i++) { const t = GRID[i]; if (t >= 2 && t <= 5) q.push(i); else if (t === 0) DEPTHG[i] = 4; else DEPTHG[i] = 255; }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MW, y = (i / MW) | 0, d = DEPTHG[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; const j = ny * MW + nx; if (DEPTHG[j] === 255) { DEPTHG[j] = d + 1; q.push(j); } }
  }
  for (let i = 0; i < DEPTHG.length; i++) if (DEPTHG[i] === 255) DEPTHG[i] = 4;
}
function waterDepth(x, y) {   // 0 on land, rising smoothly through the shallows to about knee depth (9 pixels) two tiles from the shore
  if (!DEPTHG) return 0; const fx = x / TS - 0.5, fy = y / TS - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
  const v = (tx, ty) => tx < 0 || ty < 0 || tx >= MW || ty >= MH ? 4 : DEPTHG[ty * MW + tx];
  const d = (v(x0, y0) * (1 - ax) + v(x0 + 1, y0) * ax) * (1 - ay) + (v(x0, y0 + 1) * (1 - ax) + v(x0 + 1, y0 + 1) * ax) * ay;
  return clamp((d - 0.5) * 6, 0, 9);
}
function elevAt(x, y) {   // how many pixels above the ground you stand: the museum's steps rise to its porch (12 pixels, climbing steadily over the steps). You stand at a ground position and are DRAWN that many pixels higher, so the walls' collision and the floor's drawing are lined up through museumRow() / its inverse
  if (!W.objs) return 0;
  const st = stairsAt(x, y); if (st) return Math.round(6 * Math.sin(Math.PI * clamp((st.yb - y) / (st.yb - st.y0), 0, 1)));   // up the stairs: you rise as you climb
  for (const o of W.objs) if (o.k === 'museum' && o.spr.gmask) {
    const lx = Math.floor(x - (o.x - 107)), yg = y - (o.y - 167); if (lx < 0 || lx >= 215 || yg < 129 || yg >= 167) return 0;
    const e = yg >= 150 ? (167 - yg) * 12 / 17 : 12, r = Math.round(yg - e); if (r < 0 || r >= 167 || !o.spr.gmask[r * 215 + lx]) return 0;   // only where there is porch or steps under where you are drawn
    return Math.round(e);
  }
  return 0;
}
function typeAt(px, py) {
  const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) { LASTD = 0; return 0; }
  const i = ty * MW + tx; if (DECK[i]) { LASTD = -1; return 7; }
  LASTD = DISTG[i]; return GRID[i];
}
const siteAt = (x, y) => { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return tx < 0 || ty < 0 || tx >= MW || ty >= MH ? 0 : SITE[ty * MW + tx]; };
const isWater = (x, y) => { const t = typeAt(x, y); return t === 0 || t === 1 || t === 6; };

const W = { terrain: null, sites: [], objs: [], solids: [], trees: [], bushes: [], patches: [], shore: [], lamps: [], notes: [], fires: [], glows: [], lilies: [], theme: 'day', spawn: { x: 0, y: 0 }, hub: { x: 0, y: 0 }, stall: null, board: null };

// ---- terrain rendering (dual-grid autotiling, see tiles.js) -------------------
const LVL = [0, 1, 2, 4, 3, 5, 2];   // tile type -> layer: sand, then dirt, then grass on top (grass is type 3, dirt type 4)
const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? 0 : GRID[ty * MW + tx];
const VARIETY = { 2: 'sand_variants', 3: 'dirt_variants', 4: 'grass_variants' };   // layers with painted interior variety
function grassSeed(i, j) { return hash2(i, j, 55) < 0.14; }
function grassVariant(i, j) {   // tufts are rare (about 30% of tiles) and clump: a tile is likely to have one if a neighbour is a seed tuft
  if (grassSeed(i, j)) return true; let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (grassSeed(i + dx, j + dy)) n++;
  return n > 0 && hash2(i, j, 56) < 0.18 + 0.1 * n;
}
function variantCol(L, h, i, j) {   // grass: a third plain, most of the rest the small tufts (bottom row), the big tufts (top row) rare. sand and dirt: 40% plain, the rest shared evenly
  if (L === 3) {   // dirt: mostly the sparsest variants (the plain tile and the dense ones are busier than the rest), the dense top row only ~5%
    const W = [0.09, 0.34, 0.30, 0.16, 0.06, 0.0125, 0.0125, 0.0125, 0.0125]; let acc = 0;
    for (let k = 0; k < W.length; k++) { acc += W[k]; if (h < acc) return 32 + k; } return 40;
  }
  if (L !== 4) return h < 0.4 ? 32 : 33 + Math.min(7, Math.floor((h - 0.4) / 0.6 * 8));
  if (!grassVariant(i, j)) return 32; if (h < 0.98) return 33 + Math.min(3, Math.floor(h / 0.98 * 4)); return 37 + Math.min(3, Math.floor((h - 0.98) / 0.02 * 4));
}
function renderMuseum() {   // the interior: every tile drawn from the museum tile set (assets/museum/tileset.png)
  const c = mk(PW, PH), A = ASSET.img.museum_tiles;
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) { const id = MGRID[ty * MW + tx]; c.g.drawImage(A, (id & 15) * 16, (id >> 4) * 16, 16, 16, tx * 16, ty * 16, 16, 16); }
  return c;
}
function renderTerrain() {
  if (W.theme === 'museum' && MGRID) return renderMuseum();
  const A = atlasFor(W.theme), c = mk(PW, PH);
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) c.g.drawImage(A, Math.floor(hash2(tx, ty, 21) * 3) * 16, 0, 16, 16, tx * 16, ty * 16, 16, 16);
  for (let L = 1; L <= 6; L++) for (let j = 0; j <= MH; j++) for (let i = 0; i <= MW; i++) {
    const t = [tileAt(i - 1, j - 1), tileAt(i, j - 1), tileAt(i - 1, j), tileAt(i, j)]; let m = 0;
    if (L === 3 && !t.includes(4)) continue;   // dirt is only laid where a dirt tile is near: under plain grass edges it would peek out past the grass
    for (let k = 0; k < 4; k++) if (L === 6 ? t[k] === 6 : LVL[t[k]] >= L) m |= 1 << k;
    if (!m) continue; const hv = hash2(i, j, 30 + L), col = m === 15 ? (VARIETY[L] && ASSET.img[VARIETY[L]] ? variantCol(L, hash2(i, j, 77), i, j) : 32 + (hv > 0.9 ? 3 : Math.floor(hv / 0.9 * 3))) : m + 16 * (hv > 0.5 ? 1 : 0);
    if (m === 15 && VARIETY[L] && ASSET.img[VARIETY[L]] && hash2(i, j, 91) < 0.5) { c.g.save(); c.g.translate(i * 16 + 8, j * 16 - 8); c.g.scale(-1, 1); c.g.drawImage(A, col * 16, L * 16, 16, 16, 0, 0, 16, 16); c.g.restore(); }   // half of the interior tiles of sand, grass and dirt are mirrored (edges never are)
    else c.g.drawImage(A, col * 16, L * 16, 16, 16, i * 16 - 8, j * 16 - 8, 16, 16);
  }
  if (FEATURES.groundDetail) decorate(c); drawSites(c); drawPits(c); drawDeck(c); return c;
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
function drawSites(c) { // excavation squares (placeholder art): trampled dirt, scattered finds on the surface, a rope border and a stake at each corner
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const z = SITE[ty * MW + tx]; if (!z) continue; const ox = tx * TS, oy = ty * TS, col = SITES[z].col, h = k => hash2(tx, ty, 700 + k);
    c.g.fillStyle = col; c.g.fillRect(ox, oy, TS, TS);
    c.g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 6; i++) c.g.fillRect(ox + Math.floor(h(i) * 14), oy + Math.floor(h(10 + i) * 14), 2, 1);       // soil texture
    c.g.fillStyle = 'rgba(255,230,190,0.10)'; for (let i = 0; i < 5; i++) c.g.fillRect(ox + Math.floor(h(20 + i) * 14), oy + Math.floor(h(30 + i) * 14), 2, 1);
    if (h(40) < 0.30) { const x = ox + 2 + Math.floor(h(41) * 10), y = oy + 3 + Math.floor(h(42) * 9); RC(c, x, y, 3, 1, '#d4a878'); RC(c, x + 1, y + 1, 2, 1, '#b88458'); }   // pottery shard
    if (h(43) < 0.20) { const x = ox + 2 + Math.floor(h(44) * 11), y = oy + 2 + Math.floor(h(45) * 11); RC(c, x, y, 2, 1, '#a8552a'); PX(c, x + 1, y + 1, '#7a3a1a'); }               // rusted fragment
    if (h(46) < 0.34) { const x = ox + 2 + Math.floor(h(47) * 10), y = oy + 2 + Math.floor(h(48) * 10); RC(c, x, y, 3, 2, '#8a8a82'); RC(c, x, y, 3, 1, '#b4b4aa'); }                    // pebble
    if (h(49) < 0.07) { const x = ox + 3 + Math.floor(h(50) * 6), y = oy + 4 + Math.floor(h(51) * 6); RC(c, x, y, 6, 1, '#5e3f24'); RC(c, x + 1, y - 1, 4, 1, '#5e3f24'); RC(c, x + 1, y + 1, 4, 1, '#7a5430'); }   // an exposed artifact shape, half buried
    const U = siteAtT(tx, ty - 1) === z, D = siteAtT(tx, ty + 1) === z, L = siteAtT(tx - 1, ty) === z, R = siteAtT(tx + 1, ty) === z;
    if (!U) { RC(c, ox, oy, TS, 1, '#efe2c0'); RC(c, ox, oy + 1, TS, 1, 'rgba(60,40,20,0.35)'); }
    if (!D) { RC(c, ox, oy + TS - 1, TS, 1, '#efe2c0'); RC(c, ox, oy + TS, TS, 1, 'rgba(60,40,20,0.35)'); }
    if (!L) { RC(c, ox, oy, 1, TS, '#efe2c0'); RC(c, ox + 1, oy, 1, TS, 'rgba(60,40,20,0.35)'); }
    if (!R) { RC(c, ox + TS - 1, oy, 1, TS, '#efe2c0'); RC(c, ox + TS, oy, 1, TS, 'rgba(60,40,20,0.35)'); }
    for (const [sx, sy, open] of [[ox, oy, !U && !L], [ox + TS - 1, oy, !U && !R], [ox, oy + TS - 1, !D && !L], [ox + TS - 1, oy + TS - 1, !D && !R]]) if (open) { RC(c, sx - 1, sy - 4, 3, 6, '#5a3a1a'); RC(c, sx - 1, sy - 4, 3, 2, '#8a5a30'); }
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
  return { v: 1, w: 64, h: 64, theme: cave ? 'cave' : 'day', tiles: serializeTiles(), deck: serializeDeck(), site: serializeSite(), pit: serializePit(), pier: null, structs: [], spawn: { x: 32 * TS, y: 32 * TS }, objects: [] };
}
const generateDefaultMap = () => blankMap(false), generateDefaultCave = () => blankMap(true);
function serializeTiles() { const rows = []; if (MGRID) { for (let ty = 0; ty < MH; ty++) { let s = ''; for (let tx = 0; tx < MW; tx++) s += String.fromCharCode(48 + MGRID[ty * MW + tx]); rows.push(s); } return rows; }   /* the museum keeps its own tile ids */ for (let ty = 0; ty < MH; ty++) { let s = ''; for (let tx = 0; tx < MW; tx++) s += GRID[ty * MW + tx]; rows.push(s); } return rows; }
function serializeMap() { return { v: 1, w: MW, h: MH, room: MAPDATA.room, tiles: serializeTiles(), deck: serializeDeck(), site: serializeSite(), pit: serializePit(), pier: null, theme: MAPDATA.theme || 'day', structs: [], spawn: MAPDATA.spawn, objects: MAPDATA.objects }; }
function validMap(m) {
  if (!(m && m.v === 1 && Array.isArray(m.tiles) && m.spawn && Array.isArray(m.objects))) return false;
  const w = m.w || 64, h = m.h || 64; if (!Number.isInteger(w) || !Number.isInteger(h) || w < MAP_MIN || h < MAP_MIN || w > MAP_MAX || h > MAP_MAX) return false;
  return m.tiles.length === h && m.tiles.every(r => typeof r === 'string' && r.length === w);
}

const SOLIDS = { camp: [[-26, -8, 52, 8], 20], shop: [[-24, -9, 48, 9], 22], bench: [[-14, -6, 28, 6], 22], campfire: [[-6, -3, 12, 3]], anvil: [[-9, -4, 18, 4], 22], hammer: [[-2, -2, 4, 2]], furnace: [[-20, -9, 40, 9], 22], tree: [[-3, -4, 6, 4]] };   // collision boxes (and press range) of the things still in the game; add entries here for new objects
function instantiate(s) {
  let o;
  switch (s.k) {
    case 'camp': o = { k: 'camp', spr: SPR.camp }; break;
    case 'tree': if (!SPR.tree) return; o = { k: 'tree', spr: SPR.tree.trunk, crown: SPR.tree.crown, shadow: SPR.tree.shadow, bare: (s.v | 0) === 1, ph: hash2(s.x | 0, s.y | 0, 41) * 6.28, shake: 0, lt: 1 + hash2(s.x | 0, s.y | 0, 42) * 5 }; break;
    case 'shop': if (!SPR.shop) return; o = { k: 'shop', spr: SPR.shop }; break;
    case 'anvil': if (!SPR.anvil) return; o = { k: 'anvil', spr: SPR.anvil }; break;
    case 'hammer': if (!SPR.hammer) return; o = { k: 'hammer', spr: SPR.hammer }; break;
    case 'furnace': if (!SPR.furnace) return; o = { k: 'furnace', spr: SPR.furnace }; break;
    case 'campfire': if (!SPR.campfire) return; o = { k: 'campfire', spr: SPR.campfire[0], frames: SPR.campfire, ph: hash2(s.x | 0, s.y | 0, 9) * 4 }; break;
    case 'museum': if (!SPR.museum) return; o = { k: 'museum', spr: SPR.museum }; MDOOR = { x: s.x, y: s.y + 10 }; break;
    case 'mprop': if (!SPR.mprop || !SPR.mprop[s.n]) return; o = { k: 'mprop', spr: SPR.mprop[s.n], n: s.n, item: s.item || null, st: s.st | 0, show: s.show || null, bare: !!s.bare, ix: s.ix | 0, iy: s.iy | 0 }; if (s.sy != null) o.sy = s.sy; if (s.n === 'noentry') o.sy = s.y + 40; if (s.n === 'arch' || s.n === 'arch_narrow') o.sy = -200; break;   // stairs are part of the floor: you are always drawn on top of them   // the sign hangs in front of its doorway
    case 'mexit': o = { k: 'mexit', to: s.to, sx: s.sx, sy: s.sy }; break;
    case 'bench': if (!SPR.bench) return; o = { k: 'bench', spr: SPR.bench }; break;
    case 'decor': if (!SPR.decor[s.d]) return; o = { k: 'decor', spr: SPR.decor[s.d] }; break;
    default: return;
  }
  let sd = SOLIDS[s.k];
  
  o.x = s.x; o.y = s.y; o.src = s;
  if (sd) { o.box = sd[0]; if (sd[1]) o.ia = sd[1]; }
  W.objs.push(o); if (o.box) W.solids.push(o);
  if (o.k === 'museum') for (const [part, sy] of [['ground', -400], ['back', -21], ['cols', -11]]) W.objs.push({ k: 'museum' + part, x: o.x, y: o.y, sy: o.y + sy, spr: o.spr[part] || o.spr, part, owner: o });   // the building is drawn in three pieces at their own depths: the ground, the wall and roof (in front of you when you are south of the wall), the columns
  if (o.k === 'furnace') W.solids.push({ k: 'furnace', x: o.x, y: o.y, box: [-39, -8, 20, 8] });   // the conveyor belt beside it is solid too
  if (o.k === 'mprop' && isArch(o.n) && SPR.mprop[o.n + '_tip']) W.objs.push({ k: 'mprop', x: o.x, y: o.y, sy: o.y - 6, spr: SPR.mprop[o.n + '_tip'], n: o.n + '_tip', nosel: true });   // the top of the arch is drawn over you when you are in the doorway: you walk under it
  if (o.k === 'mprop' && o.spr.col) for (const b of o.spr.col) W.solids.push({ k: 'mprop', x: o.x, y: o.y, box: b });   // cases, the stage and the board are solid where they are painted
  if (o.k === 'museum' && o.spr.col) for (const b of o.spr.col) W.solids.push({ k: 'museum', x: o.x, y: o.y, box: b });   // the museum's walls and columns, from its collision picture
}
function rebuildObjects() {
  W.objs = []; W.solids = []; W.trees = []; W.bushes = []; W.lamps = []; W.fires = []; W.glows = []; W.patches = []; 
  MAPDATA.objects.forEach(instantiate);
}
const isArch = n => /^arch/.test(n) && !/_tip$/.test(n);
function computeStairs() {   // a stairs arch with no rope across it can be walked up: you climb from the floor into the doorway and on into the corridor beyond
  W.stairs = []; if (!W.objs) return; const ropes = W.objs.filter(o => o.k === 'mprop' && o.n === 'stanchion');
  for (const o of W.objs) if (o.k === 'mprop' && isArch(o.n) && !ropes.some(r => Math.abs(r.x - o.x) < 24 && Math.abs(r.y - o.y) < 16)) { let y0 = o.y - o.spr.height + 5; for (let k = 0; k < 40; k++) { if (typeAt(o.x, y0 - k) === 5) { y0 -= k; break; } } W.stairs.push({ x0: o.x - 11, x1: o.x + 11, y0, y1: o.y + 2, yb: o.y - 2 });
    const tip = SPR.mprop[o.n + '_tip']; if (tip && tip.t0 == null) { const d = tip.g.getImageData(0, 0, tip.width, tip.height).data; tip.t0 = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) { tip.t0 = Math.floor(i / 4 / tip.width); break; } }
    const dome = o.y - o.spr.height + (tip ? tip.t0 : 0); let yt = dome; const tc = W.terrain.g;   // the wall's top edge (the dark cap) between the corridor floor and the top of the doorway: it is drawn over you while you pass through
    for (let k = 1; k < 24; k++) { const px = tc.getImageData(o.x, dome - k, 1, 1).data; if (px[0] < 30 && px[1] < 30 && px[2] < 33) break; if (px[0] > 205 && px[1] > 200 && px[2] < 200 && px[0] !== 225) break; yt = dome - k; }   // up to the dark gap (or the corridor's floor)
    let cols = null; if (tip) { const d = tip.g.getImageData(0, 0, tip.width, tip.height).data; cols = []; for (let c = 0; c < tip.width; c++) { let r = 0; for (let y = tip.t0; y < tip.height; y++) if (d[(y * tip.width + c) * 4 + 3]) { r = y - tip.t0; break; } cols.push(r); } }   // for each column, how far the curved top of the frame is below its highest point: the corners above the curve are wall too
    if (dome > yt) W.objs.push({ k: 'archwall', x: o.x, y: o.y, sy: o.y - 6, nosel: true, strip: { x: o.x - o.spr.ax, y: yt, w: o.spr.width, h: dome - yt, cols } }); }   // up to the corridor floor above (through the frame at the top of the doorway)
}
function passageWalls() {   // a doorway cut through a wall (two rooms side by side): the wall's top edge and its face down to the curve of the arch hide you as you walk through, like the stairs' wall
  if (MAPDATA && MAPDATA.archwalls) for (const q of MAPDATA.archwalls) W.objs.push({ k: 'archwall', x: q.cx, y: q.by, sy: q.y, nosel: true, strip: { x: q.x, y: q.y, w: q.w, h: q.h, bot: q.bot, pw: q.pw, bandb: q.bandb } });
}
const stairsAt = (x, y) => { if (W.stairs) for (const s of W.stairs) if (x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1) return s; return null; };
function rebuildAll() {
  buildDist(); rebuildObjects(); W.terrain = renderTerrain(); computeStairs(); passageWalls(); buildSiteRegions();
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
const pitV = (tx, ty) => (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? 0 : PIT[ty * MW + tx];
function rampDir(tx, ty) {   // which way a ramp tile slopes down: [dx, dy] pointing from its high side to its low side
  const v = pitV(tx, ty); let hi = null, lo = null;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const nv = pitV(tx + dx, ty + dy); if (nv === v - 1 && !hi) hi = [dx, dy]; if (nv === v + 1 && !lo) lo = [dx, dy]; }
  if (lo) return lo; if (hi) return [-hi[0], -hi[1]]; return null;
}
function pitZ(x, y) {   // how far below ground level a point is, in units (smooth along ramps)
  const tx = Math.floor(x / TS), ty = Math.floor(y / TS), v = pitV(tx, ty); if (!(v & 1)) return v / 2;
  const r = rampDir(tx, ty); if (!r) return v / 2; const fx = (x - tx * TS) / TS, fy = (y - ty * TS) / TS;
  return (v - 1) / 2 + clamp(r[0] === 1 ? fx : r[0] === -1 ? 1 - fx : r[1] === 1 ? fy : 1 - fy, 0, 1);
}
function rimY(x, y) {   // world y below which something standing in a pit is hidden behind the higher ground in front of it
  const z = pitZ(x, y); if (z < 0.01) return null;
  for (let ty = Math.floor(y / TS) + 1; ty < MH; ty++) { const zz = pitZ(x, ty * TS + 1); if (zz < z - 0.01) return ty * TS + zz * PIT_U; }
  return null;
}
function serializePit() { const rows = []; for (let ty = 0; ty < MH; ty++) { let r = ''; for (let tx = 0; tx < MW; tx++) r += PIT[ty * MW + tx]; rows.push(r); } return rows; }
function drawPits(c) {   // sunken ground: floors drawn lower on screen, north walls showing strata, ramps as plank slopes (placeholder art)
  let any = false; for (let i = 0; i < PIT.length; i++) if (PIT[i]) { any = true; break; } if (!any) return;
  const snap = mk(c.width, c.height); snap.g.drawImage(c, 0, 0); const U = PIT_U;
  const floorCol = d => d >= 2 ? '#4e3622' : d >= 1 ? '#5f4329' : '#6a4b2e', STRATA = ['#8f6439', '#a77d4b', '#7d532e', '#9a7040'];
  const face = (x, y0, y1, w) => { for (let y = Math.round(y0); y < Math.round(y1); y++) { c.g.fillStyle = STRATA[(y >> 1) & 3]; c.g.fillRect(x, y, w, 1); } c.g.fillStyle = 'rgba(0,0,0,0.22)'; c.g.fillRect(x, Math.round(y1) - 1, w, 1); };
  const floorTex = (tx, ty, x, y, w, h, d) => { c.g.fillStyle = floorCol(d); c.g.fillRect(x, y, w, h); c.g.fillStyle = 'rgba(0,0,0,0.14)'; for (let i = 0; i < 4; i++) c.g.fillRect(x + Math.floor(hash2(tx, ty, 800 + i) * (w - 2)), y + Math.floor(hash2(tx, ty, 810 + i) * (h - 1)), 2, 1); c.g.fillStyle = 'rgba(255,225,180,0.10)'; for (let i = 0; i < 3; i++) c.g.fillRect(x + Math.floor(hash2(tx, ty, 820 + i) * (w - 2)), y + Math.floor(hash2(tx, ty, 830 + i) * (h - 1)), 2, 1); };
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const v = PIT[ty * MW + tx]; if (!v) continue; const ox = tx * TS, oy = ty * TS;
    if (!(v & 1)) {
      const d = v / 2, off = Math.round(d * U), dn = pitZ(ox + 8, oy - 0.5);
      floorTex(tx, ty, ox, oy + off, TS, TS, d);
      if (dn < d) { face(ox, oy + dn * U, oy + off, TS); c.g.fillStyle = 'rgba(255,235,200,0.35)'; c.g.fillRect(ox, Math.round(oy + dn * U), TS, 1); }   // the north wall, with a lit lip
      if (pitV(tx - 1, ty) < v - 1) { c.g.fillStyle = 'rgba(0,0,0,0.3)'; c.g.fillRect(ox, oy + off, 2, TS); }       // the side walls seen edge-on
      if (pitV(tx + 1, ty) < v - 1) { c.g.fillStyle = 'rgba(0,0,0,0.3)'; c.g.fillRect(ox + TS - 2, oy + off, 2, TS); }
      if (pitZ(ox + 8, oy + TS + 0.5) === 0) c.g.drawImage(snap, ox, oy + TS, TS, off, ox, oy + TS, TS, off);        // the ground to the south hides the bottom of the pit
    } else {
      const r = rampDir(tx, ty) || [1, 0];
      if (r[0]) for (let k = 0; k < TS; k++) {   // a ramp along x: one column at a time
        const t = r[0] === 1 ? (k + 0.5) / TS : 1 - (k + 0.5) / TS, z = (v - 1) / 2 + t, off = Math.round(z * U), dn = pitZ(ox + k + 0.5, oy - 0.5);
        c.g.fillStyle = ((k >> 2) & 1) ? '#8a6a40' : '#7a5a34'; c.g.fillRect(ox + k, oy + off, 1, TS); c.g.fillStyle = 'rgba(0,0,0,0.2)'; c.g.fillRect(ox + k, oy + off + TS - 2, 1, 2);
        if (dn < z) face(ox + k, oy + dn * U, oy + off, 1);
        if (pitZ(ox + k + 0.5, oy + TS + 0.5) === 0) c.g.drawImage(snap, ox + k, oy + TS, 1, off, ox + k, oy + TS, 1, off);
      } else for (let k = 0; k < TS; k++) {      // a ramp along y: one row at a time
        const t = r[1] === 1 ? (k + 0.5) / TS : 1 - (k + 0.5) / TS, z = (v - 1) / 2 + t, ys = oy + k + Math.round(z * U);
        c.g.fillStyle = ((k >> 2) & 1) ? '#8a6a40' : '#7a5a34'; c.g.fillRect(ox, ys, TS, 2);
        c.g.fillStyle = 'rgba(0,0,0,0.25)'; c.g.fillRect(ox, ys, 1, 2); c.g.fillRect(ox + TS - 1, ys, 1, 2);
      }
    }
  }
}
function museumLayout(room) {   // the museum room from a floor plan: room.floor is rows of 0/1 per 32px marble block, room.exits are the corridor blocks. Walls, frame, corners, floor edges and the exit corridor are picked automatically from the tiles drawn in the template (tileset.json tmpl, see tools/museum_interior_export.py)
  const T = ASSET.mTiles.tmpl.grid, bw = clamp(room.w | 0, 2, 60), bh = clamp(room.h | 0, 2, 60), cols = 2 * bw + 8, rows = 2 * bh + 8;
  const fl = []; for (let y = 0; y < bh; y++) fl.push(((room.floor && room.floor[y]) || '1'.repeat(bw)).padEnd(bw, '0'));
  const fb = (x, y) => x >= 0 && y >= 0 && x < bw && y < bh && fl[y][x] === '1';
  const F = (cx, cy) => cx >= 3 && cy >= 5 && fb((cx - 3) >> 1, (cy - 5) >> 1);
  const K = (cx, cy) => { if (F(cx, cy)) return 0; for (let k = 1; k <= 5; k++) if (F(cx, cy + k)) return k; return 0; };   // a wall cell: how far below it the floor starts (1 to 5) = which row of the back wall it is
  const out = [];
  for (let cy = 0; cy < rows; cy++) {
    const row = [];
    for (let cx = 0; cx < cols; cx++) {
      let id = 1;
      if (F(cx, cy)) {
        const bx = (cx - 3) >> 1, by = (cy - 5) >> 1, qx = (cx - 3) & 1, qy = (cy - 5) & 1, L = !fb(bx - 1, by), R = !fb(bx + 1, by), Tt = !fb(bx, by - 1), Bt = !fb(bx, by + 1);
        const tc = L ? 3 + qx : R ? 25 + qx : 5 + 2 * Math.floor(hash2(bx, by, 7) * 10) + qx, B = hash2(bx, by, 9) < 0.5;
        const tr = Tt ? (qy ? 6 : 5) : Bt ? 15 + qy : B ? 7 + qy : (qy ? 6 : 9);
        id = T[tr][tc];
      } else {
        const k = K(cx, cy);
        if (k) { const kl = K(cx - 1, cy) !== k, kr = K(cx + 1, cy) !== k; id = T[5 - k][kl ? 3 : kr ? 26 : 4]; }
        else if (F(cx, cy - 1)) id = !F(cx - 1, cy - 1) ? T[17][3] : !F(cx + 1, cy - 1) ? T[17][26] : T[17][4];
        else if (F(cx + 1, cy - 1) && !F(cx + 1, cy)) id = T[17][2];
        else if (F(cx - 1, cy - 1) && !F(cx - 1, cy)) id = T[17][27];
        else if (F(cx + 1, cy) || K(cx + 1, cy)) id = K(cx + 1, cy) ? (K(cx + 1, cy) === 5 ? T[0][2] : T[1][2]) : (!F(cx + 1, cy + 1) ? T[16][2] : T[5][2]);
        else if (F(cx - 1, cy) || K(cx - 1, cy)) id = K(cx - 1, cy) ? (K(cx - 1, cy) === 5 ? T[0][27] : T[1][27]) : (!F(cx - 1, cy + 1) ? T[16][27] : T[5][27]);
      }
      row.push(id);
    }
    out.push(row);
  }
  const exits = (room.exits && room.exits.length ? room.exits : [{ x: bw, y: bh - 2 }]).filter(e => e.x >= 1 && e.x <= bw && e.y >= 0 && e.y < bh).slice(0, 1), ex = [];
  for (const e of exits) {   // the exit corridor: its walls, frame and the floor beside it, stamped from the template
    const cc = 3 + 2 * e.x, cr = 5 + 2 * e.y;
    for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 3; dc++) { const x = cc - 1 + dc, y = cr - 4 + dr; if (x >= 0 && y >= 0 && x < cols && y < rows) out[y][x] = T[9 + dr][26 + dc]; }
    ex.push({ x: cc * 16 + 30, y: cr * 16 + 28, sx: cc * 16 + 8 });
  }
  const e0 = ex[0] || { x: 3 * 16 + 30, y: 5 * 16 + 28, sx: 3 * 16 + 8 };
  return { w: bw, h: bh, cols, rows, tiles: out.map(r => r.map(v => String.fromCharCode(48 + v)).join('')), floor: fl, exits, exitPos: ex, spawn: { x: e0.sx, y: e0.y } };
}
function loadMap(map) {
  if (map.theme === 'museum' && map.room && ASSET.mTiles && ASSET.mTiles.tmpl) {   // a room built in the editor is rebuilt from its floor plan, so it always matches the current tile set (the museum as drawn is a plain tile map)
    const R = museumLayout(map.room); map.room = { w: R.w, h: R.h, floor: R.floor.map(r => r), exits: R.exits }; map.w = R.cols; map.h = R.rows; map.tiles = R.tiles; map.spawn = R.spawn;
    map.objects = (map.objects || []).filter(o => o.k !== 'mexit').concat(R.exitPos.map(e => ({ k: 'mexit', x: e.x, y: e.y, to: 'island' })));
  }
  setMapSize(map.w || 64, map.h || 64); GRID = new Uint8Array(MW * MH);
  const museum = map.theme === 'museum' && ASSET.mTiles; MGRID = museum ? new Uint16Array(MW * MH) : null; const walk = museum ? new Set(ASSET.mTiles.walk) : null;
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) { const id = map.tiles[ty].charCodeAt(tx) - 48; if (museum) { MGRID[ty * MW + tx] = id; GRID[ty * MW + tx] = walk.has(id) ? 5 : 0; } else GRID[ty * MW + tx] = Math.min(6, Math.max(0, id)); }   // the museum's tiles are ids into its own tile set; the game only needs to know floor (walkable) from everything else
  MAPDATA = map; W.theme = map.theme || 'day'; buildDist();
  if (!map.structs) map.structs = map.pier ? [{ t: 'pier', x0: map.pier.x0, y0: map.pier.y0, x1: map.pier.x1, y1: map.pier.y1, style: 0, rails: false, posts: true }] : [];
  map.pier = null;
  if (Array.isArray(map.deck) && map.deck.length === MH && map.deck.every(r => typeof r === 'string' && r.length === MW)) for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) DECK[y * MW + x] = Math.min(6, Math.max(0, map.deck[y].charCodeAt(x) - 48));
  for (const q of map.structs) { const id = (q.style | 0) % 3 + 1 + (q.rails ? 3 : 0); for (let y = q.y0; y < q.y1; y++) for (let x = q.x0; x < q.x1; x++) if (x >= 0 && y >= 0 && x < MW && y < MH) DECK[y * MW + x] = id; } // old pier / bridge rectangles become deck tiles
  map.structs = [];
  if (Array.isArray(map.site) && map.site.length === MH && map.site.every(r => typeof r === 'string' && r.length === MW)) for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) SITE[y * MW + x] = FEATURES.sites || EDIT ? Math.min(4, Math.max(0, map.site[y].charCodeAt(x) - 48)) : 0;
  if (Array.isArray(map.pit) && map.pit.length === MH && map.pit.every(r => typeof r === 'string' && r.length === MW)) for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) PIT[y * MW + x] = Math.min(8, Math.max(0, map.pit[y].charCodeAt(x) - 48));
  W.spawn = { x: map.spawn.x, y: map.spawn.y };
  rebuildAll(); computeShore();
}
function initWorld(map) { loadMap(map); }

// ---- collision --------------------------------------------------------------------------------------
let MSOL = null;
function museumSolidPix(x, y) {   // the museum's walls and frame are solid where they are painted: the dark frame inside a floor tile at the room's edge is not floor
  if (!MSOL) { const A = ASSET.img.museum_tiles, c = mk(A.width, A.height); c.g.drawImage(A, 0, 0); MSOL = { d: c.g.getImageData(0, 0, A.width, A.height).data, w: A.width, cache: {} }; }
  const ps = MAPDATA && MAPDATA.passages; if (ps) for (const q of ps) if (x >= q[0] && x < q[2] && y >= q[1] && y < q[3]) return false;   // a doorway through a wall's dark edge
  const tx = Math.floor(x / 16), ty = Math.floor(y / 16); if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true; const id = MGRID[ty * MW + tx];
  const sx = (id & 15) * 16 + (Math.floor(x) & 15), sy = (id >> 4) * 16 + (Math.floor(y) & 15), i = (sy * MSOL.w + sx) * 4, d = MSOL.d;
  return d[i + 3] < 10 || 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2] < 100;   // (dark slate frame and void; the carpets are lighter)
}
function blockedAt(x, y, hw = 3, hh = 3, wade = false) {   // wade: you can walk into the shallows (deep water still stops everyone); 'stone': a kicked stone ignores water and ledges (the caller deals with falling in)   // hw/hh: half width and height of the thing being moved (you by default; small stones pass their own)
  if (x < 10 || y < 10 || x > PW - 10 || y > PH - 10) return true;
  let zmin = 99, zmax = -1;
  for (const o of [[-hw, 0], [hw, 0], [-hw, -hh], [hw, -hh]]) { const t = stairsAt(x + o[0], y + o[1]) ? 5 : typeAt(x + o[0], y + o[1]); if (wade !== 'stone' && (t === 0 || ((t === 1 || t === 6) && !wade))) return true; const z = pitZ(x + o[0], y + o[1]); if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
  if (wade !== 'stone' && zmax - zmin > 0.55) return true;   // a step in the ground (the wall of a pit) can't be walked over; ramps rise gently enough
  if (MGRID && wade !== 'stone') for (const o of [[-hw, 2], [hw, 2], [-hw, -hh], [hw, -hh]]) { const px = x + o[0], py = y + o[1]; if (!stairsAt(px, py) && museumSolidPix(px, py)) return true; }
  const x0 = x - hw, x1 = x + hw, y0 = y - hh, y1 = y;
  for (const o of W.solids) {
    const bx = o.x + o.box[0], by = o.y + o.box[1]; if (x < bx - 16 || x > bx + o.box[2] + 16 || y < by - 16 || y > by + o.box[3] + 16) continue;   // only the solids near you (judged by their own edges, so a wide building is not skipped)
    if (x1 > bx && x0 < bx + o.box[2] && y1 > by && y0 < by + o.box[3]) return true;
  }
  return false;
}
function moveEnt(e, dx, dy) {
  let moved = false;
  const wd = e === ME;
  if (dx && !blockedAt(e.x + dx, e.y, 3, 3, wd)) { e.x += dx; moved = true; }
  if (dy && !blockedAt(e.x, e.y + dy, 3, 3, wd)) { e.y += dy; moved = true; }
  return moved;
}
function distToBox(x, y, o) {
  const bx = o.x + o.box[0], by = o.y + o.box[1], cx = clamp(x, bx, bx + o.box[2]), cy = clamp(y, by, by + o.box[3]);
  return Math.hypot(x - cx, y - cy);
}
