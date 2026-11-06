// Room logic for Angela's multiplayer. One shared module, two hosts:
//   worker.js -> Cloudflare Workers + a Durable Object (recommended, deploy with `npx wrangler deploy`)
//   relay.js  -> plain Node + ws (local testing, or any Node host such as Fly.io, Railway or Render)
// The server is a relay, not a referee: clients own their own movement, the server sanitises everything,
// limits how fast a client can talk, and only tells players about others in the SAME AREA (island, house, house2...).
export const MAX_PLAYERS = 100, MAX_MSG = 2048, ROLES = ['hair', 'eyes', 'skin', 'shirt', 'jeans', 'boots'];
const HEX = /^#[0-9a-fA-F]{6}$/, AREA = /^[a-z0-9_-]{1,24}$/, NAME = /[^A-Za-z0-9_.# -]/g;
const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : 0));

export const cleanName = n => (typeof n === 'string' ? n.replace(NAME, '').trim().slice(0, 14) : '') || 'Player';
export function cleanLook(l) { const out = {}; if (l && typeof l === 'object') for (const r of ROLES) if (typeof l[r] === 'string' && HEX.test(l[r])) out[r] = l[r].toLowerCase(); return out; }
const cleanArea = a => (typeof a === 'string' && AREA.test(a) ? a : 'island');
const cleanDir = d => (d === 'l' || d === 'r' || d === 'u' ? d : 'd');

// io = { send(id, obj) }  — the host decides how an object reaches a connection
export function createCore(io, now = () => Date.now()) {
  const players = new Map(), buckets = new Map();
  const pub = p => ({ id: p.id, name: p.name, lv: p.lv, look: p.look, x: p.x, y: p.y, dir: p.dir, mv: p.mv });
  const peers = p => [...players.values()].filter(q => q.id !== p.id && q.area === p.area);
  const tell = (list, msg) => { for (const q of list) io.send(q.id, msg); };
  const count = () => { for (const q of players.values()) io.send(q.id, { t: 'count', n: players.size }); };
  const allowed = id => { // token bucket: bursts of 60, 40 messages a second on average
    const t = now(); let b = buckets.get(id); if (!b) { b = { tokens: 60, t }; buckets.set(id, b); }
    b.tokens = Math.min(60, b.tokens + (t - b.t) * 0.04); b.t = t; if (b.tokens < 1) return false; b.tokens -= 1; return true;
  };
  return {
    open(id) { buckets.set(id, { tokens: 60, t: now() }); },
    message(id, raw) {
      if (typeof raw !== 'string' || raw.length > MAX_MSG || !allowed(id)) return;
      let m; try { m = JSON.parse(raw); } catch (e) { return; } if (!m || typeof m !== 'object') return;
      let p = players.get(id);
      if (m.t === 'hello') {
        if (!p && players.size >= MAX_PLAYERS) { io.send(id, { t: 'full' }); return; }
        p = p || { id }; Object.assign(p, { name: cleanName(m.name), lv: num(m.lv, 1, 999) | 0, look: cleanLook(m.look), area: cleanArea(m.area), x: num(m.x, 0, 6400), y: num(m.y, 0, 6400), dir: cleanDir(m.dir), mv: 0 });
        players.set(id, p); io.send(id, { t: 'welcome', id, players: peers(p).map(pub), n: players.size }); tell(peers(p), { t: 'join', p: pub(p) }); count(); return;
      }
      if (!p) return;                                                                   // nothing else is accepted before a hello
      if (m.t === 'state') { Object.assign(p, { x: num(m.x, 0, 6400), y: num(m.y, 0, 6400), dir: cleanDir(m.dir), mv: m.mv ? 1 : 0 }); tell(peers(p), { t: 'state', id, x: p.x, y: p.y, dir: p.dir, mv: p.mv }); }
      else if (m.t === 'profile') { Object.assign(p, { name: cleanName(m.name), lv: num(m.lv, 1, 999) | 0, look: cleanLook(m.look) }); tell(peers(p), { t: 'profile', id, name: p.name, lv: p.lv, look: p.look }); }
      else if (m.t === 'area') {
        tell(peers(p), { t: 'leave', id });                                             // the old area stops seeing you...
        Object.assign(p, { area: cleanArea(m.area), x: num(m.x, 0, 6400), y: num(m.y, 0, 6400), dir: cleanDir(m.dir), mv: 0 });
        const now2 = peers(p); tell(now2, { t: 'join', p: pub(p) }); io.send(id, { t: 'players', players: now2.map(pub) });   // ...and the new one meets you
      }
      else if (m.t === 'emote') tell(peers(p), { t: 'emote', id, e: String(m.e || '').slice(0, 8) });
      else if (m.t === 'ping') io.send(id, { t: 'pong' });
    },
    close(id) { buckets.delete(id); const p = players.get(id); if (!p) return; const list = peers(p); players.delete(id); tell(list, { t: 'leave', id }); count(); },
    size: () => players.size,
  };
}
