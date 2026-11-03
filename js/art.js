'use strict';
// All art is drawn in code: no image files.
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; c.g = g; return c; }
function RC(c, x, y, w, h, col) { c.g.fillStyle = col; c.g.fillRect(x, y, w, h); }
function PX(c, x, y, col) { c.g.fillStyle = col; c.g.fillRect(x, y, 1, 1); }
function DC(c, cx, cy, r, col) { c.g.fillStyle = col; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) c.g.fillRect(cx + x, cy + y, 1, 1); }
function EL(c, cx, cy, rx, ry, col) {
  c.g.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1) c.g.fillRect(x, y, 1, 1);
  }
}
function LN(c, x0, y0, x1, y1, col) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (; ;) { PX(c, x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function hexRGB(s) { const n = parseInt(s.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function shade(s, a) { return '#' + hexRGB(s).map(v => Math.max(0, Math.min(255, Math.round(v + a))).toString(16).padStart(2, '0')).join(''); }
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const INK = '#2a1c1c';
function OL(c, col) {
  col = col || INK;
  const w = c.width, h = c.height, o = mk(w + 2, h + 2); o.g.drawImage(c, 1, 1);
  const id = o.g.getImageData(0, 0, w + 2, h + 2), d = id.data, W2 = w + 2, H2 = h + 2, a = new Uint8Array(W2 * H2), rgb = hexRGB(col);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    const i = y * W2 + x; if (a[i]) continue;
    if ((x > 0 && a[i - 1]) || (x < W2 - 1 && a[i + 1]) || (y > 0 && a[i - W2]) || (y < H2 - 1 && a[i + W2])) { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255; }
  }
  o.g.putImageData(id, 0, 0); return o;
}
function anchor(c, ax, ay) { c.ax = ax; c.ay = ay; return c; }

const SPR = {};
const shadowCache = {};
function shadowSpr(w, h) {
  const k = w + 'x' + h; if (shadowCache[k]) return shadowCache[k];
  const c = mk(w, h); EL(c, (w - 1) / 2, (h - 1) / 2, w / 2, h / 2, 'rgba(20,24,34,0.30)'); return shadowCache[k] = c;
}

// ---- trees, bushes and props ---------------------------------------------
const CANOPY = { orange: ['#e07a2f', '#f4a94a', '#a8501f'], red: ['#c9442f', '#e8704f', '#8a2a22'], yellow: ['#e6b830', '#f6dc6a', '#a8801f'], green: ['#5f9a3a', '#8fc25a', '#3a6a2a'], dgreen: ['#4f8a38', '#78b04c', '#2f5a28'] };
function makeTree(pal, fruitCol, seed, withFruit) {
  const c = mk(46, 54), r = rng(seed);
  RC(c, 20, 34, 6, 18, '#6b4423'); RC(c, 20, 34, 2, 18, '#85582f'); RC(c, 24, 34, 2, 18, '#523318'); RC(c, 18, 50, 10, 2, '#6b4423');
  const blobs = [[23, 19, 13], [12, 25, 9], [34, 25, 9], [23, 9, 8], [16, 13, 8], [30, 13, 8]];
  blobs.forEach(b => DC(c, b[0], b[1], b[2], pal[2]));
  blobs.forEach(b => DC(c, b[0] - 1, b[1] - 2, b[2] - 2, pal[0]));
  blobs.slice(0, 1).concat(blobs.slice(3)).forEach(b => DC(c, b[0] - 3, b[1] - 4, Math.max(3, b[2] - 6), pal[1]));
  const inside = (x, y) => blobs.some(b => (x - b[0]) ** 2 + (y - b[1]) ** 2 <= b[2] * b[2] - 4);
  for (let i = 0; i < 90; i++) { const x = 2 + Math.floor(r() * 42), y = 2 + Math.floor(r() * 36); if (inside(x, y)) PX(c, x, y, r() < 0.5 ? pal[1] : pal[2]); }
  if (withFruit && fruitCol) {
    [[14, 24], [26, 29], [34, 21], [20, 14], [29, 12], [9, 29], [36, 29], [23, 22]].forEach(p => { RC(c, p[0], p[1], 3, 3, fruitCol); PX(c, p[0], p[1], shade(fruitCol, 60)); });
  }
  return anchor(OL(c), 24, 53);
}
function makePine() {
  const c = mk(30, 56);
  RC(c, 13, 48, 4, 7, '#5a3a1f');
  for (let t = 0; t < 4; t++) {
    const top = 2 + t * 11;
    for (let rw = 0; rw < 15; rw++) {
      const hw = 2 + Math.floor(rw * 0.85) + t; const y = top + rw;
      RC(c, 15 - hw, y, hw * 2, 1, rw < 5 ? '#3f7a45' : rw < 10 ? '#2f6338' : '#244f2e');
      PX(c, 15 - hw, y, '#4f8f52');
    }
  }
  return anchor(OL(c), 15, 55);
}
function makeBush(berryCol, withBerries) {
  const c = mk(22, 16);
  [[7, 10, 5], [14, 10, 5], [11, 7, 5]].forEach(b => DC(c, b[0], b[1], b[2], '#3a6a2a'));
  [[7, 9, 5], [14, 9, 5], [11, 6, 5]].forEach(b => DC(c, b[0] - 1, b[1] - 1, b[2] - 2, '#5f9a3a'));
  DC(c, 9, 5, 2, '#8fc25a');
  if (withBerries) [[5, 9], [10, 11], [14, 8], [9, 6], [16, 11], [12, 4]].forEach(p => { RC(c, p[0], p[1], 2, 2, berryCol); PX(c, p[0], p[1], shade(berryCol, 70)); });
  return anchor(OL(c), 11, 15);
}
function makeLamp() {
  const c = mk(10, 30);
  RC(c, 4, 10, 2, 18, '#2f3a4d'); RC(c, 2, 26, 6, 2, '#2f3a4d'); RC(c, 1, 2, 8, 2, '#2f3a4d'); RC(c, 3, 0, 4, 2, '#2f3a4d');
  RC(c, 2, 4, 6, 7, '#ffe9a8'); RC(c, 2, 4, 1, 7, '#2f3a4d'); RC(c, 7, 4, 1, 7, '#2f3a4d'); RC(c, 3, 5, 2, 3, '#fff6d6'); RC(c, 2, 11, 6, 1, '#2f3a4d');
  return anchor(OL(c), 5, 28);
}
function makeBench() {
  const c = mk(26, 14);
  RC(c, 1, 1, 24, 3, '#8a5a30'); RC(c, 1, 1, 24, 1, '#a8733f'); RC(c, 1, 5, 24, 4, '#a0693a'); RC(c, 1, 5, 24, 1, '#c28a52'); RC(c, 3, 9, 2, 4, '#5a3a1f'); RC(c, 21, 9, 2, 4, '#5a3a1f');
  return anchor(OL(c), 13, 13);
}
function makeFountain() {
  const c = mk(64, 54);
  EL(c, 32, 42, 28, 10, '#b8a678'); EL(c, 32, 40, 28, 10, '#e0d3a8'); EL(c, 32, 40, 23, 7, '#c9b88a'); EL(c, 32, 39, 21, 6, '#5aa8c8'); EL(c, 28, 38, 9, 2, '#86c8e0');
  RC(c, 29, 20, 6, 18, '#d8cba0'); RC(c, 29, 20, 2, 18, '#efe4bd'); RC(c, 33, 20, 2, 18, '#b8a678');
  EL(c, 32, 22, 12, 4, '#e0d3a8'); EL(c, 32, 21, 9, 3, '#7ac4de');
  RC(c, 30, 12, 4, 8, '#d8cba0'); DC(c, 32, 11, 3, '#f0e0c0'); PX(c, 31, 10, '#fff8e0');
  return anchor(OL(c), 32, 50);
}
function makeRock() {
  const c = mk(18, 12); EL(c, 9, 7, 8, 5, '#6c7380'); EL(c, 8, 5, 6, 3, '#8a919c'); EL(c, 6, 4, 2, 1, '#a8aeb8'); return anchor(OL(c), 9, 11);
}
function makeFlower(col) { const c = mk(7, 8); PX(c, 3, 5, '#5f9a3a'); RC(c, 3, 5, 1, 3, '#4f8a38'); PX(c, 2, 4, '#5f9a3a'); RC(c, 2, 2, 3, 3, col); PX(c, 3, 3, '#fff2a8'); PX(c, 3, 1, col); PX(c, 1, 3, col); PX(c, 5, 3, col); return c; }
// ---- atmosphere props ------------------------------------------------------
function makeCampfire() {
  const c = mk(22, 14);
  [[3, 7], [6, 10], [11, 11], [16, 10], [19, 7], [16, 4], [6, 4]].forEach(p => { DC(c, p[0], p[1], 2, '#7c8290'); PX(c, p[0] - 1, p[1] - 1, '#a8afbb'); });
  EL(c, 11, 8, 6, 3, '#3a2f2a'); LN(c, 5, 10, 17, 5, '#6b4423'); LN(c, 5, 9, 17, 4, '#8a5a30'); LN(c, 5, 5, 17, 10, '#5a3a1f'); LN(c, 5, 4, 17, 9, '#7a4e2a');
  return anchor(OL(c), 12, 13);
}
function makeTent(main, accent) {
  const c = mk(42, 32);
  EL(c, 21, 28, 19, 4, 'rgba(0,0,0,0.0)');
  for (let r = 0; r < 24; r++) { const hw = 2 + Math.round(r * 0.82); RC(c, 21 - hw, 4 + r, hw * 2, 1, r % 6 < 1 ? accent : main); }
  for (let r = 0; r < 24; r++) { const hw = 2 + Math.round(r * 0.82); PX(c, 21 - hw, 4 + r, accent); PX(c, 21 + hw - 1, 4 + r, accent); }
  for (let r = 8; r < 24; r++) { const hw = Math.round((r - 6) * 0.38); RC(c, 21 - hw, 4 + r, hw * 2, 1, '#2f2a38'); }
  RC(c, 20, 0, 2, 5, '#6b4423'); RC(c, 22, 1, 5, 3, '#e8483a');
  RC(c, 3, 28, 36, 1, accent);
  return anchor(OL(c), 21, 29);
}
function makeLogSeat() {
  const c = mk(30, 12);
  RC(c, 3, 3, 24, 6, '#8a5a30'); RC(c, 3, 3, 24, 2, '#a8743a'); RC(c, 3, 8, 24, 1, '#5a3a1f');
  EL(c, 4, 6, 3, 3, '#c9a068'); EL(c, 4, 6, 1.5, 1.5, '#a8743a'); EL(c, 26, 6, 3, 3, '#c9a068'); EL(c, 26, 6, 1.5, 1.5, '#a8743a');
  return anchor(OL(c), 15, 10);
}
function makeCrate() { const c = mk(16, 16); RC(c, 1, 2, 14, 13, '#a8743a'); RC(c, 1, 2, 14, 2, '#c9965a'); RC(c, 1, 2, 2, 13, '#7a5028'); RC(c, 13, 2, 2, 13, '#7a5028'); RC(c, 1, 12, 14, 3, '#7a5028'); LN(c, 3, 4, 12, 12, '#8a5a30'); LN(c, 12, 4, 3, 12, '#8a5a30'); return anchor(OL(c), 8, 15); }
function makeBarrel() { const c = mk(14, 18); EL(c, 7, 9, 6, 8, '#8a5a30'); RC(c, 2, 4, 10, 1, '#4a3020'); RC(c, 1, 13, 12, 1, '#4a3020'); RC(c, 3, 2, 3, 14, '#a8743a'); EL(c, 7, 3, 5, 2, '#c9965a'); EL(c, 7, 3, 3, 1, '#7a5028'); return anchor(OL(c), 7, 17); }
function makeSignpost() { const c = mk(16, 24); RC(c, 7, 6, 2, 17, '#6b4423'); RC(c, 1, 3, 12, 6, '#c9a068'); RC(c, 1, 3, 12, 1, '#e0bd88'); PX(c, 13, 5, '#c9a068'); PX(c, 14, 6, '#c9a068'); RC(c, 3, 5, 6, 1, '#6b4423'); RC(c, 3, 7, 4, 1, '#6b4423'); RC(c, 3, 11, 10, 4, '#b08a54'); RC(c, 4, 12, 6, 1, '#6b4423'); return anchor(OL(c), 8, 23); }
function makeFence() { const c = mk(50, 16); RC(c, 0, 5, 50, 2, '#a8743a'); RC(c, 0, 10, 50, 2, '#a8743a'); RC(c, 0, 5, 50, 1, '#c9965a'); RC(c, 0, 10, 50, 1, '#c9965a'); [2, 16, 30, 44].forEach(x => { RC(c, x, 2, 4, 13, '#8a5a30'); RC(c, x, 2, 4, 2, '#c9965a'); }); return anchor(OL(c), 25, 15); }
function makeLily(k) {
  const c = mk(10, 7), r = [3, 4, 3][k];
  EL(c, 5, 3.5, r + 1, r - 0.4, '#4e9a52'); EL(c, 5, 3, r, r - 1, '#6cbc6a'); PX(c, 5 + r, 3, '#3f7f9a'); PX(c, 5 + r, 4, '#3f7f9a'); PX(c, 4, 2, '#8ad88a');
  if (k === 1) { PX(c, 4, 3, '#f5a0c0'); PX(c, 5, 3, '#fff0f4'); PX(c, 5, 2, '#f5a0c0'); PX(c, 6, 3, '#f5a0c0'); }
  return anchor(c, 5, 3);
}

// ---- characters -----------------------------------------------------------
// ---- icons ----------------------------------------------------------------
const iconCache = {};
function itemIcon(id) {
  if (iconCache['i' + id]) return iconCache['i' + id];
  const it = ITEM[id], c = mk(16, 16), a = it.cols[0], b = it.cols[1];
  switch (it.shape) {
    case 'fish': EL(c, 7, 8, 5.5, 3.4, a); RC(c, 11, 6, 1, 5, a); RC(c, 12, 5, 2, 7, b); RC(c, 3, 8, 8, 1, b); EL(c, 7, 10, 4, 1, shade(a, 40)); PX(c, 4, 7, '#1a1a1a'); PX(c, 6, 4, b); PX(c, 7, 4, b); break;
    case 'boot': RC(c, 5, 3, 5, 8, a); RC(c, 5, 10, 9, 3, a); RC(c, 5, 12, 9, 1, b); RC(c, 5, 3, 5, 1, b); PX(c, 7, 6, b); PX(c, 7, 8, b); break;
    case 'fruit': DC(c, 8, 9, 5, a); DC(c, 7, 8, 3, shade(a, 35)); PX(c, 6, 6, '#ffffff'); RC(c, 8, 2, 1, 3, '#5a3a1a'); RC(c, 9, 3, 3, 2, b); break;
    case 'berry': DC(c, 5, 10, 2, a); DC(c, 10, 10, 2, a); DC(c, 8, 6, 2, a); PX(c, 4, 9, shade(a, 70)); PX(c, 9, 9, shade(a, 70)); PX(c, 7, 5, shade(a, 70)); RC(c, 7, 2, 3, 2, b); break;
    case 'acorn': RC(c, 5, 3, 6, 4, b); RC(c, 6, 2, 4, 1, b); DC(c, 8, 9, 3, a); RC(c, 7, 12, 2, 2, a); PX(c, 7, 8, shade(a, 40)); break;
    case 'branch': LN(c, 2, 13, 13, 3, a); LN(c, 3, 13, 14, 3, shade(a, -20)); LN(c, 7, 9, 5, 5, a); LN(c, 10, 7, 13, 8, a); break;
    case 'nest': EL(c, 8, 10, 6, 3, a); EL(c, 8, 9, 4, 1.4, b); for (let i = 0; i < 6; i++) PX(c, 3 + i * 2, 11 + (i % 2), b); DC(c, 7, 8, 1, '#c8e0f0'); DC(c, 10, 8, 1, '#c8e0f0'); break;
    case 'bug': DC(c, 4, 6, 3, a); DC(c, 11, 6, 3, a); DC(c, 5, 10, 2, b); DC(c, 10, 10, 2, b); PX(c, 4, 5, '#fff8'); RC(c, 7, 4, 2, 9, '#2a2020'); PX(c, 6, 3, '#2a2020'); PX(c, 9, 3, '#2a2020'); break;
    case 'shell': for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) { const dx = x - 8, dy = 13 - y; if (dx * dx + dy * dy <= 45 && dy >= Math.abs(dx) * 0.55) { PX(c, x, y, (dx % 3 === 0 && dy > 2) ? b : a); } } RC(c, 6, 13, 4, 2, b); break;
    case 'crab': EL(c, 8, 9, 5, 3, a); RC(c, 2, 5, 3, 3, a); RC(c, 11, 5, 3, 3, a); PX(c, 6, 5, '#1a1a1a'); PX(c, 10, 5, '#1a1a1a'); for (let i = 0; i < 3; i++) { PX(c, 3 + i, 12, shade(a, -30)); PX(c, 11 + i - 1, 12, shade(a, -30)); } PX(c, 5, 8, b); break;
    case 'glass': EL(c, 8, 8, 5, 4, a); EL(c, 7, 7, 3, 2, b); PX(c, 5, 6, '#ffffff'); PX(c, 11, 10, shade(a, -40)); break;
    case 'wood': LN(c, 2, 12, 13, 4, a); LN(c, 2, 11, 13, 3, b); LN(c, 3, 13, 14, 5, shade(a, -35)); PX(c, 9, 6, shade(a, -40)); break;
    case 'star': DC(c, 8, 8, 2, a); [[8, 1], [14, 6], [12, 14], [4, 14], [2, 6]].forEach(p => { LN(c, 8, 8, p[0], p[1], a); LN(c, 8, 9, p[0], p[1] + 1, a); }); PX(c, 8, 8, b); PX(c, 8, 4, b); break;
    case 'dollar': DC(c, 8, 8, 6, a); DC(c, 8, 8, 5, b); for (let k = 0; k < 5; k++) { const an = k * 1.2566 - 1.57; LN(c, 8, 8, Math.round(8 + Math.cos(an) * 4), Math.round(8 + Math.sin(an) * 4), shade(a, -40)); } PX(c, 8, 8, shade(a, -60)); break;
    case 'conch': EL(c, 7, 9, 5, 4, a); RC(c, 11, 8, 4, 2, a); PX(c, 15, 9, a); EL(c, 6, 9, 2, 2, b); LN(c, 4, 6, 9, 6, shade(a, -25)); LN(c, 3, 9, 3, 11, shade(a, -25)); PX(c, 5, 8, '#fff'); break;
    case 'coin': DC(c, 8, 8, 5, a); DC(c, 8, 8, 3, b); PX(c, 6, 5, '#ffffff'); RC(c, 7, 6, 2, 5, shade(a, -25)); break;
    case 'bottle': RC(c, 5, 6, 6, 8, a); RC(c, 7, 3, 2, 4, a); RC(c, 7, 1, 2, 2, '#a8743a'); RC(c, 6, 8, 4, 4, b); PX(c, 6, 7, '#ffffff'); break;
    case 'pearl': DC(c, 8, 8, 4, a); DC(c, 9, 9, 2, b); PX(c, 6, 6, '#ffffff'); PX(c, 7, 6, '#ffffff'); break;
    case 'shard': RC(c, 3, 7, 9, 5, a); RC(c, 5, 5, 6, 3, a); RC(c, 10, 9, 4, 4, a); RC(c, 3, 11, 5, 2, shade(a, -25)); LN(c, 4, 8, 11, 8, b); LN(c, 5, 10, 10, 10, b); PX(c, 12, 10, shade(a, -30)); break;
    case 'arrow': LN(c, 8, 2, 4, 11, a); LN(c, 8, 2, 12, 11, a); RC(c, 5, 10, 7, 2, a); RC(c, 7, 11, 3, 3, shade(a, -40)); LN(c, 8, 4, 8, 10, b); PX(c, 8, 3, b); break;
    case 'bead': DC(c, 8, 8, 4, a); DC(c, 8, 8, 1, '#2a1c14'); PX(c, 6, 6, b); PX(c, 7, 5, b); RC(c, 4, 8, 1, 1, shade(a, -30)); break;
    case 'needle': LN(c, 3, 13, 13, 3, a); LN(c, 3, 12, 12, 3, b); RC(c, 11, 2, 3, 3, a); PX(c, 12, 3, '#2a1c14'); PX(c, 3, 13, shade(a, -40)); break;
    case 'nail': RC(c, 7, 3, 2, 10, a); RC(c, 5, 2, 6, 2, b); PX(c, 7, 13, shade(a, -40)); PX(c, 8, 6, shade(a, 40)); PX(c, 7, 9, shade(a, -30)); break;
    case 'pot': EL(c, 8, 9, 5.5, 4.5, a); RC(c, 5, 3, 6, 2, a); RC(c, 4, 4, 8, 1, shade(a, -30)); RC(c, 3, 8, 10, 1, b); RC(c, 3, 10, 10, 1, b); PX(c, 5, 7, shade(a, 50)); RC(c, 5, 13, 6, 1, shade(a, -40)); break;
    case 'seal': RC(c, 4, 6, 8, 8, a); RC(c, 4, 6, 8, 1, b); RC(c, 6, 2, 4, 4, shade(a, -15)); RC(c, 7, 1, 2, 2, b); PX(c, 6, 9, shade(a, -50)); PX(c, 9, 9, shade(a, -50)); RC(c, 6, 11, 4, 1, shade(a, -50)); break;
    case 'amulet': DC(c, 8, 9, 5, a); DC(c, 8, 9, 3, b); DC(c, 8, 9, 1, shade(a, -40)); RC(c, 7, 1, 2, 3, '#8a6a3a'); PX(c, 6, 7, '#ffffff'); break;
    case 'dagger': LN(c, 3, 13, 12, 3, a); LN(c, 3, 12, 11, 3, b); LN(c, 4, 13, 12, 4, shade(a, -30)); RC(c, 3, 10, 5, 2, '#6b4423'); RC(c, 2, 12, 3, 3, '#4a2f1a'); PX(c, 11, 4, '#ffffff'); break;
    case 'lamp': EL(c, 7, 10, 5, 3, a); RC(c, 11, 8, 4, 2, a); RC(c, 14, 7, 1, 2, b); RC(c, 3, 7, 4, 2, a); RC(c, 6, 6, 3, 2, b); PX(c, 5, 9, shade(a, 50)); RC(c, 5, 13, 5, 1, shade(a, -40)); break;
    case 'mask': RC(c, 4, 2, 8, 11, a); RC(c, 5, 13, 6, 1, a); RC(c, 3, 4, 1, 6, a); RC(c, 12, 4, 1, 6, a); RC(c, 5, 6, 2, 2, '#1a1a1a'); RC(c, 9, 6, 2, 2, '#1a1a1a'); RC(c, 7, 8, 2, 3, shade(a, -35)); RC(c, 6, 11, 4, 1, shade(a, -45)); RC(c, 4, 2, 8, 1, b); PX(c, 5, 4, b); PX(c, 10, 4, b); break;
    case 'urn': RC(c, 6, 1, 4, 2, a); RC(c, 5, 3, 6, 1, shade(a, -30)); EL(c, 8, 9, 5.5, 5, a); RC(c, 5, 13, 6, 2, shade(a, -35)); RC(c, 3, 8, 10, 1, b); RC(c, 3, 10, 10, 1, b); for (let i = 0; i < 5; i++) PX(c, 4 + i * 2, 9, shade(a, -45)); PX(c, 5, 6, shade(a, 55)); break;
    case 'scroll': RC(c, 3, 4, 10, 8, a); RC(c, 2, 3, 2, 10, shade(a, -30)); RC(c, 12, 3, 2, 10, shade(a, -30)); RC(c, 5, 6, 6, 1, '#6b4423'); RC(c, 5, 8, 5, 1, '#6b4423'); RC(c, 5, 10, 6, 1, '#6b4423'); DC(c, 8, 8, 2, b); PX(c, 8, 8, shade(b, -50)); break;
    case 'ring': DC(c, 8, 9, 5, a); DC(c, 8, 9, 3, '#00000000'); c.g.clearRect(6, 7, 5, 5); RC(c, 7, 3, 3, 3, b); PX(c, 8, 3, '#ffffff'); PX(c, 4, 8, b); break;
    case 'fossil': EL(c, 8, 8, 6, 5, a); for (let i = 0; i < 5; i++) { RC(c, 3 + i * 2, 5, 1, 7, shade(a, -35)); } RC(c, 7, 4, 2, 9, b); PX(c, 4, 6, b); PX(c, 11, 10, b); break;
    case 'tablet': RC(c, 3, 2, 10, 12, a); RC(c, 3, 2, 10, 1, b); RC(c, 3, 13, 10, 1, shade(a, -35)); for (let y = 4; y < 12; y += 2) for (let x = 5; x < 11; x += 2) PX(c, x + (y % 4 ? 0 : 1), y, shade(a, -45)); PX(c, 4, 3, shade(a, 40)); break;
    case 'statue': RC(c, 5, 13, 6, 2, shade(a, -30)); RC(c, 6, 7, 4, 6, a); RC(c, 4, 7, 2, 4, a); RC(c, 10, 7, 2, 4, a); DC(c, 8, 4, 3, a); RC(c, 5, 1, 2, 2, a); RC(c, 9, 1, 2, 2, a); PX(c, 7, 4, b); PX(c, 9, 4, b); RC(c, 7, 9, 2, 1, b); break;
    case 'crown': RC(c, 2, 8, 12, 5, a); RC(c, 2, 5, 2, 4, a); RC(c, 7, 3, 2, 6, a); RC(c, 12, 5, 2, 4, a); PX(c, 3, 4, b); PX(c, 8, 2, b); PX(c, 13, 4, b); RC(c, 2, 12, 12, 1, shade(a, -45)); DC(c, 5, 10, 1, b); DC(c, 8, 10, 1, '#4a9ae8'); DC(c, 11, 10, 1, b); PX(c, 4, 8, '#ffffff'); break;
    case 'skull': DC(c, 8, 7, 5, a); RC(c, 5, 10, 6, 4, a); RC(c, 5, 6, 2, 2, b); RC(c, 9, 6, 2, 2, b); PX(c, 8, 9, shade(a, -50)); for (let x = 6; x < 11; x += 2) RC(c, x, 12, 1, 2, shade(a, -45)); PX(c, 5, 4, '#ffffff'); PX(c, 6, 3, '#ffffff'); break;
    case 'relic': RC(c, 5, 3, 6, 11, a); RC(c, 4, 12, 8, 2, shade(a, -30)); RC(c, 6, 1, 4, 2, a); DC(c, 8, 7, 2, b); PX(c, 7, 6, '#ffffff'); RC(c, 5, 3, 1, 9, shade(a, 40)); break;
    default: DC(c, 8, 8, 5, a);
  }
  return iconCache['i' + id] = OL(c);
}
function actIcon(name) {
  if (iconCache['a' + name]) return iconCache['a' + name];
  const alias = { portal: ['door'], tank: ['tank'], trophy: ['trophy'], shirt: ['shirt', '#e86fa8'], tackle: ['reel', '#f2b84b'] };
  if (alias[name]) return iconCache['a' + name] = shopIcon(alias[name][0], alias[name][1]);
  const c = mk(16, 16);
  switch (name) {
    case 'rod': LN(c, 2, 14, 11, 2, '#a8743a'); LN(c, 3, 14, 12, 2, '#8a5a30'); LN(c, 11, 2, 12, 2, '#6b4423'); LN(c, 13, 2, 13, 9, '#e8e8e0'); RC(c, 12, 9, 2, 2, '#e8483a'); RC(c, 12, 11, 2, 1, '#f5f5f0'); PX(c, 13, 12, '#aab2bf'); RC(c, 2, 12, 3, 3, '#6b4423'); break;
    case 'tree': DC(c, 8, 9, 5, '#d8402f'); DC(c, 7, 8, 3, '#ee6a58'); PX(c, 6, 6, '#ffffff'); RC(c, 8, 2, 1, 3, '#5a3a1a'); RC(c, 9, 2, 4, 2, '#5c8f3a'); LN(c, 1, 5, 2, 7, '#cfd8e3'); LN(c, 14, 5, 13, 7, '#cfd8e3'); break;
    case 'bush': RC(c, 2, 6, 12, 8, '#a8743a'); RC(c, 3, 13, 10, 1, '#7a5028'); RC(c, 2, 6, 12, 1, '#c28a52'); for (let x = 3; x < 13; x += 3) RC(c, x, 7, 1, 6, '#7a5028'); DC(c, 5, 5, 2, '#7a3f8a'); DC(c, 9, 4, 2, '#d8305f'); DC(c, 12, 5, 2, '#4a5fc0'); break;
    case 'bug': for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7, y - 6); if (d <= 5 && d >= 3.5) PX(c, x, y, '#e8e0d0'); else if (d < 3.5) PX(c, x, y, 'rgba(210,235,240,0.5)'); } LN(c, 9, 10, 14, 15, '#a8743a'); LN(c, 10, 10, 15, 15, '#8a5a30'); DC(c, 6, 5, 1, '#f08a2a'); break;
    case 'beach': LN(c, 3, 3, 3, 9, '#8a5a30'); RC(c, 2, 2, 3, 2, '#6b4423'); RC(c, 1, 9, 5, 6, '#aab2bf'); RC(c, 1, 9, 2, 5, '#d4dae3'); RC(c, 9, 13, 6, 2, '#c9b078'); RC(c, 10, 11, 4, 2, '#c9b078'); DC(c, 12, 10, 1, '#f0b8a0'); break;
    case 'stall': DC(c, 8, 8, 6, '#f2b84b'); DC(c, 8, 8, 4, '#ffd877'); RC(c, 7, 5, 2, 6, '#c8902a'); PX(c, 5, 5, '#fff3c4'); PX(c, 6, 4, '#fff3c4'); break;
    case 'board': RC(c, 2, 1, 12, 14, '#f5e9cf'); RC(c, 2, 1, 12, 1, '#d8c9a4'); RC(c, 4, 4, 8, 1, '#8a5a30'); RC(c, 4, 7, 8, 1, '#8a5a30'); RC(c, 4, 10, 5, 1, '#8a5a30'); RC(c, 11, 11, 3, 3, '#c85a4a'); break;
    case 'wave': RC(c, 5, 6, 7, 8, '#f0c8a0'); RC(c, 5, 3, 1, 4, '#f0c8a0'); RC(c, 7, 2, 1, 5, '#f0c8a0'); RC(c, 9, 2, 1, 5, '#f0c8a0'); RC(c, 11, 3, 1, 4, '#f0c8a0'); RC(c, 2, 8, 3, 2, '#f0c8a0'); RC(c, 5, 13, 7, 1, '#d8a878'); LN(c, 2, 3, 0, 1, '#cfd8e3'); LN(c, 14, 3, 15, 1, '#cfd8e3'); break;
    case 'book': RC(c, 2, 1, 12, 14, '#2f8f86'); RC(c, 2, 1, 2, 14, '#1f6a63'); RC(c, 5, 3, 7, 1, '#f5e9cf'); RC(c, 5, 5, 5, 1, '#f5e9cf'); DC(c, 9, 10, 2, '#f2b84b'); break;
    case 'bag': RC(c, 3, 5, 10, 10, '#a8743a'); RC(c, 3, 5, 10, 2, '#c28a52'); RC(c, 5, 1, 6, 4, '#8a5a30'); RC(c, 6, 2, 4, 2, '#a8743a'); RC(c, 5, 10, 6, 4, '#8a5a30'); RC(c, 7, 9, 2, 2, '#f2b84b'); break;
    case 'chat': RC(c, 1, 2, 14, 9, '#f5e9cf'); RC(c, 3, 11, 3, 3, '#f5e9cf'); RC(c, 4, 5, 2, 2, '#2a1c1c'); RC(c, 7, 5, 2, 2, '#2a1c1c'); RC(c, 10, 5, 2, 2, '#2a1c1c'); break;
    case 'gem': RC(c, 5, 2, 6, 2, '#8ff0e0'); RC(c, 3, 4, 10, 3, '#5fd0c0'); RC(c, 5, 7, 6, 3, '#3aa89c'); RC(c, 7, 10, 2, 2, '#2f8f86'); PX(c, 5, 3, '#ffffff'); break;
    case 'coin': DC(c, 8, 8, 6, '#c8902a'); DC(c, 8, 8, 5, '#f2b84b'); DC(c, 8, 8, 3, '#ffd877'); RC(c, 7, 5, 2, 6, '#c8902a'); PX(c, 5, 5, '#fff3c4'); break;
  }
  return iconCache['a' + name] = OL(c);
}
function dataURL(c, key) { return iconCache['u' + key] || (iconCache['u' + key] = c.toDataURL()); }
const itemURL = id => dataURL(itemIcon(id), 'i' + id);
const actURL = n => dataURL(actIcon(n), 'a' + n);


