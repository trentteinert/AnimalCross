'use strict';
// Panels for the fishing shop, fish tank, leaderboard, gem shop and daily outfit shop.
const isFish = i => ITEM[i.id].cat === 'fish';
const fishVal = v => Math.round(v * (S.gearOwned.includes('coin') ? 1.05 : 1));
function spend(cost, lv) {
  if (S.lv < lv) { UI.toast('Reach level ' + lv + ' first', 'info'); sfx('no'); return false; }
  if (S.gold < cost) { UI.toast('Not enough gold yet', 'info'); sfx('no'); return false; }
  S.gold -= cost; sfx('coin'); return true;
}
function srow(img, name, desc, btn, cls) { return `<div class="row ${cls || ''}"><img src="${img}" alt=""><div class="grow"><b>${esc(name)}</b><small>${esc(desc)}</small></div>${btn}</div>`; }
function priceBtn(act, cost, lv) { return S.lv < lv ? `<button class="btn small lock" data-act="${act}">Lv ${lv}</button>` : `<button class="btn small ${S.gold >= cost ? '' : 'dis'}" data-act="${act}">${cost}g</button>`; }
const gemBtn = (act, n, dis) => `<button class="btn small gemb ${dis ? 'dis' : ''}" data-act="${act}">${gemImg}${n}</button>`;
function tabsHTML(list, cur, act) { return `<div class="tabs">${list.map(t => `<button class="tab ${t[0] === cur ? 'on' : ''}" data-act="${act}:${t[0]}">${t[1]}</button>`).join('')}</div>`; }
function modalShell(id, title, extra) { UI.open(id, `<div id="${id}box"></div>`); UI.cur = id; UI['render' + id[0].toUpperCase() + id.slice(1)](extra); }

