'use strict';
// Chat (typed text between players) and the "You" panel (name + clothes).
const CHAT = { lines: [], el: null, t: 0 };
CHAT.add = function (who, text) {   // newest lines sit above the chat bar and fade after a while; built with textContent so nothing is parsed as HTML
  const log = document.getElementById('chatlog'); if (!log) return;
  const d = document.createElement('div'); d.className = 'cl px'; const b = document.createElement('b'); b.textContent = who + ': '; d.appendChild(b); d.appendChild(document.createTextNode(text));
  log.appendChild(d); while (log.children.length > 6) log.firstChild.remove();
  setTimeout(() => d.classList.add('out'), 12000); setTimeout(() => d.remove(), 12600);
};
CHAT.isOpen = () => !document.getElementById('chatbar').classList.contains('hidden');
CHAT.open = function () {
  if (UI.isOpen) return; for (const k in keys) keys[k] = false;
  document.getElementById('chatbar').classList.remove('hidden'); setTimeout(() => document.getElementById('chatin').focus(), 0);
};
CHAT.close = function () { const i = document.getElementById('chatin'); i.blur(); i.value = ''; document.getElementById('chatbar').classList.add('hidden'); };
CHAT.toggle = function () { if (CHAT.isOpen()) CHAT.close(); else CHAT.open(); };
CHAT.send = function (raw) {
  const text = String(raw).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80); if (!text) return;
  const t = performance.now(); if (t - CHAT.t < 400) return; CHAT.t = t;
  ME.bubble = text; ME.bt = 6; CHAT.add(S.name, text); NET.chat(text); sfx('pop');
};
document.addEventListener('submit', e => { if (e.target.id !== 'chatbar') return; e.preventDefault(); const i = document.getElementById('chatin'); CHAT.send(i.value); CHAT.close(); });
addEventListener('keydown', e => { if (e.code === 'Escape' && CHAT.isOpen()) CHAT.close(); });

// ---- You: name + clothes --------------------------------------------------
const LOOK_ROLES = [['hair', 'Hair'], ['eyes', 'Eyes'], ['skin', 'Skin'], ['shirt', 'Shirt'], ['jeans', 'Jeans'], ['boots', 'Boots']];
UI.openMe = function (first) {
  const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  UI.me = { dir: 0 };
  const picks = LOOK_ROLES.map(([r, n]) => `<label class="lk">${n}<input type="color" data-role="${r}" value="${HERO.tint[r] || hex(heroRoleColor(r))}"></label>`).join('');
  UI.open('me', `${head(first ? 'Welcome!' : 'You', !first)}
  <div class="crtop"><canvas id="meprev" width="96" height="144" data-act="meturn"></canvas>
  <div class="crform"><label>Name<input id="mename" maxlength="14" value="${esc(S.name)}" autocomplete="off" spellcheck="false"></label><div id="meerr" class="err"></div><div class="looks2">${picks}</div></div></div>
  <div class="foot"><button class="btn small" data-act="mereset">Reset clothes</button></div>
  <button class="btn big" data-act="medone">${first ? 'Let\'s go!' : 'Done'}</button>`);
  document.querySelectorAll('#modal input[data-role]').forEach(inp => inp.addEventListener('input', () => {
    HERO.tint[inp.dataset.role] = inp.value; heroApply(); try { localStorage.setItem('angela.look', JSON.stringify(HERO.tint)); } catch (e) { }
  }));
  clearInterval(UI.crTimer); UI.crTimer = setInterval(UI.meDraw, 160); UI.meDraw();
};
UI.meDraw = function () {
  const c = document.getElementById('meprev'); if (!c) return; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height);
  const f = Math.floor(performance.now() / 220) % 4 + 1, spr = heroSprite(['d', 'l', 'u', 'r'][UI.me.dir], f); g.drawImage(spr.canvas || spr, 0, 0, 96, 144);
};
UI.onClick2 = (function (prev) {
  return function (a, p1, p2, p3) {
    if (a === 'balloon') BAL.set((BAL.n + 1) % 5);
    else if (a === 'meturn') { UI.me.dir = (UI.me.dir + 1) % 4; UI.meDraw(); }
    else if (a === 'mereset') { HERO.tint = {}; heroApply(); try { localStorage.removeItem('angela.look'); } catch (e) { } UI.openMe(!!S.firstMe); }
    else if (a === 'medone') {
      const n = document.getElementById('mename').value.trim(), bad = badName(n);
      if (bad) { document.getElementById('meerr').textContent = bad; return; }
      S.name = n; S.created = true; saveState(); NET.profileSoon(); UI.close();
    } else if (prev) prev(a, p1, p2, p3);
  };
})(UI.onClick2);

// ---- balloon: tap the button to hold one (tap again for the next colour, then none) ------------------
const BAL = { n: 0, cols: [null, ['#e84a4a', '#ff9a8a', '#a82a2a'], ['#4a8ae8', '#9ac4ff', '#2a4fa8'], ['#f0c93a', '#fff0a0', '#b8901a'], ['#4ac46a', '#a0f0b0', '#2a8a44']], cache: {} };
try { BAL.n = Math.max(0, Math.min(4, +localStorage.getItem('angela.balloon') | 0)); } catch (e) { }
function balloonSpr(i) { // 14x18 pixel balloon with a highlight and a knot; the string is drawn separately so it can reach the hand
  if (BAL.cache[i]) return BAL.cache[i]; const [c, hi, lo] = BAL.cols[i], s = mk(14, 18), g = s.g;
  const rows = [[5, 4], [3, 8], [2, 10], [1, 12], [1, 12], [0, 14], [0, 14], [0, 14], [1, 12], [1, 12], [2, 10], [3, 8], [4, 6], [5, 4]];
  rows.forEach((r, y) => { g.fillStyle = c; g.fillRect(r[0], y + 1, r[1], 1); g.fillStyle = lo; g.fillRect(r[0] + r[1] - 2, y + 1, 2, 1); });
  g.fillStyle = hi; g.fillRect(3, 3, 2, 3); g.fillRect(3, 3, 3, 1); g.fillStyle = lo; g.fillRect(6, 15, 2, 2); s.ax = 7; s.ay = 17; return BAL.cache[i] = s;
}
function drawBalloon(g, i, x, y, t) { // (x, y) = the hand; the balloon bobs above and a little to the side
  if (!i || !BAL.cols[i]) return; const sw = Math.round(Math.sin(t * 2) * 1.5), bx = x + 15 + sw, by = y - 26 + Math.round(Math.sin(t * 2.6));
  g.fillStyle = 'rgba(245,240,230,.9)'; for (let k = 0; k <= 10; k++) g.fillRect(Math.round(x + (bx - x) * k / 10), Math.round(y + (by - y) * k / 10), 1, 1);
  g.drawImage(balloonSpr(i), bx - 7, by - 17);
}
BAL.set = function (n) { BAL.n = n; try { localStorage.setItem('angela.balloon', n); } catch (e) { } NET.profileSoon(); const b = document.getElementById('balbtn'); if (b) b.firstChild.src = BAL.icon(); };
BAL.icon = () => { const c = mk(28, 28), i = BAL.n || 1; c.g.globalAlpha = BAL.n ? 1 : 0.55; c.g.drawImage(balloonSpr(i), 0, 0, 14, 18, 2, 0, 24, 28); return c.toDataURL(); };
