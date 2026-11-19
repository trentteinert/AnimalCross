'use strict';
// Lighting for the painted props. Each prop has a bump map (assets/props/<name>_bump.png, see tools/bump_export.py): grey = how far a pixel sticks out toward you.
// From it the game works out which way every pixel faces, then lights that from three kinds of source:
//  - the sun: one fixed direction (from the upper left and front); shading baked once per sprite, and it fades with SUN, so it goes away at night along with the cast shadows
//  - point lights (furnace window, campfires): they light the pixels that face them, with falloff and flicker, drawn additively after the night tint, plus a soft stepped glow on the ground
// Switch it all off with FEATURES.light = false (data.js).
const SUN_DIR = (() => { const v = [-0.5, 0.62, 0.78], l = Math.hypot(...v); return v.map(a => a / l); })();
let LID = 0;
const LITQ = [];   // props to light with point lights this frame (filled while drawing, used after the night tint)
const LIGHTS = []; // [{ x, y (ground), h (height above ground), z (toward you), r, k, col }]
function sunAmt(h) {   // 0 at night, 1 by day, with dawn and dusk ramps
  const up = clamp((h - 5.5) / 2.5, 0, 1), down = clamp((19.5 - h) / 2.5, 0, 1); return Math.min(up, down);
}
function bumpOf(spr, img) {   // read a bump image into a surface-direction map and bake the sun's light and shade overlays
  const w = img.width, h = img.height, c = mk(w, h); c.g.drawImage(img, 0, 0); const d = c.g.getImageData(0, 0, w, h).data, B = new Float32Array(w * h), A = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { B[i] = d[i * 4] / 10; A[i] = d[i * 4 + 3]; }
  const at = (x, y) => B[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)], n = new Float32Array(w * h * 3), dk = mk(spr.width, spr.height), lt = mk(spr.width, spr.height), od = dk.g.createImageData(spr.width, spr.height), ol = lt.g.createImageData(spr.width, spr.height);
  const flat = SUN_DIR[2];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (A[i] < 9) continue;
    let nx = -(at(x + 1, y) - at(x - 1, y)) / 2, ny = (at(x, y + 1) - at(x, y - 1)) / 2, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; n[i * 3] = nx; n[i * 3 + 1] = ny; n[i * 3 + 2] = nz;
    const sh = nx * SUN_DIR[0] + ny * SUN_DIR[1] + nz * SUN_DIR[2] - flat;   // brighter or darker than a flat face would be
    const k = i * 4; if (sh < -0.04) { od.data[k] = 24; od.data[k + 1] = 30; od.data[k + 2] = 68; od.data[k + 3] = Math.round(clamp(-sh * 1.3, 0, 0.5) * 255); }
    else if (sh > 0.04) { ol.data[k] = 255; ol.data[k + 1] = 242; ol.data[k + 2] = 206; ol.data[k + 3] = Math.round(clamp(sh * 1.0, 0, 0.36) * 255); }
  }
  dk.g.putImageData(od, 0, 0); lt.g.putImageData(ol, 0, 0); spr.nrm = n; spr.bumpv = B; spr.sunD = dk; spr.sunL = lt; spr.lw = w;
}
function lightInit() {
  const I = ASSET.img, pairs = [[SPR.shop, 'shop_stall'], [SPR.shop && SPR.shop.merchant, 'shop_merchant'], [SPR.bench, 'workbench'], [SPR.anvil, 'anvil'], [SPR.hammer, 'hammer']];
  for (const [spr, n] of pairs) if (spr && I[n + '_bump']) { bumpOf(spr, I[n + '_bump']); spr.flat = n !== 'anvil' && n !== 'hammer'; }
  if (SPR.furnace && I.furnace_bump) { bumpOf(SPR.furnace[0], I.furnace_bump); for (let i = 1; i < SPR.furnace.length; i++) { const f = SPR.furnace[i], b = SPR.furnace[0]; f.nrm = b.nrm; f.bumpv = b.bumpv; f.sunD = b.sunD; f.sunL = b.sunL; f.lw = b.lw; f.flat = true; } SPR.furnace[0].flat = true; }
}
function litProp(o, spr, x, y, fa) {   // after a prop is drawn: its sun shading now, its point lighting later
  if (!FEATURES.light || !spr.nrm) return;
  if (SUN > 0.03) { g.globalAlpha = SUN * (fa == null ? 1 : fa); g.drawImage(spr.sunD, x, y); g.drawImage(spr.sunL, x, y); g.globalAlpha = 1; }
  LITQ.push({ o, spr, x, y, fa: fa == null ? 1 : fa });
}
function collectLights(now) {   // furnaces and campfires, with their flicker
  LIGHTS.length = 0; if (!FEATURES.light) return; const dark = 0.3 + 0.7 * (1 - SUN);
  for (const o of W.objs) {
    if (o.k === 'furnace') { const fl = 0.88 + 0.12 * Math.sin(now * 11 + o.x) + 0.05 * Math.sin(now * 23); LIGHTS.push({ o, x: o.x - 4, y: o.y, h: 14, z: 7, r: 78, k: dark * fl, col: [255, 160, 70] }); }
    else if (o.k === 'campfire') { const fl = 0.85 + 0.15 * Math.sin(now * 13 + o.x) + 0.06 * Math.sin(now * 29); LIGHTS.push({ o, x: o.x, y: o.y, h: 7, z: 2, r: 86, k: dark * fl * 1.1, col: [255, 170, 80] }); }
  }
}
function lightOverlay(q, now) {   // per pixel: how much does each light (that faces this pixel) add
  const spr = q.spr, o = q.o, w = spr.lw, h = spr.height, step = Math.floor(now * 10), key = step * 4 + LIGHTS.length, sid = spr._id || (spr._id = ++LID); o._lcm = o._lcm || {};
  let e = o._lcm[sid]; if (e && e.key === key) { o._lany = e.any; return e.c; }
  const c = e ? e.c : mk(spr.width, h), id = c.g.createImageData(spr.width, h), D = id.data; let any = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, nx = spr.nrm[i * 3], ny = spr.nrm[i * 3 + 1], nz = spr.nrm[i * 3 + 2]; if (nz === 0) continue;
    const X = o.x - spr.ax + x, Hh = spr.ay - y, Z = spr.bumpv[i]; let r = 0, gg = 0, b = 0;
    for (const L of LIGHTS) {
      let vx = L.x - X, vy = L.h - Hh, vz = (L.y - o.y) + L.z - Z, dist = Math.hypot(vx, vy, vz);
      if (spr.flat) { vx = L.x - o.x; vy = L.h - spr.ay * 0.4; vz = (L.y - o.y) + L.z; dist = Math.hypot(vx, vy, vz); }   // big props are lit as one piece (one direction and strength for the whole thing), so a wall never gets a round hot spot; only its edges and painted detail catch the light differently
      if (dist >= L.r || dist < 0.5) continue;
      const dn = Math.max(0, (nx * vx + ny * vy + nz * vz) / dist), at = (1 - dist / L.r) ** 2, a = clamp(dn * at * L.k * 1.5, 0, 0.9);
      r += L.col[0] * a; gg += L.col[1] * a; b += L.col[2] * a;
    }
    if (r + gg + b > 2) { const k = i * 4, j = (y * spr.width + x) * 4, m = Math.max(r, gg, b, 1); D[j] = Math.min(255, r); D[j + 1] = Math.min(255, gg); D[j + 2] = Math.min(255, b); D[j + 3] = 255; any = true; }
  }
  c.g.putImageData(id, 0, 0); o._lcm[sid] = { c, key, any }; o._lany = any; return c;
}
// ---- the layers of a frame -----------------------------------------------------------------------------------------------------------------
// ground (terrain, holes, shadows)  ->  night tint  ->  glow on the ground  ->  props and people on their own layer  ->  tint  ->  light on them  ->  laid over the ground
// so the glow lies on the ground only (things standing in it cover it) and every prop and person is lit from its own shape instead.
const EC = document.createElement('canvas'), EG = EC.getContext('2d'), MC = document.createElement('canvas'), MG = MC.getContext('2d');
let ENT_ON = false;
function nightTint() { const tc = tintAt(hourNow()).map(v => Math.round(255 - (255 - v) * 0.72)); return tc[0] + tc[1] + tc[2] < 750 ? tc : null; }
function lightGround(cx, cy, now) {
  if (!FEATURES.light) return; const tc = nightTint();
  if (tc) { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${tc[0]},${tc[1]},${tc[2]})`; g.fillRect(-2, -2, VW + 4, VH + 4); g.globalCompositeOperation = 'source-over'; }
  g.globalCompositeOperation = 'lighter'; for (const L of LIGHTS) groundGlow(L, cx, cy, now); g.globalCompositeOperation = 'source-over';
}
const GLOW_K = { 0: 0.22, 1: 0.5, 2: 1.15, 3: 0.8, 4: 0.7, 5: 1.0, 6: 0.5 };   // how much of the light each ground takes: pale sand throws it back, grass and dirt soak it up, water barely holds it (it gets glints instead)
const glowCache = {};
function glowSprite(col, r) {   // a smooth round glow, brightest in the middle and eased out to nothing
  const k = col.join(',') + ':' + r; if (glowCache[k]) return glowCache[k]; const w = r * 2, c = mk(w, w), gr = c.g.createRadialGradient(r, r, 0, r, r, r);
  for (let i = 0; i <= 12; i++) { const t = i / 12, a = Math.pow(1 - t, 2.2) * 0.62; gr.addColorStop(t, `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`); }
  c.g.fillStyle = gr; c.g.fillRect(0, 0, w, w); return glowCache[k] = c;
}
function groundGlow(L, cx, cy, now) {   // the circle, tile by tile, so each kind of ground answers the light its own way
  const R = Math.round(L.r), x0 = Math.round(L.x - cx), y0 = Math.round(L.y - cy - 3), spr = glowSprite(L.col, R), n = L.k * clamp((1 - SUN) * 1.25, 0, 1); if (n < 0.02) return;
  const tx0 = Math.floor((L.x - R) / TS), tx1 = Math.floor((L.x + R) / TS), ty0 = Math.floor((L.y - R) / TS), ty1 = Math.floor((L.y + R) / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = typeAt((tx + 0.5) * TS, (ty + 0.5) * TS), f = GLOW_K[t] == null ? 0.8 : GLOW_K[t], sx = tx * TS - cx, sy = ty * TS - cy; if (sx > VW || sy > VH || sx + TS < 0 || sy + TS < 0) continue;
    const u = sx - (x0 - R), v = (sy - y0) * 1 + R; if (u < -TS || v < -TS || u > 2 * R || v > 2 * R) continue; g.globalAlpha = clamp(n * f, 0, 1);
    const su = Math.max(0, u), sv = Math.max(0, v), sw = Math.min(TS, 2 * R - su), sh = Math.min(TS, 2 * R - sv); if (sw <= 0 || sh <= 0) continue; g.drawImage(spr, su, sv, sw, sh, sx + (su - u), sy + (sv - v), sw, sh);
    if (t === 0 || t === 1 || t === 6) { const mid = sx + 8, d = Math.hypot(mid - x0, (sy + 8 - y0) * 1.6) / R; if (d < 1) {   // water: a few warm glints that wink on and off instead of a glow
      g.globalAlpha = clamp(n * (1 - d) * 1.4, 0, 1); g.fillStyle = `rgb(${L.col[0]},${L.col[1]},${L.col[2] - 30})`;
      for (let q = 0; q < 3; q++) if (hash2(tx * 3 + q, ty, Math.floor(now * 3 + q)) < 0.45) g.fillRect(sx + Math.floor(hash2(tx, ty * 3 + q, 5) * 14), sy + Math.floor(hash2(tx + q, ty, 6) * 14), 2, 1);
    } }
  }
  g.globalAlpha = 1;
}
function entBegin() {
  ENT_ON = FEATURES.light; if (!ENT_ON) return; const w = cv.width, h = cv.height;
  if (EC.width !== w || EC.height !== h) { EC.width = w; EC.height = h; MC.width = w; MC.height = h; }
  EG.setTransform(1, 0, 0, 1, 0, 0); EG.clearRect(0, 0, w, h); EG.setTransform(G0.getTransform()); EG.imageSmoothingEnabled = false; g = EG;
}
function charLight(e, now) {   // a person standing in a light is warmed by it, most on the side that faces it
  const im = e._last; if (!im) return; let k = 0, side = 0;
  for (const L of LIGHTS) { const dx = L.x - e.x, dy = (L.y - e.y) * 1.4, d = Math.hypot(dx, dy); if (d < L.r) { const a = (1 - d / L.r) ** 2 * L.k; k += a; side += dx * a; } }
  if (k < 0.02) return; k = Math.min(k, 1); const [spr, x, y] = im, w = spr.width, h = spr.height, left = side > 0 ? false : true;
  g.globalAlpha = k * 0.4; g.drawImage(spr, x, y); g.globalAlpha = k * 0.4; if (left) g.drawImage(spr, 0, 0, w >> 1, h, x, y, w >> 1, h); else g.drawImage(spr, w >> 1, 0, w - (w >> 1), h, x + (w >> 1), y, w - (w >> 1), h); g.globalAlpha = 1;
}
function entEnd(cx, cy, now) {
  if (!ENT_ON) { LITQ.length = 0; return; } ENT_ON = false; const tc = nightTint(), w = cv.width, h = cv.height, T = EG.getTransform();
  if (tc) {   // tint only what is on this layer
    MG.setTransform(1, 0, 0, 1, 0, 0); MG.clearRect(0, 0, w, h); MG.drawImage(EC, 0, 0);
    EG.setTransform(1, 0, 0, 1, 0, 0); EG.globalCompositeOperation = 'multiply'; EG.fillStyle = `rgb(${tc[0]},${tc[1]},${tc[2]})`; EG.fillRect(0, 0, w, h); EG.globalCompositeOperation = 'destination-in'; EG.drawImage(MC, 0, 0); EG.globalCompositeOperation = 'source-over'; EG.setTransform(T);
  }
  g.globalCompositeOperation = 'lighter';
  if (LIGHTS.length) {
    for (const q of LITQ) { if (!LIGHTS.some(L => Math.abs(L.x - q.o.x) < L.r + 40 && Math.abs(L.y - q.o.y) < L.r + 40)) continue; const c = lightOverlay(q, now); if (!q.o._lany) continue; g.globalAlpha = q.fa; g.drawImage(c, q.x, q.y); g.globalAlpha = 1; }
    charLight(ME, now); for (const n of NPCS) charLight(n, now);
  }
  LITQ.length = 0; g.globalCompositeOperation = 'source-over';
  for (const o of W.objs) if (o.frames && (o.k === 'furnace' || o.k === 'campfire') && o.spr) {   // flames and coals glow on their own: put them back at full brightness over the night tint
    const s = o.spr, em = s._em || (s._em = emissive(s)), x = Math.round(o.x - s.ax - cx), y = Math.round(o.y - s.ay - cy); if (x > VW || y > VH || x + s.width < 0 || y + s.height < 0) continue;
    g.globalAlpha = clamp(0.35 + (1 - SUN), 0.35, 1); g.drawImage(em, x, y); g.globalAlpha = 1;
  }
  g = G0; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(EC, 0, 0); g.restore();
}
function emissive(s) {   // only the bright orange and yellow pixels of a sprite
  const c = mk(s.width, s.height), id = s.g.getImageData(0, 0, s.width, s.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) if (!(d[i + 3] > 200 && d[i] > 190 && d[i + 1] > 80 && d[i + 2] < 150 && d[i] > d[i + 2] * 1.6)) d[i + 3] = 0;
  c.g.putImageData(id, 0, 0); return c;
}
