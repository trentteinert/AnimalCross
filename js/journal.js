// ---- the journal: one book for the collection log, bag, community, tasks and settings -----------------------------------------------------------------
// The art is a 256x160 open book (assets/ui/journal/*.png, cut by tools/journal_export.py). Every piece is placed in book units and scaled by one number, --u (screen pixels
// per art pixel), so it fits any screen. All text is real text on top of the art. Wide screens show both pages; tall screens show one page and a bookmark flips to the other.
const JR = { cat: 'hair', man: null, ready: false, page: 'log', side: 0, mode: 'spread', u: 3, tab: { log: 'art' }, sel: 0, clock: null, tasks: 'day', dir: 0, name: null };
const JR_PAGES = [['log', 'COLLECTION', 'rib_log', 'icon_log'], ['bag', 'BAG', 'rib_bag', 'icon_bag'], ['com', 'COMMUNITY', 'rib_com', 'icon_com'], ['tasks', 'TASKS', 'rib_tasks', 'icon_tasks'], ['set', 'SETTINGS', 'rib_gear', 'icon_gear']];
const JR_ORG = { l: 35, r: 134 }, JR_TOP = 28;   // where the content area of the left and right page starts, in book units (each page's area is 77 x 97)
const jc = n => `calc(var(--u)*${+n.toFixed(2)})`;
JR.load = function () {
  if (JR.loading) return; JR.loading = true;
  fetch('assets/ui/journal/journal.json').then(r => r.json()).then(m => {
    JR.man = m; let left = Object.keys(m.pieces).length; const done = () => { if (--left === 0) { JR.ready = true; if (JR.wantOpen) UI.openJournal(); setTimeout(JR.warm, 400); } };
    JR.imgs = []; for (const k in m.pieces) { const im = new Image(); JR.imgs.push(im); im.onload = im.onerror = done; im.src = `assets/ui/journal/${k}.png`; }
  }).catch(() => { JR.loading = false; });
};
JR.warm = function () {   // the first time the book opens (and each page the first time) everything is decoded, drawn and laid out for the first time: do that work early, in small idle steps, so opening is instant
  if (JR.warmed) return; JR.warmed = true; const idle = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 800 }) : setTimeout(f, 60)), steps = [];
  steps.push(() => { if (document.fonts) { document.fonts.load('400 14px "Pixelify Sans"'); document.fonts.load('600 14px "Pixelify Sans"'); } });
  (JR.imgs || []).forEach(im => steps.push(() => { if (im.decode) im.decode().catch(() => { }); }));   // every piece of the book decoded now, not when it is first on screen
  steps.push(() => { ARTIFACTS.concat(SALVAGE).forEach(i => { const u = itemURL(i.id), im = new Image(); im.src = u; if (im.decode) im.decode().catch(() => { }); }); });   // the item icons are drawn and turned into pictures once
  steps.push(() => { if (typeof heroSprite === 'function' && HERO.base) for (let f = 0; f < 8; f++) for (let fr = 0; fr < 5; fr++) heroSprite(f, fr); });   // all the portrait's turning frames
  steps.push(() => {   // draw every page once, invisibly, so the layout and the first paint are done too
    const el = document.getElementById('jr'); if (!el || UI.cur === 'journal') return; const keep = [JR.page, JR.side, JR.sel], pages = JR_PAGES.map(p => p[0]).concat('edit');
    el.classList.remove('hidden'); el.style.opacity = '0'; el.style.pointerEvents = 'none';
    const undo = () => { el.style.opacity = ''; el.style.pointerEvents = ''; if (UI.cur !== 'journal') el.classList.add('hidden'); JR.page = keep[0]; JR.side = keep[1]; JR.sel = keep[2]; clearInterval(JR.spinTimer); JR.spinTimer = null; };
    let i = 0; const go = () => { if (UI.cur === 'journal') { undo(); return; } if (i >= pages.length) { undo(); return; } JR.page = pages[i++]; JR.side = 0; JR.sel = 0; JR.render(); setTimeout(go, 90); }; go();
  });
  const next = () => { const f = steps.shift(); if (!f) return; try { f(); } catch (e) { } idle(next); }; idle(next);
};
JR.fit = function () {   // spread or single page, and how many screen pixels one art pixel gets
  const vw = innerWidth, vh = innerHeight; JR.mode = vw >= 560 && vw / vh >= 1.1 ? 'spread' : 'single';
  const b = JR.mode === 'spread' ? { x0: 6, y0: 9, x1: 242, y1: 149 } : { x0: 119, y0: 9, x1: 243, y1: 149 }; JR.box = b;   // single: the right page and its ribbons fill the screen; the rest of the book runs off the left edge
  const fit = Math.min(vw * (JR.mode === 'spread' ? 0.96 : 0.99) / (b.x1 - b.x0), vh * 0.92 / (b.y1 - b.y0)); JR.u = Math.min(6, fit >= 3 ? Math.floor(fit) : Math.max(1, Math.floor(fit * 2) / 2));
};
const jp = n => JR.man.pieces[n];
function jx(x) { return jc(x - JR.box.x0); } function jy(y) { return jc(y - JR.box.y0); }
function jimg(name, dx = 0, dy = 0, cls = '') { const p = jp(name); return `<img class="jl ${cls}" src="assets/ui/journal/${name}.png" alt="" decoding="sync" style="left:${jx(p.x + dx)};top:${jy(p.y + dy)};width:${jc(p.w)};height:${jc(p.h)}">`; }
function jbox(x, y, w, h, html, cls = '', attrs = '') { return `<div class="jb ${cls}" ${attrs} style="left:${jx(x)};top:${jy(y)};width:${jc(w)};height:${jc(h)}">${html}</div>`; }

