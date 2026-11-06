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

## Put it online (PartyKit, recommended)
Netlify can host the game page but not a WebSocket server, so the live part goes on PartyKit (Cloudflare):
```
cd server
npm install
npx partykit login        # once, with a free account
npx partykit deploy       # prints a host like angela-multiplayer.YOURNAME.partykit.dev
```
Then edit `js/config.js`:
```js
const SERVER_URL = 'wss://angela-multiplayer.YOURNAME.partykit.dev/party/main';
```
and deploy the game to Netlify as usual. Everyone who opens the page connects to the same server.

Any Node host works too (Fly.io, Railway, Render): run `npm start` there and use its `wss://` address.

## Growing it
`core.js` keeps everyone in one room and filters by area. For hundreds of players, give each area its own PartyKit room (`/party/island`, `/party/house`) by choosing the room name from `AREA` in `js/net.js`.
