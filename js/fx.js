'use strict';
// Ambient effects shared by the game and the editor: waves, lily pads, cloud shadows, vignette, drifting leaves, tree sway.
const FX = { cloud: null, leaves: [], lastLeaf: 0 };
const fxOn = () => typeof S === 'undefined' || S.fx !== false;

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
    const t = GRID[ty * MW + tx]; if (!(t <= 1 || t === 6) || DECK[ty * MW + tx]) continue;
    if (GRID[ty * MW + tx - 1] !== t || GRID[ty * MW + tx + 1] !== t || GRID[(ty - 1) * MW + tx] !== t || GRID[(ty + 1) * MW + tx] !== t) continue;
    const h = hash2(tx, ty, 70); if (h > 0.5) continue;
    const ph = (now * 0.28 + h * 9) % 1, a = Math.sin(ph * Math.PI), x = tx * TS + ph * 20 - 2, y = ty * TS + 3 + Math.floor(h * 20) % 11;
    g.fillStyle = t === 0 ? `rgba(150,200,245,${0.42 * a})` : `rgba(240,250,252,${0.55 * a})`;
    g.fillRect(Math.round(x - cx), Math.round(y - cy), 5, 1); g.fillRect(Math.round(x - cx) + 2, Math.round(y - cy) + 1, 3, 1);
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
