'use strict';
const UI = { isOpen: false, cur: null, cr: null, crTimer: 0, hintTxt: '', actIcon: null, revealT: 0, toastQ: [] };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EMOTES = ['👋', '❤️', '😄', '❓', '⛏️', '✨'];

UI.init = function () {
  $('#act').insertAdjacentHTML('afterbegin', '<img id="acticon" alt="">');
  $('#menu').innerHTML = [['book', 'Book'], ['bag', 'Bag'], ['chat', 'Emote']].map(m =>
    `<button class="mbtn px" data-act="open:${m[0]}" aria-label="${m[1]}"><img src="${actURL(m[0])}" alt=""><i id="badge-${m[0]}"></i></button>`).join('');
  $('#emotes').innerHTML = EMOTES.map(e => `<button data-act="emote:${e}">${e}</button>`).join('');
  $('#coinimg').src = actURL('coin');
  document.addEventListener('click', UI.onClick);
  addEventListener('keydown', e => { if (e.code === 'Escape' && UI.isOpen && UI.cur !== 'creator') UI.close(); });
  document.body.classList.toggle('lefty', !!S.lefty);
  UI.refresh();
};

UI.refresh = function () {
  $('#gold').textContent = S.gold; $('#lv').textContent = S.lv;
  $('#xpfill').style.width = clamp(S.xp / needXP(S.lv), 0, 1) * 100 + '%';
  const b = $('#badge-bag'); b.textContent = bagCount() >= bagCap() ? 'FULL' : bagCount() + '/' + bagCap(); b.className = bagCount() >= bagCap() ? 'full' : '';
  const R = { dealer: () => UI.renderDealer() }; if (R[UI.cur]) R[UI.cur]();
  saveState();
};

UI.setHint = function (t) { if (t === UI.hintTxt) return; UI.hintTxt = t; const h = $('#hint'); h.textContent = t; h.classList.toggle('show', !!t); };
UI.toast = function (t, cls) {
  const d = document.createElement('div'); d.className = 'toast px ' + (cls || ''); d.textContent = t; $('#toasts').appendChild(d);
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

UI.reveal = function (list, meta) {
  meta = meta || {};
  const groups = []; list.forEach(i => { const g = groups.find(x => x.id === i.id); if (g) { g.n++; g.val += i.val; g.isNew = g.isNew || i.isNew; } else groups.push({ id: i.id, n: 1, val: i.val, inst: i, isNew: i.isNew }); });
  groups.sort((a, b) => ITEM[b.id].r - ITEM[a.id].r);
  const m = groups[0], it = ITEM[m.id], rar = RAR[it.r];
  const tags = []; if (m.isNew) tags.push('<em class="new">NEW!</em>'); if (m.inst.isBest) tags.push('<em class="best">BEST SIZE!</em>'); else if (m.inst.big) tags.push('<em class="big">BIG!</em>');
  const sz = fmtSz(m.inst);
  const extra = groups.slice(1).map(g => `<span class="ex"><img src="${itemURL(g.id)}" alt="">${g.n > 1 ? '×' + g.n : ''}</span>`).join('');
  const el = $('#reveal');
  el.innerHTML = `<div class="rv px r${it.r}" style="--rc:${rar.c}"><div class="tags">${tags.join('')}</div><img class="ic" src="${itemURL(m.id)}" alt=""><div class="nm">${esc(it.name)}${m.n > 1 ? ' ×' + m.n : ''}</div><div class="mt">${sz ? sz + ' · ' : ''}<span style="color:${rar.c}">${rar.n}</span></div><div class="vl">worth ${m.val}g</div>${extra ? '<div class="exs">' + extra + '</div>' : ''}${meta.full ? '<div class="full">Bag full: some items left behind</div>' : ''}</div>`;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); el.style.pointerEvents = 'auto';
  clearTimeout(UI.revealT); UI.revealT = setTimeout(UI.hideReveal, it.r >= 2 ? 3200 : 2400);
};
UI.hideReveal = function () { const el = $('#reveal'); el.classList.remove('go'); el.style.pointerEvents = 'none'; };

