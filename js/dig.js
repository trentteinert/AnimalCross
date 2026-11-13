'use strict';
// The core loop, with placeholder art (basic shapes only):
//   1 choose a spot at a dig site and dig  ->  2 something comes up, held over your head with its name and how intact it is
//   3 it joins your collection  ->  4 process spare commons at camp  ->  5 craft better brushes and mattocks from salvage and scrap
//   6 a better mattock opens the next dig site.
const HOLES = [], HOLE_LIFE = 50;                 // dug spots: they refill after a while
const holeAt = (tx, ty) => HOLES.find(h => h.tx === tx && h.ty === ty);
const mattock = () => MATTOCKS[S.gear.mattock], brush = () => BRUSHES[S.gear.brush];
const siteOpen = z => mattock().tier >= SITES[z].tier;
const toolFor = z => MATTOCKS.find(m => m.tier >= SITES[z].tier).n;
const found = id => !!(S.col[id] && S.col[id].n > 0);
const pctCol = p => p >= 70 ? '#8fe09a' : p >= 40 ? '#ffd877' : '#ff9a8a';

// ---- what a dig turns up ------------------------------------------------------------------------------------------------------------------
const DIG_FINDS = { artifact: 0.45, salvage: 0.40 };   // the rest is dirt and pebbles
const ART_W = { 1: [60, 28, 12], 2: [42, 36, 22], 3: [28, 40, 32] };   // common / uncommon / rare, by dig site tier
const SALV_IDS = ['nails', 'fabric', 'boot'], SALV_W = [45, 30, 25];
function rollDig(tier, depth) {   // depth: how far down the dug spot is (units): deeper strata give rarer finds that are better preserved
  depth = depth || 0;
  const st = S.stats; let kind;
  if (st.digs === 0 || st.dry >= 3) kind = 'artifact';   // the very first dig, and every fourth dry one, always turns up an artifact
  else { const r = Math.random(); kind = r < DIG_FINDS.artifact ? 'artifact' : r < DIG_FINDS.artifact + DIG_FINDS.salvage ? 'salvage' : 'dirt'; }
  if (kind === 'artifact') {
    const w = (ART_W[tier] || ART_W[1]).slice(); w[0] *= Math.max(0.2, 1 - 0.25 * depth); w[2] *= 1 + 0.8 * depth;
    const a = st.digs === 0 ? ARTIFACTS[0] : ARTIFACTS[pickW(w)];
    return { kind, id: a.id, pct: clamp(Math.round(rnd(40, 88) - a.r * 4 + brush().pres + depth * 6), 5, 100) };   // rarer things are a little more fragile; brushes help
  }
  if (kind === 'salvage') return { kind, id: SALV_IDS[pickW(SALV_W)], n: 1 + (Math.random() < 0.4 ? 1 : 0) };
  return { kind };
}
function recordFind(res) {
  const st = S.stats; st.digs++;
  if (res.kind === 'artifact') {
    st.dry = 0; const c = S.col[res.id] || (S.col[res.id] = { n: 0, best: 0 });
    res.isNew = c.n === 0; res.isBest = c.n > 0 && res.pct > c.best; c.n++; if (res.pct > c.best) c.best = res.pct;
    S.arts.push({ id: res.id, pct: res.pct });
    res.unlocks = res.isNew ? RECIPES.filter(r => r.unlock === res.id) : [];
  } else { st.dry++; if (res.kind === 'salvage') { st.seen = st.seen || {}; res.isNew = !st.seen[res.id]; st.seen[res.id] = 1; S.mats[res.id] = (S.mats[res.id] | 0) + res.n; } }
}