// ---- the pages ------------------------------------------------------------------------------------------------------------------------------------
// Each page is drawn into a slot: sx is where that slot's content area starts in the book (35 left, 134 right). A piece that was painted for the other side is shifted to fit.
function jart(name, sx) { const p = jp(name); return jimg(name, sx - JR_ORG[p.side || 'l'], 0); }
function jrect(name, k, sx) { const c = jp(name).cells[k], o = JR_ORG[jp(name).side || 'l']; return [c[0] - o + sx, c[1], c[2], c[3]]; }
const jhead = (t, sx, x = 0, w = 77) => jbox(sx + x, 29, w, 8, `<span class="jh">${t}</span>`, 'jc');
function jitemIcon(id, big) { const ic = itemIcon(id), s = big ? 2 : 1; return `<img class="ji" src="${itemURL(id)}" alt="" style="width:${jc(ic.width * s)};height:${jc(ic.height * s)}">`; }
function jlist(tab) { return tab === 'salv' ? SALVAGE : ARTIFACTS; }
const jstat = [['TOTAL DIGS', () => S.stats.digs | 0], ['SITE DIGS', () => S.stats.sdigs | 0], ['BAG', () => bagUsed() + '/' + bagCap()], ['COINS', () => S.coins | 0],
  ['COLLECTION', () => ARTIFACTS.filter(a => found(a.id)).length + '/' + ARTIFACTS.length], ['BEST FIND', () => (S.arts.reduce((m, a) => Math.max(m, a.pct), 0) || '-') + (S.arts.length ? '%' : '')], ['SALVAGE', () => Object.values(S.mats).reduce((a, b) => a + (b | 0), 0)]];

