'use strict';
// Multiplayer client. Talks to the realtime server in /server (see server/README.md): sends Angela's position about 10 times a second,
// and draws the other players that are in the same area, gliding them between updates. With no server address it does nothing.
const NET = { ws: null, id: null, remotes: new Map(), url: '', retry: 0, open: false, count: 0, sendT: 0, last: null, pt: 0, timer: 0 };
const netUrl = () => { const q = new URLSearchParams(location.search).get('server'); return q !== null ? q : typeof SERVER_URL === 'string' ? SERVER_URL : ''; };
NET.start = function () { NET.url = netUrl(); if (NET.url) NET.connect(); };
NET.connect = function () {
  let ws; try { ws = new WebSocket(NET.url); } catch (e) { NET.retryLater(); return; }
  NET.ws = ws;
  ws.onopen = () => { NET.open = true; NET.retry = 0; NET.last = null; NET.hello(); UI.toast('Connected: other players can see you', 'info'); };
  ws.onmessage = e => { try { NET.onMsg(JSON.parse(e.data)); } catch (err) { } };
  ws.onclose = () => { if (NET.open) UI.toast('Connection lost. Playing solo until it comes back.', 'info'); NET.open = false; NET.id = null; NET.remotes.clear(); NET.count = 0; NET.retryLater(); };
  ws.onerror = () => { try { ws.close(); } catch (e) { } };
};
NET.retryLater = function () { clearTimeout(NET.timer); NET.timer = setTimeout(NET.connect, Math.min(15000, 1000 * 2 ** NET.retry++)); };   // 1s, 2s, 4s ... 15s
NET.send = o => { if (NET.open && NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); };
NET.me = () => ({ name: S.name, lv: S.lv, look: HERO.tint, bal: BAL.n });
NET.hello = () => NET.send(Object.assign({ t: 'hello', area: AREA, x: Math.round(ME.x), y: Math.round(ME.y), dir: ME.dir }, NET.me()));
NET.profileSoon = () => { clearTimeout(NET.pt); NET.pt = setTimeout(() => NET.send(Object.assign({ t: 'profile' }, NET.me())), 300); };   // name, level or look changed
NET.area = () => { NET.remotes.clear(); NET.last = null; NET.send({ t: 'area', area: AREA, x: Math.round(ME.x), y: Math.round(ME.y), dir: ME.dir }); };
NET.emote = e => NET.send({ t: 'emote', e });
NET.chat = text => NET.send({ t: 'chat', text });
NET.add = p => NET.remotes.set(p.id, { k: 'rp', id: p.id, name: p.name, lv: p.lv, look: p.look || {}, bal: p.bal | 0, x: p.x, y: p.y, tx: p.x, ty: p.y, dir: p.dir || 'd', moving: !!p.mv, mvFlag: !!p.mv, t: 0, bubble: null, bt: 0, seen: performance.now() });
NET.onMsg = function (m) {
  const r = m.id && NET.remotes.get(m.id);
  switch (m.t) {
    case 'welcome': NET.id = m.id; NET.remotes.clear(); (m.players || []).forEach(NET.add); NET.count = m.n || 0; break;
    case 'players': NET.remotes.clear(); (m.players || []).forEach(NET.add); break;
    case 'join': if (m.p) NET.add(m.p); break;
    case 'leave': NET.remotes.delete(m.id); break;
    case 'state': if (r) { r.tx = m.x; r.ty = m.y; r.dir = m.dir; r.mvFlag = !!m.mv; r.seen = performance.now(); } break;
    case 'profile': if (r) { r.name = m.name; r.lv = m.lv; r.look = m.look || {}; r.bal = m.bal | 0; } break;
    case 'emote': if (r) { r.bubble = m.e; r.bt = 2.6; } break;
    case 'chat': if (typeof m.text === 'string' && m.text) { if (r) { r.bubble = m.text.slice(0, 80); r.bt = 6; } CHAT.add(r ? r.name : '?', m.text.slice(0, 80)); } break;
    case 'count': NET.count = m.n; break;
    case 'full': UI.toast('The server is full right now', 'info'); break;
  }
};
NET.update = function (dt) {
  const t = performance.now();
  for (const r of NET.remotes.values()) {   // glide to the last known spot
    const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy);
    if (d > 80) { r.x = r.tx; r.y = r.ty; } else { const k = Math.min(1, dt * 12); r.x += dx * k; r.y += dy * k; }
    r.moving = d > 0.6 || (r.mvFlag && t - r.seen < 250); if (r.moving) r.t += dt;
    r.bt = Math.max(0, r.bt - dt); if (!r.bt) r.bubble = null;
  }
  if (!NET.open || !ME) return;
  const s = { x: Math.round(ME.x * 10) / 10, y: Math.round(ME.y * 10) / 10, dir: ME.dir, mv: ME.moving ? 1 : 0 }, l = NET.last;
  const changed = !l || s.x !== l.x || s.y !== l.y || s.dir !== l.dir || s.mv !== l.mv;
  if ((changed && t - NET.sendT > 90) || t - NET.sendT > 1000) { NET.send(Object.assign({ t: 'state' }, s)); NET.last = s; NET.sendT = t; }   // ~10 a second while moving, a heartbeat otherwise
};
