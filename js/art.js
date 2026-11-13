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

// ---- placeholder art: everything below is basic shapes until the real art arrives -------------------------------------------------
const iconCache = {};
const ITEM_CELLS = { jug: [0, 0], bowl: [1, 0], coin: [2, 0], nails: [3, 0], boot: [0, 1], fabric: [1, 1], scrap: [2, 1] };   // 8x8 painted icons in assets/props/items.png (column, row)
function itemIcon(id) {   // icons of finds and salvage (painted 8x8) and tools (16x16 placeholders)
  if (iconCache['i' + id]) return iconCache['i' + id];
  if (ITEM_CELLS[id] && ASSET.img.items) { const c = mk(8, 8); c.g.drawImage(ASSET.img.items, ITEM_CELLS[id][0] * 8, ITEM_CELLS[id][1] * 8, 8, 8, 0, 0, 8, 8); return iconCache['i' + id] = c; }
  const c = mk(16, 16);
  switch (id) {
    case 'jug': EL(c, 8, 10, 4.6, 5, '#b9774a'); RC(c, 6, 3, 4, 4, '#a0643c'); RC(c, 5, 2, 6, 2, '#d89a68'); RC(c, 3, 6, 2, 4, '#8f5532'); RC(c, 5, 9, 6, 1, '#8f5532'); break;
    case 'bowl': EL(c, 8, 9, 6.5, 5, '#d8c8a0'); EL(c, 8, 7, 6, 2.6, '#a8b8c0'); RC(c, 3, 10, 10, 2, '#3f7f9f'); RC(c, 5, 13, 6, 1, '#8f7a58'); break;
    case 'coin': DC(c, 8, 8, 6, '#b88a28'); DC(c, 8, 8, 5, '#e8c050'); DC(c, 8, 8, 3, '#f6dc80'); RC(c, 7, 5, 2, 6, '#b88a28'); PX(c, 5, 5, '#fff3c4'); break;
    case 'nails': for (let i = 0; i < 3; i++) { LN(c, 3 + i * 3, 3, 6 + i * 3, 13, '#8a5a3a'); RC(c, 2 + i * 3, 2, 3, 1, '#5a3a28'); } break;
    case 'boot': RC(c, 5, 2, 5, 9, '#8a6a4a'); RC(c, 5, 10, 9, 4, '#8a6a4a'); RC(c, 5, 13, 9, 1, '#4a3a2a'); RC(c, 5, 2, 5, 1, '#5a4a38'); PX(c, 7, 5, '#c8a878'); PX(c, 7, 7, '#c8a878'); break;
    case 'fabric': RC(c, 2, 3, 12, 10, '#c9b8a0'); for (let x = 2; x < 14; x += 3) RC(c, x, 3, 1, 10, '#a89880'); for (let i = 0; i < 6; i++) RC(c, 2 + i * 2, 13, 1, 1 + (i % 3), '#c9b8a0'); break;
    case 'scrap': RC(c, 2, 8, 6, 5, '#8a909a'); RC(c, 7, 4, 6, 6, '#a8afbb'); RC(c, 5, 10, 8, 3, '#6c7380'); PX(c, 9, 5, '#dfe5ee'); break;
    case 'mattock0': case 'mattock1': case 'mattock2': { const col = MATTOCKS[+id.slice(7)].col; LN(c, 3, 14, 12, 4, '#8a5a30'); LN(c, 4, 14, 13, 4, '#a8743a'); RC(c, 9, 2, 6, 3, col); RC(c, 9, 2, 6, 1, shade(col, 40)); RC(c, 11, 5, 2, 2, '#6b4423'); break; }
    case 'brush0': case 'brush1': { const col = BRUSHES[+id.slice(5)].col; LN(c, 3, 14, 10, 7, '#8a5a30'); LN(c, 4, 14, 11, 7, '#a8743a'); RC(c, 10, 2, 5, 5, col); RC(c, 10, 2, 5, 1, shade(col, 35)); RC(c, 10, 6, 5, 1, shade(col, -40)); if (id === 'brush1') { PX(c, 11, 3, '#fff3c4'); PX(c, 13, 4, '#fff3c4'); } break; }
  }
  return iconCache['i' + id] = OL(c);
}
function actIcon(name) {   // buttons: dig, camp, collection book, you
  if (iconCache['a' + name]) return iconCache['a' + name];
  const c = mk(16, 16);
  switch (name) {
    case 'beach': LN(c, 3, 14, 12, 4, '#8a5a30'); LN(c, 4, 14, 13, 4, '#a8743a'); RC(c, 9, 2, 6, 3, '#c08a40'); RC(c, 9, 2, 6, 1, '#e8b870'); RC(c, 11, 5, 2, 2, '#6b4423'); break;
    case 'camp': for (let y = 0; y < 11; y++) RC(c, 8 - Math.round(y * 0.65), 3 + y, 1 + Math.round(y * 1.3), 1, y % 2 ? '#e8d8b0' : '#c9503f'); RC(c, 7, 10, 2, 4, '#4a3326'); RC(c, 1, 14, 14, 1, '#6b4423'); break;
    case 'book': RC(c, 2, 1, 12, 14, '#2f8f86'); RC(c, 2, 1, 2, 14, '#1f6a63'); RC(c, 5, 3, 7, 1, '#f5e9cf'); RC(c, 5, 5, 5, 1, '#f5e9cf'); DC(c, 9, 10, 2, '#f2b84b'); break;
    case 'bag': RC(c, 3, 5, 10, 10, '#a8743a'); RC(c, 3, 5, 10, 2, '#c28a52'); RC(c, 5, 1, 6, 4, '#8a5a30'); RC(c, 6, 2, 4, 2, '#a8743a'); RC(c, 5, 10, 6, 4, '#8a5a30'); RC(c, 7, 9, 2, 2, '#f2b84b'); break;
    case 'wave': RC(c, 5, 6, 7, 8, '#f0c8a0'); RC(c, 5, 3, 1, 4, '#f0c8a0'); RC(c, 7, 2, 1, 5, '#f0c8a0'); RC(c, 9, 2, 1, 5, '#f0c8a0'); RC(c, 11, 3, 1, 4, '#f0c8a0'); RC(c, 2, 8, 3, 2, '#f0c8a0'); break;
  }
  return iconCache['a' + name] = OL(c);
}
function dataURL(c, key) { return iconCache['u' + key] || (iconCache['u' + key] = c.toDataURL()); }
const itemURL = id => dataURL(itemIcon(id), 'i' + id);
const actURL = n => dataURL(actIcon(n), 'a' + n);

