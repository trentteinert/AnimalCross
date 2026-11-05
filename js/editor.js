'use strict';
// Map editor: open the game with ?edit. Paint tiles, place objects, drag out the pier, set the spawn point.
// Edits autosave to a browser draft; "Save to project" writes maps/island.json (needs server.py), "Export" downloads it.
const ED = {
  on: false, zoom: 3, cam: { x: 0, y: 0 }, tool: 'paint', tile: 3, brush: 1, place: null, sel: null, snap: 8, grid: true,
  undo: [], redo: [], cur: '', keys: {}, mouse: { sx: 0, sy: 0, wx: 0, wy: 0, in: false }, dirty: false, stroke: null, strokeChanged: false,
  pan: null, mv: null, msg: '', msgT: 0, last: 0, lastWheel: 0, unsaved: false
};
const TILE_NAMES = ['Deep water', 'Shallow water', 'Sand', 'Grass', 'Dirt path', 'Cobble', 'Pond'];
const TILE_COL = ['#2e6294', '#5fa8c0', '#e2cd96', '#7b9b45', '#b88652', '#c9b790', '#54a0b8'];
const DECO_NAMES = ['Orange tree', 'Red tree', 'Yellow tree', 'Green tree', 'Pine', 'Pine (b)'];
const PAL = [
  { k: 'tree', kind: 'apple', n: 'Apple tree (fruit)' }, { k: 'tree', kind: 'orange', n: 'Orange tree (fruit)' }, { k: 'tree', kind: 'pear', n: 'Pear tree (fruit)' }, { k: 'tree', kind: 'plum', n: 'Plum tree (fruit)' },
  { k: 'bush', kind: 'blueberry', n: 'Blueberry bush' }, { k: 'bush', kind: 'raspberry', n: 'Raspberry bush' }, { k: 'bush', kind: 'blackberry', n: 'Blackberry bush' }, { k: 'bush', kind: 'elderberry', n: 'Elderberry bush' },
  { k: 'deco', v: 0, n: 'Orange tree' }, { k: 'deco', v: 1, n: 'Red tree' }, { k: 'deco', v: 2, n: 'Yellow tree' }, { k: 'deco', v: 3, n: 'Green tree' }, { k: 'deco', v: 4, n: 'Pine' },
  { k: 'rock', n: 'Rock' }, { k: 'lamp', n: 'Lamp post' }, { k: 'bench', n: 'Bench' }, { k: 'fountain', n: 'Fountain' },
  { k: 'patch', n: 'Flower patch' },
  { k: 'furn', f: 'bed', n: 'Bed' }, { k: 'furn', f: 'sofa', n: 'Sofa' }, { k: 'furn', f: 'armchair', n: 'Armchair' }, { k: 'furn', f: 'table', n: 'Table' }, { k: 'furn', f: 'chair', n: 'Chair' }, { k: 'furn', f: 'shelf', n: 'Bookshelf' }, { k: 'furn', f: 'counter', n: 'Kitchen counter' }, { k: 'furn', f: 'fridge', n: 'Fridge' }, { k: 'furn', f: 'plant', n: 'Plant' }, { k: 'furn', f: 'lamp', n: 'Floor lamp' }, { k: 'furn', f: 'tv', n: 'TV' }, { k: 'furn', f: 'painting', n: 'Painting (hang on a wall)' }, { k: 'portal', style: 'door', n: 'Door (portal to another area)' },
  { k: 'tackle', n: 'Antiquities dealer' },
  { k: 'portal', style: 'cave', n: 'Cave entrance (portal)' }, { k: 'portal', style: 'exit', n: 'Cave exit (portal)' }, { k: 'crystal', kind: 'blue', n: 'Crystal (blue)' }, { k: 'crystal', kind: 'purple', n: 'Crystal (purple)' },
  { k: 'mushroom', kind: 'cyan', n: 'Glow mushrooms' }, { k: 'mushroom', kind: 'pink', n: 'Glow mushrooms (pink)' }, { k: 'stalagmite', n: 'Stalagmite' },
  { k: 'campfire', n: 'Campfire (lights up at night)' }, { k: 'tent', kind: 'red', n: 'Tent (red)' }, { k: 'tent', kind: 'green', n: 'Tent (green)' }, { k: 'logseat', n: 'Log seat' },
  { k: 'crate', n: 'Crate' }, { k: 'barrel', n: 'Barrel' }, { k: 'signpost', n: 'Signpost' }, { k: 'fence', n: 'Fence' }
];
const LABELS = { tree: 'Fruit tree (scenery)', bush: 'Berry bush (scenery)', deco: 'Decorative tree', rock: 'Rock', lamp: 'Lamp post', bench: 'Bench', fountain: 'Fountain', patch: 'Flower patch', furn: 'Furniture', tackle: 'Antiquities dealer', portal: 'Portal', crystal: 'Crystal', mushroom: 'Glow mushrooms', stalagmite: 'Stalagmite', campfire: 'Campfire', tent: 'Tent', logseat: 'Log seat', crate: 'Crate', barrel: 'Barrel', signpost: 'Signpost', fence: 'Fence' };

