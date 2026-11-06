// Cloudflare Worker host for the same room logic (core.js). One Durable Object holds every player; areas are separated inside core.js.
// Deploy with `npx wrangler deploy` (see README). The game connects to  wss://<your-worker>.workers.dev/party/main
import { createCore } from './core.js';

export class Room {
  constructor(state, env) {
    this.sockets = new Map(); this.n = 0;
    this.core = createCore({ send: (id, obj) => { const s = this.sockets.get(id); if (s) { try { s.send(JSON.stringify(obj)); } catch (e) { } } } });
  }
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('angela relay ok, ' + this.core.size() + ' players\n');
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const id = 'p' + (++this.n).toString(36) + Math.random().toString(36).slice(2, 6); this.sockets.set(id, server); this.core.open(id);
    server.addEventListener('message', e => this.core.message(id, typeof e.data === 'string' ? e.data : ''));
    const bye = () => { this.sockets.delete(id); this.core.close(id); };
    server.addEventListener('close', bye); server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const room = env.ROOM.get(env.ROOM.idFromName('main'));   // everybody shares one room; see README to split by area
    return room.fetch(request);
  },
};