// ---- shops and landmarks -------------------------------------------------------
function makeShop(c1, c2, sign, wares) {
  const c = mk(52, 46);
  RC(c, 5, 10, 2, 28, '#6b4423'); RC(c, 45, 10, 2, 28, '#6b4423');
  RC(c, 4, 26, 44, 14, '#9a6a3a'); for (let x = 4; x < 48; x += 6) RC(c, x, 26, 1, 14, '#7a5028'); RC(c, 4, 26, 44, 2, '#c28a52');
  wares(c);
  for (let x = 2; x < 50; x += 6) { const col = (x / 6) % 2 === 0 ? c1 : c2; RC(c, x, 9, 6, 11, col); RC(c, x + 1, 20, 4, 2, col); }
  RC(c, 2, 9, 48, 1, shade(c1, -40));
  RC(c, 16, 0, 20, 8, '#f5e9cf'); RC(c, 16, 0, 20, 1, '#d8c9a4'); sign(c);
  return anchor(OL(c), 26, 41);
}
function makeTackleShop() { return makeShop('#3f7fb8', '#f5e9cf', c => { LN(c, 24, 6, 28, 2, '#a8743a'); EL(c, 26, 4, 3, 2, '#78bfff'); PX(c, 30, 3, '#2a1c1c'); }, c => { LN(c, 9, 25, 13, 12, '#a8743a'); LN(c, 12, 25, 16, 12, '#8a5a30'); LN(c, 40, 25, 36, 13, '#a8743a'); RC(c, 20, 22, 8, 4, '#c85a4a'); RC(c, 30, 23, 6, 3, '#e8c24a'); }); }
function makePortal(kind) {
  if (kind === 'exit') {
    const c = mk(40, 34); EL(c, 20, 22, 19, 12, '#6c7380'); EL(c, 20, 18, 17, 11, '#8a919c'); RC(c, 10, 14, 20, 17, '#d8ecff'); EL(c, 20, 14, 10, 6, '#d8ecff'); RC(c, 14, 14, 12, 17, '#f4fbff'); EL(c, 20, 13, 6, 4, '#f4fbff');
    for (let i = 0; i < 4; i++) RC(c, 10 + i, 27 + i, 20 - i * 2, 1, '#a8afbb'); PX(c, 7, 12, '#a8afbb'); PX(c, 32, 11, '#a8afbb'); return anchor(OL(c), 20, 32);
  }
  const c = mk(48, 40); EL(c, 24, 26, 23, 13, '#5c6270'); EL(c, 24, 20, 21, 14, '#6c7380'); EL(c, 20, 12, 12, 7, '#8a919c');
  RC(c, 14, 20, 20, 17, '#0e0a16'); EL(c, 24, 20, 10, 8, '#0e0a16'); RC(c, 16, 24, 16, 13, '#1a1426'); [[18, 30], [27, 28], [22, 34], [30, 33]].forEach(p => PX(c, p[0], p[1], '#5fd0c0'));
  for (let i = 0; i < 5; i++) { RC(c, 12 + i * 5, 36, 4, 2, '#8a919c'); } PX(c, 8, 20, '#5f9a3a'); PX(c, 40, 22, '#5f9a3a'); PX(c, 9, 19, '#5f9a3a'); RC(c, 6, 28, 6, 3, '#4f8a38'); RC(c, 36, 26, 7, 3, '#4f8a38');
  return anchor(OL(c), 24, 38);
}
function makeCrystal(a, b) { const c = mk(18, 24); [[8, 22, 3, 18, a], [4, 22, 2, 11, b], [13, 22, 2, 13, b]].forEach(s => { for (let y = 0; y < s[3]; y++) { const w = Math.max(1, Math.round(s[2] * (1 - Math.abs(y - s[3] * 0.62) / (s[3] * 0.62 + 1) * 0.9))); RC(c, s[0] - w, s[1] - y, w * 2, 1, y % 5 < 2 ? shade(s[4], 40) : s[4]); } }); EL(c, 9, 22, 6, 1.5, '#3a3548'); PX(c, 7, 8, '#ffffff'); PX(c, 7, 9, '#ffffff'); return anchor(OL(c), 9, 22); }
function makeMushroom(col) { const c = mk(16, 14); [[4, 11, 3], [9, 9, 4], [13, 11, 2]].forEach(m => { RC(c, m[0] - 1, m[1], 2, 3, '#e8e0d0'); EL(c, m[0], m[1], m[2] + 1, m[2] - 1, col); PX(c, m[0] - 1, m[1] - 1, shade(col, 70)); PX(c, m[0] + 1, m[1], shade(col, 70)); }); return anchor(OL(c), 8, 13); }
function makeStalagmite() { const c = mk(16, 24); for (let y = 0; y < 22; y++) { const w = 1 + Math.round(y * 0.33); RC(c, 8 - w, 22 - y > 0 ? y + 1 : 0, w * 2, 1, y < 8 ? '#8a8fa0' : '#6a6f80'); } RC(c, 7, 4, 1, 14, '#a8aebb'); EL(c, 8, 22, 7, 2, '#4a4e5c'); return anchor(OL(c), 8, 22); }
const shopIconCache = {};
function shopIcon(kind, col) {
  const key = kind + (col || ''); if (shopIconCache[key]) return shopIconCache[key]; col = col || '#c8d0d8';
  const c = mk(16, 16);
  switch (kind) {
    case 'rod': LN(c, 2, 14, 12, 2, '#a8743a'); LN(c, 3, 14, 13, 2, shade(col, -10)); LN(c, 12, 2, 13, 2, col); LN(c, 14, 3, 14, 10, '#e8e8e0'); PX(c, 14, 11, '#aab2bf'); RC(c, 2, 12, 3, 3, '#6b4423'); break;
    case 'reel': DC(c, 8, 8, 6, shade(col, -30)); DC(c, 8, 8, 5, col); DC(c, 8, 8, 2, '#2a2020'); RC(c, 8, 1, 2, 4, '#6b4423'); PX(c, 5, 5, '#fff'); break;
    case 'line': RC(c, 3, 2, 10, 2, '#8a5a30'); RC(c, 3, 12, 10, 2, '#8a5a30'); RC(c, 4, 4, 8, 8, col); for (let y = 5; y < 12; y += 2) RC(c, 4, y, 8, 1, shade(col, -40)); break;
    case 'bobber': RC(c, 8, 1, 1, 3, '#2a2020'); DC(c, 8, 8, 4, '#f5f5f0'); for (let y = 4; y < 8; y++) for (let x = 4; x < 13; x++) if ((x - 8) ** 2 + (y - 8) ** 2 <= 17) PX(c, x, y, col); RC(c, 8, 12, 1, 3, '#2a2020'); PX(c, 6, 6, '#fff'); break;
    case 'spinner': EL(c, 7, 6, 4, 3, col); EL(c, 7, 6, 2, 1, '#fff'); RC(c, 7, 9, 2, 5, '#6b4423'); PX(c, 9, 14, '#aab2bf'); PX(c, 10, 13, '#aab2bf'); break;
    case 'feather': LN(c, 3, 13, 13, 3, col); LN(c, 4, 13, 13, 4, shade(col, -30)); LN(c, 6, 11, 9, 13, col); LN(c, 8, 9, 12, 11, col); LN(c, 8, 8, 7, 4, col); break;
    case 'bait': RC(c, 4, 5, 8, 9, '#cfd8e3'); RC(c, 5, 8, 6, 5, col); RC(c, 3, 3, 10, 3, '#8a5a30'); PX(c, 5, 7, '#fff'); LN(c, 7, 8, 9, 10, shade(col, -40)); break;
    case 'pouch': RC(c, 3, 5, 10, 10, '#a8743a'); RC(c, 3, 5, 10, 2, '#c28a52'); RC(c, 5, 2, 6, 4, '#8a5a30'); RC(c, 7, 9, 2, 2, '#f2b84b'); break;
    case 'sandals': RC(c, 2, 4, 5, 10, '#e8a23a'); RC(c, 9, 4, 5, 10, '#e8a23a'); RC(c, 2, 8, 5, 1, '#6b4423'); RC(c, 9, 8, 5, 1, '#6b4423'); RC(c, 3, 2, 3, 3, '#f0c8a0'); RC(c, 10, 2, 3, 3, '#f0c8a0'); break;
    case 'glove': RC(c, 4, 7, 8, 7, '#e8a23a'); RC(c, 4, 3, 2, 5, '#e8a23a'); RC(c, 7, 2, 2, 6, '#e8a23a'); RC(c, 10, 3, 2, 5, '#e8a23a'); RC(c, 2, 8, 2, 3, '#e8a23a'); RC(c, 4, 12, 8, 2, '#8a5a30'); break;
    case 'wrist': DC(c, 8, 8, 6, '#e8483a'); DC(c, 8, 8, 3, '#0000'); c.g.clearRect(6, 6, 5, 5); RC(c, 7, 1, 2, 2, '#f5e9cf'); break;
    case 'coin': DC(c, 8, 8, 6, '#c8902a'); DC(c, 8, 8, 5, '#f2b84b'); DC(c, 8, 8, 3, '#ffd877'); RC(c, 7, 5, 2, 6, '#c8902a'); PX(c, 5, 5, '#fff3c4'); break;
    case 'finder': RC(c, 3, 1, 10, 14, '#4a7ad8'); RC(c, 4, 3, 8, 7, '#8fe09a'); RC(c, 5, 5, 3, 1, '#2f7f6f'); RC(c, 6, 7, 4, 1, '#2f7f6f'); RC(c, 5, 12, 6, 2, '#2a3a5a'); break;
    case 'tank': RC(c, 2, 3, 12, 10, '#6b4423'); RC(c, 3, 4, 10, 7, '#5fb0d0'); EL(c, 8, 8, 3, 1.5, '#f08a2a'); PX(c, 6, 8, '#1a1a1a'); RC(c, 3, 11, 10, 2, '#e0cd96'); break;
    case 'trophy': RC(c, 5, 12, 6, 2, '#c8902a'); RC(c, 7, 9, 2, 3, '#c8902a'); RC(c, 4, 2, 8, 7, '#ffd23f'); RC(c, 2, 3, 2, 3, '#f2b84b'); RC(c, 12, 3, 2, 3, '#f2b84b'); PX(c, 5, 3, '#fff3c4'); break;
    case 'shirt': RC(c, 4, 3, 8, 11, col); RC(c, 1, 3, 4, 4, col); RC(c, 11, 3, 4, 4, col); RC(c, 6, 3, 4, 1, shade(col, -50)); break;
    case 'hat': EL(c, 8, 11, 7, 2, shade(col, -30)); RC(c, 4, 5, 8, 6, col); RC(c, 4, 5, 8, 1, shade(col, 25)); break;
    case 'gem': RC(c, 5, 2, 6, 2, '#8ff0e0'); RC(c, 3, 4, 10, 3, '#5fd0c0'); RC(c, 5, 7, 6, 3, '#3aa89c'); RC(c, 7, 10, 2, 2, '#2f8f86'); PX(c, 5, 3, '#fff'); break;
    case 'door': EL(c, 8, 8, 6, 7, '#6c7380'); RC(c, 5, 6, 6, 8, '#14101c'); EL(c, 8, 6, 3, 3, '#14101c'); PX(c, 7, 10, '#5fd0c0'); break;
    case 'boost': RC(c, 7, 1, 3, 6, '#f2b84b'); RC(c, 5, 6, 7, 2, '#f2b84b'); RC(c, 6, 8, 3, 7, '#f2b84b'); PX(c, 8, 2, '#fff3c4'); break;
    default: DC(c, 8, 8, 5, col);
  }
  return shopIconCache[key] = OL(c);
}
const shopIconURL = (k, col) => dataURL(shopIcon(k, col), 's' + k + (col || ''));

