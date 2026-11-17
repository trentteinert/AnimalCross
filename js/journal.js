// ---- the journal: one book for the collection log, bag, community, tasks and settings -----------------------------------------------------------------
// The art is a 256x160 open book (assets/ui/journal/*.png, cut by tools/journal_export.py). Every piece is placed in book units and scaled by one number, --u (screen pixels
// per art pixel), so it fits any screen. All text is real text on top of the art. Wide screens show both pages; tall screens show one page and a bookmark flips to the other.
const JR = { man: null, ready: false, page: 'log', side: 0, mode: 'spread', u: 3, tab: { log: 'art' }, sel: 0, clock: null, tasks: 'day', dir: 0, name: null };
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
    let h = ['bag_portrait', 'bag_clouds', 'bag_slots', 'bag_equip', 'bag_inv'].map(n => jart(n, sx)).join('') + jhero(sx, false);
    h += jbox(sx + 29, 73, 9, 9, `<img class="jl" src="assets/ui/journal/bag_edit.png" alt="" style="left:${jc(2)};top:${jc(2)};width:${jc(5)}">`, 'jbtn', 'data-act="jedit" title="Edit your character"');
    const items = [], mats = SALVAGE.filter(s => (S.mats[s.id] | 0) > 0).map(s => ({ id: s.id, n: S.mats[s.id], name: s.name }));
    items.push(...mats, ...S.arts.slice().reverse().map(a => ({ id: a.id, pct: a.pct, name: ITEM[a.id].name })));
    jp('bag_inv').cells.forEach((c, k) => { const it = items[k], r = jrect('bag_inv', k, sx); h += jbox(r[0], r[1], r[2], r[3], it ? `${jitemIcon(it.id)}<em>${it.n ? it.n : it.pct + '%'}</em>` : '', 'jslot', it ? `title="${it.name}"` : ''); });
    return h;
  }
  let h = jart('com_right', sx) + jhead('STATS', sx);
  const rows = jstat.concat([['MATTOCK', () => mattock().n.replace(' Mattock', '').toUpperCase()], ['BRUSH', () => brush().n.replace(' Brush', '').toUpperCase() || 'PLAIN']]);
  rows.filter(r => r[0] !== 'SALVAGE').forEach((s, k) => { h += jbox(sx + 4, 40 + k * 10, 69, 10, `<span>${s[0]}</span><b>${s[1]()}</b>`, 'jrow jline'); });
  return h;
}
function jhero(sx, click) {   // your character drawn live in the portrait frame (the frame's own painted figure is not used)
  return `<canvas class="jhero" width="32" height="48" style="left:${jx(sx + 3)};top:${jy(28)};width:${jc(32)};height:${jc(48)}"></canvas>` + (click ? jbox(sx, 28, 38, 54, '', 'jbtn', 'data-act="jturn" title="Turn around"') : '');
}
JR.drawHero = function () {
  document.querySelectorAll('#jrstage .jhero').forEach(cv => { if (typeof heroSprite !== 'function' || !HERO.base) return; const c = cv.getContext('2d'); c.clearRect(0, 0, 32, 48); c.imageSmoothingEnabled = false; c.drawImage(heroSprite([0, 2, 4, 6][JR.dir || 0], 0), 0, 0); });
};
function pageEdit(side, sx) {   // the character page: the left page holds the portrait, name and hair; the right page the colours
  if (side === 'l') {
    const hs = HERO.tint.hairStyle || HAIR_STYLES[0]; let h = ['edit_panel', 'bag_portrait', 'bag_clouds'].map(n => jart(n, sx)).join('') + jhero(sx, true);
    h += jbox(sx + 41, 30, 36, 6, '<span class="jh jsm">HAIR</span>', 'jl2');
    ['none', ...HAIR_STYLES].slice(0, 5).forEach((id, k) => { h += jbox(sx + 42, 38 + k * 9, 34, 8, `<button class="jtog sm ${hs === id ? 'on' : ''}" data-act="jhair:${id}" style="min-width:0;width:100%">${id === 'none' ? 'BALD' : id.toUpperCase()}</button>`, ''); });
    h += jbox(sx + 3, 87, 71, 9, `<input id="jname" class="jin" maxlength="14" value="${esc(JR.name != null ? JR.name : S.name)}" autocomplete="off" spellcheck="false">`, '');
    h += jbox(sx + 3, 98, 34, 9, '<button class="jtog sm" data-act="jrand" style="min-width:0;width:100%">RANDOM</button>', '') + jbox(sx + 40, 98, 34, 9, '<button class="jtog sm" data-act="jreset" style="min-width:0;width:100%">RESET</button>', '');
    h += jbox(sx + 3, 110, 71, 11, '<button class="jtog on" data-act="jdone" style="width:100%">SAVE</button>', '');
    h += jbox(sx + 3, 122, 71, 3, `<span class="jh jerr" id="jerr"></span>`, 'jl2');
    return h;
  }
  let h = jhead('COLOURS', sx); const roles = LOOK_ROLES.filter(r => r[0] === 'hair' ? (HERO.tint.hairStyle || HAIR_STYLES[0]) !== 'none' : (HERO.roles[r[0]] || []).length);
  roles.forEach(([r, n], k) => {
    const cur = HERO.tint[r] || nearestIn(PALETTE[r], '#' + (r === 'hair' ? ((HERO.hair[HERO.tint.hairStyle || HAIR_STYLES[0]] || { main: [136, 96, 75] }).main.map(v => v.toString(16).padStart(2, '0')).join('')) : heroRoleColor(r).map(v => v.toString(16).padStart(2, '0')).join('')));
    h += jbox(sx + 2, 38 + k * 15, 73, 5, `<span class="jh jsm">${n.toUpperCase()}</span>`, 'jl2');
    h += jbox(sx + 2, 43 + k * 15, 73, 9, PALETTE[r].map(c => `<button class="jsw ${c === cur ? 'on' : ''}" style="background:${c}" data-act="jcol:${r}:${c}" aria-label="${n} ${c}"></button>`).join(''), 'jsws');
  });
  return h;
}
function pageCom(side, sx) {
  if (side === 'l') return ['com_left', 'com_bg', 'com_plaque', 'com_prog', 'dino0'].map(n => jart(n, sx)).join('') + jhead('SEASON EXHIBIT', sx) + jbox(sx + 3, 84, 55 + 8, 14, '<span class="jh jsm">COMING SOON</span>', 'jc', '');
  return ['com_right', 'com_slots', 'com_plaques'].map(n => jart(n, sx)).join('') + jhead('PERMANENT', sx);
}
const JR_TASKS = { day: [['DIG 5 SPOTS', 'digs', 5], ['DIG AT A SITE', 'sdigs', 3], ['FIND 2 ARTIFACTS', 'afound', 2], ['A FIND OVER 80%', 'great', 1], ['COLLECT 3 SALVAGE', 'salv', 3]],
  week: [['DIG 30 SPOTS', 'digs', 30], ['DIG AT SITES 15', 'sdigs', 15], ['FIND 10 ARTIFACTS', 'afound', 10], ['FIND 4 OVER 80%', 'great', 4], ['COLLECT 15 SALVAGE', 'salv', 15]] };
