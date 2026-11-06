# Angela multiplayer server

A small relay: each player's browser tells the server where it is (about 10 times a second), and the server tells everyone else **in the same area**
(island, house, house2...). Players see each other walk, wave and change look. Nothing else is shared yet (dig sites, dogs, inventory stay local).

## Messages (JSON over one WebSocket)
Client -> server: `hello {name, lv, look, area, x, y, dir}`, `state {x, y, dir, mv}`, `profile {name, lv, look}`, `area {area, x, y, dir}`, `emote {e}`, `ping`
Server -> client: `welcome {id, players, n}`, `players {players}`, `join {p}`, `leave {id}`, `state {id, x, y, dir, mv}`, `profile {id, name, lv, look}`, `emote {id, e}`, `count {n}`, `full`, `pong`

The server never trusts input: names are cleaned, looks must be `#rrggbb`, coordinates are clamped, a client can send ~40 messages a second at most,
messages over 2 KB are dropped, and nothing is accepted before `hello`. Up to 100 players per server.

## Test it on your machine
```
cd server && npm install && npm start            # relay on ws://localhost:8787
python3 server.py 5173                           # the game, from the repo root
```
Open `http://localhost:5173/?server=ws://localhost:8787` in two browser windows (use a private window for the second one, so it has its own saved name).

## Put it online (Cloudflare Workers, free)
Netlify can host the game page but not a WebSocket server, so the live part runs on Cloudflare (the hosted PartyKit service has shut down).
You need a free Cloudflare account.
```
cd server
npm install
npx wrangler login        # opens the browser; sign in or create the free account
npx wrangler deploy       # prints https://angela-multiplayer.YOURSUBDOMAIN.workers.dev
```
The first deploy may ask you to pick a free `workers.dev` subdomain: accept it. Then edit `js/config.js`:
```js
const SERVER_URL = 'wss://angela-multiplayer.YOURSUBDOMAIN.workers.dev/party/main';
```
and deploy the game to Netlify as usual. Everyone who opens the page connects to the same server.
Try it before the game is online: `npx wrangler dev` runs the same Worker on your PC at ws://127.0.0.1:8787/party/main.
(The Worker answers on every path; `/party/main` is just a tidy address.)

Any Node host also works (Fly.io, Railway, Render): run `npm start` there and use its `wss://` address.
On the free Cloudflare plan the room stays awake while players are connected, which is fine for a small crowd. For a bigger one, switch `worker.js` to Durable Object WebSocket hibernation.

## Growing it
`core.js` keeps everyone in one room and filters by area. For hundreds of players, give each area its own room: in `worker.js` use the area from the URL instead of `'main'`, and in `js/net.js` connect to a different address per area.
