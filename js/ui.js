'use strict';
const UI = { isOpen: false, cur: null, cr: null, crTimer: 0, hintTxt: '', actIcon: null, revealT: 0, toastQ: [] };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EMOTES = ['👋', '❤️', '😄', '❓', '🎣', '✨'];

UI.init = function () {
  $('#act').insertAdjacentHTML('afterbegin', '<img id="acticon" alt="">');
  $('#menu').innerHTML = [['book', 'Book'], ['bag', 'Bag'], ['shop', 'Market'], ['chat', 'Emote']].map(m =>
    `<button class="mbtn px" data-act="open:${m[0]}" aria-label="${m[1]}"><img src="${actURL(m[0] === 'shop' ? 'stall' : m[0])}" alt=""><i id="badge-${m[0]}"></i></button>`).join('');
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
  const q = curQuest(); $('#qtxt').textContent = q.txt; $('#qprog').textContent = q.need > 1 ? S.qprog + '/' + q.need : '';
  const b = $('#badge-bag'); b.textContent = bagCount() >= bagCap() ? 'FULL' : bagCount() + '/' + bagCap(); b.className = bagCount() >= bagCap() ? 'full' : '';
  const R = { market: () => UI.renderMarket(UI.tab), tackle: () => UI.renderTackle(), tank: () => UI.renderTank(), leaders: () => UI.renderLeaders(), gems: () => UI.renderGems(), outfits: () => UI.renderOutfits() }; if (R[UI.cur]) R[UI.cur]();
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
UI.note = function (txt, i, n, first) {
  const el = $('#note'); el.innerHTML = `<small>Note ${i + 1} of ${n}${first ? ' · new' : ''}</small><p>${esc(txt)}</p><em>tap to close</em>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(UI.noteT); UI.noteT = setTimeout(UI.hideNote, 14000);
};
UI.hideNote = function () { const el = $('#note'); if (el) el.classList.remove('show'); };
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
    case 'hidenote': UI.hideNote(); break;
    case 'close': UI.close(); break;
    case 'open': if (p1 === 'chat') { $('#emotes').classList.toggle('hidden'); } else (UI['open' + p1[0].toUpperCase() + p1.slice(1)] || UI.openMarket)(); break;
    case 'emote': doEmote(p1); $('#emotes').classList.add('hidden'); break;
    case 'tab': UI.renderMarket(p1); break;
    case 'sell': sellAll(); break;
    case 'buy': buyTool(p1); break;
    case 'buyhat': buyCosm('hat', +p1); break;
    case 'buystyle': buyCosm('style', +p1); break;
    case 'prem': UI.toast('Premium shop opens soon', 'info'); break;
    case 'bookcat': UI.renderBook(p1); break;
    case 'bookitem': UI.bookDetail(p1); break;
    case 'snd': S.sound = !S.sound; if (S.sound) audioInit(); UI.openBag(); break;
    case 'fx': S.fx = S.fx === false; UI.openBag(); break;
    case 'lefty': S.lefty = !S.lefty; document.body.classList.toggle('lefty', S.lefty); UI.openBag(); break;
    case 'cr': UI.crSet(p1, p2); break;
    case 'crrand': UI.cr.look = randLook(); UI.crDraw(); UI.crRefreshChips(); break;
    case 'crdone': UI.crDone(); break;
    case 'crturn': UI.crDir = (UI.crDir + 1) % 8; break;
    case 'editlook': UI.openCreator(false); break;
    default: if (UI.onClick2) UI.onClick2(a, p1, p2, p3);
  }
};

// ---- bag ------------------------------------------------------------------
function grouped(f) { const g = {}; S.bag.filter(i => !f || f(i)).forEach(i => { (g[i.id] = g[i.id] || { id: i.id, n: 0, val: 0 }); g[i.id].n++; g[i.id].val += i.val; }); return Object.values(g).sort((a, b) => ITEM[b.id].r - ITEM[a.id].r || b.val - a.val); }
UI.openBag = function () {
  const g = grouped(), tot = S.bag.reduce((s, i) => s + i.val, 0);
  const cells = g.length ? g.map(x => `<button class="cell r${ITEM[x.id].r}" data-act="show:${x.id}"><img src="${itemURL(x.id)}" alt=""><b>${x.n > 1 ? '×' + x.n : ''}</b><span>${esc(ITEM[x.id].name)}</span></button>`).join('') : '<p class="empty">Nothing yet. Fish, shake a tree, net a butterfly or dig the beach!</p>';
  UI.open('bag', `${head('Bag')}<div class="capbar"><i style="width:${bagCount() / bagCap() * 100}%"></i><span>${bagCount()} / ${bagCap()} · worth ${tot}g</span></div><div class="grid">${cells}</div>
  <p class="note">Tap an item to show it off. Fish sell at the Fishing Shop, everything else at the General Market.</p>
  <div class="foot"><button class="btn small" data-act="snd">Sound: ${S.sound ? 'On' : 'Off'}</button><button class="btn small" data-act="lefty">Left-handed: ${S.lefty ? 'On' : 'Off'}</button><button class="btn small" data-act="fx">Effects: ${S.fx === false ? 'Off' : 'On'}</button></div>`);
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
  $('#bookdetail').innerHTML = b ? `<img src="${itemURL(id)}" alt=""><div><h3 style="color:${r.c}">${esc(it.name)} <small>${r.n}</small></h3><p>${esc(it.desc)}</p><p class="mut">Caught ${b.n}× · ${it.sz ? 'best ' + (b.best >= 10 ? Math.round(b.best) : b.best) + ' cm · ' : ''}base ${it.v}g</p><p class="mut">${whereText(it)}</p></div>`
    : `<img class="sil" src="${itemURL(id)}" alt=""><div><h3>???</h3><p class="mut">Hint: ${whereText(it)}</p></div>`;
};

// ---- market ---------------------------------------------------------------
UI.openMarket = function () { UI.tab = 'sell'; UI.open('market', '<div id="mk"></div>'); UI.cur = 'market'; UI.renderMarket('sell'); sfx('coin'); };
UI.renderMarket = function (tab) {
  UI.tab = tab; const host = $('#mk'); if (!host) return;
  const tabs = ['sell', 'upgrades', 'outfits'].map(t => `<button class="tab ${t === tab ? 'on' : ''}" data-act="tab:${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('');
  let body = '';
  if (tab === 'sell') {
    const g = grouped(i => !isFish(i)), tot = S.bag.filter(i => !isFish(i)).reduce((s, i) => s + i.val, 0);
    body = g.length ? `<div class="list">${g.map(x => `<div class="row"><img src="${itemURL(x.id)}" alt=""><div><b>${esc(ITEM[x.id].name)}</b><small>×${x.n}</small></div><span class="gold">${x.val}g</span></div>`).join('')}</div><button class="btn big" data-act="sell">Sell everything · +${tot}g</button>`
      : '<p class="empty">Nothing to sell here. Fish sell at the Fishing Shop.</p>';
  } else if (tab === 'upgrades') {
    body = '<div class="list">' + ['net', 'shovel'].map(k => {
      const lv = S.tools[k], cur = TOOLS[k][lv], nx = TOOLS[k][lv + 1];
      return `<div class="row"><div class="grow"><b>${TOOL_LABEL[k]}</b><small>${cur.n}: ${cur.d}</small>${nx ? `<small class="nx">Next: ${nx.n}: ${nx.d}</small>` : '<small class="nx">Maxed out</small>'}</div>${nx ? `<button class="btn small ${S.lv < nx.lv ? 'lock' : S.gold >= nx.cost ? '' : 'dis'}" data-act="buy:${k}">${S.lv < nx.lv ? 'Lv ' + nx.lv : nx.cost + 'g'}</button>` : '<span class="max">MAX</span>'}</div>`;
    }).join('') + '</div>';
  } else {
    const prev = l => `<img class="pv" src="${charURL(l)}" alt="">`;
    const hats = HATS.map(h => { const own = S.owned.hat.includes(h.id), on = S.look.hat === h.id; return `<div class="row">${prev(Object.assign({}, S.look, { hat: h.id }))}<div class="grow"><b>${h.n}</b></div>${own ? `<button class="btn small ${on ? 'on' : ''}" data-act="buyhat:${h.id}">${on ? 'Worn' : 'Wear'}</button>` : `<button class="btn small ${S.gold >= h.cost ? '' : 'dis'}" data-act="buyhat:${h.id}">${h.cost}g</button>`}</div>`; }).join('');
    const sts = STYLES.map(h => { const own = S.owned.style.includes(h.id), on = S.look.style === h.id; return `<div class="row">${prev(Object.assign({}, S.look, { style: h.id }))}<div class="grow"><b>${h.n}</b></div>${own ? `<button class="btn small ${on ? 'on' : ''}" data-act="buystyle:${h.id}">${on ? 'Worn' : 'Wear'}</button>` : `<button class="btn small ${S.gold >= h.cost ? '' : 'dis'}" data-act="buystyle:${h.id}">${h.cost}g</button>`}</div>`; }).join('');
    const prem = PREMIUM.map(p => `<div class="row prem"><span class="sw" style="background:${p.col}"></span><div class="grow"><b>${p.n}</b><small>Premium · coming soon</small></div><button class="btn small gemb" data-act="prem">${gemImg}${p.gem}</button></div>`).join('');
    body = `<h4>Hats</h4><div class="list">${hats}</div><h4>Tops</h4><div class="list">${sts}</div><button class="btn small" data-act="editlook">Edit name and look</button><h4>Premium (preview)</h4><div class="list">${prem}</div>`;
  }
  host.innerHTML = `${head('General Market')}<div class="wallet"><img src="${actURL('coin')}" alt=""><b>${S.gold}g</b></div><div class="tabs">${tabs}</div><div class="mbody">${body}</div>`;
};
function charURL(look) { return dataURL(charSprite(look, 0, 1), 'c' + JSON.stringify(look)); }
function sellAll() {
  const sell = S.bag.filter(i => !isFish(i)); if (!sell.length) return; const tot = sell.reduce((s, i) => s + i.val, 0), n = sell.length;
  S.gold += tot; S.stats.earned += tot; S.bag = S.bag.filter(isFish); sfx('coin'); UI.toast(`Sold ${n} item${n > 1 ? 's' : ''} for ${tot}g`, 'gold'); questEvent('sell', 1); UI.refresh();
}
function buyTool(k) {
  const lv = S.tools[k], nx = TOOLS[k][lv + 1]; if (!nx) return;
  if (S.lv < nx.lv) { UI.toast('Reach level ' + nx.lv + ' first', 'info'); sfx('no'); return; }
  if (S.gold < nx.cost) { UI.toast('Not enough gold yet', 'info'); sfx('no'); return; }
  S.gold -= nx.cost; S.tools[k]++; sfx('level'); UI.toast(nx.n + ' unlocked!', 'gold'); UI.refresh();
}
function buyCosm(kind, id) {
  const list = kind === 'hat' ? HATS : STYLES, own = S.owned[kind], it = list.find(x => x.id === id);
  if (!own.includes(id)) { if (S.gold < it.cost) { UI.toast('Not enough gold yet', 'info'); sfx('no'); return; } S.gold -= it.cost; own.push(id); sfx('coin'); }
  S.look[kind] = id; if (kind === 'hat') S.look.hatc = null; else S.look.topc = null; UI.refresh();
}

// ---- notice board ---------------------------------------------------------
UI.openBoard = function () {
  const q = curQuest();
  const rows = ONB.map((o, i) => `<div class="row"><span class="chk ${i < S.quest ? 'done' : ''}">${i < S.quest ? '✓' : ''}</span><div class="grow"><b>${o.txt}</b></div></div>`).join('');
  UI.open('board', `${head('Notice Board')}<p class="note">Island goals. Finish them for gold and xp.</p><div class="list">${rows}</div><p class="note">Now: <b>${esc(q.txt)}</b>${q.need > 1 ? ' (' + S.qprog + '/' + q.need + ')' : ''}</p><p class="note">Tip notes found: <b>${S.notes.length}/${W.notes.length}</b>. Look for little signs along the paths.</p><p class="note mut">Coming soon: crew catches, weekly events and the island museum.</p>`);
};

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
