'use strict';
// The one shop: the antiquities dealer. Sell what you dug up, buy better picks, brushes, gloves and a bigger bag.
function spend(cost, lv) {
  if (S.lv < lv) { UI.toast('Reach level ' + lv + ' first', 'info'); sfx('no'); return false; }
  if (S.gold < cost) { UI.toast('Not enough gold yet', 'info'); sfx('no'); return false; }
  S.gold -= cost; sfx('coin'); return true;
}
function srow(img, name, desc, btn) { return `<div class="row"><img src="${img}" alt=""><div class="grow"><b>${esc(name)}</b><small>${esc(desc)}</small></div>${btn}</div>`; }
function priceBtn(act, cost, lv) { return S.lv < lv ? `<button class="btn small lock" data-act="${act}">Lv ${lv}</button>` : `<button class="btn small ${S.gold >= cost ? '' : 'dis'}" data-act="${act}">${cost}g</button>`; }
const tabsHTML = (list, cur, act) => `<div class="tabs">${list.map(t => `<button class="tab ${t[0] === cur ? 'on' : ''}" data-act="${act}:${t[0]}">${t[1]}</button>`).join('')}</div>`;

UI.openDealer = function (tab) { UI.open('dealer', '<div id="dealerbox"></div>'); UI.cur = 'dealer'; UI.renderDealer(tab || 'sell'); sfx('coin'); };
UI.renderDealer = function (tab) {
  UI.dtab = tab = tab || UI.dtab || 'sell'; const host = $('#dealerbox'); if (!host) return; let body = '';
  if (tab === 'sell') {
    const g = grouped(), tot = S.bag.reduce((s, i) => s + i.val, 0);
    body = g.length ? `<div class="list">${g.map(x => `<div class="row"><img src="${itemURL(x.id)}" alt=""><div><b>${esc(ITEM[x.id].name)}</b><small>×${x.n}</small></div><span class="gold">${x.val}g</span></div>`).join('')}</div><button class="btn big" data-act="sellall">Sell everything · +${tot}g</button>`
      : '<p class="empty">Nothing to sell yet. Dig up something at a dig site!</p>';
  } else {
    const rd = TOOLS.rod[S.tools.rod + 1], rl = GEAR.reel[S.gear.reel], ln = GEAR.line[S.gear.line], pg = TOOLS.bag[S.tools.bag + 1];
    const ic = n => actURL(n), max = t => `<span class="max">${t}</span>`;
    body = `<p class="note">Using: ${TOOLS.rod[S.tools.rod].n}${S.gear.reel ? ', ' + GEAR.reel[S.gear.reel - 1].n : ''}${S.gear.line ? ', ' + GEAR.line[S.gear.line - 1].n : ''}</p><div class="list">` +
      (rd ? srow(ic('beach'), rd.n, rd.d, priceBtn('dlb:rod', rd.cost, rd.lv)) : srow(ic('beach'), TOOLS.rod[3].n, 'Your best pick.', max('MAX'))) +
      (rl ? srow(ic('book'), rl.n, rl.d, priceBtn('dlb:reel', rl.cost, rl.lv)) : srow(ic('book'), 'Brushes', 'All brushes owned.', max('MAX'))) +
      (ln ? srow(ic('wave'), ln.n, ln.d, priceBtn('dlb:line', ln.cost, ln.lv)) : srow(ic('wave'), 'Gloves', 'All gloves owned.', max('MAX'))) +
      (pg ? srow(ic('bag'), pg.n, pg.d, priceBtn('dlb:bag', pg.cost, pg.lv)) : srow(ic('bag'), TOOLS.bag[3].n, 'Biggest bag.', max('MAX'))) + '</div>';
  }
  host.innerHTML = `${head('Antiquities Dealer')}<div class="wallet"><img src="${actURL('coin')}" alt=""><b>${S.gold}g</b></div>${tabsHTML([['sell', 'Sell'], ['tools', 'Tools']], tab, 'dl')}<div class="mbody">${body}</div>`;
};
function dealerBuy(type) {
  const list = { rod: [TOOLS.rod, S.tools, 'rod'], bag: [TOOLS.bag, S.tools, 'bag'], reel: [GEAR.reel, S.gear, 'reel'], line: [GEAR.line, S.gear, 'line'] }[type]; if (!list) return;
  const n = list[0][list[1][list[2]] + (type === 'reel' || type === 'line' ? 0 : 1)]; if (n && spend(n.cost, n.lv)) { list[1][list[2]]++; UI.toast(n.n + ' ready!', 'gold'); }
  UI.refresh();
}
function sellAll() {
  if (!S.bag.length) return; const tot = S.bag.reduce((s, i) => s + i.val, 0), n = S.bag.length;
  S.gold += tot; S.stats.earned += tot; S.bag = []; sfx('coin'); UI.toast(`Sold ${n} find${n > 1 ? 's' : ''} for ${tot}g`, 'gold'); UI.refresh();
}
UI.onClick2 = function (a, p1, p2) {
  switch (a) {
    case 'dl': UI.renderDealer(p1); break;
    case 'dlb': dealerBuy(p1); break;
    case 'sellall': sellAll(); break;
    case 'show': { const f = S.bag.filter(i => i.id === p1).sort((x, y) => (y.sz || 0) - (x.sz || 0))[0]; if (f) { UI.close(); setHold([Object.assign({}, f, { isNew: false })]); sfx('pop'); } break; }
  }
};
