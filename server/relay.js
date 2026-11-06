// Plain Node host for the same room logic: `npm install && npm start` (default port 8787, override with PORT).
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { createCore } from './core.js';

const sockets = new Map();
const core = createCore({ send: (id, obj) => { const s = sockets.get(id); if (s && s.readyState === 1) s.send(JSON.stringify(obj)); } });
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('angela relay ok, ' + core.size() + ' players\n'); });
const wss = new WebSocketServer({ server, maxPayload: 4096 });
wss.on('connection', ws => {
  const id = crypto.randomUUID().slice(0, 8); sockets.set(id, ws); core.open(id);
  ws.on('message', data => core.message(id, data.toString()));
  const bye = () => { sockets.delete(id); core.close(id); }; ws.on('close', bye); ws.on('error', bye);
});
const port = +process.env.PORT || 8787; server.listen(port, () => console.log('angela relay listening on', port));