// ---- modal plumbing -------------------------------------------------------
UI.open = function (type, html) {
  UI.cur = type; UI.isOpen = true; const m = $('#modal'); m.innerHTML = `<div class="sheet px" data-type="${type}">${html}</div>`; m.classList.remove('hidden');
  $('#emotes').classList.add('hidden');
};
UI.close = function () {
  if (!UI.isOpen) return; clearInterval(UI.crTimer); UI.isOpen = false; UI.cur = null; $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; saveState();
};
const head = (t, x) => `<div class="mh"><h2>${t}</h2>${x === false ? '' : '<button class="x" data-act="close" aria-label="Close">✕</button>'}</div>`;
const gemImg = `<img class="gem" src="${actURL('gem')}" alt="">`;

UI.onClick = function (e) {
  const b = e.target.closest('[data-act]'); if (!b) { if (e.target.id === 'modal' && UI.cur !== 'creator') UI.close(); return; }
  const [a, p1, p2, p3] = b.dataset.act.split(':'); sfx('ui');
  switch (a) {
    case 'x': UI.hideReveal(); break;
    case 'close': UI.close(); break;
    case 'open': if (p1 === 'chat') { $('#emotes').classList.toggle('hidden'); } else UI['open' + p1[0].toUpperCase() + p1.slice(1)](); break;
    case 'emote': doEmote(p1); $('#emotes').classList.add('hidden'); break;
    case 'bookcat': UI.renderBook(p1); break;
    case 'bookitem': UI.bookDetail(p1); break;
    case 'snd': S.sound = !S.sound; if (S.sound) audioInit(); UI.openBag(); break;
    case 'fx': S.fx = S.fx === false; UI.openBag(); break;
    case 'lefty': S.lefty = !S.lefty; document.body.classList.toggle('lefty', S.lefty); UI.openBag(); break;
    case 'editlook': UI.openMe(false); break;
    case 'meturn': UI.me.dir = (UI.me.dir + 1) % 4; UI.meDraw(); break;
    case 'merand': Object.assign(HERO.tint, randLook()); heroApply(); UI.meSync(); break;
    case 'mereset': for (const k in HERO.tint) delete HERO.tint[k]; heroApply(); UI.meSync(); break;
    case 'medone': UI.meDone(); break;
    default: if (UI.onClick2) UI.onClick2(a, p1, p2, p3);
  }
};

// ---- bag ------------------------------------------------------------------
function grouped(f) { const g = {}; S.bag.filter(i => !f || f(i)).forEach(i => { (g[i.id] = g[i.id] || { id: i.id, n: 0, val: 0 }); g[i.id].n++; g[i.id].val += i.val; }); return Object.values(g).sort((a, b) => ITEM[b.id].r - ITEM[a.id].r || b.val - a.val); }
UI.openBag = function () {
  const g = grouped(), tot = S.bag.reduce((s, i) => s + i.val, 0);
  const cells = g.length ? g.map(x => `<button class="cell r${ITEM[x.id].r}" data-act="show:${x.id}"><img src="${itemURL(x.id)}" alt=""><b>${x.n > 1 ? '×' + x.n : ''}</b><span>${esc(ITEM[x.id].name)}</span></button>`).join('') : '<p class="empty">Nothing yet. Find a dig site and start digging!</p>';
  UI.open('bag', `${head('Bag')}<div class="capbar"><i style="width:${bagCount() / bagCap() * 100}%"></i><span>${bagCount()} / ${bagCap()} · worth ${tot}g</span></div><div class="grid">${cells}</div>
  <p class="note">Tap an item to show it off. Sell your finds at the Antiquities Dealer.</p>
  <div class="foot"><button class="btn small" data-act="editlook">Edit look</button><button class="btn small" data-act="snd">Sound: ${S.sound ? 'On' : 'Off'}</button><button class="btn small" data-act="lefty">Left-handed: ${S.lefty ? 'On' : 'Off'}</button><button class="btn small" data-act="fx">Effects: ${S.fx === false ? 'Off' : 'On'}</button></div>`);
};

