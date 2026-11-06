'use strict';
// Where the multiplayer server lives. Leave it empty to play alone.
// After `npx wrangler deploy` (see server/README.md) put the address here, for example:
//   const SERVER_URL = 'wss://angela-multiplayer.YOUR-SUBDOMAIN.workers.dev/party/main';
// For local testing you can also add ?server=ws://localhost:8787 to the game's address (that overrides this).
const SERVER_URL = 'wss://angela-multiplayer.angelasbirthday.workers.dev/party/main';
