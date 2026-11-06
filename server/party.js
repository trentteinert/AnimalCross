// PartyKit host: `npx partykit deploy` (see README). One room holds everybody; areas are separated inside core.js.
import { createCore } from './core.js';

export default class AngelaServer {
  constructor(room) {
    this.room = room;
    this.core = createCore({ send: (id, obj) => { const c = this.room.getConnection(id); if (c) c.send(JSON.stringify(obj)); } });
  }
  onConnect(conn) { this.core.open(conn.id); }
  onMessage(message, sender) { this.core.message(sender.id, typeof message === 'string' ? message : ''); }
  onClose(conn) { this.core.close(conn.id); }
  onError(conn) { this.core.close(conn.id); }
}