// ---- book -----------------------------------------------------------------
UI.openBook = function () { UI.renderBook('fish'); };
UI.renderBook = function (cat) {
  const items = ITEMS.filter(i => i.cat === cat), found = items.filter(i => S.book[i.id]).length;
  const tabs = CATS.map(c => { const n = ITEMS.filter(i => i.cat === c.id), f = n.filter(i => S.book[i.id]).length; return `<button class="tab ${c.id === cat ? 'on' : ''}" data-act="bookcat:${c.id}">${c.n}<small>${f}/${n.length}</small></button>`; }).join('');
  const cells = items.map(i => { const b = S.book[i.id]; return `<button class="cell bk ${b ? 'r' + i.r : 'unk'}" data-act="bookitem:${i.id}"><img src="${itemURL(i.id)}" alt=""><span>${b ? esc(i.name) : '???'}</span></button>`; }).join('');
  UI.open('book', `${head('Collection Book')}<div class="tabs">${tabs}</div><div class="grid g4">${cells}</div><div id="bookdetail" class="detail"><p class="empty">${found}/${items.length} found. Tap an entry for details.</p></div>`);
  UI.bookCat = cat;
};
UI.bookDetail = function (id) {
  const it = ITEM[id], b = S.book[id], r = RAR[it.r];
  $('#bookdetail').innerHTML = b ? `<img src="${itemURL(id)}" alt=""><div><h3 style="color:${r.c}">${esc(it.name)} <small>${r.n}</small></h3><p>${esc(it.desc)}</p><p class="mut">Found ${b.n}× · ${it.sz ? 'best ' + (b.best >= 10 ? Math.round(b.best) : b.best) + ' cm · ' : ''}base ${it.v}g</p><p class="mut">${whereText(it)}</p></div>`
    : `<img class="sil" src="${itemURL(id)}" alt=""><div><h3>???</h3><p class="mut">Hint: ${whereText(it)}</p></div>`;
};

// ---- the player: name + clothes (colour pickers recolour the UV-skinned hero) -------------------------------
UI.openMe = function (first) {
  const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); UI.me = { dir: 0, first: !!first };
  const picks = LOOK_ROLES.filter(r => (HERO.roles[r[0]] || []).length).map(([r, n]) => `<label class="lk">${n}<input type="color" data-role="${r}" value="${HERO.tint[r] || hex(heroRoleColor(r))}"></label>`).join('');
  UI.open('creator', `${head(first ? 'Make it yours' : 'Your look', !first)}${first ? '<p class="note">You are getting the hang of this! Pick a name and some clothes. You can change them later.</p>' : ''}
  <div class="crtop"><canvas id="meprev" width="96" height="144" data-act="meturn"></canvas>
  <div class="crform"><label>Name<input id="mename" maxlength="14" value="${esc(S.name)}" autocomplete="off" spellcheck="false"></label><div id="meerr" class="err"></div><div class="looks2">${picks}</div></div></div>
  <div class="foot"><button class="btn small" data-act="merand">Randomize</button><button class="btn small" data-act="mereset">Reset clothes</button></div>
  <button class="btn big" data-act="medone">${first ? 'Looks good!' : 'Save'}</button>`);
  document.querySelectorAll('#modal input[data-role]').forEach(inp => inp.addEventListener('input', () => { HERO.tint[inp.dataset.role] = inp.value; heroApply(); }));
  clearInterval(UI.crTimer); UI.crTimer = setInterval(UI.meDraw, 160); UI.meDraw();
};
UI.meDraw = function () {
  const c = $('#meprev'); if (!c) return; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height);
  const f = Math.floor(Date.now() / 160) % 4 + 1, spr = heroSprite([0, 2, 4, 6][UI.me.dir], f); g.drawImage(spr, 0, 0, 96, 144);
};
UI.meSync = function () { document.querySelectorAll('#modal input[data-role]').forEach(i => { i.value = HERO.tint[i.dataset.role] || '#' + heroRoleColor(i.dataset.role).map(v => v.toString(16).padStart(2, '0')).join(''); }); UI.meDraw(); };
UI.meDone = function () {
  const n = $('#mename').value.trim(), err = badName(n); if (err) { $('#meerr').textContent = err; sfx('no'); return; }
  S.name = n; S.created = true; UI.close(); sfx('level'); UI.toast('Welcome, ' + n + '!', 'gold'); UI.refresh();
};
