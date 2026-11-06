'use strict';
const UI = { isOpen: false, cur: null, cr: null, crTimer: 0, hintTxt: '', actIcon: null, revealT: 0, toastQ: [] };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EMOTES = ['👋', '❤️', '😄', '❓', '⛏️', '✨'];

UI.init = function () {
  $('#act').insertAdjacentHTML('afterbegin', '<img id="acticon" alt="">');
  $('#menu').innerHTML = [['me', 'You', 'wave'], ['chat', 'Chat', 'chat']].map(m =>
    `<button class="mbtn px" data-act="open:${m[0]}" aria-label="${m[1]}"><img src="${actURL(m[2])}" alt=""></button>`).join('') + `<button id="balbtn" class="mbtn px" data-act="balloon" aria-label="Balloon"><img src="${BAL.icon()}" alt=""></button>`;
  document.addEventListener('click', UI.onClick);
  addEventListener('keydown', e => { if (e.code === 'Escape' && UI.isOpen && UI.cur !== 'creator') UI.close(); });
  document.body.classList.toggle('lefty', !!S.lefty);
  UI.refresh();
};

UI.refresh = function () {
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
    case 'open': if (p1 === 'chat') CHAT.toggle(); else UI['open' + p1[0].toUpperCase() + p1.slice(1)](); break;
    case 'bookcat': UI.renderBook(p1); break;
    case 'bookitem': UI.bookDetail(p1); break;
    case 'snd': S.sound = !S.sound; if (S.sound) audioInit(); UI.openBag(); break;
    case 'fx': S.fx = S.fx === false; UI.openBag(); break;
    case 'lefty': S.lefty = !S.lefty; document.body.classList.toggle('lefty', S.lefty); UI.openBag(); break;
    case 'editlook': UI.openCreator(false); break;
    case 'cr': UI.crSet(p1, p2); break;
    case 'crrand': UI.cr.look = randLook(); UI.crDraw(); UI.crRefreshChips(); break;
    case 'crdone': UI.crDone(); break;
    case 'crturn': UI.crDir = (UI.crDir + 1) % 8; break;
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

function charURL(look) { return dataURL(charSprite(look, 0, 1), 'c' + JSON.stringify(look)); }

// ---- character creator ----------------------------------------------------
UI.openCreator = function (first) {
  UI.cr = { look: Object.assign({}, S.look), name: first ? S.name : S.name, first: !!first }; UI.crDir = 0;
  const L = UI.cr.look;
  const sw = (key, arr) => arr.map((c, i) => `<button class="sw ${L[key] === i ? 'on' : ''}" data-key="${key}" data-i="${i}" data-act="cr:${key}:${i}" style="background:${c}"></button>`).join('');
  const ch = (key, arr) => arr.map((n, i) => `<button class="chip ${L[key] === i ? 'on' : ''}" data-key="${key}" data-i="${i}" data-act="cr:${key}:${i}">${n}</button>`).join('');
  UI.open('creator', `${head(first ? 'Make it yours' : 'Your look', !first)}${first ? '<p class="note">You are getting the hang of this! Pick a name and a look. You can change it later.</p>' : ''}
  <div class="crtop"><canvas id="crprev" width="96" height="120" data-act="crturn"></canvas>
  <div class="crform"><label>Name<input id="crname" maxlength="14" value="${esc(UI.cr.name)}" autocomplete="off" spellcheck="false"></label><div id="crerr" class="err"></div><button class="btn small" data-act="crrand">Randomize</button></div></div>
  <div class="crrows"><div><small>Hair</small><div class="chips">${ch('hair', HAIRS)}</div></div>
  <div><small>Hair color</small><div class="sws">${sw('hc', HAIRC)}</div></div><div><small>Skin</small><div class="sws">${sw('skin', SKIN)}</div></div><div><small>Top color</small><div class="sws">${sw('shirt', SHIRTC)}</div></div><div><small>Pants</small><div class="sws">${sw('pc', PANTSC)}</div></div></div>
  <button class="btn big" data-act="crdone">${first ? 'Looks good!' : 'Save'}</button>`);
  UI.crDraw(); clearInterval(UI.crTimer); UI.crTimer = setInterval(UI.crDraw, 160);
};
UI.crRefreshChips = function () { document.querySelectorAll('#modal [data-key]').forEach(el => el.classList.toggle('on', UI.cr.look[el.dataset.key] === +el.dataset.i)); };
UI.crSet = function (key, i) { UI.cr.look[key] = +i; UI.crRefreshChips(); UI.crDraw(); };
UI.crDraw = function () {
  const cvp = $('#crprev'); if (!cvp) return; const g = cvp.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, cvp.width, cvp.height);
  const walk = Math.floor(Date.now() / 150) % 4, s = charSprite(UI.cr.look, UI.crDir % 8, walk);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(48, 114, 22, 6, 0, 0, 7); g.fill();
  g.drawImage(s, 48 - s.ax * 3, 115 - s.ay * 3, s.width * 3, s.height * 3);
};
UI.crDone = function () {
  const n = $('#crname').value.trim(), err = badName(n); if (err) { $('#crerr').textContent = err; sfx('no'); return; }
  S.name = n; S.look = Object.assign({}, UI.cr.look); S.created = true; UI.close(); sfx('level'); UI.toast('Welcome, ' + n + '!', 'gold'); UI.refresh();
};
