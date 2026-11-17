'use strict';
// The merchant's shop: buy backpack upgrades and general supplies, sell finds. Augment crates, restoration supplies and cosmetics are listed as coming soon.
const coinTxt = n => `<span class="coins">${n | 0}</span>`;
UI.openShop = function (tab) { UI.open('shop', '<div id="shopbox"></div>'); UI.cur = 'shop'; UI.renderShop(tab || 'buy'); sfx('pop'); };
UI.renderShop = function (tab) {
  UI.stab = tab = tab || UI.stab || 'buy'; const host = $('#shopbox'); if (!host) return; let body = '';
  const soon = (name, d) => `<div class="row soon"><div class="grow"><b>${esc(name)}</b><small>${esc(d)}</small></div><span class="lockt">Coming soon</span></div>`;
  if (tab === 'buy') {
    const owned = S.bag | 0, next = BAGS[owned];
    const bags = BAGS.map((b, i) => {
      const right = i < owned ? '<span class="okt">Owned</span>' : i > owned ? '<span class="lockt">Buy the one before first</span>' : `<button class="btn small ${S.coins >= b.cost ? '' : 'dis'}" data-act="shopbuy:bag">${coinTxt(b.cost)}</button>`;
      return `<div class="row ${i > owned ? 'dim' : ''}"><div class="grow"><b>${esc(b.n)}</b><small>${esc(b.d)} (${BAG_BASE + BAGS.slice(0, i + 1).reduce((a, x) => a + x.add, 0)} in all)</small></div>${right}</div>`;
    }).join('');
    const mats = Object.keys(BUY_MAT).map(id => `<div class="row"><img src="${itemURL(id)}" alt=""><div class="grow"><b>${esc(ITEM[id].name)}</b><small>${S.mats[id] | 0} in your bag</small></div><button class="btn small ${S.coins >= BUY_MAT[id] && bagFits(id) ? '' : 'dis'}" data-act="shopbuy:${id}">${coinTxt(BUY_MAT[id])}</button></div>`).join('');
    body = `<p class="note">Bag: ${bagUsed()} of ${bagCap()} slots used${next ? '' : ' · fully upgraded'}</p><h3 class="sub">Backpack upgrades</h3><div class="list">${bags}${soon('Larger backpacks', 'Bigger packs for the long digs')}</div>
      <h3 class="sub">General supplies</h3><p class="note">Basic crafting materials, for when you need to supplement what you excavated.</p><div class="list">${mats}</div>
      <h3 class="sub">More from the merchant</h3><div class="list">${soon('Augment crates', 'Mystery crates with random augments, 5-15% bonuses')}${soon('Restoration supplies', 'Resin, cloth, polish and brushes to prepare museum artifacts')}${soon('Cosmetics', 'Hats, shirts, boots, cloaks and other basic outfits')}</div>`;
  } else {
    const arts = S.arts.map((a, i) => ({ a, i })).sort((p, q) => sellArt(q.a) - sellArt(p.a)).map(({ a, i }) => `<div class="row"><img src="${itemURL(a.id)}" alt=""><div class="grow"><b>${esc(ITEM[a.id].name)}</b><small>${a.pct}% intact</small></div><button class="btn small" data-act="shopsell:a${i}">${coinTxt(sellArt(a))}</button></div>`).join('');
    const mats = Object.keys(SELL_MAT).filter(id => (S.mats[id] | 0) > 0).map(id => `<div class="row"><img src="${itemURL(id)}" alt=""><div class="grow"><b>${esc(ITEM[id].name)}</b><small>×${S.mats[id]}</small></div><button class="btn small" data-act="shopsell:m${id}">${coinTxt(SELL_MAT[id])}</button></div>`).join('');
    body = `<p class="note">Selling an artifact keeps it in your collection log. Sell one piece at a time.</p><div class="list">${arts}${mats}${arts || mats ? '' : '<p class="note">You have nothing to sell yet.</p>'}</div>`;
  }
  host.innerHTML = `${head('Merchant')}<p class="note"><span class="coins">${S.coins | 0} coins</span></p><div class="tabs">${[['buy', 'Buy'], ['sell', 'Sell']].map(t => `<button class="tab ${t[0] === tab ? 'on' : ''}" data-act="stab:${t[0]}">${t[1]}</button>`).join('')}</div><div class="list2">${body}</div>`;
};
function shopBuy(what) {
  if (what === 'bag') {
    const b = BAGS[S.bag | 0]; if (!b || S.coins < b.cost) { sfx('no'); return; }
    S.coins -= b.cost; S.bag++; sfx('level'); UI.toast(b.n + ' bought: ' + bagCap() + ' slots', 'gold');
  } else {
    const p = BUY_MAT[what]; if (!p || S.coins < p) { sfx('no'); return; } if (!bagFits(what)) { UI.toast('Your bag is full', 'info'); sfx('no'); return; }
    S.coins -= p; S.mats[what] = (S.mats[what] | 0) + 1; sfx('coin');
  }
  UI.refresh();
}
function shopSell(what) {
  let gain = 0;
  if (what[0] === 'a') { const i = +what.slice(1), a = S.arts[i]; if (!a) { sfx('no'); return; } gain = sellArt(a); S.arts.splice(i, 1); }
  else { const id = what.slice(1); if (!(S.mats[id] > 0)) { sfx('no'); return; } gain = SELL_MAT[id]; S.mats[id]--; }
  S.coins += gain; sfx('coin'); UI.toast('+' + gain + ' coins', 'gold'); UI.refresh();
}
