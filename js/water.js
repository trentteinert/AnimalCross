'use strict';
// ---- animated water (after the layered water from the devlog the user shared): a depth gradient, a moving caustic pattern with specular sparkles,
// hand-drawn moving edges with a foam line (tools/src/Moving_water.aseprite -> assets/tiles/water_anim.png, tools/water_export.py), and the cliff shadow.
// The ground under the water is sand (js/world.js renderTerrain lays it there); each frame the water of the visible part of the map is drawn over it,
// then the things that stand above the water (grass cliffs, piers) are drawn again on top (WATER.over).
const WATER = { sd: null, val: null, shade: null, over: null, caus: null, noise: null, cv: null, sv: null };
const WCOL = { shore: [126, 186, 172], mid: [78, 150, 160], deep: [52, 112, 140], caus: [168, 216, 214], foam: [232, 244, 238], spark: [214, 238, 236] };   // shore (thin water) through mid to deep
const WAVE = { low: -1.5, high: 4.5, period: 5.2, along: 0.045, rough: 1.4, foam: 1.6, wetA: 28, fps: 7 };   // the waves on the shore (pixels; seconds): how far back and up they go, how long one takes, how fast it travels along the coast, how uneven its edge is, how thick the foam, how dark the wet sand
const WAVE_CLIFF = { low: -1.6, high: 0, period: 3.6, along: 0.06, rough: 0.8, foam: 1.1, wetA: 0, fps: 7, dotted: true, foamFace: 0.66, foamSide: 0.84 };   // foamFace / foamSide: under a cliff's face (grey stone) and along its sides, the foam shows in clumps where a slow noise is above this (higher = less foam)   // against a grass cliff: the water only bobs a little under it, with a broken line of foam (it never runs up onto the grass)
const waterOn = () => W.theme !== 'museum' && W.theme !== 'cave' && !!ASSET.img.water_anim && typeof WATER_ANIM !== 'undefined';
const isOpenWater = t => t === 0 || t === 1;

function waterTextures() {   // a tileable caustic pattern (cell edges, 1 pixel lines) and a tileable noise for the wobble and the sparkles, made once
  if (WATER.caus) return; const N = 64, pts = [];
  for (let k = 0; k < 11; k++) pts.push([hash2(k, 1, 901) * N, hash2(k, 2, 901) * N]);
  WATER.caus = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a = 1e9, b = 1e9;
    for (const [px, py] of pts) for (let oy = -N; oy <= N; oy += N) for (let ox = -N; ox <= N; ox += N) { const d = Math.hypot(x - px - ox, (y - py - oy) * 1.25); if (d < a) { b = a; a = d; } else if (d < b) b = d; }
    WATER.caus[y * N + x] = b - a < 1.1 ? 1 : 0;   // on the edge between two cells
  }
  const g = new Float32Array(9 * 9); for (let i = 0; i < 81; i++) g[i] = hash2(i % 9, (i / 9) | 0, 902);
  WATER.noise = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {   // smooth value noise on an 8 x 8 lattice that wraps
    const fx = x / 8, fy = y / 8, ix = fx | 0, iy = fy | 0, u = fx - ix, v = fy - iy, s = t => t * t * (3 - 2 * t), q = (a, b) => g[(b % 8) * 9 + (a % 8)];
    WATER.noise[y * N + x] = (q(ix, iy) * (1 - s(u)) + q(ix + 1, iy) * s(u)) * (1 - s(v)) + (q(ix, iy + 1) * (1 - s(u)) + q(ix + 1, iy + 1) * s(u)) * s(v);
  }
}

