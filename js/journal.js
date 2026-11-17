// ---- the journal: one book for the collection log, bag, community, tasks and settings -----------------------------------------------------------------
// The art is a 256x160 open book (assets/ui/journal/*.png, cut by tools/journal_export.py). Every piece is placed in book units and scaled by one number, --u (screen pixels
// per art pixel), so it fits any screen. All text is real text on top of the art. Wide screens show both pages; tall screens show one page and a bookmark flips to the other.
const JR = { man: null, ready: false, page: 'log', side: 0, mode: 'spread', u: 3, tab: { log: 'art' }, sel: 0, clock: null };
const JR_PAGES = [['log', 'COLLECTION', 'rib_log', 'icon_log'], ['bag', 'BAG', 'rib_bag', 'icon_bag'], ['com', 'COMMUNITY', 'rib_com', 'icon_com'], ['tasks', 'TASKS', 'rib_tasks', 'icon_tasks'], ['set', 'SETTINGS', 'rib_gear', 'icon_gear']];
const JR_ORG = { l: 35, r: 134 }, JR_TOP = 28;   // where the content area of the left and right page starts, in book units (each page's area is 77 x 97)
const jc = n => `calc(var(--u)*${+n.toFixed(2)})`;
JR.load = function () {
  if (JR.loading) return; JR.loading = true;
  fetch('assets/ui/journal/journal.json').then(r => r.json()).then(m => {
    JR.man = m; let left = Object.keys(m.pieces).length; const done = () => { if (--left === 0) { JR.ready = true; if (JR.wantOpen) UI.openJournal(); } };
    for (const k in m.pieces) { const im = new Image(); im.onload = im.onerror = done; im.src = `assets/ui/journal/${k}.png`; }
  }).catch(() => { JR.loading = false; });
};
JR.fit = function () {   // spread or single page, and how many screen pixels one art pixel gets
  const vw = innerWidth, vh = innerHeight; JR.mode = vw >= 560 && vw / vh >= 1.1 ? 'spread' : 'single';
  const b = JR.mode === 'spread' ? { x0: 6, y0: 9, x1: 242, y1: 149 } : { x0: 6, y0: 9, x1: 143, y1: 149 }; JR.box = b;
  const fit = Math.min(vw * 0.96 / (b.x1 - b.x0), vh * 0.92 / (b.y1 - b.y0)); JR.u = Math.min(6, fit >= 3 ? Math.floor(fit) : Math.max(1, Math.floor(fit * 2) / 2));
};
const jp = n => JR.man.pieces[n];
function jx(x) { return jc(x - JR.box.x0); } function jy(y) { return jc(y - JR.box.y0); }
function jimg(name, dx = 0, dy = 0, cls = '') { const p = jp(name); return `<img class="jl ${cls}" src="assets/ui/journal/${name}.png" alt="" style="left:${jx(p.x + dx)};top:${jy(p.y + dy)};width:${jc(p.w)};height:${jc(p.h)}">`; }
function jbox(x, y, w, h, html, cls = '', attrs = '') { return `<div class="jb ${cls}" ${attrs} style="left:${jx(x)};top:${jy(y)};width:${jc(w)};height:${jc(h)}">${html}</div>`; }

// ---- the pages ------------------------------------------------------------------------------------------------------------------------------------
// Each page is drawn into a slot: sx is where that slot's content area starts in the book (35 left, 134 right). A piece that was painted for the other side is shifted to fit.
function jart(name, sx) { const p = jp(name); return jimg(name, sx - JR_ORG[p.side || 'l'], 0); }
function jrect(name, k, sx) { const c = jp(name).cells[k], o = JR_ORG[jp(name).side || 'l']; return [c[0] - o + sx, c[1], c[2], c[3]]; }
const jhead = (t, sx, x = 0, w = 77) => jbox(sx + x, 29, w, 8, `<span class="jh">${t}</span>`, 'jc');
function jitemIcon(id, big) { const ic = itemIcon(id), s = big ? 2 : 1; return `<img class="ji" src="${itemURL(id)}" alt="" style="width:${jc(ic.width * s)};height:${jc(ic.height * s)}">`; }
function jlist(tab) { return tab === 'salv' ? SALVAGE : ARTIFACTS; }
const jstat = [['TOTAL DIGS', () => S.stats.digs | 0], ['SITE DIGS', () => S.stats.sdigs | 0], ['OPEN GROUND', () => (S.stats.digs | 0) - (S.stats.sdigs | 0)], ['ARTIFACTS', () => S.arts.length],
  ['COLLECTION', () => ARTIFACTS.filter(a => found(a.id)).length + '/' + ARTIFACTS.length], ['BEST FIND', () => (S.arts.reduce((m, a) => Math.max(m, a.pct), 0) || '-') + (S.arts.length ? '%' : '')], ['SALVAGE', () => Object.values(S.mats).reduce((a, b) => a + (b | 0), 0)]];