// the camp station: a tent, a table and a crate
function makeCamp() {
  const c = mk(60, 46);
  for (let y = 0; y < 22; y++) { const w = 6 + y * 2; RC(c, 30 - w / 2, 4 + y, w, 1, Math.floor(y / 3) % 2 ? '#e8d8b0' : '#c9503f'); }
  RC(c, 24, 18, 12, 8, '#3a2a20'); RC(c, 2, 28, 22, 3, '#8a5a30'); RC(c, 3, 31, 2, 7, '#6b4423'); RC(c, 21, 31, 2, 7, '#6b4423'); RC(c, 5, 24, 5, 4, '#c9a46a'); RC(c, 12, 25, 8, 3, '#8a919c');
  RC(c, 40, 26, 14, 12, '#a8743a'); RC(c, 40, 26, 14, 2, '#c9965a'); RC(c, 46, 26, 2, 12, '#7a5028'); RC(c, 29, 0, 2, 6, '#6b4423'); RC(c, 31, 0, 6, 3, '#f2b84b');
  return anchor(OL(c), 31, 40);
}
function buildSprites() {
  SPR.camp = makeCamp();
  const T = ASSET.tree, im = ASSET.img.tree;   // the tree is three layers: trunk, crown (drawn over everything, it sways) and the crown's shadow
  const cut = (img, q) => { const c = mk(q.w, q.h); c.g.drawImage(img, q.x, q.y, q.w, q.h, 0, 0, q.w, q.h); return c; };
  if (T && im) {
    const trunk = cut(im, T.trunk); trunk.ax = T.trunk.ax; trunk.ay = T.trunk.ay;
    const crown = cut(im, T.crown); crown.ax = -T.crown.ox; crown.ay = -T.crown.oy;
    const shadow = cut(im, T.shadow); shadow.g.globalCompositeOperation = 'source-in'; shadow.g.fillStyle = '#0c1a0c'; shadow.g.fillRect(0, 0, shadow.width, shadow.height); shadow.ax = -T.shadow.ox; shadow.ay = -T.shadow.oy;
    SPR.tree = { trunk, crown, shadow };
  }
  SPR.decor = {}; const D = ASSET.decor, dm = ASSET.img.decor;   // flowers, bushes, rocks and pebbles: anchored at their bottom centre
  if (D && dm) for (const n in D) { const c = cut(dm, D[n]); c.ax = D[n].ax; c.ay = D[n].ay; SPR.decor[n] = c; }
  SPR.leaves = []; const lm = ASSET.img.leaves;   // falling leaf: 4 frames x 3 variants, 5x5 cells
  if (lm) for (let f = 0; f < 4; f++) { SPR.leaves[f] = []; for (let k = 0; k < 3; k++) { const c = cut(lm, { x: f * 15 + k * 5, y: 0, w: 5, h: 5 }); c.ax = 2; c.ay = 2; SPR.leaves[f][k] = c; } }
}
