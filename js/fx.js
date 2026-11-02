'use strict';
// Ambient effects shared by the game and the editor: waves, lily pads, cloud shadows, vignette, drifting leaves, tree sway.
const FX = { cloud: null, leaves: [], lastLeaf: 0 };
const fxOn = () => typeof S === 'undefined' || S.fx !== false;

function buildLilies() { // lily pads float on pond tiles that are not next to the bank
  W.lilies = [];
  for (let ty = 1; ty < MH - 1; ty++) for (let tx = 1; tx < MW - 1; tx++) {
    if (GRID[ty * MW + tx] !== 6 || GRID[ty * MW + tx - 1] !== 6 || GRID[ty * MW + tx + 1] !== 6 || GRID[(ty - 1) * MW + tx] !== 6 || GRID[(ty + 1) * MW + tx] !== 6) continue;
    const h = hash2(tx, ty, 71); if (h > 0.34) continue;
    W.lilies.push({ x: tx * TS + 3 + Math.floor(hash2(tx, ty, 72) * 10), y: ty * TS + 4 + Math.floor(hash2(tx, ty, 73) * 9), v: Math.floor(hash2(tx, ty, 74) * 3), ph: h * 40 });
  }
}
function buildClouds() {
  const c = mk(640, 480), r = rng(4242);
  for (let i = 0; i < 9; i++) {
    const bx = r() * 640, by = r() * 480;
    for (let k = 0; k < 4; k++) {
      const x = bx + (r() - 0.5) * 90, y = by + (r() - 0.5) * 50, rad = 40 + r() * 50;
      for (const ox of [-640, 0, 640]) for (const oy of [-480, 0, 480]) {
        const gr = c.g.createRadialGradient(x + ox, y + oy, 2, x + ox, y + oy, rad); gr.addColorStop(0, 'rgba(14,26,60,0.12)'); gr.addColorStop(1, 'rgba(14,26,60,0)');
        c.g.fillStyle = gr; c.g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  }
  FX.cloud = c;
}
function fxWater(cx, cy, now) { // drifting wave streaks on open water, only on tiles away from the shore so they never touch sand
  const tx0 = Math.max(1, Math.floor(cx / TS)), ty0 = Math.max(1, Math.floor(cy / TS)), tx1 = Math.min(MW - 2, Math.ceil((cx + VW) / TS)), ty1 = Math.min(MH - 2, Math.ceil((cy + VH) / TS));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = GRID[ty * MW + tx]; if (!(t <= 1 || t === 6)) continue;
    if (GRID[ty * MW + tx - 1] !== t || GRID[ty * MW + tx + 1] !== t || GRID[(ty - 1) * MW + tx] !== t || GRID[(ty + 1) * MW + tx] !== t) continue;
    const h = hash2(tx, ty, 70); if (h > 0.5) continue;
    const ph = (now * 0.28 + h * 9) % 1, a = Math.sin(ph * Math.PI), x = tx * TS + ph * 20 - 2, y = ty * TS + 3 + Math.floor(h * 20) % 11;
    g.fillStyle = t === 0 ? `rgba(150,200,245,${0.42 * a})` : `rgba(240,250,252,${0.55 * a})`;
    g.fillRect(Math.round(x - cx), Math.round(y - cy), 5, 1); g.fillRect(Math.round(x - cx) + 2, Math.round(y - cy) + 1, 3, 1);
  }
}
function fxLilies(cx, cy, now) {
  for (const l of W.lilies || []) {
    if (l.x < cx - 10 || l.x > cx + VW + 10 || l.y < cy - 10 || l.y > cy + VH + 10) continue;
    const s = SPR.lily[l.v], by = Math.round(Math.sin(now * 1.4 + l.ph) * 0.7), bx = Math.round(Math.sin(now * 0.6 + l.ph * 2) * 0.6);
    g.drawImage(s, Math.round(l.x - s.ax - cx) + bx, Math.round(l.y - s.ay - cy) + by);
  }
}
function fxClouds(cx, cy, now, day) {
  if (!FX.cloud || day < 0.2) return;
  const wx = (now * 6) % 640, wy = (now * 2.2) % 480, sx = -((((cx - wx) % 640) + 640) % 640), sy = -((((cy - wy) % 480) + 480) % 480);
  g.save(); g.imageSmoothingEnabled = true; g.globalAlpha = clamp(day, 0, 1) * 0.9;
  for (let x = sx; x < VW; x += 640) for (let y = sy; y < VH; y += 480) g.drawImage(FX.cloud, x, y);
  g.restore(); g.imageSmoothingEnabled = false;
}
function fxVignette() {
  const gr = g.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
  gr.addColorStop(0, 'rgba(8,10,30,0)'); gr.addColorStop(1, 'rgba(8,10,30,0.26)'); g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
}
function fxLeaves(dt, cx, cy, now) { // a few autumn leaves drifting across the screen
  if (now - FX.lastLeaf > 1.6 && FX.leaves.length < 12) { FX.lastLeaf = now; FX.leaves.push({ x: cx + Math.random() * VW, y: cy - 6, vx: rnd(8, 18), vy: rnd(14, 26), ph: Math.random() * 6, c: pick(['#d8802f', '#c0482f', '#e6b830', '#a8501f']) }); }
  for (let i = FX.leaves.length - 1; i >= 0; i--) {
    const l = FX.leaves[i]; l.x += (l.vx + Math.sin(now * 2 + l.ph) * 10) * dt; l.y += l.vy * dt;
    if (l.y > cy + VH + 6 || l.x > cx + VW + 20) { FX.leaves.splice(i, 1); continue; }
    g.fillStyle = l.c; g.fillRect(Math.round(l.x - cx), Math.round(l.y - cy), 2, 1); g.fillRect(Math.round(l.x - cx) + (Math.sin(now * 3 + l.ph) > 0 ? 1 : 0), Math.round(l.y - cy) + 1, 1, 1);
  }
}
// canopy sways in whole-pixel steps; the trunk stays put
function drawSway(spr, x, y, now, amp, split) {
  const w = spr.width, h = spr.height, sw = fxOn() ? Math.round(Math.sin(now * 1.15 + x * 0.043 + y * 0.021) * amp) : 0, cut = Math.max(2, Math.min(h - 2, split));
  g.drawImage(spr, 0, 0, w, cut, x + sw, y, w, cut); g.drawImage(spr, 0, cut, w, h - cut, x, y + cut, w, h - cut);
}
function drawCampfire(o, cx, cy, now) {
  const x = Math.round(o.x - cx), y = Math.round(o.y - cy), f = Math.floor(now * 9 + o.x) % 3;
  g.drawImage(SPR.campfire, x - SPR.campfire.ax, y - SPR.campfire.ay);
  const hts = [10, 13, 11][f];
  g.fillStyle = '#e8483a'; g.fillRect(x - 3, y - 5 - hts + 4, 7, hts - 2); g.fillStyle = '#f08a2a'; g.fillRect(x - 2, y - 6 - hts + 4, 5, hts); g.fillStyle = '#ffd23f'; g.fillRect(x - 1, y - 4 - hts + 6, 3, hts - 4);
  g.fillStyle = '#e8483a'; g.fillRect(x - 1 + (f - 1), y - 8 - hts + 4, 2, 3); g.fillStyle = '#fff4b0'; g.fillRect(x, y - 5, 1, 3);
  for (let i = 0; i < 4; i++) { const ph = (now * 0.5 + i / 4 + o.x * 0.01) % 1; g.fillStyle = `rgba(190,190,200,${0.5 * (1 - ph)})`; g.fillRect(Math.round(x - 1 + Math.sin(ph * 6 + i) * 3), Math.round(y - 20 - ph * 22), 2 + Math.floor(ph * 2), 2); }
}