// ---- targets and actions ----------------------------------------------------------------------------------------------------------------------
const SHOPK = ['camp'];
const ICON = { camp: 'camp', dig: 'beach' };
function targetInfo(t) {
  if (t.kind === 'camp') return { icon: 'camp', hint: 'Press to open camp' };
  if (!siteOpen(t.zone)) return { icon: 'beach', hint: 'Needs the ' + toolFor(t.zone) + ' to dig here' };
  if (holeAt(t.tx, t.ty)) return { icon: 'beach', hint: 'Already dug. Pick another spot' };
  return { icon: 'beach', hint: 'Press to dig' };
}
function findTarget() {
  if (A || UI.isOpen) return null;
  const px = ME.x, py = ME.y, fv = DV[ME.dir]; let best = null;
  const consider = (kind, ref, x, y, dist, range, bias) => {
    if (dist > range) return; const dx = x - px, dy = y - py, d = Math.hypot(dx, dy) || 1;
    const sc = dist - (dx / d * fv[0] + dy / d * fv[1]) * 5 + (bias || 0);
    if (!best || sc < best.sc) best = { kind, ref, sc, dist, dir: dirOf(dx, dy) };
  };
  for (const o of W.objs) {
    if (Math.abs(o.x - px) > 60 || Math.abs(o.y - py) > 60) continue;
    if (SHOPK.includes(o.k)) consider(o.k, o, o.x, o.y, distToBox(px, py, o), o.ia);
  }
  let sb = null;   // the dig spot: the site tile just in front of you
  for (const dn of ['u', 'd', 'l', 'r']) {
    const v = DV[dn];
    for (let dd = 4; dd <= 22; dd += 2) {
      const sx = px + v[0] * dd, sy = py - 2 + v[1] * dd, z = siteAt(sx, sy);
      if (z && !(pitV(Math.floor(sx / TS), Math.floor(sy / TS)) & 1) && Math.abs(pitZ(sx, sy) - pitZ(px, py)) < 0.6) { const sc = dd * 0.8 - (dn === ME.dir ? 8 : 0); if (!sb || sc < sb.sc) sb = { dn, dd, sc, z, tx: Math.floor(sx / TS), ty: Math.floor(sy / TS) }; break; }
    }
  }
  if (sb && (!best || sb.sc < best.sc + 2)) best = { kind: 'dig', ref: null, sc: sb.sc, dist: sb.dd, dir: sb.dn, zone: sb.z, tx: sb.tx, ty: sb.ty };
  return best;
}
function faceTo(t) { if (t.dir) ME.dir = t.dir; }
function endAct(msg) { A = null; if (msg) UI.toast(msg, 'info'); }
const DIG_TIME = 6;   // seconds of digging at base speed (long for now, so the dig animation can be watched)
const BRUSH_TIME = 3;   // seconds of brushing at base brush speed before a find is revealed (a better brush is faster)
// The dig animation sheet (assets/chars/dig_sheet.png): 12 rows (one per animation frame), 20 columns of 32x48 cells: body, hair, brush, the find, mattock, each with 4 directions (down, right, up, left).
const DIGD = { ax: 16, ay: 48, dirs: { d: 0, r: 1, u: 2, l: 3 }, hands: [-0.5, -37] };   // hands: where the find is held up in the last frame, from his feet
const digAnim = dir => ASSET.img.dig_sheet && DIGD.dirs[dir] != null ? DIGD : null;
const DIGC = { px: null, lk: '', c: {}, roles: null, obj: {} };
function lookRoles() {   // which colours in the painted sheets belong to which part of the look, and how bright each shade is compared with its role's main colour
  if (DIGC.roles) return DIGC.roles; DIGC.roles = {};
  for (const role in HERO.roles) { const main = Math.max(1, heroLum(heroRoleColor(role))); HERO.roles[role].forEach((q, k) => { const i = heroPix(role, k), c = [HERO.base[i], HERO.base[i + 1], HERO.base[i + 2]]; DIGC.roles[c[0] << 16 | c[1] << 8 | c[2]] = [role, heroLum(c) / main]; }); }
  return DIGC.roles;
}
function lookPix(r, g2, b, y, look, upper) {   // recolour one painted pixel by role; the two browns shared by eyes/collar and boots are told apart by where they sit
  let m = lookRoles()[r << 16 | g2 << 8 | b]; const key = r << 16 | g2 << 8 | b;
  if (key === 0x513b30) m = y < upper ? ['eyes', 1] : ['boots', 1]; else if (key === 0x77543c) m = y < upper ? ['shirt', heroLum([r, g2, b]) / Math.max(1, heroLum(heroRoleColor('shirt')))] : ['boots', m ? m[1] : 1];
  if (!m || !look[m[0]]) return [r, g2, b]; const t = [1, 3, 5].map(i => parseInt(look[m[0]].slice(i, i + 2), 16)); return [0, 1, 2].map(q => clamp(Math.round(t[q] * m[1]), 0, 255));
}
function digInit() {
  const im = ASSET.img.dig_sheet, t = mk(im.width, im.height); t.g.drawImage(im, 0, 0); DIGC.px = t.g.getImageData(0, 0, im.width, im.height).data; DIGC.w = im.width; lookRoles();
}
function digSprite(dir, fr) {   // one 32x48 frame with your hair, skin and clothes colours on it
  if (!DIGC.px) digInit(); const look = HERO.tint, lk = JSON.stringify(look); if (DIGC.lk !== lk) { DIGC.lk = lk; DIGC.c = {}; }
  const di = DIGD.dirs[dir], key = di * 16 + fr; if (DIGC.c[key]) return DIGC.c[key];
  const c = mk(32, 48), id = c.g.createImageData(32, 48), o = id.data, P = DIGC.px, hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const cell = (col, x, y) => ((fr * 48 + y) * DIGC.w + (col * 32 + x)) * 4;
  const put = (col, fn) => { for (let y = 0; y < 48; y++) for (let x = 0; x < 32; x++) { const i = cell(col, x, y); if (!P[i + 3]) continue; const k = (y * 32 + x) * 4, r = fn(P[i], P[i + 1], P[i + 2], y); o[k] = r[0]; o[k + 1] = r[1]; o[k + 2] = r[2]; o[k + 3] = 255; } };
  put(di, (r, g2, b, y) => lookPix(r, g2, b, y, look, 36));   // body: recoloured by role
  const hs = look.hairStyle; if (hs !== 'none') { const t = look.hair ? hex(look.hair) : null, ml = heroLum([136, 96, 75]); put(4 + di, (r, g2, b) => t ? [0, 1, 2].map(q => clamp(Math.round(t[q] * heroLum([r, g2, b]) / ml), 0, 255)) : [r, g2, b]); }   // hair: recoloured around its main shade
  put(8 + di, (r, g2, b) => [r, g2, b]); put(16 + di, (r, g2, b) => [r, g2, b]);   // the brush and the mattock keep the colours they were drawn in
  c.g.putImageData(id, 0, 0); return DIGC.c[key] = c;
}
function digBlob(dir, fr, prog) {   // the dirt blob drawn over the find in the sheet, with pixels brushed away at random as `prog` goes from 0 to 1
  const q = Math.min(24, Math.floor(prog * 24)), di = DIGD.dirs[dir], key = (di * 16 + fr) * 32 + q; if (DIGC.bl && DIGC.bl[key]) return DIGC.bl[key]; if (!DIGC.px) digInit(); DIGC.bl = DIGC.bl || {};
  const c = mk(32, 48), id = c.g.createImageData(32, 48), o = id.data, P = DIGC.px;
  for (let y = 0; y < 48; y++) for (let x = 0; x < 32; x++) { const i = ((fr * 48 + y) * DIGC.w + 12 * 32 + di * 32 + x) * 4; if (!P[i + 3] || hash2(x, y, 5) * 0.96 < q / 24) continue; const k = (y * 32 + x) * 4; o[k] = P[i]; o[k + 1] = P[i + 1]; o[k + 2] = P[i + 2]; o[k + 3] = 255; }
  c.g.putImageData(id, 0, 0); return DIGC.bl[key] = c;
}
function digObjAt(dir, fr) {   // where the find sits in the hole on this frame (the sheet's find column): its centre, or null when it isn't showing
  const di = DIGD.dirs[dir], key = di * 16 + fr; if (key in DIGC.obj) return DIGC.obj[key]; if (!DIGC.px) digInit();
  let x0 = 99, x1 = -1, y0 = 99, y1 = -1; for (let y = 0; y < 48; y++) for (let x = 0; x < 32; x++) if (DIGC.px[((fr * 48 + y) * DIGC.w + 12 * 32 + di * 32 + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return DIGC.obj[key] = x1 < 0 ? null : { x: (x0 + x1 + 1) / 2, y: (y0 + y1 + 1) / 2 };
}
const DIGE = { fps: 8, begin: [0, 1, 2, 3, 4, 5], clips: [[3, 4, 5], [4, 5]], brush: [6, 7], reward: [8, 9, 10, 11] };   // frames 1-6 dig, 7-8 brushing, 9-12 reward; hands: where the find is held, from the feet   // the east dig strip: frames 1-6 play when digging starts, then 'dig 2' (frames 4-6) and 'prospect' (frames 5-6) at random
function digFrameE(a) {
  if (a.ph === 'brush') return DIGE.brush[Math.floor(a.bt * DIGE.fps * 0.75) % 2];
  if (a.ph === 'reward') return DIGE.reward[Math.min(3, Math.floor(a.rt * DIGE.fps))];
  if (a.rise != null) return [2, 1, 0][Math.min(2, Math.floor(a.rise * DIGE.fps))];   // which frame of the east dig strip is showing; the random clips are chosen once and remembered so they don't flicker
  if (!a.seq) a.seq = DIGE.begin.slice(); const i = Math.floor(a.t * DIGE.fps);
  while (a.seq.length <= i) a.seq.push(...DIGE.clips[Math.floor(Math.random() * DIGE.clips.length)]);
  return a.seq[i];
}
function startAction() {
  if (A || UI.isOpen || !target) return; const t = target; faceTo(t); ME.face = FACE_OF_DIR[ME.dir]; ME.faceDir = ME.dir; ME.hold = null;
  if (t.kind === 'camp') { held = false; UI.openCamp('process'); return; }
  if (t.kind === 'dig') {
    if (!siteOpen(t.zone)) { UI.toast('You need the ' + toolFor(t.zone) + ' for ' + SITES[t.zone].n, 'info'); sfx('no'); return; }
    if (holeAt(t.tx, t.ty)) { UI.toast('Already dug. Pick another spot', 'info'); sfx('no'); return; }
    const v = DV[t.dir];
    A = { k: 'dig', t: 0, dur: DIG_TIME / mattock().spd, tx: t.tx, ty: t.ty, zone: t.zone, dir: t.dir, hit: digAnim(t.dir) ? 4 / DIGE.fps : 0, x: (t.tx + 0.5) * TS, y: (t.ty + 0.5) * TS, fx: 0, depth: pitZ((t.tx + 0.5) * TS, (t.ty + 0.5) * TS) };
  }
}
function updateAct(dt) {
  if (!A) return; A.t += dt;
  if (A.k === 'dig') {
    if (A.rise != null) { A.rise += dt; if (A.rise >= 3 / DIGE.fps) endAct(); return; }   // standing back up: frames 3-2-1 played in reverse
    if (A.ph === 'brush') {   // brush the find clear: a better brush finishes sooner
      A.bt += dt; A.fx -= dt; if (A.fx <= 0) { A.fx = 0.3; burst(A.x + rnd(-4, 4), A.y + rnd(-3, 1), '#d8c8a8', 2, 20, 0.5, 60, 1); }
      if (A.bt >= A.bdur) { A.ph = 'reward'; A.rt = 0; }
      return;
    }
    if (A.ph === 'reward') {   // stand and hold the find up; it is revealed when the last frame lands
      A.rt += dt; if (A.rt >= 3 / DIGE.fps) { recordFind(A.res); showFind(A.res, A.x, A.y); if (ME.hold) ME.hold.pose = { dir: A.dir, hands: DIGD.hands }; endAct(); }
      return;
    }
    A.d = Math.max(0, A.t - A.hit);   // digging only starts when the mattock first lands (frame 5 of the east dig); until then you are just winding up
    if (A.d <= 0) return;
    const strike = () => { burst(A.x + rnd(-3, 3), A.y + rnd(-2, 2), '#8a6a44', 4, 34, 0.5, 90, 1); sfx('dig'); };
    if (digAnim(A.dir)) { const fr = digFrameE(A); if (fr === 4 && A.lf !== 4) strike(); A.lf = fr; }   // the dig sound and dust happen only as the mattock lands (frame 5 of the animation)
    else { A.fx -= dt; if (A.fx <= 0) { A.fx = 0.22; strike(); } }
    if (A.d >= A.dur) {
      const res = rollDig(SITES[A.zone].tier, A.depth); HOLES.push({ tx: A.tx, ty: A.ty, t: 0 }); const hx = A.x, hy = A.y;
      if (digAnim(A.dir) && res.kind !== 'dirt') { A.res = res; A.ph = 'brush'; A.bt = 0; A.bdur = BRUSH_TIME / brush().spd; A.fx = 0; return; }   // something is in the hole: brush it clear, then hold it up
      recordFind(res); if (digAnim(A.dir)) A.rise = 0; else endAct();
      showFind(res, hx, hy);
    }
  }
}
function actState() {
  if (!A) return null;
  if (A.k === 'dig') return { icon: 'beach', prog: A.ph === 'brush' ? A.bt / A.bdur : A.ph === 'reward' ? 1 : (A.d || 0) / A.dur, alert: false, hint: A.ph ? 'Brushing...' : 'Digging...' };
}
function showFind(res, hx, hy) {   // the find is held up over your head with its name and how intact it is
  if (res.kind === 'dirt') { floater(hx, hy - 8, 'Just dirt and pebbles', '#d8c8a8'); sfx('no'); UI.refresh(); return; }
  ME.hold = { res, t: 0, dur: res.kind === 'artifact' ? 4 : 2.6 };
  const rr = res.kind === 'artifact' ? ARTIFACTS.find(a => a.id === res.id).r : 0;
  sfx(rr >= 1 ? 'rare' : 'catch'); vib(rr >= 1 ? [20, 40, 30] : 20);
  burst(ME.x, ME.y - 30, res.kind === 'artifact' ? RAR[rr].c : '#d8c8a8', 8 + rr * 8, 60 + rr * 15, 0.9, 50, rr >= 1 ? 2 : 1);
  if (res.unlocks && res.unlocks.length) setTimeout(() => UI.note('Recipe unlocked', res.unlocks.map(r => r.name).join(', ')), 1400);
  UI.refresh();
}
function tickHoles(dt) { for (let i = HOLES.length - 1; i >= 0; i--) { HOLES[i].t += dt; if (HOLES[i].t > HOLE_LIFE) HOLES.splice(i, 1); } }

// ---- drawing: dug spots, site signs, the find above your head, the mattock -----------------------------------------------------------------------
function drawHoles(cx, cy) {
  for (const h of HOLES) {
    const x = h.tx * TS - cx, y = h.ty * TS - cy + Math.round(pitZ((h.tx + 0.5) * TS, (h.ty + 0.5) * TS) * PIT_U); if (x < -20 || x > VW || y < -20 || y > VH) continue;
    g.globalAlpha = clamp((HOLE_LIFE - h.t) / 8, 0, 1);
    g.fillStyle = '#2e1c10'; g.fillRect(x + 3, y + 5, 10, 7); g.fillRect(x + 4, y + 4, 8, 1); g.fillRect(x + 4, y + 12, 8, 1);
    g.fillStyle = '#4a3220'; g.fillRect(x + 4, y + 6, 8, 4);
    g.fillStyle = '#9a7248'; g.fillRect(x + 1, y + 12, 4, 2); g.fillRect(x + 11, y + 11, 4, 2); g.fillRect(x + 6, y + 13, 5, 1);   // the spoil heaps
    g.globalAlpha = 1;
  }
  if (A && A.k === 'dig' && A.d > 0 && A.rise == null && !A.ph) {   // the hole opening up while you dig
    const x = Math.round(A.x - cx), y = Math.round(A.y - cy + A.depth * PIT_U), u = clamp((A.d || 0) / A.dur, 0, 1), w = 2 + Math.round(u * 8);
    g.fillStyle = '#2e1c10'; g.fillRect(x - w / 2, y - 2, w, 4 + Math.round(u * 3));
  }
}
function drawLockedShade(cx, cy) {   // dig sites you can't work yet are dimmed
  for (const r of W.sites) {
    if (siteOpen(r.zone) || r.x1 < cx || r.x0 > cx + VW || r.y1 < cy || r.y0 > cy + VH) continue;
    g.fillStyle = 'rgba(30,14,14,0.42)'; for (const j of r.tiles) { const tx = j % MW, ty = (j / MW) | 0; g.fillRect(tx * TS - cx, ty * TS - cy, TS, TS); }
  }
}
function drawSiteBoards(cx, cy) {   // a sign on every dig site: its name and what it needs
  for (const r of W.sites) {
    if (r.x1 < cx - 40 || r.x0 > cx + VW + 40 || r.y1 < cy - 20 || r.y0 > cy + VH + 40) continue;
    const zn = SITES[r.zone], locked = !siteOpen(r.zone), sx = Math.round((r.x0 + r.x1) / 2 - cx), sy = Math.round(r.y0 - cy - 9), txt = zn.n, sub = locked ? 'Needs ' + toolFor(r.zone) : 'Tier ' + zn.tier + ' dig site';
    g.font = 'bold 7px "Pixelify Sans", monospace'; const w = Math.max(g.measureText(txt).width, g.measureText(sub).width, 40) + 8;
    const mx = ME.x - cx, my = ME.y - cy; g.globalAlpha = Math.abs(mx - sx) < w / 2 + 10 && my - 52 < sy + 9 && my > sy - 12 ? 0.3 : 1;   // the sign fades when you stand behind it
    g.fillStyle = locked ? '#4a2f2f' : '#6b4423'; g.fillRect(sx - w / 2, sy - 12, w, 17); g.fillStyle = locked ? '#8a5a5a' : '#a8743a'; g.fillRect(sx - w / 2, sy - 12, w, 1); g.fillStyle = '#2a1c14'; g.fillRect(sx - 1, sy + 5, 2, 4);
    g.fillStyle = '#f5e9cf'; g.textAlign = 'center'; g.fillText(txt, sx, sy - 5); g.font = '6px "Pixelify Sans", monospace'; g.fillStyle = locked ? '#ff9a8a' : '#a8e8a0'; g.fillText(sub, sx, sy + 2); g.globalAlpha = 1;
  }
}
function drawDigMarker(cx, cy, now) {   // the corners of the tile you would dig: drawn on the ground, under you and everything standing on it
  if (!target || target.kind !== 'dig') return;
  const x = target.tx * TS - cx, y = target.ty * TS - cy + Math.round(pitZ((target.tx + 0.5) * TS, (target.ty + 0.5) * TS) * PIT_U), ok = siteOpen(target.zone) && !holeAt(target.tx, target.ty); g.fillStyle = ok ? `rgba(255,255,255,${0.55 + 0.35 * Math.sin(now * 6)})` : 'rgba(255,120,110,0.7)';
  const L = 4;   // only the four corners are marked: short L-shapes, not a full box
  g.fillRect(x, y, L, 1); g.fillRect(x, y, 1, L); g.fillRect(x + TS - L, y, L, 1); g.fillRect(x + TS - 1, y, 1, L);
  g.fillRect(x, y + TS - 1, L, 1); g.fillRect(x, y + TS - L, 1, L); g.fillRect(x + TS - L, y + TS - 1, L, 1); g.fillRect(x + TS - 1, y + TS - L, 1, L);
}
function drawMarker(cx, cy, now) {   // the bobbing arrow over a camp or other thing you can use
  if (!target || target.kind === 'dig') return;
  const o = target.ref, bob = Math.round(Math.sin(now * 6) * 1.5), px = Math.round(o.x - cx), py = Math.round(o.y - 44 - cy + bob);
  g.fillStyle = '#2a1c1c'; g.fillRect(px - 3, py - 1, 7, 2); g.fillRect(px - 2, py + 1, 5, 2); g.fillRect(px - 1, py + 3, 3, 1);
  g.fillStyle = '#f2b84b'; g.fillRect(px - 2, py, 5, 1); g.fillRect(px - 1, py + 1, 3, 1); g.fillRect(px, py + 2, 1, 1);
}
function drawHoldIcon(e, cx, cy, now) {   // the find rises above your head and bobs
  if (ME.hold.pose) { const h = ME.hold, ic = itemIcon(h.res.id), u = Math.min(1, h.t / 0.2), fade = clamp((h.dur - h.t) / 0.35, 0, 1); g.globalAlpha = fade; g.drawImage(ic, Math.round(e.x + h.pose.hands[0] - ic.width / 2 - cx), Math.round(e.y + h.pose.hands[1] - ic.height / 2 - cy + (1 - u) * 4), ic.width, ic.height); g.globalAlpha = 1; return; }   // held between the hands of the reward pose
  const h = ME.hold, r = h.res, ic = itemIcon(r.id), big = r.kind === 'artifact', u = Math.min(1, h.t / 0.24), k = 2.70158, eb = 1 + k * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2);
  const fade = clamp((h.dur - h.t) / 0.35, 0, 1), sz = Math.round(ic.width * (big ? 3 : 2) * eb), bob = Math.round(Math.sin(now * 4)), top = Math.round(e.y - 44 - sz + bob - cy);
  g.globalAlpha = fade;
  if (big && r.pct >= 80) { g.fillStyle = 'rgba(255,240,170,0.9)'; for (let i = 0; i < 4; i++) { const a = now * 2 + i * 1.57, rr = sz * 0.55 + 4; g.fillRect(Math.round(e.x - cx + Math.cos(a) * rr), Math.round(top + sz / 2 + Math.sin(a) * rr * 0.7), 2, 2); } }
  g.drawImage(ic, Math.round(e.x - sz / 2 - cx), top, sz, sz); g.globalAlpha = 1;
}
function drawHoldText(cx, cy) {   // over the held find: its name in the rarity colour and, for artifacts, how intact it is, each with a thin dark shadow
  if (!ME.hold) return; const h = ME.hold, r = h.res, it = ITEM[r.id], big = r.kind === 'artifact', x = Math.round(ME.x - cx);
  const y = Math.round(ME.y + pitZ(ME.x, ME.y) * PIT_U - (h.pose ? 45 : 44 + 16 * (big ? 3 : 2)) - cy), col = big ? RAR[it.r].c : '#d8c8a8', txt = big ? it.name : '+' + r.n + ' ' + it.name;
  g.globalAlpha = clamp((h.dur - h.t) / 0.35, 0, 1) * (h.t > 0.2 ? 1 : h.t / 0.2); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const line = (t, yy, c, f) => { g.font = f; g.fillStyle = 'rgba(14,10,8,0.9)'; g.fillText(t, x + 1, yy + 1); g.fillText(t, x, yy + 1); g.fillText(t, x + 1, yy); g.fillStyle = c; g.fillText(t, x, yy); };
  if (big) { line(r.pct + '% intact', y, pctCol(r.pct), 'bold 7px "Pixelify Sans", monospace'); line(txt, y - 9, col, 'bold 7px "Pixelify Sans", monospace'); }
  else line(txt, y, col, 'bold 7px "Pixelify Sans", monospace');
  g.globalAlpha = 1; g.font = '6px "Pixelify Sans", monospace';
}
// ---- trees: the crown is drawn over everything and sways; leaves drift down from it ---------------------------------------------------------------------
const LEAVES = [];
function tickTrees(dt) {
  if (!W.objs) return; const t = performance.now() / 1000;
  for (const o of W.objs) {
    if (o.k === 'decor' && /^bush/.test(o.src.d)) {   // walk onto a bush and it squashes down; step off and it springs back
      const on = Math.abs(ME.x - o.x) < o.spr.width / 2 && ME.y > o.y - 8 && ME.y < o.y + 5;
      if (on && !o.on && ME.moving) { for (let i = 0; i < 5; i++) spawnLeaf(o); sfx('rustle'); }
      o.on = on; o.sq = (o.sq || 0) + ((on ? 1 : 0) - (o.sq || 0)) * Math.min(1, dt * (on ? 14 : 7)); continue;
    }
    if (o.k === 'decor' && /^flower/.test(o.src.d)) {   // flowers bend away as you brush through, then wobble back upright
      const near = Math.abs(ME.x - o.x) < 11 && Math.abs(ME.y - o.y) < 9;
      if (near && ME.moving && (!o.rt || t - o.rt > 0.5)) { o.rt = t; o.lv = (o.x >= ME.x ? 1 : -1) * 9; }
      o.lv = o.lv || 0; o.lp = o.lp || 0; o.lv += (-o.lp * 90 - o.lv * 7) * dt; o.lp += o.lv * dt;
      o.lean = o.lp; continue;
    }
    if (o.k === 'decor' && ROLL[o.src.d]) {   // pebbles and small rocks get kicked and roll; the bigger the stone, the less it rolls
      const f = ROLL[o.src.d]; o.vx = o.vx || 0; o.vy = o.vy || 0; o.ang = o.ang || 0;
      const R = STONE_R[o.src.d], cyo = o.spr.height / 2, dx = o.x - ME.x, dy = o.y - cyo - (ME.y - 2), d = Math.hypot(dx, dy * 1.3);   // distance from you to the middle of the stone
      if (ME.moving && d < R + 5 && d > 0.1) { const k = 62 * f / d; o.vx = dx * k; o.vy = dy * k; }
      const sp = Math.hypot(o.vx, o.vy);
      if (sp > 2.5) {
        const nx = o.x + o.vx * dt, ny = o.y + o.vy * dt;
        if (!blockedAt(nx, o.y, R, R * 1.4)) o.x = nx; else o.vx *= -0.35;
        if (!blockedAt(o.x, ny, R, R * 1.4)) o.y = ny; else o.vy *= -0.35;
        o.ang += (o.vx >= 0 ? 1 : -1) * sp * dt / R;
        const fr = Math.exp(-3.2 * dt); o.vx *= fr; o.vy *= fr;
      } else o.vx = o.vy = 0;
      continue;
    }
    if (o.k !== 'tree') continue; o.sx = 0;
    if (Math.abs(o.x - ME.x) > 220 || Math.abs(o.y - ME.y) > 260) continue;   // only trees near you are alive
    o.shake = Math.max(0, o.shake - dt); const sw = o.bare ? 0 : Math.round(Math.sin(t * 0.8 + o.ph) * 1.2 + Math.sin(t * 1.9 + o.ph * 2) * 0.5); o.sx = sw + Math.round(Math.sin(t * 42) * o.shake * 2.4);
    if (!o.bare && SPR.leaves.length) { o.lt -= dt; if (o.lt <= 0) { o.lt = rnd(3.5, 8); spawnLeaf(o); } }
    if (ME.moving && Math.hypot(ME.x - o.x, (ME.y - o.y) * 1.2) < 13 && !o.bare) { if (!o.rt || t - o.rt > 1.6) { o.rt = t; o.shake = 0.55; for (let i = 0; i < 4; i++) spawnLeaf(o); } }   // brush past the trunk and the crown rustles
  }
  for (let i = LEAVES.length - 1; i >= 0; i--) {
    const l = LEAVES[i]; l.t += dt;
    if (!l.land) { l.y += l.vy * dt; l.x += (Math.sin(l.t * 1.7 + l.ph) * 9 + l.vx) * dt; if (l.y >= l.gy) { l.y = l.gy; l.land = true; l.lt = 0; } }
    else { l.lt += dt; if (l.lt > 3.5) LEAVES.splice(i, 1); }
  }
}
const ROLL = { pebble0: 1, pebble1: 0.85, pebble2: 0.75, rock0: 0.3 };
const STONE_R = { pebble0: 1.5, pebble1: 2, pebble2: 2.5, rock0: 3.5 };   // each stone's collider radius: a tight circle around the middle of its sprite, which is also what it spins around   // how far each stone rolls when kicked; rock1 is too big to move
function spawnLeaf(o) {
  if (o.k === 'decor') { const w = o.spr.width; LEAVES.push({ x: o.x + rnd(-w / 3, w / 3), y: o.y - rnd(4, o.spr.height * 0.7), vy: rnd(14, 24), vx: rnd(-8, 8), ph: rnd(0, 6.28), t: 0, k: Math.floor(rnd(0, 3)), gy: o.y + rnd(-2, 6), land: false, lt: 0 }); return; }
  const c = o.crown, x = o.x - c.ax + rnd(0.15, 0.85) * c.width, y = o.y - c.ay + rnd(0.4, 0.95) * c.height;
  LEAVES.push({ x, y, vy: rnd(10, 17), vx: rnd(-3, 3), ph: rnd(0, 6.28), t: 0, k: Math.floor(rnd(0, 3)), gy: o.y + rnd(-8, 12), land: false, lt: 0 });
}
function drawCrowns(cx, cy, now) {
  for (const o of W.objs) {
    if (o.k !== 'tree' || o.bare || !o.crown) continue; const c = o.crown, x = o.x - c.ax, y = o.y - c.ay;
    if (x + c.width < cx - 10 || x > cx + VW + 10 || y + c.height < cy - 10 || y > cy + VH + 10) continue;
    let a = 1; if (false) { const over = ME.x + 9 > x && ME.x - 9 < x + c.width && ME.y > y && ME.y - 46 < y + c.height; o.fa = (o.fa == null ? 1 : o.fa) + ((over ? 0.38 : 1) - (o.fa == null ? 1 : o.fa)) * 0.18; a = o.fa; }
    const sx = o.sx || 0, px = Math.round(x - cx), py = Math.round(y - cy), h = c.height, b1 = Math.round(h * 0.34), b2 = Math.round(h * 0.67);
    if (a < 1) g.globalAlpha = a;
    g.drawImage(c, 0, 0, c.width, b1, px + sx, py, c.width, b1);                                   // the top of the crown sways most,
    g.drawImage(c, 0, b1, c.width, b2 - b1, px + Math.round(sx * 0.6), py + b1, c.width, b2 - b1);   // the middle less,
    g.drawImage(c, 0, b2, c.width, h - b2, px + Math.round(sx * 0.25), py + b2, c.width, h - b2);   // and the bottom hardly at all
    g.globalAlpha = 1;
  }
}
function drawLeaf(l, cx, cy) {
  if (l.x < cx - 10 || l.x > cx + VW + 10 || l.y < cy - 10 || l.y > cy + VH + 10) return;
  const fr = l.land ? 3 : Math.floor(l.t * 7) % 4, s = SPR.leaves[fr][l.k]; if (l.land) g.globalAlpha = clamp(1 - Math.max(0, l.lt - 2.5), 0, 1);
  g.drawImage(s, Math.round(l.x - s.ax - cx), Math.round(l.y - s.ay - cy)); g.globalAlpha = 1;
}

// ---- a dithered ghost of you over whatever hides you (objects in front of you, the rim of a pit) --------------------------------------------------
const GHOST_MODE = new URLSearchParams(location.search).get('ghost') || 'outline';   // how you show through things in front of you: 'fade' (the object turns see-through), 'outline' (a thin outline of you), 'dither' (a sparse ghost of you)
const GHOST = { sil: null, mask: null, checker: null, tmp: null };
function behindAlpha(o) {   // 'fade' mode: an object drawn over you turns see-through while it covers you
  if (GHOST_MODE !== 'fade' || !o.spr || !ME || o.k === 'me' || o.k === 'tree' || o.k === 'decor') return 1;
  const s = o.spr, over = o.y > ME.y && ME.x + 9 > o.x - s.ax && ME.x - 9 < o.x - s.ax + s.width && ME.y > o.y - s.ay && ME.y - 46 < o.y;
  o.fa = (o.fa == null ? 1 : o.fa) + ((over ? 0.38 : 1) - (o.fa == null ? 1 : o.fa)) * 0.18; return o.fa;
}
function drawGhost(L, cx, cy) {
  const e = ME, spr = heroSprite(faceIdx(e), (A && A.k === 'dig') || ME.hold ? 0 : heroFrameOf(e), null), w = spr.width, h = spr.height;
  const bob = A && A.k === 'dig' ? -Math.round(Math.max(0, Math.sin(A.t * 15))) : ME.wave ? -(Math.floor(ME.wave.t * 8) % 2) : 0, z = pitZ(e.x, e.y);
  const sx = Math.round(e.x - spr.ax - cx), sy = Math.round(e.y - spr.ay - cy + bob) + Math.round(z * PIT_U);
  const near = (x0, y0, sw, sh) => x0 + sw > sx && x0 < sx + w && y0 + sh > sy && y0 < sy + h;
  const front = (GHOST_MODE === 'fade' ? [] : L.slice(L.indexOf(e) + 1).filter(o => o.spr && o.k !== 'me' && o.k !== 'tree' && o.k !== 'decor' && near(o.x - o.spr.ax - cx, o.y - o.spr.ay - cy, o.spr.width, o.spr.height))).map(o => ({ spr: o.spr, px: Math.round(o.x - o.spr.ax - cx), py: Math.round(o.y - o.spr.ay - cy) }));   // things drawn after you that overlap you
  const ry = z > 0.01 ? rimY(e.x, e.y) : null;
  if (!front.length && ry == null) return;
  if (!GHOST.mask) { GHOST.tmp = mk(48, 56); GHOST.mask = mk(48, 56); GHOST.sil = mk(48, 56); GHOST.checker = mk(48, 56); for (let y = 0; y < 56; y++) for (let x = 0; x < 48; x++) if ((x & 1) && (y & 1)) GHOST.checker.g.fillRect(x, y, 1, 1); }
  const M = GHOST.mask, Sil = GHOST.sil, ox = 8, oy = 4;   // work area: your sprite sits at (ox, oy) inside it
  M.g.clearRect(0, 0, 48, 56); Sil.g.clearRect(0, 0, 48, 56);
  M.g.globalCompositeOperation = 'source-over'; M.g.fillStyle = '#fff';
  if (ry != null) M.g.fillRect(0, Math.round(ry - cy - sy) + oy, 48, 56);
  for (const o of front) M.g.drawImage(o.spr, o.px - sx + ox, o.py - sy + oy);   // where something solid is drawn over you
  if (GHOST_MODE === 'outline') {   // a one pixel outline of you, only where something hides you
    const T = GHOST.tmp; T.g.clearRect(0, 0, 48, 56); T.g.globalCompositeOperation = 'source-over'; T.g.drawImage(spr, ox, oy); T.g.globalCompositeOperation = 'source-in'; T.g.fillStyle = '#fff'; T.g.fillRect(0, 0, 48, 56); T.g.globalCompositeOperation = 'source-over';
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) Sil.g.drawImage(T, dx, dy);
    Sil.g.globalCompositeOperation = 'destination-out'; Sil.g.drawImage(T, 0, 0);
    Sil.g.globalCompositeOperation = 'source-atop'; Sil.g.fillStyle = 'rgba(255,238,200,0.7)'; Sil.g.fillRect(0, 0, 48, 56);
  } else {
    Sil.g.drawImage(spr, ox, oy);
    Sil.g.globalCompositeOperation = 'destination-out'; Sil.g.drawImage(GHOST.checker, 0, 0); Sil.g.drawImage(GHOST.checker, 1, 0); Sil.g.drawImage(GHOST.checker, 0, 1);   // dither: only one pixel in four is kept
    Sil.g.globalCompositeOperation = 'source-atop'; Sil.g.fillStyle = 'rgba(190,225,255,0.12)'; Sil.g.fillRect(0, 0, 48, 56);
  }
  Sil.g.globalCompositeOperation = 'destination-in'; Sil.g.drawImage(M, 0, 0); Sil.g.globalCompositeOperation = 'source-over';
  g.save(); g.translate(snapDev(e.x - Math.round(e.x)), snapDev(e.y - Math.round(e.y))); g.globalAlpha = GHOST_MODE === 'outline' ? 0.55 : 0.55; g.drawImage(Sil, sx - ox, sy - oy); g.restore();
}
function drawMattock(e, cx, cy, now) {   // placeholder dig animation: the character stands in the idle pose and swings the mattock down into the spot
  const dv = DV[e.dir] || [0, 1], hx = e.x + dv[0] * 6, hy = e.y - 17 + (dv[1] < 0 ? -2 : 0), raised = [hx - dv[0] * 3, hy - 15];
  const cyc = (A.t * 2.4) % 1, u = cyc < 0.62 ? 1 - cyc / 0.62 : (cyc - 0.62) / 0.38, ease = cyc < 0.62 ? u : u * u;   // lift slowly, strike fast
  const tx = raised[0] + (A.x - raised[0]) * (1 - ease), ty = raised[1] + (A.y - 3 - raised[1]) * (1 - ease);
  const x0 = Math.round(hx - cx), y0 = Math.round(hy - cy), x1 = Math.round(tx - cx), y1 = Math.round(ty - cy), col = mattock().col;
  lineG(x0, y0, x1, y1, '#7a5230'); lineG(x0 + 1, y0, x1 + 1, y1, '#a8743a');
  g.fillStyle = col; g.fillRect(x1 - 3, y1 - 1, 7, 3); g.fillStyle = shade(col, 45); g.fillRect(x1 - 3, y1 - 1, 7, 1); g.fillStyle = shade(col, -50); g.fillRect(x1 - 3, y1 + 1, 7, 1);
}

// ---- UI: materials chip, collection, gear, camp --------------------------------------------------------------------------------------------------
const chipIcon = id => `<img src="${itemURL(id)}" alt="">`;
UI.matsHTML = () => ['nails', 'fabric', 'boot', 'scrap'].map(id => `<span class="mt" title="${ITEM[id].name}">${chipIcon(id)}<b>${S.mats[id] | 0}</b></span>`).join('');
function extrasOf(id) {   // spare copies of a common find: everything except your best one
  const list = S.arts.filter(a => a.id === id).sort((p, q) => q.pct - p.pct); return list.slice(1);
}
const scrapFor = a => 1 + (a.pct >= 60 ? 1 : 0);
const costHTML = cost => Object.keys(cost).map(id => `<span class="cst ${(S.mats[id] | 0) >= cost[id] ? 'ok' : 'no'}">${chipIcon(id)}${S.mats[id] | 0}/${cost[id]}</span>`).join('');

UI.openBook = function () {
  const total = ARTIFACTS.length, got = ARTIFACTS.filter(a => found(a.id)).length;
  const cards = ARTIFACTS.map(a => {
    const c = S.col[a.id], ok = c && c.n > 0;
    return `<div class="card ${ok ? '' : 'unk'}" style="--rc:${RAR[a.r].c}"><img src="${itemURL(a.id)}" alt=""><b>${ok ? esc(a.name) : '???'}</b><small>${ok ? RAR[a.r].n : 'Not found yet'}</small>`
      + (ok ? `<div class="pbar"><i style="width:${c.best}%;background:${pctCol(c.best)}"></i></div><small>Best ${c.best}% intact · found ${c.n}</small><p>${esc(a.desc)}</p>` : '') + '</div>';
  }).join('');
  const salv = SALVAGE.map(s => `<span class="mt big" title="${esc(s.desc)}">${chipIcon(s.id)}<b>${esc(s.name)}</b> ×${S.mats[s.id] | 0}</span>`).join('');
  UI.open('book', `${head('Collection')}<p class="note">${got} of ${total} artifacts found</p><div class="cards">${cards}</div><h3 class="sub">Salvage</h3><div class="mats">${salv}</div>`);
};
UI.openGear = function () {
  const m = mattock(), b = brush();
  const sites = SITES.slice(1).map((s, i) => `<div class="row"><div class="grow"><b>${esc(s.n)}</b><small>Tier ${s.tier}</small></div><span class="${siteOpen(i + 1) ? 'okt' : 'lockt'}">${siteOpen(i + 1) ? 'Open' : 'Needs ' + toolFor(i + 1)}</span></div>`).join('');
  UI.open('gear', `${head('Gear')}<div class="list"><div class="row"><img src="${itemURL('mattock' + S.gear.mattock)}" alt=""><div class="grow"><b>${esc(m.n)}</b><small>Tier ${m.tier} · dig speed ×${m.spd}</small></div></div>
    <div class="row"><img src="${itemURL('brush' + S.gear.brush)}" alt=""><div class="grow"><b>${esc(b.n)}</b><small>Finds are ${b.pres}% more intact</small></div></div></div>
    <h3 class="sub">Dig sites</h3><div class="list">${sites}</div><p class="note">Craft better tools at the camp tent.</p><div class="foot"><button class="btn small" data-act="snd">Sound: ${S.sound ? 'On' : 'Off'}</button><button class="btn small" data-act="testmenu">Test tools</button></div>`);
};
UI.openCamp = function (tab) { UI.open('camp', '<div id="campbox"></div>'); UI.cur = 'camp'; UI.renderCamp(tab || 'process'); sfx('pop'); };
UI.renderCamp = function (tab) {
  UI.ctab = tab = tab || UI.ctab || 'process'; const host = $('#campbox'); if (!host) return; let body = '';
  if (tab === 'process') {
    const rows = ARTIFACTS.filter(a => a.r === 0).map(a => {
      const ex = extrasOf(a.id), scrap = ex.reduce((s, x) => s + scrapFor(x), 0);
      return `<div class="row"><img src="${itemURL(a.id)}" alt=""><div class="grow"><b>${esc(a.name)}</b><small>${ex.length ? ex.length + ' spare → ' + scrap + ' scrap' : found(a.id) ? 'No spares (your best copy is kept)' : 'Not found yet'}</small></div>`
        + `<button class="btn small ${ex.length ? '' : 'dis'}" data-act="process:${a.id}">Process</button></div>`;
    }).join('');
    body = `<p class="note">Spare commons break down into scrap, which you need for tools. Your best copy of each artifact is always kept, and uncommon and rare finds are never processed.</p><div class="list">${rows}</div>`;
  } else {
    const rows = RECIPES.map(recipeRow).join('');
    body = `<p class="note">Using: ${esc(mattock().n)} · ${esc(brush().n)}. Recipes unlock when you first find the artifact named on them.</p><div class="list">${rows}</div>`;
  }
  host.innerHTML = `${head('Camp')}<div class="tabs">${[['process', 'Process'], ['craft', 'Craft']].map(t => `<button class="tab ${t[0] === tab ? 'on' : ''}" data-act="ctab:${t[0]}">${t[1]}</button>`).join('')}</div><div class="list2">${body}</div>`;
};
function recipeState(r) {   // 'done' | 'locked' | 'later' | 'ready' | 'short'
  const cur = r.kind === 'mattock' ? S.gear.mattock : S.gear.brush;
  if (cur >= r.to) return 'done'; if (cur < r.to - 1) return 'later';   // a recipe makes the tool right after the one you hold
  if (!found(r.unlock)) return 'locked';
  return Object.keys(r.cost).every(id => (S.mats[id] | 0) >= r.cost[id]) ? 'ready' : 'short';
}
function recipeRow(r) {
  const st = recipeState(r), icon = itemURL((r.kind === 'mattock' ? 'mattock' : 'brush') + r.to);
  let right;
  if (st === 'done') right = '<span class="okt">Owned</span>'; else if (st === 'later') right = '<span class="lockt">Craft the one before first</span>';
  else if (st === 'locked') right = `<span class="lockt">Find a ${esc(ITEM[r.unlock].name)} to unlock</span>`;
  else right = `<button class="btn small ${st === 'ready' ? '' : 'dis'}" data-act="craft:${r.id}">Craft</button>`;
  const cost = st === 'locked' || st === 'later' ? '' : `<div class="costs">${costHTML(r.cost)}</div>`;
  return `<div class="row ${st === 'locked' || st === 'later' ? 'dim' : ''}"><img src="${icon}" alt=""><div class="grow"><b>${esc(r.name)}</b><small>${esc(r.d)}</small>${cost}</div>${right}</div>`;
}
function craft(id) {
  const r = RECIPES.find(x => x.id === id); if (!r || recipeState(r) !== 'ready') { sfx('no'); return; }
  for (const k in r.cost) S.mats[k] -= r.cost[k];
  if (r.kind === 'mattock') S.gear.mattock = r.to; else S.gear.brush = r.to;
  sfx('level'); UI.toast(r.name + ' crafted!', 'gold');
  if (r.kind === 'mattock') { const z = SITES.findIndex((s, i) => i && s.tier === mattock().tier); if (z > 0) setTimeout(() => UI.note('New area unlocked', SITES[z].n), 600); }
  UI.refresh(); UI.renderCamp();
}
function processExtras(id) {
  const ex = extrasOf(id); if (!ex.length) { sfx('no'); return; }
  let scrap = 0; ex.forEach(x => { scrap += scrapFor(x); }); const keep = S.arts.filter(a => a.id === id).sort((p, q) => q.pct - p.pct)[0];
  S.arts = S.arts.filter(a => a.id !== id); S.arts.push(keep); S.mats.scrap = (S.mats.scrap | 0) + scrap;
  sfx('coin'); UI.toast(`Processed ${ex.length} spare ${ITEM[id].name}${ex.length > 1 ? 's' : ''} → ${scrap} scrap`, 'gold'); UI.refresh(); UI.renderCamp();
}
UI.openTest = function () {   // testing tools: start the dig-and-collect loop again from nothing
  UI.open('gear', `${head('Test tools')}<p class="note">For testing. Both buttons ask you to tap twice, because they can't be undone.</p>
    <div class="list"><div class="row"><div class="grow"><b>Reset progress</b><small>Clears the collection, materials, artifacts, tools, counts and every dug hole. Keeps your name and look.</small></div><button class="btn small" data-act="testreset" id="tr1">Reset</button></div>
    <div class="row"><div class="grow"><b>Erase everything</b><small>Deletes the whole save, character included, and reloads so you start at the character creator.</small></div><button class="btn small lock" data-act="testwipe" id="tr2">Erase</button></div></div>`);
};
UI.testConfirm = function (id, label, fn) {   // first tap arms the button, a second tap within a few seconds does it
  const b = document.getElementById(id); if (!b) return; if (b.dataset.armed) { fn(); return; }
  b.dataset.armed = '1'; b.textContent = 'Tap again to confirm'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = label; } }, 3500);
};
UI.onClick2 = function (a, p1) {
  switch (a) {
    case 'testmenu': UI.openTest(); break;
    case 'testreset': UI.testConfirm('tr1', 'Reset', () => {
      S.col = {}; S.arts = []; S.mats = { nails: 0, boot: 0, fabric: 0, scrap: 0 }; S.gear = { mattock: 0, brush: 0 }; S.stats = { digs: 0, dry: 0 }; HOLES.length = 0; ME.hold = null; A = null; saveState(); UI.refresh(); UI.close(); UI.toast('Progress reset', 'info');
    }); break;
    case 'testwipe': UI.testConfirm('tr2', 'Erase', () => { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('littledig.proto.v1'); } catch (e) { } S = defaultState(); location.reload(); }); break;
    case 'ctab': UI.renderCamp(p1); break;
    case 'process': processExtras(p1); break;
    case 'craft': craft(p1); break;
  }
};

