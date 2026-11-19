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
  for (const [spr, n] of pairs) if (spr && I[n + '_bump']) bumpOf(spr, I[n + '_bump']);
  if (SPR.furnace && I.furnace_bump) { bumpOf(SPR.furnace[0], I.furnace_bump); for (let i = 1; i < SPR.furnace.length; i++) { const f = SPR.furnace[i], b = SPR.furnace[0]; f.nrm = b.nrm; f.bumpv = b.bumpv; f.sunD = b.sunD; f.sunL = b.sunL; f.lw = b.lw; } }
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
      const vx = L.x - X, vy = L.h - Hh, vz = (L.y - o.y) + L.z - Z, dist = Math.hypot(vx, vy, vz); if (dist >= L.r || dist < 0.5) continue;
      const dn = Math.max(0, (nx * vx + ny * vy + nz * vz) / dist), at = (1 - dist / L.r) ** 2, a = clamp(dn * at * L.k * 1.5, 0, 0.9);
      r += L.col[0] * a; gg += L.col[1] * a; b += L.col[2] * a;
    }
    if (r + gg + b > 2) { const k = i * 4, j = (y * spr.width + x) * 4, m = Math.max(r, gg, b, 1); D[j] = Math.min(255, r); D[j + 1] = Math.min(255, gg); D[j + 2] = Math.min(255, b); D[j + 3] = 255; any = true; }
  }
  c.g.putImageData(id, 0, 0); o._lcm[sid] = { c, key, any }; o._lany = any; return c;
}
function lightPass(cx, cy, now) {   // after the world is drawn: the night tint, then everything that glows
  if (!FEATURES.light) { LITQ.length = 0; return; }
  const tc = tintAt(hourNow()).map(v => Math.round(255 - (255 - v) * 0.72));   // the day's tint, softened so nights stay playable
  if (tc[0] + tc[1] + tc[2] < 750) { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${tc[0]},${tc[1]},${tc[2]})`; g.fillRect(-2, -2, VW + 4, VH + 4); g.globalCompositeOperation = 'source-over'; }
  g.globalCompositeOperation = 'lighter';
  for (const L of LIGHTS) {   // a glow on the ground made of dither dots, not smooth rings: an uneven edge that breathes with the flame
    const x = Math.round(L.x - cx), y = Math.round(L.y - cy); if (x < -L.r || x > VW + L.r || y < -L.r * 0.6 || y > VH + L.r * 0.6) continue;
    const c = glowCanvas(L, now); if (c) g.drawImage(c, x - (c.width >> 1), y - 3 - (c.height >> 1));
  }
  if (LIGHTS.length) for (const q of LITQ) {
    if (!LIGHTS.some(L => Math.abs(L.x - q.o.x) < L.r + 40 && Math.abs(L.y - q.o.y) < L.r + 40)) continue;
    const c = lightOverlay(q, now); if (!q.o._lany) continue; g.globalAlpha = q.fa; g.drawImage(c, q.x, q.y); g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'source-over'; LITQ.length = 0;
  for (const o of W.objs) if (o.frames && (o.k === 'furnace' || o.k === 'campfire') && o.spr) {   // flames and coals glow on their own: put them back at full brightness over the night tint
    const s = o.spr, em = s._em || (s._em = emissive(s)), x = Math.round(o.x - s.ax - cx), y = Math.round(o.y - s.ay - cy); if (x > VW || y > VH || x + s.width < 0 || y + s.height < 0) continue;
    g.globalAlpha = clamp(0.35 + (1 - SUN), 0.35, 1); g.drawImage(em, x, y); g.globalAlpha = 1;
  }
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function glowCanvas(L, now) {   // pixel-dithered, lumpy, slowly shifting; redrawn about eight times a second
  if (SUN > 0.9) return null;   // no ground glow in full daylight
  const R = Math.round(L.r), w = R * 2, h = Math.round(R * 1.2), step = Math.floor(now * 8); const O = L.o; if (O._gc && O._gs === step) return O._gc;
  const c = O._gc || (O._gc = mk(w, h)), id = c.g.createImageData(w, h), D = id.data, ph = L.x * 0.13;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - R) / R, dy = (y - h / 2) / (R * 0.6), d = Math.hypot(dx, dy); if (d >= 1.15) continue; const a = Math.atan2(dy, dx);
    const lump = 0.1 * Math.sin(a * 3 + ph + now * 0.7) + 0.07 * Math.sin(a * 5 - ph + now * 1.1) + 0.05 * Math.sin(a * 9 + step * 0.9), v = (1 - (d + lump)) * L.k * 1.5 * clamp((1 - SUN) * 1.2, 0, 1);   // lumpy radius, brighter in the middle
    if (v <= 0) continue; const t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16, lvl = v > 0.55 ? 2 : 1;   // a dot is lit where the light beats the pattern; the very middle is a second, brighter tier
    if (v * 1.15 > t) { const j = (y * w + x) * 4; D[j] = L.col[0]; D[j + 1] = L.col[1] - 20; D[j + 2] = L.col[2] - 20; D[j + 3] = lvl === 2 ? 46 : 30; }
  }
  c.g.putImageData(id, 0, 0); O._gs = step; return c;
}
function emissive(s) {   // only the bright orange and yellow pixels of a sprite
  const c = mk(s.width, s.height), id = s.g.getImageData(0, 0, s.width, s.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) if (!(d[i + 3] > 200 && d[i] > 190 && d[i + 1] > 80 && d[i + 2] < 150 && d[i] > d[i + 2] * 1.6)) d[i + 3] = 0;
  c.g.putImageData(id, 0, 0); return c;
}