function waterBuild(cliffM, ground) {   // called by renderTerrain: how deep the water is per tile, the cliffs' shadow on it, and what stands above it
  if (!waterOn()) { WATER.val = null; return; }
  waterTextures();
  const val = new Float32Array(MW * MH);   // 0 on land, the shallows a little, open water fully
  const dist = new Int16Array(MW * MH).fill(-1), q = [];   // how far each water tile is from the nearest land (tiles)
  for (let i = 0; i < MW * MH; i++) if (!isOpenWater(GRID[i])) { dist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % MW, y = (i / MW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue; const j = yy * MW + xx; if (dist[j] < 0) { dist[j] = dist[i] + 1; q.push(j); } } }
  for (let i = 0; i < MW * MH; i++) val[i] = isOpenWater(GRID[i]) ? Math.min(1, dist[i] / 6) * (GRID[i] === 0 ? 1 : 0.7) : 0;   // deeper the further from the shore (the shallows never get very deep)
  for (let pass = 0; pass < 3; pass++) {   // softened, so the deep and the shallows fade into each other over a few tiles (no tile-shaped blocks)
    const nv = new Float32Array(MW * MH);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = y * MW + x; if (!isOpenWater(GRID[i])) continue; let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) { s += 1; n++; continue; } s += val[yy * MW + xx]; n++; }
      nv[i] = s / n;
    }
    val.set(nv);
  }
  WATER.val = val;
  WATER.shade = new Uint8Array(PW * PH).fill(255);
  if (cliffM) {   // the cliffs' shadow: below them, and a pixel to the right (the light comes from above, a little from the left)
    const md = cliffM.g.getImageData(0, 0, PW, PH).data, N = CLIFF_SHADOW.length;
    for (let y = 0; y < PH; y++) for (let x = 1; x < PW; x++) {
      if (!isOpenWater(GRID[(y >> 4) * MW + (x >> 4)]) || md[(y * PW + x) * 4 + 3]) continue;
      for (let k = 0; k <= N && k <= y; k++) if (md[((y - k) * PW + x - 1) * 4 + 3]) { WATER.shade[y * PW + x] = Math.round(CLIFF_SHADOW[Math.max(0, k - 1)] * 255); break; }
    }
  }
  const over = mk(PW, PH);   // the grass cliffs as they are on the finished ground (with the grass's shadow patches and little sprites), then the piers
  if (cliffM) { over.g.drawImage(ground || cliffM, 0, 0); over.g.globalCompositeOperation = 'destination-in'; over.g.drawImage(cliffM, 0, 0); over.g.globalCompositeOperation = 'source-over'; }
  drawDeck(over); WATER.over = over;   // the grass cliffs and the piers stand above the water
  const ct = new Uint8Array(MW * MH);   // tiles at a grass cliff: water next to grass, and that grass
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const t = GRID[y * MW + x]; if (!isOpenWater(t) && t !== 3) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue; const u = GRID[yy * MW + xx]; if ((isOpenWater(t) && u === 3) || (t === 3 && isOpenWater(u))) ct[y * MW + x] = 1; } }
  WATER.cliffT = ct;
  WATER.cd = null;
  if (cliffM) {   // how far each pixel is from the cliffs as drawn (thirds of a pixel, capped): the foam at a cliff hugs its foot
    const md = cliffM.g.getImageData(0, 0, PW, PH).data, N = PW * PH, D = new Uint8Array(N);
    for (let i = 0; i < N; i++) D[i] = md[i * 4 + 3] ? 0 : 30;
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const i = y * PW + x; if (!D[i]) continue; let v = D[i]; if (x > 0) v = Math.min(v, D[i - 1] + 3); if (y > 0) { v = Math.min(v, D[i - PW] + 3); if (x > 0) v = Math.min(v, D[i - PW - 1] + 4); if (x < PW - 1) v = Math.min(v, D[i - PW + 1] + 4); } D[i] = v; }
    for (let y = PH - 1; y >= 0; y--) for (let x = PW - 1; x >= 0; x--) { const i = y * PW + x; if (!D[i]) continue; let v = D[i]; if (x < PW - 1) v = Math.min(v, D[i + 1] + 3); if (y < PH - 1) { v = Math.min(v, D[i + PW] + 3); if (x < PW - 1) v = Math.min(v, D[i + PW + 1] + 4); if (x > 0) v = Math.min(v, D[i + PW - 1] + 4); } D[i] = v; }
    WATER.cd = D;
    const lip = new Uint8Array(N);   // the foot of a cliff's face (the grey stone shows: the cliff is right above), not its sides
    for (let y = 1; y < PH; y++) for (let x = 0; x < PW; x++) if (!md[(y * PW + x) * 4 + 3]) for (let k = 1; k <= 3 && k <= y; k++) if (md[((y - k) * PW + x) * 4 + 3]) { lip[y * PW + x] = 1; break; }
    WATER.lip = lip;
  }
  waterCoast();
}
function waterCoast() {   // the coast as a distance field: for every pixel near it, how far it is from the shoreline (in quarter pixels; minus = in the water)
  // the still shoreline is the hand-drawn edge (frame 1 of tools/src/Moving_water.aseprite), laid at every corner of the map
  const m = mk(PW, PH), im = ASSET.img.water_anim;
  for (let j = 0; j <= MH; j++) for (let i = 0; i <= MW; i++) {
    const t = [tileAt(i - 1, j - 1), tileAt(i, j - 1), tileAt(i - 1, j), tileAt(i, j)]; let k = 0;
    for (let q = 0; q < 4; q++) if (isOpenWater(t[q])) k |= 1 << q;
    if (k) m.g.drawImage(im, k * 16, 0, 16, 16, i * 16 - 8, j * 16 - 8, 16, 16);
  }
  const md = m.g.getImageData(0, 0, PW, PH).data, N = PW * PH, CAP = 60, wet = new Uint8Array(N);
  for (let i = 0; i < N; i++) wet[i] = md[i * 4 + 3] > 0 ? 1 : 0;
  const cham = inside => {   // two-pass chamfer distance (3 = a step, 4 = a diagonal) to the nearest pixel on the other side, capped
    const D = new Uint8Array(N);
    for (let i = 0; i < N; i++) D[i] = wet[i] === inside ? CAP : 0;
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const i = y * PW + x; if (!D[i]) continue; let v = D[i];
      if (x > 0) v = Math.min(v, D[i - 1] + 3); if (y > 0) { v = Math.min(v, D[i - PW] + 3); if (x > 0) v = Math.min(v, D[i - PW - 1] + 4); if (x < PW - 1) v = Math.min(v, D[i - PW + 1] + 4); } D[i] = v; }
    for (let y = PH - 1; y >= 0; y--) for (let x = PW - 1; x >= 0; x--) { const i = y * PW + x; if (!D[i]) continue; let v = D[i];
      if (x < PW - 1) v = Math.min(v, D[i + 1] + 3); if (y < PH - 1) { v = Math.min(v, D[i + PW] + 3); if (x < PW - 1) v = Math.min(v, D[i + PW + 1] + 4); if (x > 0) v = Math.min(v, D[i + PW - 1] + 4); } D[i] = v; }
    return D;
  };
  const dIn = cham(1), dOut = cham(0), sd = new Int8Array(N);   // dIn: in the water, how far from the land; dOut: on the land, how far from the water (both in thirds of a pixel)
  for (let i = 0; i < N; i++) sd[i] = wet[i] ? -Math.round(dIn[i] * 4 / 3) + 2 : Math.round(dOut[i] * 4 / 3) - 2;   // quarter pixels, 0 halfway across the drawn edge
  WATER.sd = sd;
}

