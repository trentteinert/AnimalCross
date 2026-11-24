'use strict';
// ---- inside the museum: the plaques on the display cases and the curator ---------------------------------------------------------------
// Basic for now (made from the journal's painted pieces and the usual frames); a custom look comes later.

let GAME_ID_OF_ART = null;
function caseFinds(o) {   // the finds a museum object stands for: the pieces of a set in a case, a single find, or every piece of a permanent exhibit
  if (o.show) { const it = ITEM[o.show]; return it && it.set ? EXHIBITS.filter(e => e.set === it.set).map(e => e.id) : [o.show]; }
  if (!o.item) return [];
  const d = ASSET.mItems && ASSET.mItems[o.item];
  if (d && d.parts) {
    if (!GAME_ID_OF_ART) { GAME_ID_OF_ART = {}; for (const a of ARTIFACTS) GAME_ID_OF_ART[a.art] = a.id; }
    return [...new Set(d.parts.map(q => GAME_ID_OF_ART[q.k]).filter(id => ITEM[id]))];
  }
  return ITEM[o.item] ? [o.item] : [];
}
const isCaseObj = o => o.k === 'mprop' && !o.nosel && (o.item || o.show) && caseFinds(o).length > 0;
const isCuratorObj = o => o.k === 'mprop' && /^curator/.test(o.n || '');
function museumTargets(px, py, consider) {   // called from findTarget: a case you stand in front of, the curator you stand near
  if (W.theme !== 'museum') return;
  for (const o of W.objs) {
    if (Math.abs(o.x - px) > 50 || Math.abs(o.y - py) > 50) continue;
    if (isCuratorObj(o)) { const d = Math.hypot(o.x - px, o.y - py); consider('curator', o, o.x, o.y - 6, d, 30, -10); continue; }
    if (isCaseObj(o)) {   // in front of it (south), or beside it, close to its base
      const hw = (o.spr ? o.spr.width / 2 : 12) + 4, dx = Math.abs(o.x - px), dy = py - o.y;
      if (dx < hw && dy > -10 && dy < 16) consider('case', o, o.x, o.y - 6, Math.max(0, dy) + dx * 0.3, 40, -6);
    }
  }
}
function whereFound(id) {
  const it = ITEM[id]; if (!it) return '';
  if (it.ex) return 'A piece of a great exhibit: turns up now and then at any dig site';
  return ['Common: the Meadow Dig and open ground', 'Uncommon: most often at the Hillside Dig', 'Rare: mostly at the Deep Dig, digging deep'][it.r] || '';
}

// the plaque: shows by itself while you stand at a case
let PLAQUE_FOR = null, PLAQUE_KEY = '';
UI.plaque = function (o) {
  const el = document.getElementById('plaque'); if (!el) return;
  if (!o) { if (PLAQUE_FOR) { el.classList.add('hidden'); PLAQUE_FOR = null; PLAQUE_KEY = ''; } return; }
  const ids = caseFinds(o), key = ids.map(id => id + (found(id) ? 'y' + bestTier(id) : 'n')).join(',');
  if (o === PLAQUE_FOR && key === PLAQUE_KEY) return; PLAQUE_FOR = o; PLAQUE_KEY = key;
  const ex = ITEM[ids[0]] && ITEM[ids[0]].ex, title = ex ? (ITEM[ids[0]].set || 'Exhibit') : ids.length > 1 ? 'Display case' : (found(ids[0]) ? ITEM[ids[0]].name : '???');
  const have = ids.filter(found).length;
  const row = id => {
    const it = ITEM[id], ok = found(id), c = S.col[id], r = RAR[it.r] || RAR[0], rc = ['#6f747b', '#3f8a4a', '#2f6fae'][it.r] || '#6f747b', t = ok && hasTiers(id) ? bestTier(id) : 0;
    const pic = ok ? `<img src="${itemURL(id, t || 1)}" alt="">` : '<i class="pq">?</i>';
    const stat = ok ? (it.ex ? 'In your collection' : `Found ${c.n} &middot; best ${c.best}% intact${t ? ' &middot; ' + esc(tierName(id, t)) : ''}`) : 'Not found yet';
    return `<div class="prow">${pic}<div><b>${ok ? esc(it.name) : '???'}</b> <em style="color:${rc}">${r.n}</em><small>${stat}</small>${ok && ids.length === 1 && it.desc ? `<p>${esc(it.desc)}</p>` : ''}</div></div>`;
  };
  el.innerHTML = `<div class="ptitle">${esc(title)}</div>${ids.length > 1 ? `<div class="pcount">${have} of ${ids.length} found</div>` : ''}${ids.map(row).join('')}${(() => { const w = [...new Set(ids.filter(id => !found(id)).map(whereFound))]; return w.length ? `<div class="pwhere"><b>Where to look</b>${w.map(x => `<small>${esc(x)}</small>`).join('')}</div>` : ''; })()}`;
  el.classList.remove('hidden');
};
function openPlaqueInJournal(o) {   // pressing at a case opens its first find in the journal's collection log
  const id = caseFinds(o)[0]; if (!id || typeof JR === 'undefined') return;
  const idx = ALL_ART.findIndex(a => a.id === id); if (idx < 0) return;
  JR.page = 'log'; JR.tab.log = 'art'; JR.sel = idx; JR.tierFor = null;
  try { const C = jp('clog_grid').cells.length, L2 = ALL_ART.length, per = L2 > C ? C - 2 : C; JR.pgl = Math.floor(idx / per); } catch (e) { JR.pgl = 0; }
  if (JR.mode === 'single') JR.side = 1; UI.plaque(null); UI.openJournal('log');
}

// the curator: a few lines, tap to go on
const CURATOR_TIPS = ['The rarest pieces sleep deep. Dig lower at the Deep Dig for better odds.', 'A careful brush keeps more of a find intact. Stay in the green!',
  'Pieces of our great exhibits turn up at every dig site. The statue is still missing a few parts.', 'Most finds come in three tiers. Keep an eye out for the gilded ones.',
  'Every case here has a plaque. Walk up to one to see what belongs in it.'];
UI.openTalk = function () {
  const have = ARTIFACTS.filter(a => found(a.id)).length, exh = EXHIBITS.filter(e => found(e.id)).length, nm = S.name || 'friend';
  const lines = [`Welcome to the museum, ${nm}!`,
    have ? `You have found ${have} of ${ARTIFACTS.length} artifacts, and ${exh} of ${EXHIBITS.length} exhibit pieces. Splendid work.` : 'Our cases are waiting. Bring me whatever you dig up: every find has a place here.',
    CURATOR_TIPS[Math.floor(Math.random() * CURATOR_TIPS.length)],
    'Donations open soon. Until then, have a look around!'];
  UI.talk = { lines, i: 0 }; UI.renderTalk(); sfx('pop');
};
UI.renderTalk = function () {
  const t = UI.talk; if (!t) return;
  UI.open('talk', `<div class="tname">Curator</div><p class="tline">${esc(t.lines[t.i])}</p><button class="btn small tnext" data-act="talknext">${t.i < t.lines.length - 1 ? 'Next' : 'Bye!'}</button>`);
};
const _onClick2 = UI.onClick2;
UI.onClick2 = function (a, p1, p2, p3) {
  if (a === 'talknext') { const t = UI.talk; if (t && t.i < t.lines.length - 1) { t.i++; UI.renderTalk(); } else { UI.talk = null; UI.close(); } return; }
  if (_onClick2) _onClick2(a, p1, p2, p3);
};
