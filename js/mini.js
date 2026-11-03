'use strict';
// Pop-up mini game: the brushing bar that appears once you uncover a find (hold to lift the bar, keep it on the relic).
// Game state lives in the current activity object A (see game.js); this file builds the small pop-up and updates it.
const MINI = { mode: null };

function miniMode(a) { return a && a.k === 'fish' && a.ph === 'reel' ? 'reel' : null; }
const MINI_UI = {
  reel: { title: 'Uncovered!', hint: 'Hold to brush', body: '<div class="reelw"><div class="trk"><div id="mzone"></div><div id="mfish">🏺</div></div><div class="pg"><i id="mpg"></i></div></div>' },
};

UI.setMini = function (a) {
  const mode = miniMode(a), el = $('#mini'); if (!el) return;
  if (mode !== MINI.mode) {
    MINI.mode = mode; el.classList.toggle('hidden', !mode);
    if (mode) { const d = MINI_UI[mode]; $('#mtitle').textContent = d.title; $('#mhint').textContent = d.hint; $('#mbody').innerHTML = d.body; }
  }
  if (!mode) return;
  const z = $('#mzone'), f = $('#mfish'); z.style.bottom = (a.bp - a.bsz / 2) * 100 + '%'; z.style.height = a.bsz * 100 + '%'; z.classList.toggle('hit', a.hit);
  f.style.bottom = a.fp * 100 + '%'; $('#mpg').style.height = clamp(a.p, 0, 1) * 100 + '%';
};