function waterShade(wx, wy) {   // smooth depth at a world pixel: the tile values blended between tile centres (0 = shore, 1 = open water)
  const fx = (wx - 8) / 16, fy = (wy - 8) / 16, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy, V = WATER.val;
  const at = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? 1 : V[y * MW + x];
  return (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
}

function drawWater(cx, cy, now) {
  if (!WATER.val || !WATER.sd || !waterOn()) return;
  const M = 16, w = Math.ceil(VW) + 2 * M, h = Math.ceil(VH) + 2 * M, x0 = cx - M, y0 = cy - M;   // the visible part of the map, with a margin
  if (!WATER.cv || WATER.cv.width !== w || WATER.cv.height !== h) WATER.cv = mk(w, h);
  // the waves: the water reaches up to a level that rises and falls over time (eased, a little uneven, travelling along the coast); a foam line rides
  // on its front (thick while it comes in, broken while it goes back) and the sand it has just left stays dark for a moment
  const out = WATER.cv.g.createImageData(w, h), o = out.data, CA = WATER.caus, NO = WATER.noise, SH = WATER.shade, SD = WATER.sd;
  const tq = now * 3, ta = Math.floor(tq), tb = Math.floor(now * 5), C = WCOL, CT = WATER.cliffT, pulse = 0.55 + 0.45 * Math.sin(now * 0.7);   // pulse: the caustic pattern slowly comes and goes
  const lvl = (WV, wx, wy, tt) => { tt = Math.floor(tt * WV.fps) / WV.fps; const om = 2 * Math.PI / WV.period, ph = wx * WV.along + wy * WV.along * 0.6 + NO[((wy >> 4) & 63) * 64 + ((wx >> 4) & 63)] * 5; const sn = Math.sin(tt * om - ph), e = Math.sign(sn) * Math.abs(sn) ** 0.6; return WV.low + (WV.high - WV.low) * (0.5 + 0.5 * e); };   // (eased: it lingers at the top and the bottom)
  for (let py = 0; py < h; py++) {
    const wy = y0 + py; if (wy < 0 || wy >= PH) continue;
    for (let px = 0; px < w; px++) {
      const wx = x0 + px; if (wx < 0 || wx >= PW) continue;
      const WV = CT[(wy >> 4) * MW + (wx >> 4)] ? WAVE_CLIFF : WAVE;   // a cliff or a beach
      const pi = wy * PW + wx, sdv = SD[pi] / 4; if (sdv > WV.high + 2) continue;   // far up the beach: never reached
      const near = sdv > WV.low - WV.rough - WV.foam - 1;   // only the pixels the waves can reach need the wave worked out
      const jit = near ? (NO[((wy >> 1) & 63) * 64 + (((wx >> 1) + ta) & 63)] - 0.5) * WV.rough : 0, L = near ? lvl(WV, wx, wy, now) + jit : 99, coming = near && L >= lvl(WV, wx, wy, now - 0.3) + jit;
      const si = (py * w + px) * 4;
      if (sdv > L) {   // above the water: wet sand where it was a moment ago
        const Lw = WV.wetA ? Math.max(lvl(WV, wx, wy, now - 0.7), lvl(WV, wx, wy, now - 1.4)) + jit : -99;
        if (sdv < Lw && GRID[(wy >> 4) * MW + (wx >> 4)] === 2) { o[si] = 60; o[si + 1] = 40; o[si + 2] = 20; o[si + 3] = WV.wetA; }
        continue;
      }
      let r, gr, b, alpha = 255;
      const foamW = coming ? WV.foam : WV.foam * 0.6;
      const atCliff = WV === WAVE_CLIFF && WATER.cd, cdv = atCliff ? WATER.cd[pi] / 3 : 99;
      if (atCliff ? (cdv < 2.4 && cdv <= 0.8 + (lvl(WV, wx, wy, now) - WV.low) * 0.6 && NO[((((wy >> 1) + (tb >> 2)) & 63) * 64) + (((wx >> 1) + (ta >> 1)) & 63)] > (WATER.lip[pi] ? WAVE_CLIFF.foamFace : WAVE_CLIFF.foamSide)) : (sdv > L - foamW && (coming || hash2(wx, wy, ta) < 0.55))) { r = C.foam[0]; gr = C.foam[1]; b = C.foam[2]; }   // the foam on the wave's front
      else {
        const d = waterShade(wx, wy), e = d < 0.42 ? d / 0.42 : 1, f2 = d < 0.42 ? 0 : (d - 0.42) / 0.58;
        r = C.shore[0] + (C.mid[0] - C.shore[0]) * e + (C.deep[0] - C.mid[0]) * f2; gr = C.shore[1] + (C.mid[1] - C.shore[1]) * e + (C.deep[1] - C.mid[1]) * f2; b = C.shore[2] + (C.mid[2] - C.shore[2]) * e + (C.deep[2] - C.mid[2]) * f2;
        if (near && sdv > -7) alpha = Math.round(255 * Math.min(1, 0.4 + 0.6 * (L - sdv) / (L + 7)));   // thin water at the shore is see-through: the sand shows under it
        const n1 = NO[(((wy >> 1) + ta) & 63) * 64 + ((wx >> 1) & 63)], n2 = NO[((wy >> 1) & 63) * 64 + (((wx >> 1) + tb) & 63)];   // two scrolling noises bend the pattern (whole pixels: it stays pixel art)
        const ux = (wx + Math.floor(n1 * 6) - 3) & 63, uy = (Math.floor(wy * 1.2) + Math.floor(n2 * 6) - 3) & 63;
        const fade = NO[(((wy >> 3) + (ta >> 3)) & 63) * 64 + (((wx >> 3) + (tb >> 2)) & 63)];   // a slow fade over parts of the pattern, so it does not look like one repeating net
        if (CA[uy * 64 + ux] && fade > 0.3) {
          const k = (0.1 - 0.04 * d) * Math.min(1, (fade - 0.3) * 4) * pulse;   // faint, and it fades in and out r += (C.caus[0] - r) * k; gr += (C.caus[1] - gr) * k; b += (C.caus[2] - b) * k;
          const s2 = NO[(((wy >> 2) + tb) & 63) * 64 + (((wx >> 2) + ta) & 63)] + NO[(((wy >> 2) - ta + 31) & 63) * 64 + (((wx >> 2) - tb + 17) & 63)];   // noises scrolling opposite ways: where both are high, a sparkle
          if (s2 > 1.72 && pulse > 0.5) { r += (C.spark[0] - r) * 0.6; gr += (C.spark[1] - gr) * 0.6; b += (C.spark[2] - b) * 0.6; }   // a few soft glints
        }
        const sh = SH[pi]; if (sh < 255) { const q = sh / 255; r *= q; gr *= q; b *= q; }
      }
      o[si] = r; o[si + 1] = gr; o[si + 2] = b; o[si + 3] = alpha;
    }
  }
  WATER.cv.g.putImageData(out, 0, 0);
  g.drawImage(WATER.cv, x0 - cx, y0 - cy);
  if (WATER.over) g.drawImage(WATER.over, x0, y0, w, h, x0 - cx, y0 - cy, w, h);   // cliffs and piers over the water
}
