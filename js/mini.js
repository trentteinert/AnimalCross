'use strict';
// Pop-up mini games: fishing reel (hold), butterfly tapping, fruit-tree catching, berry picking.
// Game state lives in the current activity object A (see game.js); this file builds the pop-up and draws it.
const MINI = { mode: null, ptr: 0.5, taps: [] }; // ptr = pointer x (0..1) over the catch field; taps = pending canvas-space taps
const MNW = 200, MNH = 240;                         // logical size of the canvas mini games
const miniEl = () => $('#mini');

function miniMode(a) {
  if (!a) return null;
  if (a.k === 'fish' && a.ph === 'reel') return 'reel';
  if (a.k === 'net' && a.ph === 'tap') return 'tap';
  if (a.k === 'catch') return 'catch';
  if (a.k === 'berries') return 'berries';
  return null;
}
const MINI_UI = {
  reel: { title: 'Hooked!', hint: 'Hold to lift the green bar. Keep it on the fish!', body: '<div class="reelw"><div class="trk"><div id="mzone"></div><div id="mfish">🐟</div></div><div class="pg"><i id="mpg"></i></div></div>' },
  tap: { title: 'Catch it!', hint: 'Tap fast before it flutters away!', body: '<div class="tapw"><div id="mbug">🦋</div><div class="hbar"><i id="mfill"></i></div><div class="tbar"><i id="mtime"></i></div><div class="taplab">TAP! TAP! TAP!</div></div>' },
  catch: { title: 'Shake the tree!', hint: 'Drag (or use A / D) to move the basket under the fruit.', body: `<canvas id="mcv" width="${MNW}" height="${MNH}"></canvas>` },
  berries: { title: 'Pick the berries!', hint: 'Tap each berry before it drops.', body: `<canvas id="mcv" width="${MNW}" height="${MNH}"></canvas>` },
};

UI.setMini = function (a) {
  const mode = miniMode(a), el = miniEl(); if (!el) return;
  if (mode !== MINI.mode) {
    MINI.mode = mode; MINI.taps.length = 0; MINI.ptr = 0.5; el.classList.toggle('hidden', !mode);
    if (mode) {
      const d = MINI_UI[mode]; $('#mtitle').textContent = d.title; $('#mhint').textContent = d.hint; $('#mbody').innerHTML = d.body;
      const cv = $('#mcv'); if (cv) {
        const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * MNW, (e.clientY - r.top) / r.height * MNH]; };
        cv.addEventListener('pointermove', e => { MINI.ptr = clamp(pos(e)[0] / MNW, 0, 1); });
        cv.addEventListener('pointerdown', e => { e.preventDefault(); const p = pos(e); MINI.ptr = clamp(p[0] / MNW, 0, 1); MINI.taps.push({ x: p[0], y: p[1] }); try { cv.setPointerCapture(e.pointerId); } catch (_) { } });
      }
    }
  }
  if (!mode) return;
  if (mode === 'reel') {
    const z = $('#mzone'), f = $('#mfish'); z.style.bottom = (a.bp - a.bsz / 2) * 100 + '%'; z.style.height = a.bsz * 100 + '%'; z.classList.toggle('hit', a.hit);
    f.style.bottom = a.fp * 100 + '%'; $('#mpg').style.height = clamp(a.p, 0, 1) * 100 + '%';
  } else if (mode === 'tap') {
    $('#mfill').style.width = clamp(a.fill, 0, 1) * 100 + '%'; $('#mtime').style.width = clamp(1 - a.t / a.tl, 0, 1) * 100 + '%';
    const b = $('#mbug'); b.style.transform = `translate(${Math.sin(a.t * 18) * 6}px,${Math.cos(a.t * 11) * 5}px) scale(${1 + (a.flash > 0 ? 0.25 : 0)})`;
  } else {
    const c = $('#mcv').getContext('2d'); c.imageSmoothingEnabled = false;
    mode === 'catch' ? miniDrawCatch(c, a) : miniDrawBerries(c, a);
  }
};
function miniText(c, s, x, y, col, size) { c.font = `bold ${size || 11}px "Pixelify Sans", monospace`; c.lineWidth = 3; c.strokeStyle = 'rgba(15,22,36,.9)'; c.strokeText(s, x, y); c.fillStyle = col || '#f5e9cf'; c.fillText(s, x, y); }
function miniDrawCatch(c, a) {
  c.fillStyle = '#2a4468'; c.fillRect(0, 0, MNW, MNH); c.fillStyle = '#1f3555'; c.fillRect(0, MNH - 22, MNW, 22);
  c.fillStyle = '#3f7d3a'; c.fillRect(0, 0, MNW, 24); c.fillStyle = '#4f9648'; for (let i = 0; i < 11; i++) c.fillRect(i * 19 - 4, 18 + (i % 2) * 4, 18, 12);
  const sway = Math.sin(a.t * 30) * (a.spawned < a.total ? 1.5 : 0);
  for (const f of a.fr) {
    const ic = itemIcon(f.inst ? f.inst.id : a.kind), s = 22;
    if (f.inst) { c.fillStyle = 'rgba(255,235,150,.35)'; c.fillRect(f.x - 14, f.y - 14, 28, 28); }
    c.drawImage(ic, Math.round(f.x - s / 2 + sway), Math.round(f.y - s / 2), s, s);
  }
  const bx = Math.round(a.bx * MNW - 24), by = MNH - 34;
  c.fillStyle = '#6e4624'; c.fillRect(bx + 2, by + 6, 44, 18); c.fillStyle = '#8a5a2e'; for (let i = 0; i < 5; i++) c.fillRect(bx + 4 + i * 9, by + 8, 5, 14);
  c.fillStyle = '#c28a46'; c.fillRect(bx - 2, by, 52, 6); c.fillStyle = '#e0a85c'; c.fillRect(bx - 2, by, 52, 2);
  c.textAlign = 'left'; miniText(c, 'Caught ' + (a.caught + a.bonusCaught) + ' / ' + a.total, 6, MNH - 6);
}
function miniDrawBerries(c, a) {
  c.fillStyle = '#244a2c'; c.fillRect(0, 0, MNW, MNH);
  c.fillStyle = '#2f6038'; for (let i = 0; i < 9; i++) c.fillRect(10 + (i * 53) % 150, 14 + (i * 37) % 170, 46, 40);
  c.fillStyle = '#3b7a45'; for (let i = 0; i < 7; i++) c.fillRect(24 + (i * 71) % 140, 26 + (i * 59) % 160, 28, 22);
  for (const b of a.berries) {
    if (!b.shown || b.done) continue; const left = clamp((b.t0 + b.life - a.t) / b.life, 0, 1), s = 28;
    if (b.inst) { c.fillStyle = 'rgba(255,235,150,.45)'; c.fillRect(b.x - 20, b.y - 20, 40, 40); }
    c.drawImage(itemIcon(b.inst ? b.inst.id : a.kind), Math.round(b.x - s / 2), Math.round(b.y - s / 2), s, s);
    c.fillStyle = 'rgba(15,22,36,.7)'; c.fillRect(b.x - 12, b.y + 16, 24, 4); c.fillStyle = left < 0.35 ? '#e8483a' : '#f2b84b'; c.fillRect(b.x - 12, b.y + 16, Math.round(24 * left), 4);
  }
  c.textAlign = 'left'; miniText(c, 'Picked ' + (a.got + a.bonusGot), 6, MNH - 6);
}