// ---- build ---------------------------------------------------------------
function buildSprites() {
  SPR.tree = {
    apple: [makeTree(CANOPY.green, '#d8402f', 11, true), makeTree(CANOPY.green, null, 11, false)],
    orange: [makeTree(CANOPY.dgreen, '#f08a2a', 22, true), makeTree(CANOPY.dgreen, null, 22, false)],
    pear: [makeTree(CANOPY.yellow, '#b8c84a', 33, true), makeTree(CANOPY.yellow, null, 33, false)],
    plum: [makeTree(CANOPY.red, '#7a3f8a', 44, true), makeTree(CANOPY.red, null, 44, false)]
  };
  SPR.deco = [makeTree(CANOPY.orange, null, 5, false), makeTree(CANOPY.red, null, 6, false), makeTree(CANOPY.yellow, null, 7, false), makeTree(CANOPY.green, null, 8, false), makePine(), makePine()];
  const bc = { blueberry: '#4a5fc0', raspberry: '#d8305f', blackberry: '#3a2a4a', elderberry: '#5a3a7a' };
  SPR.bush = {}; for (const k in bc) SPR.bush[k] = [makeBush(bc[k], true), makeBush(bc[k], false)];
  SPR.lamp = makeLamp(); SPR.bench = makeBench(); SPR.fountain = makeFountain(); SPR.rock = makeRock();
  SPR.flower = ['#f06a8a', '#f5e9cf', '#f2b84b', '#a98af0', '#ff9a5a'].map(makeFlower);
 
  SPR.portalCave = makePortal('cave'); SPR.portalExit = makePortal('exit'); SPR.crystalB = makeCrystal('#5fa8ff', '#a8d4ff'); SPR.crystalP = makeCrystal('#b070f0', '#d8b0ff'); SPR.mushroom = makeMushroom('#5fd8d0'); SPR.mushroomP = makeMushroom('#e86fa8'); SPR.stalagmite = makeStalagmite();
  SPR.tackle = makeTackleShop();
  SPR.campfire = makeCampfire(); SPR.tentRed = makeTent('#d8604a', '#f5e9cf'); SPR.tentGreen = makeTent('#5f9a5a', '#e8d8a0'); SPR.logseat = makeLogSeat(); SPR.crate = makeCrate();
  SPR.barrel = makeBarrel(); SPR.signpost = makeSignpost(); SPR.fence = makeFence(); SPR.lily = [makeLily(0), makeLily(1), makeLily(2)];
}