// ---- the "You" button: a little portrait of your character in your colours (assets/ui/portrait.png: body, shadow and hair, with and without hair) ----
const PORT = { px: null };
function portraitIcon() {
  const im = ASSET.img.portrait; if (!im) return null;
  if (!PORT.px) { const t = mk(im.width, im.height); t.g.drawImage(im, 0, 0); PORT.px = t.g.getImageData(0, 0, im.width, im.height).data; PORT.w = im.width; }
  const look = HERO.tint, hair = look.hairStyle !== 'none', row = hair ? 0 : 1, P = PORT.px, c = mk(16, 16), id = c.g.createImageData(16, 16), o = id.data;
  const at = (col, x, y) => ((row * 16 + y) * PORT.w + col * 16 + x) * 4, put = (k, r, g2, b, a) => { o[k] = r; o[k + 1] = g2; o[k + 2] = b; o[k + 3] = a; };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = at(1, x, y); if (P[i + 3]) put((y * 16 + x) * 4, P[i], P[i + 1], P[i + 2], 105); }   // the drop shadow, see-through
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = at(0, x, y); if (!P[i + 3]) continue; const r = lookPix(P[i], P[i + 1], P[i + 2], y, look, 16); put((y * 16 + x) * 4, r[0], r[1], r[2], 255); }
  if (hair) {
    const t = look.hair ? [1, 3, 5].map(i => parseInt(look.hair.slice(i, i + 2), 16)) : null, ml = heroLum([136, 96, 75]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = at(2, x, y); if (!P[i + 3]) continue; const f = heroLum([P[i], P[i + 1], P[i + 2]]) / ml; put((y * 16 + x) * 4, ...(t ? [0, 1, 2].map(q => clamp(Math.round(t[q] * f), 0, 255)) : [P[i], P[i + 1], P[i + 2]]), 255); }
  }
  c.g.putImageData(id, 0, 0); return c;
}
UI.refreshPortrait = function () { const im = document.querySelector('.mbtn[data-act="open:me"] img'), c = HERO.base && portraitIcon(); if (im && c) im.src = c.toDataURL(); };
