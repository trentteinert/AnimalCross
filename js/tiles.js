'use strict';
// Procedural tileset using the "dual grid" autotile technique.
//
// Each map tile holds a terrain type. Rendered tiles sit on the CORNERS between four map tiles,
// so only 16 edge shapes are needed per terrain layer.
//
// Atlas layout (16px tiles), 36 columns x 7 rows:
//   row 0           deep water fills                       cols 0-3
//   rows 1..6       SHALLOW, SAND, GRASS, DIRT, COBBLE, POND (drawn in that order, each over the last)
//     cols 0-15     edge mask variant A   mask = TL*1 + TR*2 + BL*4 + BR*8 (which of the 4 corners are "this terrain")
//     cols 16-31    edge mask variant B
//     cols 32-35    full interior fills (mask 15)
// To use your own art: paint an atlas.png with the same layout, save it as tiles/atlas.png, open the game with ?customtiles
const ATL_COLS = 36, ATL_ROWS = 7;
let ATLAS = null;

function tilePixel(L, x, y, gg, n, n2, full, s, dfdv) {
  const inside = gg >= 0, edge = !full && gg < 0.065; // 1px hard edge band just inside the shape
  switch (L) {
    case 0: return n < 0.05 ? [40, 100, 114] : n < 0.09 ? [24, 70, 82] : [30, 84, 98];
    case 1: // shallow water: flat, one lighter line at its edge
      if (!inside) return null; return edge ? [104, 176, 178] : n < 0.05 ? [64, 142, 152] : n > 0.96 ? [44, 112, 122] : [52, 126, 136];
    case 2: // sand: clean edge with a single foam line on the water side
      if (!inside) return gg > -0.065 ? [240, 250, 250] : null;
      return n < 0.06 ? [220, 178, 114] : n > 0.95 ? [246, 214, 160] : [235, 196, 132];
    case 3: { // grass with a thick shaded dirt lip on every edge except the north-facing ones (reads as raised ground)
      if (!inside) {
        const north = dfdv > 0.3, ring = north ? 0.075 : 0.19; // every edge except the north-facing ones gets the same thick, three-tone shaded lip (reads as raised ground)
        if (gg > -ring) { const t = -gg / ring; return north ? [152, 102, 58] : (t < 0.45 ? [170, 114, 64] : t < 0.8 ? [136, 90, 50] : [102, 68, 40]); }
        if (!north && gg > -ring - 0.06) return [86, 66, 40, 70];
        return null;
      }
      if (edge) return [112, 108, 34]; if (n2 < 0.012) return [100, 96, 30]; if (n2 > 0.996) return [226, 150, 50];
      return n < 0.07 ? [118, 114, 36] : n > 0.94 ? [150, 146, 54] : [134, 130, 42];
    }
    case 4: // dirt path
      if (!inside) return null; if (edge) return [166, 112, 66]; return n < 0.06 ? [172, 118, 70] : n > 0.95 ? [200, 146, 92] : [185, 128, 77];
    case 5: { // cobble plaza: 8x4 bricks, seamless on a 16px tile
      if (!inside) return null; if (edge) return [120, 104, 78];
      const row = y >> 2, off = (row & 1) * 4, xx = (x + off) & 7;
      if ((y & 3) === 0 || xx === 0) return [150, 132, 104];
      const bh = hash2((x + off) >> 3, row, s + 3); return bh < 0.5 ? [196, 178, 145] : [205, 188, 156];
    }
    case 6: // pond: flat water with one foam line
      if (!inside) return null; if (edge) return [200, 232, 228]; return n < 0.05 ? [52, 120, 130] : n < 0.09 ? [30, 88, 98] : [39, 103, 113];
  }
  return null;
}
function paintTile(L, m, v) {
  const c = mk(16, 16), id = c.g.createImageData(16, 16), d = id.data, s = L * 977 + m * 31 + v * 7919 + 13;
  const b0 = m & 1, b1 = (m >> 1) & 1, b2 = (m >> 2) & 1, b3 = (m >> 3) & 1, full = m === 15;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const u = (x + 0.5) / 16, w = (y + 0.5) / 16, f = b0 * (1 - u) * (1 - w) + b1 * u * (1 - w) + b2 * (1 - u) * w + b3 * u * w;
    const gg = f - 0.5;
    const dfdv = (b2 - b0) * (1 - u) + (b3 - b1) * u, px = tilePixel(L, x, y, gg, hash2(x + 40, y + 40, s + 1), hash2(x + 90, y + 7, s + 2), full, s, dfdv);
    if (px) { const i = (y * 16 + x) * 4; d[i] = px[0]; d[i + 1] = px[1]; d[i + 2] = px[2]; d[i + 3] = px[3] === undefined ? 255 : px[3]; }
  }
  c.g.putImageData(id, 0, 0); return c;
}
function generateAtlas() {
  const c = mk(ATL_COLS * 16, ATL_ROWS * 16);
  for (let v = 0; v < 4; v++) c.g.drawImage(paintTile(0, 15, v), v * 16, 0);
  for (let L = 1; L <= 6; L++) {
    for (let set = 0; set < 2; set++) for (let m = 1; m < 16; m++) c.g.drawImage(paintTile(L, m, set), (m + 16 * set) * 16, L * 16);
    for (let v = 0; v < 4; v++) c.g.drawImage(paintTile(L, 15, 10 + v), (32 + v) * 16, L * 16);
  }
  return c;
}
// Fill tiles painted in the new tileset (assets/tiles/fills.png: rows grass, dirt, sand, water; 4 variants each) replace the generated interiors.
function applyFills(c) {
  const f = ASSET && ASSET.img && ASSET.img.fills; if (!f) return c;
  const put = (srcRow, dstRow, dstCol0, tint) => { for (let k = 0; k < 4; k++) { c.g.drawImage(f, k * 16, srcRow * 16, 16, 16, (dstCol0 + k) * 16, dstRow * 16, 16, 16); if (tint) { c.g.save(); c.g.globalCompositeOperation = 'source-atop'; c.g.fillStyle = tint; c.g.fillRect((dstCol0 + k) * 16, dstRow * 16, 16, 16); c.g.restore(); } } };
  put(3, 0, 0, 'rgba(0,24,34,0.32)'); put(3, 1, 32, 'rgba(120,210,190,0.12)'); put(3, 6, 32);
  // painted terrain sets (assets/tiles/<name>.png: one tile per corner mask, built by tools/make_tiles.py). They have no outer lip, only their own edge,
  // and replace both the generated edges and the interior fills of their rows; a missing set falls back to the old generated art.
  const SETS = [[2, 'sand_tiles', 2], [3, 'grass_tiles', 0], [4, 'dirt_tiles', 1]];   // [atlas row, image, fills.png row for the fallback]
  for (const [row, key, fillRow] of SETS) {
    const im = ASSET.img[key]; if (!im) { put(fillRow, row, 32); continue; }
    c.g.clearRect(0, row * 16, ATL_COLS * 16, 16);
    for (let m = 1; m < 16; m++) for (let set = 0; set < 2; set++) c.g.drawImage(im, m * 16, 0, 16, 16, (m + 16 * set) * 16, row * 16, 16, 16);
    for (let k = 0; k < 4; k++) c.g.drawImage(im, 15 * 16, 0, 16, 16, (32 + k) * 16, row * 16, 16, 16);
  }
  return c;
}
function showAtlas(a) {
  const cv2 = mk(a.width, a.height); cv2.g.drawImage(a, 0, 0); const url = cv2.toDataURL('image/png');
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:99;background:#14202e;overflow:auto;padding:14px;color:#f5e9cf;font:14px monospace';
  el.innerHTML = `<p>Tile atlas (${a.width}x${a.height}). Rows: deep, shallow, sand, grass, dirt, cobble, pond. <a style="color:#f2b84b" download="atlas.png" href="${url}">Download atlas.png</a> · <a style="color:#f2b84b" href="?">Close</a></p><img src="${url}" style="image-rendering:pixelated;width:${a.width * 3}px;border:2px solid #f5e9cf">`;
  document.body.appendChild(el);
}
// Cave theme: the same tile art recoloured by brightness (rock walls instead of deep water, stone floor instead of grass, glowing pools).
const CAVE_RAMPS = [[[22, 22, 32], [66, 60, 78]], [[24, 70, 94], [88, 176, 196]], [[70, 60, 58], [158, 138, 116]], [[48, 52, 68], [104, 112, 130]], [[84, 66, 54], [152, 122, 94]], [[56, 54, 64], [124, 120, 132]], [[22, 74, 100], [96, 190, 206]]];
const atlasCache = {};
function atlasFor(theme) {
  if (theme !== 'cave') return ATLAS; if (atlasCache.cave) return atlasCache.cave;
  const src = mk(ATLAS.width, ATLAS.height); src.g.drawImage(ATLAS, 0, 0); const out = mk(ATLAS.width, ATLAS.height);
  for (let row = 0; row < ATL_ROWS; row++) {
    const id = src.g.getImageData(0, row * 16, ATLAS.width, 16), d = id.data, ramp = CAVE_RAMPS[row];
    for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const lum = clamp(((0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255 - 0.22) / 0.62, 0, 1); for (let k = 0; k < 3; k++) d[i + k] = Math.round(ramp[0][k] + (ramp[1][k] - ramp[0][k]) * lum); }
    out.g.putImageData(id, 0, row * 16);
  }
  return atlasCache.cave = out;
}
function prepareAtlas(cb) {
  const done = a => { ATLAS = a instanceof HTMLCanvasElement ? applyFills(a) : a; if (qs.has('atlas')) showAtlas(a); cb(); };
  if (qs.has('customtiles')) { const im = new Image(); im.onload = () => done(im); im.onerror = () => done(generateAtlas()); im.src = 'tiles/atlas.png'; }
  else done(generateAtlas());
}