function jrTrack() {   // tasks count what you do from the start of today (or this week), so each day and each week begins fresh
  const st = S.stats, cur = { digs: st.digs | 0, sdigs: st.sdigs | 0, afound: st.afound | 0, great: st.great | 0, salv: st.salv | 0 }, d = new Date(), pad = n => String(n).padStart(2, '0');
  const dayKey = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const wkKey = mon.getFullYear() + '-' + pad(mon.getMonth() + 1) + '-' + pad(mon.getDate());
  S.track = S.track || {}; if (!S.track.day || S.track.day.k !== dayKey) S.track.day = { k: dayKey, b: Object.assign({}, cur) }; if (!S.track.week || S.track.week.k !== wkKey) S.track.week = { k: wkKey, b: Object.assign({}, cur) };
  return { cur, day: S.track.day.b, week: S.track.week.b };
}
function pageTasks(side, sx) {
  const tp = jp('tasks_panel'), tr = jrTrack();
  if (side === 'l') {
    let h = jart('tasks_panel', sx);
    const A = jp('tab_sel'), B = jp('tab_idle'), slots = [[A.x, A.y, 'day', 'TODAY'], [B.x, B.y, 'week', 'WEEK']];   // the chosen tab is the dark one, so the two swap places' looks
    slots.forEach(([x, y, key, label]) => { const on = JR.tasks === key, pc = on ? A : B; h += jbox(sx + x - 35, y, pc.w, pc.h, `<img class="jl" src="assets/ui/journal/${on ? 'tab_sel' : 'tab_idle'}.png" alt="" style="left:0;top:0;width:${jc(pc.w)}"><span class="jh jsm" style="position:relative;opacity:1;color:${on ? '#e9d4c4' : '#594237'}">${label}</span>`, 'jc jbtn', `data-act="jtasks:${key}"`); });
    h += jbox(sx + 3, 30, 71, 8, `<span class="jh jsm">${JR.tasks === 'day' ? 'RESETS AT MIDNIGHT' : 'RESETS ON MONDAY'}</span>`, 'jc');
    const list = JR_TASKS[JR.tasks]; tp.rows.forEach((r, k) => {
      const t = list[k]; if (!t) return; const base = tr[JR.tasks][t[1]], v = Math.min(t[2], tr.cur[t[1]] - base), done = v >= t[2];
      h += jbox(sx + r[0] - 35 + 15, r[1], r[2] - 19, r[3], `<span>${t[0]}</span><b>${done ? 'DONE' : v + '/' + t[2]}</b>`, 'jrow jtask' + (done ? ' done' : ''));
      if (done) h += jbox(sx + r[0] - 35 + 4, r[1] + 1, 9, 9, '<span class="jtick">✓</span>', 'jc');
    });
    return h;
  }
  const d = new Date(), np = jp('cal_nameplate'), cg = jp('cal_grid'), months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  let h = jart('cal_nameplate', sx) + jart('cal_grid', sx) + jbox(sx + np.x - 134 + 8, np.y, np.w - 16, np.h, `<span class="jh">${months[d.getMonth()]}</span>`, 'jc');
  cg.cells.forEach((c, k) => { const r = jrect('cal_grid', k, sx), today = k + 1 === Math.min(30, d.getDate()); h += jbox(r[0], r[1], r[2], r[3], `<span class="jday">${k + 1}</span>`, 'jcell' + (today ? ' today' : '')); });
  return h;
}
function jtoggle(label, on, act, y, sx) { return jbox(sx + 4, y, 69, 11, `<span>${label}</span><button class="jtog ${on ? 'on' : ''}" data-act="${act}">${on ? 'ON' : 'OFF'}</button>`, 'jrow'); }
function pageSet(side, sx) {
  if (side === 'l') return jart('com_left', sx) + jhead('SETTINGS', sx) + jtoggle('SOUND', S.sound, 'jsnd', 40, sx) + jtoggle('LEFT HAND', !!S.lefty, 'jlefty', 54, sx)
    + jbox(sx + 4, 70, 69, 11, '<span>CHARACTER</span><button class="jtog" data-act="jedit">EDIT</button>', 'jrow');
  return jart('com_right', sx) + jhead('TESTING', sx) + jbox(sx + 4, 40, 69, 11, '<span>PROGRESS</span><button class="jtog" id="tr1" data-act="testreset">RESET</button>', 'jrow') + jbox(sx + 4, 54, 69, 11, '<span>ALL DATA</span><button class="jtog bad" id="tr2" data-act="testwipe">ERASE</button>', 'jrow')
    + jbox(sx + 4, 72, 69, 24, '<span class="jh jsm">ARCHIVE THE WEB</span>', 'jc');
}
const JR_FN = { log: pageLog, bag: pageBag, edit: pageEdit, com: pageCom, tasks: pageTasks, set: pageSet };