// ---- fishing shop ---------------------------------------------------------------
const ROD_COLS = ['#a8743a', '#5fbf5a', '#78bfff', '#ffd23f'];
UI.openTackle = function (tab) { UI.tab2 = tab || 'sell'; modalShell('tackle', 'Fishing Shop', UI.tab2); sfx('coin'); };
UI.renderTackle = function (tab) {
  UI.tab2 = tab = tab || UI.tab2; const host = $('#tacklebox'); if (!host) return; let body = '';
  const tabs = tabsHTML([['sell', 'Sell'], ['rods', 'Rods'], ['tackle', 'Tackle'], ['bait', 'Bait'], ['gear', 'Gear']], tab, 'tk');
  if (tab === 'sell') {
    const g = grouped(isFish), tot = S.bag.filter(isFish).reduce((s, i) => s + fishVal(i.val), 0);
    body = g.length ? `<div class="list">${g.map(x => `<div class="row"><img src="${itemURL(x.id)}" alt=""><div><b>${esc(ITEM[x.id].name)}</b><small>×${x.n}</small></div><span class="gold">${fishVal(x.val)}g</span></div>`).join('')}</div><button class="btn big" data-act="sellfish">Sell all fish · +${tot}g</button>${S.gearOwned.includes('coin') ? '<p class="note">Lucky Coin: +5% on fish.</p>' : ''}<p class="note">Want to keep a prize catch? Put it in the fish tank first.</p>`
      : '<p class="empty">No fish in your bag. This shop only buys fish. Bugs, berries and beach finds sell at the General Market.</p>';
  } else if (tab === 'rods') {
    const rd = TOOLS.rod[S.tools.rod + 1], rl = GEAR.reel[S.gear.reel], ln = GEAR.line[S.gear.line];
    body = `<p class="note">Using: ${TOOLS.rod[S.tools.rod].n}${S.gear.reel ? ', ' + GEAR.reel[S.gear.reel - 1].n : ''}${S.gear.line ? ', ' + GEAR.line[S.gear.line - 1].n : ''}</p><div class="list">` +
      (rd ? srow(shopIconURL('rod', ROD_COLS[S.tools.rod + 1]), rd.n, 'Faster bites, rarer fish.', priceBtn('tkb:rod', rd.cost, rd.lv)) : srow(shopIconURL('rod', ROD_COLS[3]), TOOLS.rod[3].n, 'Your best rod.', '<span class="max">MAX</span>')) +
      (rl ? srow(shopIconURL('reel', '#f2b84b'), rl.n, rl.d, priceBtn('tkb:reel', rl.cost, rl.lv)) : srow(shopIconURL('reel', '#f2b84b'), 'Reels', 'All reels owned.', '<span class="max">MAX</span>')) +
      (ln ? srow(shopIconURL('line', '#6cbc6a'), ln.n, ln.d, priceBtn('tkb:line', ln.cost, ln.lv)) : srow(shopIconURL('line', '#6cbc6a'), 'Lines', 'All lines owned.', '<span class="max">MAX</span>')) + '</div>';
  } else if (tab === 'tackle') {
    body = `<div class="list">${BOBBERS.map(b => { const own = S.bobbers.includes(b.id), eq = S.bobberSel === b.id; return srow(shopIconURL(b.id === 'spinner' ? 'spinner' : b.id === 'feather' ? 'feather' : 'bobber', b.col), b.n, b.d, own ? `<button class="btn small ${eq ? 'on' : ''}" data-act="tkq:bob:${b.id}">${eq ? 'Equipped' : 'Equip'}</button>` : priceBtn('tkb:bob:' + b.id, b.cost, b.lv)); }).join('')}</div><p class="note">One bobber at a time. Tap Equipped again to remove it.</p>`;
  } else if (tab === 'bait') {
    body = `<div class="list">${BAITS.map(b => { const n = S.bait[b.id] || 0, sel = S.baitSel === b.id; return srow(shopIconURL('bait', b.col), b.n + ' ×' + b.qty, b.d + (n ? '  (you have ' + n + ')' : ''), `<div class="col2">${priceBtn('tkb:bait:' + b.id, b.cost, b.lv)}${n ? `<button class="btn small ${sel ? 'on' : ''}" data-act="tkq:bait:${b.id}">${sel ? 'In use' : 'Use'}</button>` : ''}</div>`); }).join('')}</div><p class="note">Each cast uses one bait.</p>`;
  } else {
    const pg = TOOLS.bag[S.tools.bag + 1];
    body = `<div class="list">${pg ? srow(shopIconURL('pouch'), pg.n, pg.d, priceBtn('tkb:pouch', pg.cost, pg.lv)) : srow(shopIconURL('pouch'), TOOLS.bag[3].n, 'Biggest bag.', '<span class="max">MAX</span>')}` +
      GEARS.map(g2 => { const own = S.gearOwned.includes(g2.id); return srow(shopIconURL(g2.id), g2.n, g2.d, own ? '<span class="max">Owned</span>' : priceBtn('tkb:gear:' + g2.id, g2.cost, g2.lv)); }).join('') + '</div>';
  }
  host.innerHTML = `${head('Fishing Shop')}<div class="wallet"><img src="${actURL('coin')}" alt=""><b>${S.gold}g</b></div>${tabs}<div class="mbody">${body}</div>`;
};
function tackleBuy(type, id) {
  if (type === 'rod') { const n = TOOLS.rod[S.tools.rod + 1]; if (n && spend(n.cost, n.lv)) { S.tools.rod++; UI.toast(n.n + ' unlocked!', 'gold'); } }
  else if (type === 'reel') { const n = GEAR.reel[S.gear.reel]; if (n && spend(n.cost, n.lv)) { S.gear.reel++; UI.toast(n.n + ' equipped', 'gold'); } }
  else if (type === 'line') { const n = GEAR.line[S.gear.line]; if (n && spend(n.cost, n.lv)) { S.gear.line++; UI.toast(n.n + ' equipped', 'gold'); } }
  else if (type === 'bob') { const b = BOBBERS.find(x => x.id === id); if (b && !S.bobbers.includes(id) && spend(b.cost, b.lv)) { S.bobbers.push(id); S.bobberSel = id; UI.toast(b.n + ' equipped', 'gold'); } }
  else if (type === 'bait') { const b = BAITS.find(x => x.id === id); if (b && spend(b.cost, b.lv)) { S.bait[id] = (S.bait[id] || 0) + b.qty; if (!S.baitSel) S.baitSel = id; UI.toast('+' + b.qty + ' ' + b.n, 'gold'); } }
  else if (type === 'pouch') { const n = TOOLS.bag[S.tools.bag + 1]; if (n && spend(n.cost, n.lv)) { S.tools.bag++; UI.toast(n.n + ': ' + n.d, 'gold'); } }
  else if (type === 'gear') { const g2 = GEARS.find(x => x.id === id); if (g2 && !S.gearOwned.includes(id) && spend(g2.cost, g2.lv)) { S.gearOwned.push(id); UI.toast(g2.n + ' ready!', 'gold'); } }
  UI.refresh();
}
function tackleEquip(type, id) {
  if (type === 'bob') S.bobberSel = S.bobberSel === id ? null : id; else S.baitSel = S.baitSel === id ? null : id; UI.refresh();
}
function sellFish() {
  const list = S.bag.filter(isFish); if (!list.length) return; const tot = list.reduce((s, i) => s + fishVal(i.val), 0);
  S.bag = S.bag.filter(i => !isFish(i)); S.gold += tot; S.stats.earned += tot; sfx('coin'); UI.toast(`Sold ${list.length} fish for ${tot}g`, 'gold'); questEvent('sell', 1); UI.refresh();
}