function pageLog(side, sx) {
  if (side === 'l') {
    const list = jlist(JR.tab.log), cs = jp('clog_grid').cells; let h = jart('clog_grid', sx);
    h += [['art', 'ARTIFACTS'], ['salv', 'SALVAGE']].map((t, i) => jbox(sx + i * 38, 29, 37, 7, `<span>${t[1]}</span>`, 'jtab' + (JR.tab.log === t[0] ? ' on' : ''), `data-act="jtab:${t[0]}"`)).join('');
    cs.forEach((c, k) => { const it = list[k], r = jrect('clog_grid', k, sx); h += jbox(r[0], r[1], r[2], r[3], it ? `<span class="${found(it.id) ? '' : 'jdim'}">${jitemIcon(it.id)}</span>` : '', 'jslot' + (it && k === JR.sel ? ' on' : ''), it ? `data-act="jsel:${k}"` : ''); });
    return h;
  }
  const it = jlist(JR.tab.log)[JR.sel] || jlist(JR.tab.log)[0], ok = it && found(it.id), c = it && S.col[it.id];
  let h = jart('clog_right', sx) + jart('clog_card', sx) + jart('clog_box', sx);
  if (it) {
    const card = jp('clog_card'), box = jp('clog_box'), rar = it.r != null ? RAR[it.r] : null;
    h += jbox(sx + card.x - 134, card.y, card.w, card.h, `<div class="jcard"><span class="${ok ? '' : 'jdim'}">${jitemIcon(it.id, true)}</span><b style="color:${ok && rar ? `color-mix(in srgb,${rar.c} 28%,#3a2a1e)` : '#594237'}">${ok ? it.name : '???'}</b><i>${ok ? (rar ? rar.n : 'Salvage') : 'Not found yet'}</i><p>${ok ? it.desc : ''}</p></div>`, 'jfill');
    const st = it.r != null ? (ok ? `<span>FOUND <b>${c.n}</b></span><span>BEST <b>${c.best}%</b></span><div class="jbar"><i style="width:${c.best}%"></i></div>` : '<span>BEST <b>-</b></span>') : `<span>HAVE <b>${S.mats[it.id] | 0}</b></span>`;
    h += jbox(sx + box.x - 134, box.y, box.w, box.h, `<div class="jstat">${st}</div>`, 'jfill');
  }
  return h;
}
function pageBag(side, sx) {
  if (side === 'l') {
    let h = ['bag_left', 'bag_portrait', 'bag_clouds', 'bag_slots', 'bag_equip', 'bag_inv'].map(n => jart(n, sx)).join('');
    h += `<canvas class="jhero" width="32" height="48" style="left:${jx(sx + 19 - 16 + 0)};top:${jy(76 - 48)};width:${jc(32)};height:${jc(48)}"></canvas>`;
    h += jbox(sx + 29, 73, 9, 9, `<img class="jl" src="assets/ui/journal/bag_edit.png" alt="" style="left:${jc(2)};top:${jc(2)};width:${jc(5)}">`, 'jbtn', 'data-act="jedit" title="Edit your look"');
    const items = [], mats = SALVAGE.filter(s => (S.mats[s.id] | 0) > 0).map(s => ({ id: s.id, n: S.mats[s.id], name: s.name }));
    items.push(...mats, ...S.arts.slice().reverse().map(a => ({ id: a.id, pct: a.pct, name: ITEM[a.id].name })));
    jp('bag_inv').cells.forEach((c, k) => { const it = items[k], r = jrect('bag_inv', k, sx); h += jbox(r[0], r[1], r[2], r[3], it ? `${jitemIcon(it.id)}<em>${it.n ? it.n : it.pct + '%'}</em>` : '', 'jslot', it ? `title="${it.name}"` : ''); });
    return h;
  }
  let h = jart('bag_right', sx) + jhead('STATS:', sx, 1, 40).replace('jc', 'jl2');
  jstat.forEach((s, k) => { h += jbox(sx + 4, 38 + k * 10, 69, 9, `<span>${s[0]}</span><b>${s[1]()}</b>`, 'jrow'); });
  const tools = [['mattock' + S.gear.mattock, mattock().n], ['brush' + S.gear.brush, brush().n]];
  jp('bag_right').cells.forEach((c, k) => { const r = jrect('bag_right', k, sx), t = tools[k]; h += jbox(r[0], r[1], r[2], r[3], t ? `<img class="ji half" src="${itemURL(t[0])}" alt="" style="width:${jc(9)};height:${jc(9)}">` : '', 'jslot', t ? `title="${t[1]}"` : ''); });
  return h;
}
function pageCom(side, sx) {
  if (side === 'l') return ['com_left', 'com_bg', 'com_plaque', 'com_prog', 'dino0'].map(n => jart(n, sx)).join('') + jhead('SEASON EXHIBIT', sx) + jbox(sx + 3, 84, 55 + 8, 14, '<span class="jh jsm">COMING SOON</span>', 'jc', '');
  return ['com_right', 'com_slots', 'com_plaques'].map(n => jart(n, sx)).join('') + jhead('PERMANENT', sx);
}
function pageTasks(side, sx) {
  return jart(side === 'l' ? 'com_left' : 'com_right', sx) + jhead(side === 'l' ? 'TASKS' : 'CALENDAR', sx) + jbox(sx + 4, 50, 69, 30, '<span class="jh jsm">COMING SOON</span>', 'jc');
}
function jtoggle(label, on, act, y, sx) { return jbox(sx + 4, y, 69, 11, `<span>${label}</span><button class="jtog ${on ? 'on' : ''}" data-act="${act}">${on ? 'ON' : 'OFF'}</button>`, 'jrow'); }
function pageSet(side, sx) {
  if (side === 'l') return jart('com_left', sx) + jhead('SETTINGS', sx) + jtoggle('SOUND', S.sound, 'jsnd', 40, sx) + jtoggle('LEFT HAND', !!S.lefty, 'jlefty', 54, sx)
    + jbox(sx + 4, 70, 69, 11, '<span>CHARACTER</span><button class="jtog" data-act="jedit">EDIT</button>', 'jrow');
  return jart('com_right', sx) + jhead('TESTING', sx) + jbox(sx + 4, 40, 69, 11, '<span>PROGRESS</span><button class="jtog" id="tr1" data-act="testreset">RESET</button>', 'jrow') + jbox(sx + 4, 54, 69, 11, '<span>ALL DATA</span><button class="jtog bad" id="tr2" data-act="testwipe">ERASE</button>', 'jrow')
    + jbox(sx + 4, 72, 69, 24, '<span class="jh jsm">ARCHIVE THE WEB</span>', 'jc');
}
const JR_FN = { log: pageLog, bag: pageBag, com: pageCom, tasks: pageTasks, set: pageSet };

// ---- the book ------------------------------------------------------------------------------------------------------------------------------------
JR.render = function () {
  const el = document.getElementById('jr'); if (!el || !JR.ready) return; JR.fit(); const b = JR.box, spread = JR.mode === 'spread', pg = JR_PAGES.find(p => p[0] === JR.page), fn = JR_FN[JR.page];
  el.style.setProperty('--u', JR.u + 'px'); el.classList.toggle('single', !spread);
  const stage = document.getElementById('jrstage'); stage.style.width = jc(b.x1 - b.x0); stage.style.height = jc(b.y1 - b.y0);
  const L = ['back_l', 'edge_l', 'block_l'], R = ['back_r', 'edge_r', 'block_r']; let h = '';
  const ribs = JR_PAGES.map(p => {
    const rp = jp(p[2]), ip = jp(p[3]), left = p[0] === 'set', sel = JR.page === p[0], x = spread || left ? rp.x : 111 + (rp.x - 210), dx = x - rp.x, off = (left ? -3 : 3) * (sel ? 1 : 0);
    return `<button class="jrib ${sel ? 'on' : ''}" data-act="jpage:${p[0]}" aria-label="${p[1]}" style="left:${jx(x)};top:${jy(rp.y)};width:${jc(rp.w)};height:${jc(rp.h)};transform:translateX(${jc(off)})"><img src="assets/ui/journal/${p[2]}.png" alt="" style="left:0;top:0;width:${jc(rp.w)}"><img src="assets/ui/journal/${p[3]}.png" alt="" style="left:${jc(ip.x - rp.x)};top:${jc(ip.y - rp.y)};width:${jc(ip.w)}"></button>`;
  }).join('');
  h += L.map(n => jimg(n)).join('') + (spread ? R.map(n => jimg(n)).join('') : '');
  h += jimg('tab_left') + (spread ? jimg('tab_time') + jimg('tab_dot') : '');
  h += ribs;
  h += (spread ? '' : '') + jimg('lines_l') + (spread ? jimg('lines_r') : '') + jimg('page_l') + (spread ? jimg('page_r') : '');
  h += jbox(38, 11, 52, 8, `<span class="jh jtl">${pg[1]}</span>`, 'jl2');
  if (spread) h += jbox(168, 12, 36, 7, `<span class="jh jtl" id="jclock">${jrTime()}</span>`, 'jl2');
  if (spread) h += fn('l', JR_ORG.l) + fn('r', JR_ORG.r); else h += fn(JR.side ? 'r' : 'l', JR_ORG.l);
  if (!spread) { const bk = jp('bookmark'); h += `<button class="jmark" data-act="jflip" aria-label="Turn the page" style="left:${jx(bk.x)};top:${jy(bk.y)};width:${jc(bk.w)};height:${jc(bk.h)}"><img src="assets/ui/journal/bookmark.png" alt="" style="width:${jc(bk.w)}"></button>`; }
  stage.innerHTML = h;
  const cv = stage.querySelector('.jhero'); if (cv && typeof heroSprite === 'function' && HERO.base) { const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(heroSprite(0, 0), 0, 0); }
};
function jrTime() { const d = new Date(), h = d.getHours() % 12 || 12, m = String(d.getMinutes()).padStart(2, '0'); return h + ':' + m + (d.getHours() < 12 ? 'AM' : 'PM'); }
UI.openJournal = function (page) {
  if (!JR.ready) { JR.wantOpen = true; JR.load(); return; } JR.wantOpen = false; if (UI.isOpen && UI.cur !== 'journal') UI.close();
  if (page) JR.page = page; const el = document.getElementById('jr'); el.classList.remove('hidden'); UI.isOpen = true; UI.cur = 'journal'; JR.render(); sfx('pop');
  clearInterval(JR.clock); JR.clock = setInterval(() => { const c = document.getElementById('jclock'); if (c) c.textContent = jrTime(); }, 20000);
};
UI.journalClosed = function () { const el = document.getElementById('jr'); if (el) el.classList.add('hidden'); clearInterval(JR.clock); };
UI.journalClick = function (a, p1, p2) {   // returns true when the click was for the journal
  switch (a) {
    case 'jpage': JR.page = p1; JR.side = 0; JR.sel = 0; JR.render(); sfx('ui'); return true;
    case 'jflip': JR.side = JR.side ? 0 : 1; JR.render(); sfx('ui'); return true;
    case 'jtab': JR.tab.log = p1; JR.sel = 0; JR.render(); sfx('ui'); return true;
    case 'jsel': JR.sel = +p1; if (JR.mode === 'single') JR.side = 1; JR.render(); sfx('ui'); return true;
    case 'jsnd': S.sound = !S.sound; if (S.sound) audioInit(); saveState(); JR.render(); return true;
    case 'jlefty': S.lefty = !S.lefty; document.body.classList.toggle('lefty', S.lefty); saveState(); JR.render(); return true;
    case 'jedit': UI.close(); UI.openMe(false); return true;
  }
  return false;
};
addEventListener('resize', () => { if (UI.cur === 'journal') JR.render(); });
addEventListener('keydown', e => {
  if (typeof EDIT !== 'undefined' && EDIT) return; if (e.code === 'KeyJ' && !e.repeat && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) { if (UI.cur === 'journal') UI.close(); else if (!UI.isOpen) UI.openJournal(); }
  else if (UI.cur === 'journal' && JR.mode === 'single' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { JR.side = e.code === 'ArrowRight' ? 1 : 0; JR.render(); }
});
(function () { let sx = null; addEventListener('pointerdown', e => { if (UI.cur === 'journal' && e.target.closest('#jr')) sx = e.clientX; }); addEventListener('pointerup', e => { if (sx != null && UI.cur === 'journal' && JR.mode === 'single' && Math.abs(e.clientX - sx) > 50) { JR.side = e.clientX < sx ? 1 : 0; JR.render(); } sx = null; }); })();   // swipe to turn the page on a tall screen