function entrySpr(e) {
  switch (e.k) {
    case 'tree': return SPR.tree[e.kind][0]; case 'bush': return SPR.bush[e.kind][0]; case 'deco': return SPR.deco[e.v]; case 'rock': return SPR.rock; case 'lamp': return SPR.lamp;
    case 'furn': return SPR.furn[e.f];
    case 'bench': return SPR.bench; case 'fountain': return SPR.fountain; case 'patch': return SPR.flower[0];
    case 'tackle': return SPR.tackle;
    case 'portal': return e.style === 'door' ? SPR.furn.door : e.style === 'exit' ? SPR.portalExit : SPR.portalCave; case 'crystal': return e.kind === 'purple' ? SPR.crystalP : SPR.crystalB; case 'mushroom': return e.kind === 'pink' ? SPR.mushroomP : SPR.mushroom; case 'stalagmite': return SPR.stalagmite;
    case 'campfire': return SPR.campfire; case 'tent': return e.kind === 'green' ? SPR.tentGreen : SPR.tentRed; case 'logseat': return SPR.logseat; case 'crate': return SPR.crate; case 'barrel': return SPR.barrel; case 'signpost': return SPR.signpost; case 'fence': return SPR.fence;
  }
}
function runtimeSpr(o) {
  if (o.k === 'tree') return SPR.tree[o.kind][0]; if (o.k === 'bush') return SPR.bush[o.kind][0]; return o.spr;
}
const anc = s => ({ ax: s.ax != null ? s.ax : s.width / 2, ay: s.ay != null ? s.ay : s.height });
const iconCache2 = {};
function palIcon(i) {
  if (iconCache2[i]) return iconCache2[i];
  const s = entrySpr(PAL[i]), c = mk(40, 40), sc = Math.min(40 / s.width, 40 / s.height, 2); const w = Math.round(s.width * sc), h = Math.round(s.height * sc);
  c.g.drawImage(s, Math.round((40 - w) / 2), Math.round((40 - h) / 2), w, h); return iconCache2[i] = c.toDataURL();
}
const snapv = v => ED.snap > 1 ? Math.round(v / ED.snap) * ED.snap : Math.round(v);
function msg(t) { ED.msg = t; ED.msgT = performance.now(); const el = $('#edStatus'); if (el) el.dataset.msg = t; }
const esc2 = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function startEditor(src) {
  ED.on = true; document.body.classList.add('editing'); $('#hud').style.display = 'none'; $('#modal').style.display = 'none'; $('#loading').classList.add('hidden');
  injectEditorCSS(); buildEditorUI(); bindEditor();
  ED.cam = { x: W.spawn.x - (innerWidth / ED.zoom) / 2 + 120 / ED.zoom, y: W.spawn.y - innerHeight / ED.zoom / 2 - 40 };
  ED.cur = snapshot(); updateBar(); refreshInspector(); const th = $('#edTheme'); if (th) th.value = W.theme;
  msg(src === 'draft' ? 'Loaded your draft (unsaved edits from last time).' : src === 'file' ? 'Loaded maps/' + AREA + '.json.' : 'Loaded a new default map. Press Save to project to create maps/' + AREA + '.json.');
  requestAnimationFrame(edLoop);
}

// ---- history ----------------------------------------------------------------------------
const snapshot = () => JSON.stringify(serializeMap());
function resizeMap(nw, nh, centred) { // grow or shrink the map; new ground is water, and everything placed moves with the land
  nw = clamp(Math.round(nw) || MW, MAP_MIN, MAP_MAX); nh = clamp(Math.round(nh) || MH, MAP_MIN, MAP_MAX); if (nw === MW && nh === MH) { msg('The map is already ' + MW + ' x ' + MH + '.'); return; }
  const m = JSON.parse(snapshot()), ox = centred ? Math.floor((nw - MW) / 2) : 0, oy = centred ? Math.floor((nh - MH) / 2) : 0, rows = [];
  for (let y = 0; y < nh; y++) { let r = ''; for (let x = 0; x < nw; x++) { const sx = x - ox, sy = y - oy; r += sx >= 0 && sy >= 0 && sx < MW && sy < MH ? m.tiles[sy][sx] : '0'; } rows.push(r); }
  const inside = o => o.x >= 0 && o.y >= 0 && o.x < nw * TS && o.y < nh * TS;
  m.objects.forEach(o => { o.x += ox * TS; o.y += oy * TS; }); m.objects = m.objects.filter(inside);
  (m.structs || []).forEach(q => { q.x0 += ox; q.x1 += ox; q.y0 += oy; q.y1 += oy; }); m.structs = (m.structs || []).filter(q => q.x1 > 0 && q.y1 > 0 && q.x0 < nw && q.y0 < nh);
  m.spawn = { x: clamp(m.spawn.x + ox * TS, 8, nw * TS - 8), y: clamp(m.spawn.y + oy * TS, 8, nh * TS - 8) };
  const od = m.deck || []; m.deck = []; for (let y = 0; y < nh; y++) { let r = ''; for (let x = 0; x < nw; x++) { const sx = x - ox, sy = y - oy; r += sx >= 0 && sy >= 0 && sx < MW && sy < MH && od[sy] ? od[sy][sx] : '0'; } m.deck.push(r); }
  const os = m.site || []; m.site = []; for (let y = 0; y < nh; y++) { let r = ''; for (let x = 0; x < nw; x++) { const sx = x - ox, sy = y - oy; r += sx >= 0 && sy >= 0 && sx < MW && sy < MH && os[sy] ? os[sy][sx] : '0'; } m.site.push(r); }
  const oi = m.int || []; m.int = []; for (let y = 0; y < nh; y++) { let r = ''; for (let x = 0; x < nw; x++) { const sx = x - ox, sy = y - oy; r += sx >= 0 && sy >= 0 && sx < MW && sy < MH && oi[sy] ? oi[sy][sx] : '0'; } m.int.push(r); }
  m.w = nw; m.h = nh; m.tiles = rows; loadMap(m); ED.sel = null; commit(); refreshInspector(); msg('Map is now ' + nw + ' x ' + nh + ' tiles. New ground is water; paint land onto it.');
}
function commit() {
  const s = snapshot(); if (s === ED.cur) return;
  ED.undo.push(ED.cur); if (ED.undo.length > 80) ED.undo.shift(); ED.cur = s; ED.redo = []; ED.unsaved = true;
  try { localStorage.setItem(areaDraftKey(AREA), s); } catch (e) { } updateBar();
}
function applySnap(s) {
  loadMap(JSON.parse(s)); ED.sel = null; ED.cur = s; ED.unsaved = true; try { localStorage.setItem(areaDraftKey(AREA), s); } catch (e) { } refreshInspector(); updateBar();
}
function undo() { if (!ED.undo.length) return; ED.redo.push(ED.cur); applySnap(ED.undo.pop()); }
function redo() { if (!ED.redo.length) return; ED.undo.push(ED.cur); applySnap(ED.redo.pop()); }