// ---- fish tank ---------------------------------------------------------------------
UI.openTank = function () { modalShell('tank', 'Fish Tank'); };
UI.renderTank = function () {
  const host = $('#tankbox'); if (!host) return; const cells = [];
  for (let i = 0; i < S.tankSlots; i++) {
    const f = S.tank[i];
    cells.push(f ? `<button class="cell r${ITEM[f.id].r}" data-act="tank:take:${i}"><img src="${itemURL(f.id)}" alt=""><span>${esc(ITEM[f.id].name)}</span><small>${fmtSz(f)}</small></button>` : '<div class="cell empty-slot"><span>Empty</span></div>');
  }
  const mine = S.bag.map((f, i) => ({ f, i })).filter(x => isFish(x.f) && x.f.sz != null).sort((a, b) => b.f.sz - a.f.sz);
  host.innerHTML = `${head('Fish Tank')}<p class="note">Keep your prized fish safe and on display. Fish in the tank swim in the tank on the map, and can't be sold by accident.</p>
  <div class="grid g3">${cells.join('')}</div><h4>Your fish (${S.tank.length}/${S.tankSlots} slots used)</h4>
  <div class="list">${mine.length ? mine.map(x => `<div class="row"><img src="${itemURL(x.f.id)}" alt=""><div class="grow"><b>${esc(ITEM[x.f.id].name)}</b><small>${fmtSz(x.f)} · ${RAR[ITEM[x.f.id].r].n}</small></div><button class="btn small ${S.tank.length >= S.tankSlots ? 'dis' : ''}" data-act="tank:put:${x.i}">Display</button></div>`).join('') : '<p class="empty">No fish in your bag right now.</p>'}</div>`;
};
function tankPut(i) { const f = S.bag[i]; if (!f) return; if (S.tank.length >= S.tankSlots) { UI.toast('The tank is full', 'info'); sfx('no'); return; } S.tank.push(f); S.bag.splice(i, 1); sfx('pop'); UI.refresh(); }
function tankTake(i) { if (bagFull()) { UI.toast('Your bag is full', 'info'); sfx('no'); return; } S.bag.push(S.tank[i]); S.tank.splice(i, 1); sfx('pop'); UI.refresh(); }

