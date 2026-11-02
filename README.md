# AnimalCross (working title)

A cozy, mobile-first multiplayer-style fishing and collecting island, built as a plain HTML canvas game (no build step).

## Run it

```bash
python3 server.py 5173      # serves the game and lets the map editor save maps/*.json
```

Open http://localhost:5173

Useful URL options: `?reset` (fresh save), `?hour=22` (force the time), `?rain=1`, `?gems=500`, `?area=cave`, `?atlas` (view/download the tile atlas).

## Map editor

Open http://localhost:5173/?edit. Paint tiles, place objects, drag out piers and bridges, set the spawn point. **Save to project** writes `maps/<area>.json` (needs `server.py`). Switch areas with the Area picker (island, cave, or a new one).

## Layout

- `index.html`, `style.css`
- `js/` game code: `data.js` (catalogues, save state), `art.js` (code-drawn sprites), `assets.js` (painted sheets, character layering, props), `tiles.js` (autotile atlas), `world.js` (map, collision, objects), `fx.js` (ambient effects), `ui.js` / `ui2.js` (panels and shops), `game.js` (loop, controls, activities), `editor.js`
- `assets/` painted sprite sheets (characters, tile fills, props)
- `maps/` the island and cave map files
- `tools/` scripts that converted the painted sheets into `assets/`