// ---- editing actions ----------------------------------------------------------------------
const findRuntime = src => W.objs.find(o => o.src === src) || W.patches.find(p => p.src === src) || null;
function rebuildAndSelect(src) { rebuildAll(); computeShore(); ED.sel = src ? findRuntime(src) : null; refreshInspector(); }
function paintAt(tx, ty) {
  const b = ED.brush, o = Math.floor((b - 1) / 2);
  for (let dy = 0; dy < b; dy++) for (let dx = 0; dx < b; dx++) {
    const x = tx - o + dx, y = ty - o + dy; if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    if (ED.tile >= 300) { const id = ED.tile - 300; if (INT[y * MW + x] !== id) { INT[y * MW + x] = id; ED.dirty = true; ED.strokeChanged = true; } continue; }
    if (ED.tile >= 200) { const id = ED.tile - 200; if (SITE[y * MW + x] !== id) { SITE[y * MW + x] = id; ED.dirty = true; ED.strokeChanged = true; } continue; }
    if (ED.tile >= 100) { const id = ED.tile - 100; if (DECK[y * MW + x] !== id) { DECK[y * MW + x] = id; ED.dirty = true; ED.strokeChanged = true; } continue; }
    if (GRID[y * MW + x] !== ED.tile) { GRID[y * MW + x] = ED.tile; ED.dirty = true; ED.strokeChanged = true; }
  }
}
function lineTiles(x0, y0, x1, y1, fn) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (let n = 0; n < 400; n++) { fn(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function placeAt(wx, wy) {
  const e = ED.place; if (!e) { msg('Pick an object from the palette first.'); return; }
  const o = { k: e.k, x: snapv(wx), y: snapv(wy) }; if (e.kind) o.kind = e.kind; if (e.v != null) o.v = e.v; if (e.style) o.style = e.style; if (e.f) o.f = e.f;
  if (e.k === 'portal') { o.to = e.style === 'exit' ? 'island' : 'cave'; o.sx = e.style === 'exit' ? 512 : 512; o.sy = e.style === 'exit' ? 224 : 912; } if (e.k === 'note') o.text = 'Write your tip here.';
  MAPDATA.objects.push(o); rebuildAndSelect(o); commit();
}
function hitTest(wx, wy) {
  const objs = W.objs.slice().sort((a, b) => b.y - a.y);
  for (const o of objs) { const s = runtimeSpr(o); if (!s) continue; const x0 = o.x - s.ax, y0 = o.y - s.ay; if (wx >= x0 && wx < x0 + s.width && wy >= y0 && wy < y0 + s.height) return o; }
  for (const p of W.patches) if (Math.hypot(p.x - wx, p.y - wy) < 22) return p;
  return null;
}
function deleteSel() {
  if (!ED.sel) return; const list = MAPDATA.objects, i = list.indexOf(ED.sel.src); if (i >= 0) list.splice(i, 1);
  ED.sel = null; rebuildAll(); computeShore(); refreshInspector(); commit();
}
function setSpawn(wx, wy) {
  const x = Math.round(wx), y = Math.round(wy);
  if (blockedAt(x, y)) { msg('That spot is blocked (water or an object). Click walkable ground.'); return; }
  MAPDATA.spawn = { x, y }; W.spawn = { x, y }; commit(); msg('Spawn point set.');
}

// ---- input ---------------------------------------------------------------------------------------
function updMouse(e) { ED.mouse = { sx: e.clientX, sy: e.clientY, wx: e.clientX / ED.zoom + ED.cam.x, wy: e.clientY / ED.zoom + ED.cam.y, in: true }; }
function bindEditor() {
  const inp = $('#inp');
  inp.addEventListener('pointerdown', edDown); inp.addEventListener('pointermove', edMove); inp.addEventListener('pointerup', edUp); inp.addEventListener('pointercancel', edUp);
  inp.addEventListener('pointerleave', () => { ED.mouse.in = false; }); inp.addEventListener('wheel', edWheel, { passive: false });
  addEventListener('keydown', edKey); addEventListener('keyup', e => { ED.keys[e.code] = false; });
  const ed = $('#ed'); ed.addEventListener('click', edClick); ed.addEventListener('input', edInput); ed.addEventListener('change', edChange);
}
function edDown(e) {
  try { $('#inp').setPointerCapture(e.pointerId); } catch (_) { } updMouse(e);
  if (e.button === 1 || e.button === 2 || ED.keys.Space) { ED.pan = { sx: e.clientX, sy: e.clientY, cx: ED.cam.x, cy: ED.cam.y }; return; }
  if (e.button !== 0) return;
  const { wx, wy } = ED.mouse, tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
  switch (ED.tool) {
    case 'paint': ED.stroke = { tx, ty }; ED.strokeChanged = false; paintAt(tx, ty); break;
    case 'place': placeAt(wx, wy); break;
    case 'select': { const h = hitTest(wx, wy); ED.sel = h; ED.mv = h ? { dx: h.x - wx, dy: h.y - wy, moved: false } : null; refreshInspector(); break; }
    case 'spawn': setSpawn(wx, wy); break;
  }
}
function edMove(e) {
  updMouse(e);
  if (ED.pan) { ED.cam.x = ED.pan.cx - (e.clientX - ED.pan.sx) / ED.zoom; ED.cam.y = ED.pan.cy - (e.clientY - ED.pan.sy) / ED.zoom; return; }
  const { wx, wy } = ED.mouse, tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
  if (ED.stroke) { lineTiles(ED.stroke.tx, ED.stroke.ty, tx, ty, paintAt); ED.stroke.tx = tx; ED.stroke.ty = ty; }
  else if (ED.mv && ED.sel) {
    const nx = snapv(wx + ED.mv.dx), ny = snapv(wy + ED.mv.dy);
    if (nx !== ED.sel.x || ny !== ED.sel.y) { ED.sel.x = ED.sel.src.x = nx; ED.sel.y = ED.sel.src.y = ny; ED.mv.moved = true; refreshInspector(true); }
  }
}
function edUp() {
  if (ED.pan) { ED.pan = null; return; }
  if (ED.stroke) {
    ED.stroke = null;
    if (ED.strokeChanged) { const keep = ED.sel && ED.sel.src; rebuildAll(); computeShore(); ED.sel = keep ? findRuntime(keep) : null; commit(); }
  } else if (ED.mv) {
    const m = ED.mv; ED.mv = null;
    if (m.moved) { if (ED.sel && ED.sel.fl) { const k = ED.sel.src; rebuildAll(); ED.sel = findRuntime(k); } commit(); }
  }
}
function edWheel(e) {
  e.preventDefault(); const now = performance.now(); if (now - ED.lastWheel < 130) return; ED.lastWheel = now;
  const z = clamp(ED.zoom + (e.deltaY < 0 ? 1 : -1), 1, 6); if (z === ED.zoom) return;
  const wx = e.clientX / ED.zoom + ED.cam.x, wy = e.clientY / ED.zoom + ED.cam.y; ED.zoom = z; ED.cam.x = wx - e.clientX / z; ED.cam.y = wy - e.clientY / z; updateBar();
}
function edKey(e) {
  const t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
  ED.keys[e.code] = true; const mod = e.ctrlKey || e.metaKey;
  if (e.code === 'Space') e.preventDefault();
  if (mod && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.code === 'KeyY') { e.preventDefault(); redo(); return; }
  if (mod && e.code === 'KeyS') { e.preventDefault(); saveProject(); return; }
  if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); deleteSel(); return; }
  if (e.code === 'Escape') { ED.sel = null; refreshInspector(); return; }
  if (e.code === 'KeyG') { ED.grid = !ED.grid; updateBar(); return; }
  if (/^Digit[1-7]$/.test(e.code)) { ED.tile = +e.code.slice(5) - 1; ED.tool = 'paint'; updateBar(); }
}
function edClick(e) {
  const b = e.target.closest('[data-ed]'); if (!b) return; const [a, p] = b.dataset.ed.split(':');
  switch (a) {
    case 'tool': ED.tool = p; if (p !== 'place') ED.place = ED.place; break;
    case 'tile': ED.tile = +p; ED.tool = 'paint'; break;
    case 'brush': ED.brush = +p; ED.tool = 'paint'; break;
    case 'pal': ED.place = PAL[+p]; ED.tool = 'place'; break;
    case 'undo': undo(); break; case 'redo': redo(); break;
    case 'grid': ED.grid = !ED.grid; break;
    case 'zoomin': ED.zoom = clamp(ED.zoom + 1, 1, 6); break; case 'zoomout': ED.zoom = clamp(ED.zoom - 1, 1, 6); break;
    case 'resize': resizeMap(+$('#edMW').value, +$('#edMH').value, $('#edGrow').value === 'c'); break;
    case 'save': saveProject(); break; case 'export': download('island.json', JSON.stringify(serializeMap())); msg('Exported island.json. Put it in the maps folder to use it.'); break;
    case 'import': $('#edFile').click(); break;
    case 'play': try { localStorage.setItem(areaDraftKey(AREA), snapshot()); } catch (_) { } location.href = location.pathname + '?map=draft&area=' + AREA; break;
    case 'reset': if (confirm('Replace the whole map with the default island? (You can undo this.)')) { loadMap(defaultFor(AREA)); ED.sel = null; commit(); refreshInspector(); } break;
    case 'reloadfile': discardDraft(); break;
    case 'del': deleteSel(); break;
  }
  updateBar();
}
function edInput(e) {
  if (e.target.id === 'edNoteText' && ED.sel) { ED.sel.src.text = e.target.value; ED.sel.text = e.target.value; }
}
function edChange(e) {
  const t = e.target;
  if (t.id === 'edSnap') ED.snap = +t.value;
  else if (t.id === 'edArea') { let a = t.value; if (a === '__new') a = (prompt('Name for the new area (letters, numbers, - or _)') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24); if (a) location.href = location.pathname + '?edit&area=' + a; else t.value = AREA; }
  else if (t.id === 'edTheme') { MAPDATA.theme = t.value; W.theme = t.value; rebuildAll(); commit(); }
  else if (ED.sel && t.id === 'edPTo') { ED.sel.src.to = t.value.trim().toLowerCase(); ED.sel.to = ED.sel.src.to; commit(); }
  else if (ED.sel && (t.id === 'edPSx' || t.id === 'edPSy')) { const k = t.id === 'edPSx' ? 'sx' : 'sy'; ED.sel.src[k] = Math.round(+t.value) || 0; ED.sel[k] = ED.sel.src[k]; commit(); }
  else if (t.id === 'edKind' && ED.sel) { const s = ED.sel.src; s.kind = t.value; rebuildAndSelect(s); commit(); }
  else if (t.id === 'edVar' && ED.sel) { const s = ED.sel.src; s.v = +t.value; rebuildAndSelect(s); commit(); }
  else if (t.id === 'edFile' && t.files[0]) {
    const r = new FileReader(); r.onload = () => { try { const m = JSON.parse(r.result); if (!validMap(m)) throw 0; loadMap(m); ED.sel = null; commit(); refreshInspector(); msg('Imported the map.'); } catch (_) { msg('That file is not a valid map.'); } t.value = ''; }; r.readAsText(t.files[0]);
  }
}
function download(name, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
async function saveProject() {
  const body = JSON.stringify(serializeMap());
  try { const r = await fetch('maps/' + AREA + '.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body }); if (!r.ok) throw new Error(r.status); ED.unsaved = false; msg('Saved to maps/' + AREA + '.json. The game will load it.'); }
  catch (err) { download('island.json', body); msg('Could not write to the project folder, so I downloaded island.json. Put it in the maps folder.'); }
  updateBar();
}
async function discardDraft() {
  if (!confirm('Throw away your draft and reload maps/island.json?')) return;
  try { localStorage.removeItem(areaDraftKey(AREA)); } catch (_) { }
  try { const r = await fetch('maps/' + AREA + '.json', { cache: 'no-store' }); const m = r.ok ? await r.json() : null; loadMap(validMap(m) ? m : defaultFor(AREA)); } catch (_) { loadMap(defaultFor(AREA)); }
  ED.sel = null; ED.undo = []; ED.redo = []; ED.cur = snapshot(); ED.unsaved = false; refreshInspector(); updateBar(); msg('Draft discarded.');
}

// ---- loop and drawing ---------------------------------------------------------------------------------------
function edLoop(ts) {
  const dt = Math.min(0.05, (ts - ED.last) / 1000 || 0.016); ED.last = ts;
  try { edUpdate(dt); edRender(ts / 1000); } catch (e) { console.error(e); }
  requestAnimationFrame(edLoop);
}
function edUpdate(dt) {
  const k = ED.keys, sp = 460 / ED.zoom * dt;
  if (k.KeyA || k.ArrowLeft) ED.cam.x -= sp; if (k.KeyD || k.ArrowRight) ED.cam.x += sp; if (k.KeyW || k.ArrowUp) ED.cam.y -= sp; if (k.KeyS || k.ArrowDown) ED.cam.y += sp;
  if (ED.dirty) { buildDist(); W.terrain = renderTerrain(); paintFlowers(W.terrain); ED.dirty = false; }
  ED.cam.x = clamp(ED.cam.x, -200 / ED.zoom, PW - innerWidth / ED.zoom + 60 / ED.zoom); ED.cam.y = clamp(ED.cam.y, -80 / ED.zoom, PH - innerHeight / ED.zoom + 80 / ED.zoom);
  $('#inp').style.cursor = ED.pan ? 'grabbing' : ED.keys.Space ? 'grab' : ED.tool === 'paint' ? 'crosshair' : ED.tool === 'place' ? 'copy' : ED.tool === 'select' ? 'default' : 'crosshair';
}
function outline(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h); }
function edRender(now) {
  Z = ED.zoom; VW = innerWidth / Z; VH = innerHeight / Z; g.setTransform(DPR * Z, 0, 0, DPR * Z, 0, 0); g.imageSmoothingEnabled = false;
  const cx = Math.round(ED.cam.x), cy = Math.round(ED.cam.y);
  g.fillStyle = '#121a27'; g.fillRect(0, 0, VW, VH); g.drawImage(W.terrain, -cx, -cy);
  if (fxOn()) { fxWater(cx, cy, now); fxLilies(cx, cy, now); }
  const L = W.objs.filter(o => o.x > cx - 80 && o.x < cx + VW + 80 && o.y > cy - 10 && o.y < cy + VH + 100).sort((a, b) => a.y - b.y);
  for (const o of L) drawEnt(o, cx, cy, now);
  if (ED.grid) {
    g.fillStyle = 'rgba(255,255,255,0.11)'; const lw = 1 / Z;
    for (let x = Math.max(0, Math.floor(cx / TS)) * TS; x <= Math.min(PW, cx + VW); x += TS) g.fillRect(x - cx, Math.max(0, -cy), lw, Math.min(PH - cy, VH));
    for (let y = Math.max(0, Math.floor(cy / TS)) * TS; y <= Math.min(PH, cy + VH); y += TS) g.fillRect(Math.max(0, -cx), y - cy, Math.min(PW - cx, VW), lw);
  }
  outline(-cx, -cy, PW, PH, 'rgba(242,184,75,0.6)');
  for (const p of W.patches) { g.fillStyle = 'rgba(255,170,210,0.9)'; for (let i = 0; i < 24; i++) { const a = i * 0.2618; g.fillRect(Math.round(p.x + Math.cos(a) * 24 - cx), Math.round(p.y + Math.sin(a) * 19 - cy), 1, 1); } g.fillRect(Math.round(p.x - cx) - 1, Math.round(p.y - cy) - 1, 3, 3); }
  { const sx = Math.round(W.spawn.x - cx), sy = Math.round(W.spawn.y - cy); g.fillStyle = 'rgba(20,24,34,0.4)'; g.fillRect(sx - 5, sy - 1, 10, 2); g.fillStyle = '#f5e9cf'; g.fillRect(sx, sy - 16, 1, 16); g.fillStyle = '#e8483a'; g.fillRect(sx + 1, sy - 16, 8, 5); g.fillStyle = '#fff'; g.fillRect(sx + 1, sy - 16, 8, 1); }
  if (ED.sel) {
    const s = ED.sel; if (s.fl) { g.fillStyle = '#f2b84b'; for (let i = 0; i < 32; i++) { const a = i * 0.196; g.fillRect(Math.round(s.x + Math.cos(a) * 26 - cx), Math.round(s.y + Math.sin(a) * 21 - cy), 2, 2); } }
    else { const sp = runtimeSpr(s); if (sp) outline(Math.round(s.x - sp.ax - cx) - 1, Math.round(s.y - sp.ay - cy) - 1, sp.width + 2, sp.height + 2, '#f2b84b'); }
  }
  const m = ED.mouse;
  if (m.in && !ED.pan) {
    const tx = Math.floor(m.wx / TS), ty = Math.floor(m.wy / TS);
    if (ED.tool === 'paint') { const b = ED.brush, o = Math.floor((b - 1) / 2); outline((tx - o) * TS - cx, (ty - o) * TS - cy, b * TS, b * TS, '#f2b84b'); g.fillStyle = TILE_COL[ED.tile]; g.globalAlpha = 0.35; g.fillRect((tx - o) * TS - cx, (ty - o) * TS - cy, b * TS, b * TS); g.globalAlpha = 1; }
    else if (ED.tool === 'place' && ED.place) {
      const px = snapv(m.wx), py = snapv(m.wy);
      if (ED.place.k === 'patch') { g.fillStyle = 'rgba(255,170,210,0.9)'; for (let i = 0; i < 24; i++) { const a = i * 0.2618; g.fillRect(Math.round(px + Math.cos(a) * 24 - cx), Math.round(py + Math.sin(a) * 19 - cy), 1, 1); } }
      else { const s = entrySpr(ED.place), a = anc(s); g.globalAlpha = 0.6; g.drawImage(s, Math.round(px - a.ax - cx), Math.round(py - a.ay - cy)); g.globalAlpha = 1; }
    } else if (ED.tool === 'spawn') outline(tx * TS - cx, ty * TS - cy, TS, TS, '#f2b84b');
    const st = $('#edStatus'); if (st) { const ty2 = typeAt(m.wx, m.wy), recent = performance.now() - ED.msgT < 6000; st.textContent = (recent && ED.msg ? ED.msg + '   |   ' : '') + 'tile ' + tx + ',' + ty + ' · ' + (ty2 === 7 ? 'Decking' : TILE_NAMES[ty2] || '') + (siteAt(m.wx, m.wy) ? ' · ' + SITES[siteAt(m.wx, m.wy)].n + ' dig site' : '') + ' · px ' + Math.round(m.wx) + ',' + Math.round(m.wy); }
  }
}

// ---- UI ----------------------------------------------------------------------------------------------------
function buildEditorUI() {
  const el = document.createElement('div'); el.id = 'ed';
  const tiles = TILE_NAMES.map((n, i) => `<button class="edt" data-ed="tile:${i}" data-t="${i}"><span style="background:${TILE_COL[i]}"></span>${n}<kbd>${i + 1}</kbd></button>`).join('')
    + `<h4>Decking (piers, bridges, boardwalks)</h4>` + ['Driftwood', 'Dark oak', 'Pale stone', 'Driftwood + rails', 'Dark oak + rails', 'Pale stone + rails'].map((n, i) => `<button class="edt" data-ed="tile:${101 + i}" data-t="${101 + i}"><span style="background:${STRUCT_STYLES[i % 3].a}"></span>${n}</button>`).join('')
    + `<button class="edt" data-ed="tile:100" data-t="100"><span style="background:#1c4a6e"></span>Remove decking</button>`
    + `<h4>House interior (build rooms: floors, walls, doors)</h4>` + [[1, 'Teal floor', '#57727a'], [2, 'Oak floor', '#d6b284'], [3, 'Dark wood floor', '#7e5c48'], [4, 'Ceramic tile floor', '#e8e9ec'], [5, 'Carpet floor', '#ac7072'], [6, 'Wall', '#efe2c8'], [7, 'Wall with window', '#a4dddb']].map(t => `<button class="edt" data-ed="tile:${300 + t[0]}" data-t="${300 + t[0]}"><span style="background:${t[2]}"></span>${t[1]}</button>`).join('')
    + `<button class="edt" data-ed="tile:300" data-t="300"><span style="background:#17131a"></span>Remove interior</button>`
    + `<h4>Dig sites (fixed spots, unlock by level)</h4>` + [1, 2, 3, 4].map(z => `<button class="edt" data-ed="tile:${200 + z}" data-t="${200 + z}"><span style="background:${SITES[z].col}"></span>${SITES[z].n} (Lv ${SITES[z].lv})</button>`).join('')
    + `<button class="edt" data-ed="tile:200" data-t="200"><span style="background:#4a6a3a"></span>Remove dig site</button>`;
  const pal = PAL.map((e, i) => `<button class="edp" data-ed="pal:${i}" data-p="${i}" title="${esc2(e.n)}"><img src="${palIcon(i)}" alt="${esc2(e.n)}"></button>`).join('');
  el.innerHTML = `
  <div class="edbar">
    <label>Area<select id="edArea">${areaOptions()}</select></label><i></i><button data-ed="undo" id="edUndo">Undo</button><button data-ed="redo" id="edRedo">Redo</button><i></i>
    <button data-ed="grid" id="edGrid">Grid</button><label>Snap <select id="edSnap"><option value="1">1px</option><option value="4">4px</option><option value="8" selected>8px</option><option value="16">16px</option></select></label><i></i>
    <button data-ed="zoomout">-</button><span id="edZoom">3x</span><button data-ed="zoomin">+</button><i></i>
    <button data-ed="save" id="edSave" class="pri">Save to project</button><button data-ed="export">Export</button><button data-ed="import">Import</button><button data-ed="play" class="go">Play this map</button>
    <input type="file" id="edFile" accept=".json,application/json" hidden>
  </div>
  <div class="edside">
    <h4>Tool</h4>
    <div class="edtools">
      <button data-ed="tool:paint" data-tool="paint">Paint tiles</button><button data-ed="tool:place" data-tool="place">Place object</button>
      <button data-ed="tool:select" data-tool="select">Select / move</button><button data-ed="tool:spawn" data-tool="spawn">Spawn point</button>
    </div>
    <h4>Tiles</h4><div class="edtl">${tiles}</div>
    <h4>Brush size</h4><div class="edbr">${[1, 2, 3, 5].map(n => `<button data-ed="brush:${n}" data-b="${n}">${n}x${n}</button>`).join('')}</div>
    <h4>Objects</h4><div class="edpal">${pal}</div>
    <h4>Selected</h4><div id="edInsp"></div>
    <h4>Map</h4><label class="edth">Size (tiles)<span class="edsz"><input id="edMW" type="number" min="32" max="200" value="${MW}"> × <input id="edMH" type="number" min="32" max="200" value="${MH}"></span></label><label class="edth">Grow from<select id="edGrow"><option value="c">Centre (map stays in the middle)</option><option value="tl">Top-left (add water right / bottom)</option></select></label><div class="edtools"><button data-ed="resize">Apply size</button></div><label class="edth">Look<select id="edTheme"><option value="day">Overworld</option><option value="cave">Cave (dark, glowing)</option><option value="interior">House interior (dark void)</option></select></label><div class="edtools"><button data-ed="reset">Reset to default</button><button data-ed="reloadfile">Discard draft</button></div>
    <p class="edhelp">Pan: right-drag, middle-drag, Space+drag, or WASD. Zoom: mouse wheel. Undo: Ctrl+Z. Delete: Del. Save: Ctrl+S. Tiles: keys 1-7. Piers and bridges are decking tiles: paint them like any tile. Grid: G.</p>
  </div>
  <div class="edstatus" id="edStatus"></div>`;
  document.body.appendChild(el);
}
function areaOptions() { const list = ['island', 'cave']; if (!list.includes(AREA)) list.push(AREA); return list.map(a => `<option value="${a}" ${a === AREA ? 'selected' : ''}>${a}</option>`).join('') + '<option value="__new">New area...</option>'; }
function updateBar() {
  const $$ = s => document.querySelectorAll(s); if (!$('#ed')) return;
  $('#edUndo').disabled = !ED.undo.length; $('#edRedo').disabled = !ED.redo.length; $('#edGrid').classList.toggle('on', ED.grid); $('#edZoom').textContent = ED.zoom + 'x';
  $('#edSave').textContent = ED.unsaved ? 'Save to project *' : 'Save to project';
  $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === ED.tool)); $$('.edt').forEach(b => b.classList.toggle('on', +b.dataset.t === ED.tile && ED.tool === 'paint'));
  $$('.edbr button').forEach(b => b.classList.toggle('on', +b.dataset.b === ED.brush)); $$('.edp').forEach(b => b.classList.toggle('on', ED.place === PAL[+b.dataset.p] && ED.tool === 'place'));
}
function refreshInspector(quick) {
  const el = $('#edInsp'); if (!el) return; const s = ED.sel;
  if (!s) { el.innerHTML = '<p class="mut">Nothing selected. Use Select / move and click an object.</p>'; return; }
  if (quick) { const c = $('#edCoords'); if (c) c.textContent = 'x ' + s.x + '  y ' + s.y; return; }
  const src = s.src, k = src.k; let extra = '';
  if (k === 'crystal') extra = `<label>Colour<select id="edKind">${['blue', 'purple'].map(v => `<option ${src.kind === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
  if (k === 'mushroom') extra = `<label>Colour<select id="edKind">${['cyan', 'pink'].map(v => `<option ${src.kind === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
  if (k === 'portal') extra = `<label>Goes to area<input id="edPTo" type="text" value="${esc2(src.to || '')}"></label><div class="ednums"><label>Lands at x<input id="edPSx" type="number" value="${src.sx || 0}"></label><label>Lands at y<input id="edPSy" type="number" value="${src.sy || 0}"></label></div><p class="mut">Where the player appears in that area, in pixels. Open that area in the editor and read the pixel position from the status bar.</p>`;
  if (k === 'tent') extra = `<label>Colour<select id="edKind">${['red', 'green'].map(v => `<option ${src.kind === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
  if (k === 'tree') extra = `<label>Fruit<select id="edKind">${['apple', 'orange', 'pear', 'plum'].map(v => `<option ${src.kind === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
  if (k === 'bush') extra = `<label>Berries<select id="edKind">${['blueberry', 'raspberry', 'blackberry', 'elderberry'].map(v => `<option ${src.kind === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
  if (k === 'deco') extra = `<label>Style<select id="edVar">${DECO_NAMES.map((n, i) => `<option value="${i}" ${(src.v | 0) === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
  if (k === 'patch') extra = '<p class="mut">Flowers are scattered on grass inside this circle.</p>';
  el.innerHTML = `<b>${LABELS[k] || k}</b><div id="edCoords" class="mut">x ${s.x}  y ${s.y}</div>${extra}<button data-ed="del" class="danger">Delete</button>`;
}
function injectEditorCSS() {
  const st = document.createElement('style');
  st.textContent = `
  body.editing{overflow:hidden}#ed{position:fixed;inset:0;z-index:30;pointer-events:none;font-size:13px;color:#f5e9cf}
  #ed button,#ed select,#ed textarea,#ed label{font:inherit}
  .edbar{position:absolute;left:236px;right:8px;top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:#243044;padding:6px 8px;pointer-events:auto;box-shadow:0 0 0 3px #0f1624}
  .edbar i{width:1px;height:20px;background:#3b4d6e;margin:0 2px}.edbar label{display:flex;gap:4px;align-items:center;color:#9db0cf}.edbar select{background:#101826;color:#f5e9cf;border:0;padding:3px}
  #ed button{background:#33466a;color:#f5e9cf;border:0;padding:5px 9px;cursor:pointer}#ed button:hover{background:#3f5782}#ed button:disabled{opacity:.4;cursor:default}
  #ed button.on{background:#2f7f6f;color:#fff}#ed button.pri{background:#b8841f}#ed button.go{background:#2f7f6f}#ed button.danger{background:#8a3a30;margin-top:8px}
  .edside{position:absolute;left:0;top:0;bottom:0;width:228px;background:#1b2538;overflow:auto;padding:10px;pointer-events:auto;box-shadow:3px 0 0 #0f1624}
  .edside h4{margin:12px 0 6px;font-size:11px;color:#9db0cf;font-weight:400;text-transform:uppercase;letter-spacing:.06em}.edside h4:first-child{margin-top:0}
  .edtools{display:flex;flex-wrap:wrap;gap:5px}.edtl{display:flex;flex-direction:column;gap:4px}.edt{display:flex!important;align-items:center;gap:8px;text-align:left}.edt span{width:16px;height:16px;display:block;box-shadow:0 0 0 1px #0f1624}
  .edt kbd{margin-left:auto;color:#9db0cf;font-size:11px}.edbr{display:flex;gap:5px}
  .edpal{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.edp{padding:3px!important;display:grid;place-items:center}.edp img{width:40px;height:40px;image-rendering:pixelated}
  #edInsp{display:flex;flex-direction:column;gap:6px}#edInsp label{display:flex;flex-direction:column;gap:3px;color:#9db0cf}#edInsp select,#edInsp textarea{background:#101826;color:#f5e9cf;border:0;padding:5px;resize:vertical}
  .mut{color:#9db0cf;margin:0}.edhelp{color:#9db0cf;font-size:11.5px;line-height:1.45;margin-top:14px}
  .edstatus{position:absolute;left:236px;right:8px;bottom:8px;background:#243044cc;padding:5px 10px;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
  .edsopt{display:flex;flex-direction:column;gap:5px}.edsopt label,.ednums label{display:flex;flex-direction:column;gap:3px;color:#9db0cf}.edsopt label.chk{flex-direction:row;align-items:center;gap:6px}
  .edsopt select,.ednums input{background:#101826;color:#f5e9cf;border:0;padding:4px}.ednums{display:grid;grid-template-columns:1fr 1fr;gap:5px}
  .edth{display:flex;flex-direction:column;gap:3px;color:#9db0cf;margin-bottom:6px}.edth select,#edInsp input[type=text],#edInsp input[type=number]{background:#101826;color:#f5e9cf;border:0;padding:4px}
  #inp{left:0!important}`;
  document.head.appendChild(st);
}