// ---- leaderboard (simulated rivals until real multiplayer exists) ---------------------
const RIVALS = ['mossy', 'kelpie', 'pipsqueak', 'fernfox', 'tidy88', 'lilac', 'noodle', 'bramble', 'sunny', 'quill', 'marlow', 'poppy', 'otter_k', 'dune', 'wren', 'basil', 'cinder', 'juniper', 'teal', 'hazel'];
function rivalStats() {
  const d = new Date(), day = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  return RIVALS.map((n, i) => ({ name: n, lv: 4 + Math.floor(hash2(i, 1, 900) * 36 + (day % 7) * 0.2), fish: 30 + Math.floor(hash2(i, 2, 900) * 900), big: Math.round(40 + hash2(i, 3, 900) * 230), gold: 800 + Math.floor(hash2(i, 4, 900) * 90000) }));
}
UI.openLeaders = function (tab) { UI.tab3 = tab || 'me'; modalShell('leaders', 'Leaderboard', UI.tab3); };
UI.renderLeaders = function (tab) {
  UI.tab3 = tab = tab || UI.tab3; const host = $('#leadersbox'); if (!host) return;
  const st = S.stats, found = ITEMS.filter(i => S.book[i.id]).length, big = st.big ? ITEM[st.big.id].name + ' · ' + Math.round(st.big.sz) + ' cm' : 'None yet', rare = st.rare ? ITEM[st.rare.id].name : 'None yet';
  let body = '';
  if (tab === 'me') {
    const rows = [['Level', S.lv], ['Fish caught', st.fish], ['Things collected', st.total], ['Entries found', found + '/' + ITEMS.length], ['Biggest fish', big], ['Rarest find', rare], ['Gold earned from sales', st.earned + 'g'], ['Tips found', S.notes.length]];
    body = `<div class="list">${rows.map(r => `<div class="row"><div class="grow"><b>${r[0]}</b></div><span class="gold">${esc(r[1])}</span></div>`).join('')}</div>`;
  } else {
    const key = { big: 'big', most: 'fish', level: 'lv', rich: 'gold' }[tab], fmt = { big: v => v + ' cm', most: v => v, level: v => 'Lv ' + v, rich: v => v + 'g' }[tab];
    const me = { name: S.name, me: true, lv: S.lv, fish: st.fish, big: st.big ? Math.round(st.big.sz) : 0, gold: st.earned };
    const all = rivalStats().concat([me]).sort((a, b) => b[key] - a[key]), mine = all.indexOf(me), top = all.slice(0, 10);
    const line = (x, i) => `<div class="row ${x.me ? 'me' : ''}"><span class="rk">${i + 1}</span><div class="grow"><b>${esc(x.name)}</b><small>Lv ${x.lv}</small></div><span class="gold">${fmt(x[key])}</span></div>`;
    body = `<div class="list">${top.map(line).join('')}${mine >= 10 ? '<div class="dots">...</div>' + line(me, mine) : ''}</div><p class="note">Rivals are simulated in this prototype. Real players will appear once multiplayer is connected.</p>`;
  }
  host.innerHTML = `${head('Leaderboard')}${tabsHTML([['me', 'My stats'], ['big', 'Biggest'], ['most', 'Most fish'], ['level', 'Level'], ['rich', 'Richest']], tab, 'ld')}<div class="mbody">${body}</div>`;
};

// ---- gem shop -------------------------------------------------------------------------------
UI.openGems = function () { modalShell('gems', 'Gem Shop'); };
UI.renderGems = function () {
  const host = $('#gemsbox'); if (!host) return;
  const packs = [[100, '$0.99'], [550, '$4.99'], [1200, '$9.99'], [2600, '$19.99']];
  const mins = id => { const t = S.boosts[id]; return t && t > Date.now() ? Math.ceil((t - Date.now()) / 60000) : 0; };
  host.innerHTML = `${head('Gem Shop')}<div class="wallet gems">${gemImg}<b>${S.gems}</b></div>
  <h4>Gem packs</h4><div class="list">${packs.map(p => srow(shopIconURL('gem'), p[0] + ' gems', 'Payments are not connected in this prototype.', `<button class="btn small dis" data-act="gem:pack">${p[1]}</button>`)).join('')}</div>
  <h4>Boosts</h4><div class="list">${BOOSTS.map(b => { const left = mins(b.id), owned = b.once && S.boosts[b.id]; return srow(shopIconURL(b.once ? 'tank' : 'boost'), b.n, b.d + (left ? `  (${left} min left)` : ''), owned ? '<span class="max">Owned</span>' : gemBtn('gem:buy:' + b.id, b.gem, S.gems < b.gem)); }).join('')}</div>
  <p class="note">Outfits are in the daily outfit shop.</p>`;
};
function gemBuy(id) {
  const b = BOOSTS.find(x => x.id === id); if (!b) return; if (S.gems < b.gem) { UI.toast('Not enough gems', 'info'); sfx('no'); return; }
  if (b.once) { if (S.boosts[id]) return; S.boosts[id] = true; S.tankSlots += 3; } else S.boosts[id] = Math.max(Date.now(), S.boosts[id] || 0) + b.min * 60000;
  S.gems -= b.gem; sfx('level'); UI.toast(b.n + ' active!', 'gold'); UI.refresh();
}