// ---- the book ------------------------------------------------------------------------------------------------------------------------------------
JR.render = function () {
  const el = document.getElementById('jr'); if (!el || !JR.ready) return; JR.fit(); const b = JR.box, spread = JR.mode === 'spread', pg = JR_PAGES.find(p => p[0] === JR.page) || ['edit', 'CHARACTER'], fn = JR_FN[JR.page];
  el.style.setProperty('--u', JR.u + 'px'); el.classList.toggle('single', !spread);
  const stage = document.getElementById('jrstage'); stage.style.width = jc(b.x1 - b.x0); stage.style.height = jc(b.y1 - b.y0);
  const L = ['back_l', 'edge_l', 'block_l'], R = ['back_r', 'edge_r', 'block_r']; let h = '';
  const ribs = JR_PAGES.map(p => {
    const rp = jp(p[2]), ip = jp(p[3]), left = p[0] === 'set', sel = JR.page === p[0] || (JR.page === 'edit' && p[0] === 'bag'), x = spread || left ? rp.x : 111 + (rp.x - 210), dx = x - rp.x, off = (left ? -3 : 3) * (sel ? 1 : 0);
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
  JR.drawHero();
};
function jrTime() { const d = new Date(), h = d.getHours() % 12 || 12, m = String(d.getMinutes()).padStart(2, '0'); return h + ':' + m + (d.getHours() < 12 ? 'AM' : 'PM'); }
UI.openJournal = function (page) {
  if (!JR.ready) { JR.wantOpen = true; JR.load(); return; } JR.wantOpen = false; if (UI.isOpen && UI.cur !== 'journal') UI.close();
  if (page) JR.page = page; const el = document.getElementById('jr'); el.classList.remove('hidden'); UI.isOpen = true; UI.cur = 'journal'; JR.render(); sfx('pop');
  clearInterval(JR.clock); JR.clock = setInterval(() => { const c = document.getElementById('jclock'); if (c) c.textContent = jrTime(); }, 20000);
};
JR.keepName = function () { const i = document.getElementById('jname'); if (i) JR.name = i.value; };
UI.journalClosed = function () { JR.name = null; const el = document.getElementById('jr'); if (el) el.classList.add('hidden'); clearInterval(JR.clock); };
UI.journalClick = function (a, p1, p2) {   // returns true when the click was for the journal
  switch (a) {
    case 'jpage': JR.page = p1; JR.side = 0; JR.sel = 0; JR.render(); sfx('ui'); return true;
    case 'jflip': JR.side = JR.side ? 0 : 1; JR.render(); sfx('ui'); return true;
    case 'jtab': JR.tab.log = p1; JR.sel = 0; JR.render(); sfx('ui'); return true;
    case 'jsel': JR.sel = +p1; if (JR.mode === 'single') JR.side = 1; JR.render(); sfx('ui'); return true;
    case 'jsnd': S.sound = !S.sound; if (S.sound) audioInit(); saveState(); JR.render(); return true;
    case 'jlefty': S.lefty = !S.lefty; document.body.classList.toggle('lefty', S.lefty); saveState(); JR.render(); return true;
    case 'jedit': JR.page = 'edit'; JR.side = 0; JR.name = null; JR.render(); return true;
    case 'jturn': JR.dir = ((JR.dir || 0) + 1) % 4; JR.drawHero(); return true;
    case 'jtasks': JR.tasks = p1; JR.render(); return true;
    case 'jhair': JR.keepName(); HERO.tint.hairStyle = p1; heroApply(); JR.render(); return true;
    case 'jcol': HERO.tint[p1] = p2; heroApply(); JR.drawHero(); document.querySelectorAll(`#jrstage .jsw[data-act^="jcol:${p1}:"]`).forEach(b => b.classList.toggle('on', b.dataset.act === 'jcol:' + p1 + ':' + p2)); return true;
    case 'jrand': JR.keepName(); Object.assign(HERO.tint, randLook()); heroApply(); JR.render(); return true;
    case 'jreset': JR.keepName(); for (const k in HERO.tint) delete HERO.tint[k]; heroApply(); JR.render(); return true;
    case 'jdone': { const n = (document.getElementById('jname') || { value: S.name }).value.trim(), err = badName(n); if (err) { const e = document.getElementById('jerr'); if (e) e.textContent = err; sfx('no'); return true; } S.name = n; JR.name = null; saveState(); UI.refresh(); JR.page = 'bag'; JR.render(); UI.toast('Saved', 'info'); return true; }
  }
  return false;
};
addEventListener('resize', () => { if (UI.cur === 'journal') JR.render(); });
addEventListener('keydown', e => {
  if (typeof EDIT !== 'undefined' && EDIT) return; if (e.code === 'KeyJ' && !e.repeat && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) { if (UI.cur === 'journal') UI.close(); else if (!UI.isOpen) UI.openJournal(); }
  else if (UI.cur === 'journal' && JR.mode === 'single' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { JR.side = e.code === 'ArrowRight' ? 1 : 0; JR.render(); }
});
(function () { let sx = null; addEventListener('pointerdown', e => { if (UI.cur === 'journal' && e.target.closest('#jr')) sx = e.clientX; }); addEventListener('pointerup', e => { if (sx != null && UI.cur === 'journal' && JR.mode === 'single' && Math.abs(e.clientX - sx) > 50) { JR.side = e.clientX < sx ? 1 : 0; JR.render(); } sx = null; }); })();   // swipe to turn the page on a tall screen