function pageLog(side, sx) {
  if (side === 'l') {
    const list = jlist(JR.tab.log), cs = jp('clog_grid').cells; let h = jart('clog_grid', sx);
    h += [['art', 'ARTIFACTS', 'clog_tab_a'], ['salv', 'SALVAGE', 'clog_tab_b']].map(t => { const on = JR.tab.log === t[0], pc = jp(t[2]); return jimg(t[2], sx - JR_ORG.l, 1, on ? '' : 'jtabdim') + jbox(sx + pc.x - JR_ORG.l, pc.y + 1, pc.w, pc.h, `<span>${t[1]}</span>`, 'jtab' + (on ? ' on' : ''), `data-act="jtab:${t[0]}"`); }).join('');   // the two painted tabs; the one you are not on is a shade darker
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
    h += jeditIcon(sx, false);
    const items = [], mats = SALVAGE.filter(s => (S.mats[s.id] | 0) > 0).map(s => ({ id: s.id, n: S.mats[s.id], name: s.name }));
    items.push(...mats, ...S.arts.slice().reverse().map(a => ({ id: a.id, pct: a.pct, name: ITEM[a.id].name }))); const cap = bagCap();
    jp('bag_inv').cells.forEach((c, k) => { const it = items[k], r = jrect('bag_inv', k, sx); h += jbox(r[0], r[1], r[2], r[3], it ? `${jitemIcon(it.id)}<em>${it.n ? it.n : it.pct + '%'}</em>` : '', 'jslot' + (k >= cap ? ' jlk' : ''), k >= cap ? 'title="Locked: buy a bigger pack from the merchant"' : it ? `title="${it.name}"` : ''); });
    return h;
  }
  let h = jart('com_right', sx) + jhead('STATS', sx);
  const rows = jstat.concat([['MATTOCK', () => mattock().n.replace(' Mattock', '').toUpperCase()], ['BRUSH', () => brush().n.replace(' Brush', '').toUpperCase() || 'PLAIN']]);
  rows.filter(r => r[0] !== 'SALVAGE').forEach((s, k) => { h += jbox(sx + 4, 40 + k * 10, 69, 10, `<span>${s[0]}</span><b>${s[1]()}</b>`, 'jrow jline'); });
  return h;
}
function jeditIcon(sx, open) {   // the edit icon in the corner of the portrait: tan while you are on the bag page, darker while the character page is open (and then it takes you back)
  return jbox(sx + 29, 73, 9, 9, `<img class="jl${open ? ' jdark' : ''}" src="assets/ui/journal/edit_pencil.png" alt="" decoding="sync" style="left:${jc(2)};top:${jc(2)};width:${jc(5)}">`, 'jbtn', open ? 'data-act="jpage:bag" title="Back to the bag"' : 'data-act="jedit" title="Edit your character"');
}
function jhero(sx, click) {   // your character drawn live in the portrait frame (the frame's own painted figure is not used). On the bag page he walks on the spot and turns through all eight directions
  return `<canvas class="jhero${click ? '' : ' spin'}" width="32" height="48" style="left:${jx(sx + 3)};top:${jy(28)};width:${jc(32)};height:${jc(48)}"></canvas>` + (click ? jbox(sx, 28, 38, 54, '', 'jbtn', 'data-act="jturn" title="Turn around"') : '');
}
const JR_SPIN = 0.8;   // seconds he faces each of the eight directions on the bag page (a full turn takes eight times this)
JR.drawHero = function () {
  const t = performance.now() / 1000;
  document.querySelectorAll('#jrstage .jhero').forEach(cv => {
    if (typeof heroSprite !== 'function' || !HERO.base) return; const spin = cv.classList.contains('spin'), c = cv.getContext('2d');
    const face = spin ? Math.floor(t / JR_SPIN) % 8 : [0, 2, 4, 6][JR.dir || 0], frame = spin ? 1 + Math.floor(t * WALK_FPS) % 4 : 0;   // walk frames 1 to 4, or the idle pose when he is standing for the editor
    c.clearRect(0, 0, 32, 48); c.imageSmoothingEnabled = false; c.drawImage(heroSprite(face, frame), 0, 0);
  });
  const need = !!document.querySelector('#jrstage .jhero.spin');
  if (need && !JR.spinTimer) JR.spinTimer = setInterval(() => { if (UI.cur !== 'journal') { clearInterval(JR.spinTimer); JR.spinTimer = null; return; } JR.drawHero(); }, 80);
  else if (!need && JR.spinTimer) { clearInterval(JR.spinTimer); JR.spinTimer = null; }
};
function jroles() { return LOOK_ROLES.filter(r => r[0] === 'hair' ? (HERO.tint.hairStyle || HAIR_STYLES[0]) !== 'none' : (HERO.roles[r[0]] || []).length); }
function jcur(r) { return HERO.tint[r] || nearestIn(PALETTE[r], '#' + (r === 'hair' ? ((HERO.hair[HERO.tint.hairStyle || HAIR_STYLES[0]] || { main: [136, 96, 75] }).main.map(v => v.toString(16).padStart(2, '0')).join('')) : heroRoleColor(r).map(v => v.toString(16).padStart(2, '0')).join(''))); }
function pageEditSingle(side, sx) {   // on a tall screen: one page has the portrait with a category picker and its swatches (so you watch him change while you choose), the other has the name, hair style and Save
  if (side === 'l') {
    const roles = jroles(); if (!roles.some(r => r[0] === JR.cat)) JR.cat = roles[0][0];
    let h = ['edit_panel', 'bag_portrait', 'bag_clouds'].map(n => jart(n, sx)).join('') + jhero(sx, true) + jeditIcon(sx, true);
    roles.forEach(([r, n], k) => { h += jbox(sx + 41 + (k % 2) * 18, 30 + Math.floor(k / 2) * 17, 17, 16, `<button class="jcat ${JR.cat === r ? 'on' : ''}" data-act="jcat:${r}"><i class="jchip" style="background:${jcur(r)}"></i><span>${n.toUpperCase()}</span></button>`, ''); });
    const nm = (roles.find(r => r[0] === JR.cat) || ['', ''])[1];
    h += jbox(sx + 3, 86, 71, 6, `<span class="jh jsm">${nm.toUpperCase()} COLOUR</span>`, 'jc');
    h += jbox(sx + 3, 94, 71, 27, PALETTE[JR.cat].map(c => `<button class="jsw big ${c === jcur(JR.cat) ? 'on' : ''}" style="background:${c}" data-act="jcol:${JR.cat}:${c}" aria-label="${nm} ${c}"></button>`).join(''), 'jsws wrap');
    return h;
  }
  const hs = HERO.tint.hairStyle || HAIR_STYLES[0]; let h = jart('com_right', sx) + jhead('DETAILS', sx);
  h += jbox(sx + 4, 39, 69, 5, '<span class="jh jsm">NAME</span>', 'jc') + jbox(sx + 4, 45, 69, 10, `<input id="jname" class="jin" maxlength="14" value="${esc(JR.name != null ? JR.name : S.name)}" autocomplete="off" spellcheck="false">`, '');
  h += jbox(sx + 4, 59, 69, 5, '<span class="jh jsm">HAIR STYLE</span>', 'jc');
  ['none', ...HAIR_STYLES].slice(0, 3).forEach((id, k) => { h += jbox(sx + 4, 65 + k * 10, 69, 9, `<button class="jtog sm ${hs === id ? 'on' : ''}" data-act="jhair:${id}" style="min-width:0;width:100%">${id === 'none' ? 'BALD' : id.toUpperCase()}</button>`, ''); });
  h += jbox(sx + 4, 97, 33, 9, '<button class="jtog sm" data-act="jrand" style="min-width:0;width:100%">RANDOM</button>', '') + jbox(sx + 40, 97, 33, 9, '<button class="jtog sm" data-act="jreset" style="min-width:0;width:100%">RESET</button>', '');
  h += jbox(sx + 4, 108, 69, 11, '<button class="jtog on" data-act="jdone" style="width:100%">SAVE</button>', '') + jbox(sx + 4, 120, 69, 4, '<span class="jh jerr" id="jerr"></span>', 'jc');
  return h;
}
function pageEdit(side, sx) {   // the character page: the left page holds the portrait, name and hair; the right page the colours
  if (JR.mode === 'single') return pageEditSingle(side, sx);
  if (side === 'l') {
    const hs = HERO.tint.hairStyle || HAIR_STYLES[0]; let h = ['edit_panel', 'bag_portrait', 'bag_clouds'].map(n => jart(n, sx)).join('') + jhero(sx, true) + jeditIcon(sx, true);
    h += jbox(sx + 41, 30, 36, 6, '<span class="jh jsm">HAIR</span>', 'jc');
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
    h += jbox(sx + 2, 38 + k * 15, 73, 5, `<span class="jh jsm">${n.toUpperCase()}</span>`, 'jc');
    h += jbox(sx + 2, 43 + k * 15, 73, 9, PALETTE[r].map(c => `<button class="jsw ${c === cur ? 'on' : ''}" style="background:${c}" data-act="jcol:${r}:${c}" aria-label="${n} ${c}"></button>`).join(''), 'jsws');
  });
  return h;
}
function pageCom(side, sx) {
  if (side === 'l') return ['com_left', 'com_bg', 'com_plaque', 'com_prog', 'dino0'].map(n => jart(n, sx)).join('') + jhead('SEASON EXHIBIT', sx) + jbox(sx + 46 - 35, 84, 55, 14, '<span class="jh jsm">COMING SOON</span>', 'jc', '');
  return ['com_right', 'com_slots', 'com_plaques'].map(n => jart(n, sx)).join('') + jhead('PERMANENT EXHIBIT', sx);
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
    let h = jart('tasks_panel', sx); const pick = Math.min(JR.task | 0, tp.rows.length - 1); h += jimg('task_sel', sx - JR_ORG.l, tp.rows[pick][1] - tp.rows[0][1]);   // the picked task's row takes the darker inside colour
    const A = jp('tab_sel'), B = jp('tab_idle'), slots = [[A.x, A.y, 'day', 'TODAY'], [B.x, B.y, 'week', 'WEEK']];   // the chosen tab is the dark one, so the two swap places' looks
    slots.forEach(([x, y, key, label]) => { const on = JR.tasks === key, pc = on ? A : B; h += jbox(sx + x - 35, y, pc.w, pc.h, `<img class="jl" src="assets/ui/journal/${on ? 'tab_sel' : 'tab_idle'}.png" alt="" style="left:0;top:0;width:${jc(pc.w)}"><span class="jh jsm" style="position:relative;opacity:1;color:${on ? '#e9d4c4' : '#594237'}">${label}</span>`, 'jc jbtn', `data-act="jtasks:${key}"`); });
    h += jbox(sx + 3, 30, 71, 8, `<span class="jh jsm">${JR.tasks === 'day' ? 'RESETS AT MIDNIGHT' : 'RESETS ON MONDAY'}</span>`, 'jc');
    const list = JR_TASKS[JR.tasks]; tp.rows.forEach((r, k) => {
      const t = list[k]; if (!t) return; const base = tr[JR.tasks][t[1]], v = Math.min(t[2], tr.cur[t[1]] - base), done = v >= t[2];
      h += jbox(sx + r[0] - 35 + 15, r[1], r[2] - 19, r[3], `<span>${t[0]}</span><b>${done ? 'DONE' : v + '/' + t[2]}</b>`, 'jrow jtask jpick' + (done ? ' done' : ''), `data-act="jtask:${k}"`);
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
    + jtoggle('LIGHTING', S.light !== false, 'jlight', 68, sx) + jtoggle('SHADOWS', S.shadows !== false, 'jshadow', 82, sx)
    + jbox(sx + 4, 100, 69, 18, '<span class="jh jsm">ARCHIVE THE WEB</span>', 'jc');
}
const JR_FN = { log: pageLog, bag: pageBag, edit: pageEdit, com: pageCom, tasks: pageTasks, set: pageSet };

// ---- the book ------------------------------------------------------------------------------------------------------------------------------------
// The book is built once per screen size: the art that never changes (the book, its pages, the ribbons) stays in place, and a click only swaps the page content on top.
// Swapping happens after the new pictures have decoded, in a single frame, so nothing blinks.
JR.render = function (force) {
  const el = document.getElementById('jr'); if (!el || !JR.ready) return; JR.fit(); const b = JR.box, spread = JR.mode === 'spread', stage = document.getElementById('jrstage'), key = JR.mode + ':' + JR.u;
  el.style.setProperty('--u', JR.u + 'px'); el.classList.toggle('single', !spread);
  if (force || JR.key !== key || !document.getElementById('jrcont')) {
    JR.key = key; stage.style.width = jc(b.x1 - b.x0); stage.style.height = jc(b.y1 - b.y0);
    const L = ['back_l', 'edge_l', 'block_l'], R = ['back_r', 'edge_r', 'block_r'];
    const b1 = L.concat(R).map(n => jimg(n)).join('') + (spread ? jimg('tab_left') : '') + jimg('tab_time') + (spread ? jimg('tab_dot') : '');
    const ribs = JR_PAGES.map(p => {   // on a tall screen the settings ribbon joins the others on the right, turned around to face outward
      const rp = jp(p[2]), ip = jp(p[3]), gear = p[0] === 'set', mirror = gear && !spread, x = mirror ? 211 : rp.x, y = mirror ? 112 : rp.y, il = ip.x - rp.x - (mirror ? 2 : 0);   // the turned-around gear ribbon: tucked two pixels back under the book, its icon two pixels further out in its own frame (so the same position on screen as the other ribbons' icons)
      return `<button class="jrib" data-page="${p[0]}" data-mirror="${mirror ? 1 : 0}" data-left="${gear && spread ? 1 : 0}" data-act="jpage:${p[0]}" aria-label="${p[1]}" style="left:${jx(x)};top:${jy(y)};width:${jc(rp.w)};height:${jc(rp.h)}"><img src="assets/ui/journal/${p[2]}.png" alt="" decoding="sync" style="left:0;top:0;width:${jc(rp.w)}"><img src="assets/ui/journal/${p[3]}.png" alt="" decoding="sync" style="left:${jc(il)};top:${jc(ip.y - rp.y)};width:${jc(ip.w)}"></button>`;
    }).join('');
    const b2 = jimg('lines_l') + jimg('lines_r') + jimg('page_l') + jimg('page_r');
    const bk = jp('bookmark'), mark = spread ? jimg('bookmark') : `<button class="jmark" data-act="jflip" aria-label="Turn the page" style="left:${jx(193)};top:${jy(bk.y)};width:${jc(bk.w)};height:${jc(bk.h)}"><img src="assets/ui/journal/bookmark.png" alt="" decoding="sync" style="width:${jc(bk.w)}"></button>`;   // the bookmark sits behind the front page with only its tail showing; on a tall screen it turns the page
    stage.innerHTML = `<div class="jlayer">${b1}</div><div class="jlayer" id="jrrib">${ribs}${mark}</div><div class="jlayer">${b2}</div><div class="jlayer" id="jrcont"></div>`;
  }
  JR.ribbons(); JR.content(!!force);
};
JR.ribbons = function () {   // the chosen ribbon slides out a little; nothing else about them changes
  const spread = JR.mode === 'spread';
  document.querySelectorAll('#jrrib .jrib').forEach(r => { const sel = JR.page === r.dataset.page || (JR.page === 'edit' && r.dataset.page === 'bag'); r.classList.toggle('on', sel); r.style.transform = `translateX(${jc((r.dataset.left === '1' ? -3 : 3) * (sel ? 1 : 0))})${r.dataset.mirror === '1' ? ' scaleX(-1)' : ''}`; });
};
function jarrow(dir, on) {   // a little pixel arrow, five rows tall, pointing right (turned round for the left one)
  let r = ''; for (let y = 0; y < 5; y++) r += `<rect x="0" y="${y}" width="${Math.min(y, 4 - y) + 1}" height="1"/>`;
  return `<button class="jarr ${dir} ${on ? 'on' : 'off'}" ${on ? 'data-act="jflip"' : 'disabled'} aria-label="${dir === 'l' ? 'Previous page' : 'Next page'}"><svg viewBox="0 0 3 5" shape-rendering="crispEdges" style="width:${jc(3)};height:${jc(5)}" fill="currentColor">${r}</svg></button>`;
}
function jarrows() {   // on a tall screen: arrows and two dots at the foot of the page, so nobody has to guess that it can be swiped
  const ring = [[1, 0, 3, 1], [0, 1, 1, 3], [4, 1, 1, 3], [1, 4, 3, 1]], fill = [[1, 1, 3, 3]], dot = on => `<svg class="jdot" viewBox="0 0 5 5" shape-rendering="crispEdges" style="width:${jc(5)};height:${jc(5)}" fill="#594237">${(on ? ring.concat(fill) : ring).map(r => `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}"/>`).join('')}</svg>`;   // a five-pixel round dot, drawn pixel by pixel: hollow, or filled for the page you are on
  const dots = [0, 1].map(i => dot(JR.side === i)).join('');
  return jbox(136, 124, 16, 9, jarrow('l', JR.side === 1), 'jc') + jbox(194, 124, 16, 9, jarrow('r', JR.side === 0), 'jc') + jbox(160, 124, 24, 9, dots, 'jc jdots');
}
JR.content = function (instant) {
  const spread = JR.mode === 'spread', pg = JR_PAGES.find(p => p[0] === JR.page) || ['edit', 'CHARACTER'], fn = JR_FN[JR.page]; let h = '';
  if (spread) { h += jbox(34, 11, 48, 8, `<span class="jh jtl">${pg[1]}</span>`, 'jc'); h += jbox(168, 12, 36, 7, `<span class="jh jtl" id="jclock">${jrTime()}</span>`, 'jl2'); }
  else h += jbox(151, 12, 52, 7, `<span class="jh jtl">${pg[1]}</span>`, 'jc');   // the page name sits on the right-hand tab
  if (spread) h += fn('l', JR_ORG.l) + fn('r', JR_ORG.r); else h += fn(JR.side ? 'r' : 'l', JR_ORG.r) + jarrows();   // on a tall screen both halves of a section take turns on the right page
  const tmp = document.createElement('div'), token = JR.token = (JR.token || 0) + 1; tmp.innerHTML = h;
  const swap = () => { if (token !== JR.token) return; const cont = document.getElementById('jrcont'); if (!cont) return; cont.replaceChildren(...tmp.childNodes); JR.drawHero(); };
  const imgs = [...tmp.querySelectorAll('img')]; if (!imgs.length) return swap();
  Promise.all(imgs.map(i => i.decode ? i.decode().catch(() => { }) : 0)).then(swap);
};
function jrTime() { const d = new Date(), h = d.getHours() % 12 || 12, m = String(d.getMinutes()).padStart(2, '0'); return h + ':' + m + (d.getHours() < 12 ? 'AM' : 'PM'); }
UI.openJournal = function (page) {
  if (!JR.ready) { JR.wantOpen = true; JR.load(); return; } JR.wantOpen = false; if (UI.isOpen && UI.cur !== 'journal') UI.close();
  if (page) JR.page = page; const el = document.getElementById('jr'); el.classList.remove('hidden'); UI.isOpen = true; UI.cur = 'journal'; JR.render(); sfx('pop');
  clearInterval(JR.clock); JR.clock = setInterval(() => { const c = document.getElementById('jclock'); if (c) c.textContent = jrTime(); }, 20000);
};
JR.keepName = function () { const i = document.getElementById('jname'); if (i) JR.name = i.value; };
UI.journalClosed = function () { JR.name = null; clearInterval(JR.spinTimer); JR.spinTimer = null; const el = document.getElementById('jr'); if (el) el.classList.add('hidden'); clearInterval(JR.clock); };
UI.journalClick = function (a, p1, p2) {   // returns true when the click was for the journal
  switch (a) {
    case 'jpage': JR.page = p1; JR.side = 0; JR.sel = 0; JR.render(); sfx('ui'); return true;
    case 'jflip': JR.side = JR.side ? 0 : 1; JR.render(); sfx('ui'); return true;
    case 'jtab': JR.tab.log = p1; JR.sel = 0; JR.render(); sfx('ui'); return true;
    case 'jsel': JR.sel = +p1; if (JR.mode === 'single') JR.side = 1; JR.render(); sfx('ui'); return true;
    case 'jsnd': S.sound = !S.sound; if (S.sound) audioInit(); saveState(); JR.render(); return true;
    case 'jlight': S.light = !(S.light !== false); FEATURES.light = S.light; saveState(); JR.render(); return true;
    case 'jshadow': S.shadows = !(S.shadows !== false); FEATURES.shadows = S.shadows; saveState(); JR.render(); return true;
    case 'jlefty': S.lefty = !S.lefty; document.body.classList.toggle('lefty', S.lefty); saveState(); JR.render(); return true;
    case 'jedit': JR.page = 'edit'; JR.side = 0; JR.name = null; JR.render(); return true;
    case 'jturn': JR.dir = ((JR.dir || 0) + 1) % 4; JR.drawHero(); return true;
    case 'jtasks': JR.tasks = p1; JR.render(); return true;
    case 'jtask': JR.task = +p1; JR.render(); sfx('ui'); return true;
    case 'jhair': JR.keepName(); HERO.tint.hairStyle = p1; heroApply(); JR.render(); return true;
    case 'jcol': HERO.tint[p1] = p2; heroApply(); JR.drawHero(); document.querySelectorAll(`#jrstage .jsw[data-act^="jcol:${p1}:"]`).forEach(b => b.classList.toggle('on', b.dataset.act === 'jcol:' + p1 + ':' + p2)); if (JR.mode === 'single') document.querySelectorAll('#jrstage .jcat').forEach(b => { if (b.dataset.act === 'jcat:' + p1) b.querySelector('.jchip').style.background = p2; }); return true;
    case 'jcat': JR.cat = p1; JR.content(); return true;
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