// ---- daily outfit shop -----------------------------------------------------------------------
const RAR_NAMES = ['Common', 'Uncommon', 'Rare', 'Legendary'];
const outfitLook = o => o.slot === 'hat' ? Object.assign({}, S.look, { hat: o.hat, hatc: o.col }) : Object.assign({}, S.look, { style: o.style, topc: o.col });
const outfitWorn = o => o.slot === 'hat' ? (S.look.hat === o.hat && S.look.hatc === o.col) : (S.look.style === o.style && S.look.topc === o.col);
UI.openOutfits = function () { UI.tab4 = 'shop'; modalShell('outfits', 'Daily Threads'); };
UI.renderOutfits = function () {
  const host = $('#outfitsbox'); if (!host) return; let body;
  if (UI.tab4 === 'mine') {
    const mine = OUTFITS.filter(o => S.outfits.includes(o.id));
    body = `<div class="list">${mine.length ? mine.map(o => srow(charURL(outfitLook(o)), o.n, RAR_NAMES[o.r] + ' ' + (o.slot === 'hat' ? 'hat' : 'top'), `<button class="btn small ${outfitWorn(o) ? 'on' : ''}" data-act="of:eq:${o.id}">${outfitWorn(o) ? 'Worn' : 'Wear'}</button>`, 'r' + o.r)).join('') : '<p class="empty">You do not own any outfits yet.</p>'}</div><button class="btn small" data-act="of:shop">Back to the shop</button>`;
  } else {
    const ms = msToMidnight(), hh = Math.floor(ms / 3600000), mm = Math.floor(ms / 60000) % 60;
    body = `<p class="note">"Fresh threads daily. Snip snip!"</p><div class="list">${dailyOutfits().map(o => { const own = S.outfits.includes(o.id); return srow(charURL(outfitLook(o)), o.n, RAR_NAMES[o.r], own ? `<button class="btn small ${outfitWorn(o) ? 'on' : ''}" data-act="of:eq:${o.id}">${outfitWorn(o) ? 'Worn' : 'Wear'}</button>` : gemBtn('of:buy:' + o.id, o.gem.toLocaleString(), S.gems < o.gem), 'r' + o.r); }).join('')}</div>
    <div class="foot"><span class="note">New outfits in ${hh}h ${mm}m</span><button class="btn small" data-act="of:mine">My outfits</button></div>`;
  }
  host.innerHTML = `${head('Daily Threads')}<div class="wallet gems">${gemImg}<b>${S.gems}</b></div>${body}`;
};
function outfitEquip(o) { if (o.slot === 'hat') { S.look.hat = o.hat; S.look.hatc = o.col; } else { S.look.style = o.style; S.look.topc = o.col; } sfx('pop'); UI.refresh(); }

// ---- click routing for these panels -----------------------------------------------------------
UI.onClick2 = function (a, p1, p2, p3) {
  switch (a) {
    case 'tk': UI.renderTackle(p1); break;
    case 'tkb': tackleBuy(p1, p2); break;
    case 'tkq': tackleEquip(p1, p2); break;
    case 'sellfish': sellFish(); break;
    case 'tank': if (p1 === 'put') tankPut(+p2); else tankTake(+p2); break;
    case 'ld': UI.renderLeaders(p1); break;
    case 'gem': if (p1 === 'buy') gemBuy(p2); else UI.toast('Payments open later', 'info'); break;
    case 'of': {
      const o = OUTFITS.find(x => x.id === p2);
      if (p1 === 'buy' && o) { if (S.gems < o.gem) { UI.toast('Not enough gems', 'info'); sfx('no'); } else { S.gems -= o.gem; S.outfits.push(o.id); outfitEquip(o); UI.toast(o.n + ' is yours!', 'gold'); } }
      else if (p1 === 'eq' && o) outfitEquip(o); else if (p1 === 'mine') { UI.tab4 = 'mine'; UI.renderOutfits(); } else if (p1 === 'shop') { UI.tab4 = 'shop'; UI.renderOutfits(); }
      break;
    }
    case 'show': { const f = S.bag.filter(i => i.id === p1).sort((x, y) => (y.sz || 0) - (x.sz || 0))[0]; if (f) { UI.close(); setHold([Object.assign({}, f, { isNew: false })]); sfx('pop'); } break; }
  }
};
