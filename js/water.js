'use strict';
// ---- animated water (after the layered water from the devlog the user shared): a depth gradient, a moving caustic pattern with specular sparkles,
// hand-drawn moving edges with a foam line (tools/src/Moving_water.aseprite -> assets/tiles/water_anim.png, tools/water_export.py), and the cliff shadow.
// The ground under the water is sand (js/world.js renderTerrain lays it there); each frame the water of the visible part of the map is drawn over it,
// then the things that stand above the water (grass cliffs, piers) are drawn again on top (WATER.over).
const WATER = { val: null, shade: null, over: null, caus: null, noise: null, cv: null, sv: null };
const WCOL = { shore: [96, 158, 150], mid: [52, 118, 132], deep: [36, 84, 106], caus: [150, 206, 204], foam: [228, 241, 236], spark: [246, 252, 250] };
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

function waterBuild(cliffM) {   // called by renderTerrain: how deep the water is per tile, the cliffs' shadow on it, and what stands above it
  if (!waterOn()) { WATER.val = null; return; }
  waterTextures();
  const val = new Float32Array(MW * MH);   // 0 on land, the shallows a little, open water fully
  for (let i = 0; i < MW * MH; i++) val[i] = GRID[i] === 0 ? 1 : GRID[i] === 1 ? 0.42 : 0;
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
  const over = mk(PW, PH); if (cliffM) over.g.drawImage(cliffM, 0, 0); drawDeck(over); WATER.over = over;   // the grass cliffs and the piers stand above the water
}

function waterDepth(wx, wy) {   // smooth depth at a world pixel: the tile values blended between tile centres (0 = shore, 1 = open water)
  const fx = (wx - 8) / 16, fy = (wy - 8) / 16, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy, V = WATER.val;
  const at = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? 1 : V[y * MW + x];
  return (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
}

function drawWater(cx, cy, now) {
  if (!WATER.val || !waterOn()) return;
  const M = 16, w = Math.ceil(VW) + 2 * M, h = Math.ceil(VH) + 2 * M, x0 = cx - M, y0 = cy - M;   // the visible part of the map, with a margin
  if (!WATER.cv || WATER.cv.width !== w || WATER.cv.height !== h) { WATER.cv = mk(w, h); WATER.sv = mk(w, h); }
  // 1. the water's shape this frame: the edge tiles at every corner where water meets something, each corner a little out of step with its neighbours
  const S = WATER.sv, im = ASSET.img.water_anim, F = WATER_ANIM.frames, ms = WATER_ANIM.ms[0] || 100, base = Math.floor(now * 1000 / ms);
  S.g.clearRect(0, 0, w, h);
  const i0 = Math.floor(x0 / 16), j0 = Math.floor(y0 / 16), i1 = Math.ceil((x0 + w) / 16) + 1, j1 = Math.ceil((y0 + h) / 16) + 1;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const t = [tileAt(i - 1, j - 1), tileAt(i, j - 1), tileAt(i - 1, j), tileAt(i, j)]; let m = 0;
    for (let k = 0; k < 4; k++) if (isOpenWater(t[k])) m |= 1 << k;
    if (!m) continue; const f = m === 15 ? 0 : (base + Math.floor(hash2(i, j, 903) * F)) % F;
    S.g.drawImage(im, m * 16, f * 16, 16, 16, i * 16 - 8 - x0, j * 16 - 8 - y0, 16, 16);
  }
  // 2. colour it: depth gradient, the wobbling caustic lines, sparkles on them, the cliffs' shadow; the white foam line stays as drawn
  const sd = S.g.getImageData(0, 0, w, h).data, out = WATER.cv.g.createImageData(w, h), o = out.data, CA = WATER.caus, NO = WATER.noise, SH = WATER.shade;
  const tq = now * 3, ta = Math.floor(tq), tb = Math.floor(now * 5), C = WCOL;
  for (let py = 0; py < h; py++) {
    const wy = y0 + py; if (wy < 0 || wy >= PH) continue;
    for (let px = 0; px < w; px++) {
      const si = (py * w + px) * 4, a = sd[si + 3]; if (!a) continue;
      const wx = x0 + px; if (wx < 0 || wx >= PW) continue;
      let r, gr, b;
      if (sd[si] > 200 && sd[si + 1] > 200) { r = C.foam[0]; gr = C.foam[1]; b = C.foam[2]; }   // the foam line along the edge
      else {
        const d = waterDepth(wx, wy), e = d < 0.42 ? d / 0.42 : 1, f2 = d < 0.42 ? 0 : (d - 0.42) / 0.58;
        r = C.shore[0] + (C.mid[0] - C.shore[0]) * e + (C.deep[0] - C.mid[0]) * f2; gr = C.shore[1] + (C.mid[1] - C.shore[1]) * e + (C.deep[1] - C.mid[1]) * f2; b = C.shore[2] + (C.mid[2] - C.shore[2]) * e + (C.deep[2] - C.mid[2]) * f2;
        const n1 = NO[(((wy >> 1) + ta) & 63) * 64 + ((wx >> 1) & 63)], n2 = NO[((wy >> 1) & 63) * 64 + (((wx >> 1) + tb) & 63)];   // two scrolling noises bend the pattern (whole pixels: it stays pixel art)
        const ux = (wx + Math.floor(n1 * 6) - 3) & 63, uy = (Math.floor(wy * 1.2) + Math.floor(n2 * 6) - 3) & 63;
        const fade = NO[((wy >> 3) & 63) * 64 + (((wx >> 3) + (tb >> 2)) & 63)];   // a slow fade over parts of the pattern, so it does not look like one repeating net
        if (CA[uy * 64 + ux] && fade > 0.3) {
          const k = (0.2 - 0.08 * d) * Math.min(1, (fade - 0.3) * 4); r += (C.caus[0] - r) * k; gr += (C.caus[1] - gr) * k; b += (C.caus[2] - b) * k;
          const s = NO[(((wy >> 2) + tb) & 63) * 64 + (((wx >> 2) + ta) & 63)] + NO[(((wy >> 2) - ta + 31) & 63) * 64 + (((wx >> 2) - tb + 17) & 63)];   // noises scrolling opposite ways: where both are high, a sparkle
          if (s > 1.6) { r = C.spark[0]; gr = C.spark[1]; b = C.spark[2]; }
        }
        const sh = SH[wy * PW + wx]; if (sh < 255) { const q = sh / 255; r *= q; gr *= q; b *= q; }
      }
      o[si] = r; o[si + 1] = gr; o[si + 2] = b; o[si + 3] = a;
    }
  }
  WATER.cv.g.putImageData(out, 0, 0);
  g.drawImage(WATER.cv, x0 - cx, y0 - cy);
  if (WATER.over) g.drawImage(WATER.over, x0, y0, w, h, x0 - cx, y0 - cy, w, h);   // cliffs and piers over the water
}
