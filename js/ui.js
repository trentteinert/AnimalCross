'use strict';
const UI = { isOpen: false, cur: null, cr: null, crTimer: 0, hintTxt: '', actIcon: null, toastQ: [] };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

UI.init = function () {
  $('#act').insertAdjacentHTML('afterbegin', '<img id="acticon" alt="">');
  $('#menu').innerHTML = [['book', 'Collection', 'book'], ['gear', 'Gear', 'bag'], ['me', 'You', 'wave']].map(m =>
    `<button class="mbtn px fm" data-act="open:${m[0]}" aria-label="${m[1]}"><img src="${actURL(m[2])}" alt=""></button>`).join('');
  document.addEventListener('click', UI.onClick);
  addEventListener('keydown', e => { if (e.code === 'Escape' && UI.isOpen && UI.cur !== 'creator') UI.close(); });
  document.body.classList.toggle('lefty', !!S.lefty);
  UI.refresh();
};

UI.refresh = function () {
  const m = $('#mats'); if (m) m.innerHTML = UI.matsHTML();
  if (UI.cur === 'camp') UI.renderCamp();
  saveState();
};

UI.setHint = function (t) { if (t === UI.hintTxt) return; UI.hintTxt = t; const h = $('#hint'); h.textContent = t; h.classList.toggle('show', !!t); };
UI.toast = function (t, cls) {
  const d = document.createElement('div'); d.className = 'toast px fs ' + (cls || ''); d.textContent = t; $('#toasts').appendChild(d);
  setTimeout(() => d.classList.add('out'), 1800); setTimeout(() => d.remove(), 2300);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
};
UI.banner = function (t, sub) {
  const el = $('#banner'); el.innerHTML = `<b>${esc(t)}</b><span>${esc(sub || '')}</span>`; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
};
UI.setAct = function (icon, prog, alert) {
  const a = $('#act');
  if (icon !== UI.actIcon) { UI.actIcon = icon; if (icon) $('#acticon').src = actURL(icon); a.classList.toggle('show', !!icon); }
  $('#actbar').style.width = clamp(prog || 0, 0, 1) * 100 + '%'; a.classList.toggle('prog', prog != null && prog > 0); a.classList.toggle('alert', !!alert);
};

// ---- modal plumbing -------------------------------------------------------
UI.open = function (type, html) {
  UI.cur = type; UI.isOpen = true; const m = $('#modal'); m.innerHTML = `<div class="sheet px" data-type="${type}">${html}</div>`; m.classList.remove('hidden');
};
UI.close = function () {
  if (!UI.isOpen) return; clearInterval(UI.crTimer); UI.isOpen = false; UI.cur = null; $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; saveState();
};
const head = (t, x) => `<div class="mh"><h2>${t}</h2>${x === false ? '' : '<button class="x" data-act="close" aria-label="Close">✕</button>'}</div>`;

UI.onClick = function (e) {
  const b = e.target.closest('[data-act]'); if (!b) { if (e.target.id === 'modal' && UI.cur !== 'creator') UI.close(); return; }
  const [a, p1, p2, p3] = b.dataset.act.split(':'); sfx('ui');
  switch (a) {
    case 'close': UI.close(); break;
    case 'open': UI['open' + p1[0].toUpperCase() + p1.slice(1)](p1 === 'me' ? false : undefined); break;
    case 'snd': S.sound = !S.sound; if (S.sound) audioInit(); UI.openGear(); break;
    case 'mehair': { const n = $('#mename').value; HERO.tint.hairStyle = p1; heroApply(); UI.openMe(UI.me.first); $('#mename').value = n; break; }
    case 'meturn': UI.me.dir = (UI.me.dir + 1) % 4; UI.meDraw(); break;
    case 'merand': Object.assign(HERO.tint, randLook()); heroApply(); UI.meSync(); break;
    case 'mereset': for (const k in HERO.tint) delete HERO.tint[k]; heroApply(); UI.meSync(); break;
    case 'medone': UI.meDone(); break;
    default: if (UI.onClick2) UI.onClick2(a, p1, p2, p3);
  }
};

UI.openMe = function (first) {
  const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); UI.me = { dir: 0, first: !!first };
  const hs = HERO.tint.hairStyle || HAIR_STYLES[0], hh = HERO.hair[hs], picks = LOOK_ROLES.filter(r => r[0] === 'hair' ? hs !== 'none' && hh : (HERO.roles[r[0]] || []).length).map(([r, n]) => `<label class="lk">${n}<input type="color" data-role="${r}" value="${HERO.tint[r] || (r === 'hair' ? hex(hh.main) : hex(heroRoleColor(r)))}"></label>`).join('');
  UI.open('creator', `${head(first ? 'Make it yours' : 'Your look', !first)}${first ? '<p class="note">You are getting the hang of this! Pick a name and some clothes. You can change them later.</p>' : ''}
  <div class="crtop"><canvas id="meprev" width="96" height="144" data-act="meturn"></canvas>
  <div class="crform"><label>Name<input id="mename" maxlength="14" value="${esc(S.name)}" autocomplete="off" spellcheck="false"></label><div id="meerr" class="err"></div><div class="looks2">${picks}</div></div></div>
  <div class="chips" style="margin:6px 0"><small style="color:var(--muted);align-self:center">Hair</small>${["none", ...HAIR_STYLES].map(id => `<button class="chip ${hs === id ? "on" : ""}" data-act="mehair:${id}">${id === "none" ? "Bald" : id[0].toUpperCase() + id.slice(1)}</button>`).join("")}</div>
  <div class="foot"><button class="btn small" data-act="merand">Randomize</button><button class="btn small" data-act="mereset">Reset clothes</button></div>
  <button class="btn big" data-act="medone">${first ? 'Looks good!' : 'Save'}</button>`);
  document.querySelectorAll('#modal input[data-role]').forEach(inp => inp.addEventListener('input', () => { HERO.tint[inp.dataset.role] = inp.value; heroApply(); }));
  clearInterval(UI.crTimer); UI.crTimer = setInterval(UI.meDraw, 160); UI.meDraw();
};
UI.meDraw = function () {
  const c = $('#meprev'); if (!c) return; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height);
  const f = Math.floor(Date.now() / 160) % 4 + 1, spr = heroSprite([0, 2, 4, 6][UI.me.dir], f); g.drawImage(spr, 0, 0, 96, 144);
};
UI.meSync = function () { const n = $('#mename').value; UI.openMe(UI.me.first); $('#mename').value = n; };
UI.meDone = function () {
  const n = $('#mename').value.trim(), err = badName(n); if (err) { $('#meerr').textContent = err; sfx('no'); return; }
  S.name = n; S.created = true; UI.close(); sfx('level'); UI.toast('Welcome, ' + n + '!', 'gold'); UI.refresh();
};
