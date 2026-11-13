'use strict';
const cv = $('#game'), g = cv.getContext('2d');
let VW = 390, VH = 800, Z = 2, DPR = 1;
const cam = { x: 0, y: 0 };
const DV = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const qs = new URLSearchParams(location.search);
let AREA = 'island', fading = false;
let ME = null, NPCS = [], A = null, held = false, target = null, autoWalk = null, tOff = 0, timeNow = 0;
const PT = [], FL = [], RP = [];
if (qs.has('hour')) { const d = new Date(); tOff = parseFloat(qs.get('hour')) - (d.getHours() + d.getMinutes() / 60); }

// ---- time, weather --------------------------------------------------------
function hourNow() { const d = new Date(); return (((d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 + tOff) % 24) + 24) % 24; }
const isNight = () => { const h = hourNow(); return h >= 19.5 || h < 5.5; };
function isRain() { if (qs.has('rain')) return qs.get('rain') === '1'; return hash2(Math.floor(Date.now() / 1200000), 77) < 0.2; }
const TINT = [[0, [52, 62, 124]], [5, [62, 72, 134]], [6.5, [250, 190, 150]], [8.5, [255, 248, 236]], [16.5, [255, 241, 218]], [18, [255, 205, 150]], [19.5, [204, 132, 142]], [21, [92, 92, 152]], [24, [52, 62, 124]]];
function tintAt(h) {
  for (let i = 1; i < TINT.length; i++) if (h <= TINT[i][0]) { const a = TINT[i - 1], b = TINT[i], k = (h - a[0]) / (b[0] - a[0]); return a[1].map((v, j) => Math.round(v + (b[1][j] - v) * k)); }
  return TINT[0][1];
}

// ---- audio ----------------------------------------------------------------
let AC = null;
function audioInit() { if (AC || !S.sound) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } if (AC && AC.state === 'suspended') AC.resume(); }
function tone(f, d, type, v, t0, f2) {
  const o = AC.createOscillator(), gn = AC.createGain(), t = AC.currentTime + (t0 || 0); o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); gn.gain.setValueAtTime(v || 0.04, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(gn); gn.connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
}
['pointerdown', 'keydown', 'touchstart', 'click'].forEach(ev => addEventListener(ev, () => { audioInit(); if (AC && AC.state !== 'running') AC.resume(); }, true));   // browsers only allow sound after a tap or key press: any of them switches it on, and brings it back if the browser paused it
const SFX = {
  ui: [[660, .05]], cast: [[500, .12, 'triangle', .05, 0, 200]], splash: [[300, .15, 'sawtooth', .02, 0, 120]], bite: [[880, .08], [1100, .1, 'square', .05, .09]],
  hook: [[500, .08], [700, .08, 'square', .04, .07]], catch: [[523, .09], [659, .09, 'square', .04, .09], [784, .14, 'square', .04, .18]],
  rare: [[523, .1], [659, .1, 'square', .04, .1], [784, .1, 'square', .04, .2], [1047, .25, 'square', .05, .3]], coin: [[988, .07], [1319, .18, 'square', .04, .07]],
  pop: [[420, .09, 'triangle', .05, 0, 760]], no: [[200, .15, 'square', .04, 0, 140]], level: [[392, .1], [523, .1, 'square', .04, .1], [659, .1, 'square', .04, .2], [784, .28, 'square', .05, .3]],
  dig: [[160, .07, 'square', .04, 0, 90]], shake: [[240, .06, 'triangle', .04, 0, 200]]
};
// A small footstep synth in the spirit of fishtheweb's: soft pink noise through a band-pass that sweeps downward, a gentle attack, short bursts and a touch of room reverb.
let MIX = null, REV = null, PINK = null;
function mixInit() {
  if (MIX && MIX.context === AC) return; MIX = AC.createGain(); MIX.gain.value = 0.8; MIX.connect(AC.destination);
  const len = Math.floor(AC.sampleRate * 0.7), ir = AC.createBuffer(2, len, AC.sampleRate); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  REV = AC.createConvolver(); REV.buffer = ir; const rg = AC.createGain(); rg.gain.value = 0.6; REV.connect(rg); rg.connect(MIX);
  const n = AC.sampleRate * 2, pb = AC.createBuffer(1, n, AC.sampleRate), d = pb.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;   // pink noise (Paul Kellet's filter)
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
  PINK = pb;
}
function out(g, wet) { g.connect(MIX); if (wet) { const w = AC.createGain(); w.gain.value = wet; g.connect(w); w.connect(REV); } }
function nz(t0, o) {   // a burst of noise: colour, band-pass (or low-pass) sweeping f to fTo, attack a, length dur, gain, reverb send wet
  mixInit(); const t = AC.currentTime + (t0 || 0), dur = o.dur, src = AC.createBufferSource(), fl = AC.createBiquadFilter(), gn = AC.createGain();
  if (o.color === 'pink') { src.buffer = PINK; } else { const n = Math.ceil(AC.sampleRate * (dur + 0.05)), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; src.buffer = b; }
  fl.type = o.filter; fl.frequency.setValueAtTime(o.f, t); if (o.fTo) fl.frequency.exponentialRampToValueAtTime(o.fTo, t + dur); fl.Q.value = o.q || 0.7;
  gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(o.gain, t + (o.a || 0.01)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); src.connect(fl); fl.connect(gn); out(gn, o.wet);
  src.start(t, o.color === 'pink' ? Math.random() * 1.5 : 0, dur + 0.05);
}
function tn(t0, o) {   // a soft tone with a pitch glide and optional upper partials
  mixInit(); const t = AC.currentTime + (t0 || 0);
  for (const pt of [{ ratio: 1, gain: 1, d: o.d }].concat(o.partials || [])) {
    const os = AC.createOscillator(), gn = AC.createGain(), lp = AC.createBiquadFilter(); os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.freq * pt.ratio, t); if (o.to) os.frequency.exponentialRampToValueAtTime(o.to * pt.ratio, t + (o.glide || pt.d));
    lp.type = 'lowpass'; lp.frequency.value = o.lp || 4000; gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(o.gain * pt.gain, t + (o.a || 0.005)); gn.gain.exponentialRampToValueAtTime(0.0001, t + pt.d); os.connect(lp); lp.connect(gn); out(gn, o.wet); os.start(t); os.stop(t + pt.d + 0.02);
  }
}
const rj = a => 1 + (Math.random() * 2 - 1) * a;   // random wobble so no two steps are the same
const STEPS = {
  grass: () => { const j = rj(0.08); nz(0, { color: 'pink', filter: 'bandpass', f: 2400 * j, fTo: 1300 * j, q: 0.8, a: 0.015, dur: 0.07 + Math.random() * 0.015, gain: 0.34 * rj(0.15), wet: 0.03 }); },
  sand: () => { const j = rj(0.08), v = rj(0.15); nz(0, { color: 'white', filter: 'bandpass', f: 4200 * j, q: 1.2, a: 0.003, dur: 0.03, gain: 0.13 * v, wet: 0.02 }); nz(0.02, { color: 'white', filter: 'bandpass', f: 2800 * j, fTo: 1900 * j, q: 0.8, a: 0.01, dur: 0.05 + Math.random() * 0.015, gain: 0.1 * v, wet: 0.02 }); },
  dirt: () => { const j = rj(0.08), v = rj(0.15); nz(0, { color: 'pink', filter: 'lowpass', f: 650 * j, fTo: 320 * j, a: 0.004, dur: 0.055 + Math.random() * 0.015, gain: 0.3 * v, wet: 0.03 }); nz(0, { color: 'white', filter: 'bandpass', f: 2000 * j, q: 1.2, a: 0.002, dur: 0.02, gain: 0.04 * v, wet: 0.02 }); },
  wood: () => { const j = rj(0.05), v = rj(0.15); tn(0, { freq: 215 * j, to: 190 * j, glide: 0.06, a: 0.002, d: 0.085, lp: 1600, gain: 0.08 * v, partials: [{ ratio: 2.4, gain: 0.45, d: 0.04 }, { ratio: 4.1, gain: 0.2, d: 0.02 }], wet: 0.08 }); nz(0, { color: 'white', filter: 'bandpass', f: 1300 * j, q: 1.4, a: 0.001, dur: 0.025, gain: 0.1 * v, wet: 0.04 }); }
};
STEPS.stone = STEPS.dirt;
function footstep() {
  if (!S.sound || !AC) return; const x = ME.x, y = ME.y - 2; let k = 'grass';
  if (DECK[Math.floor(y / TS) * MW + Math.floor(x / TS)]) k = 'wood'; else if (siteAt(x, y) || pitZ(x, y) > 0.05) k = 'dirt'; else { const t = typeAt(x, y); k = t === 2 ? 'sand' : t === 4 ? 'dirt' : t === 5 ? 'stone' : 'grass'; }
  try { STEPS[k](); } catch (e) { }
}
const NSFX = { rustle: () => {   // walking onto a bush: three soft pink-noise rustles that sweep down, with a gentle low whump
  for (let i = 0; i < 3; i++) { const j = rj(0.1); nz(i * 0.06, { color: 'pink', filter: 'bandpass', f: 2200 * j, fTo: 1000 * j, q: 0.7, a: 0.02, dur: 0.12 + Math.random() * 0.04, gain: 0.22 * rj(0.2), wet: 0.06 }); }
  tn(0, { freq: 130, to: 75, glide: 0.09, a: 0.006, d: 0.13, lp: 400, gain: 0.07, wet: 0.05 });
} };
function sfx(n) { if (!S.sound || !AC) return; if (NSFX[n]) { try { NSFX[n](); } catch (e) { } return; } const s = SFX[n]; if (!s) return; try { s.forEach(a => tone(a[0], a[1], a[2], a[3], a[4], a[5])); } catch (e) { } }
const vib = ms => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) { } };

// ---- canvas ---------------------------------------------------------------
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 3); const w = innerWidth, h = innerHeight;
  cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
  Z = Math.max(2, Math.round(Math.min(w, h * 0.62) / 190)); VW = w / Z; VH = h / Z;
}

// ---- input ----------------------------------------------------------------
const joy = { id: null, sx: 0, sy: 0, moved: false, t0: 0, vx: 0, vy: 0, mag: 0 };
const keys = {};
const inp = $('#inp'), joyEl = $('#joy'), knob = $('#knob');
inp.addEventListener('pointerdown', e => {
  if (EDIT || joy.id !== null || UI.isOpen) return; audioInit();
  joy.id = e.pointerId; joy.sx = e.clientX; joy.sy = e.clientY; joy.moved = false; joy.t0 = performance.now(); joy.vx = joy.vy = joy.mag = 0;
  try { inp.setPointerCapture(e.pointerId); } catch (_) { }
});
inp.addEventListener('pointermove', e => {
  if (EDIT || e.pointerId !== joy.id) return; const dx = e.clientX - joy.sx, dy = e.clientY - joy.sy, d = Math.hypot(dx, dy), R = 46;
  if (d > 12 && !joy.moved) { joy.moved = true; joyEl.style.left = joy.sx + 'px'; joyEl.style.top = joy.sy + 'px'; joyEl.classList.add('on'); }
  if (joy.moved) { joy.vx = dx / (d || 1); joy.vy = dy / (d || 1); joy.mag = d < 8 ? 0 : Math.min(1, (d - 6) / (R - 6)); const k = Math.min(d, R); knob.style.transform = `translate(${joy.vx * k}px,${joy.vy * k}px)`; }
});
function joyEnd(e) {
  if (EDIT || e.pointerId !== joy.id) return;
  joy.id = null; joy.mag = 0; joyEl.classList.remove('on'); knob.style.transform = '';
}
inp.addEventListener('pointerup', joyEnd); inp.addEventListener('pointercancel', joyEnd);
document.addEventListener('contextmenu', e => e.preventDefault());
const actEl = $('#act');
function actDown() { if (held) return; held = true; audioInit(); if (UI.isOpen) return; if (A) A.pressed = true; else startAction(); }
function actUp() { held = false; }
actEl.addEventListener('pointerdown', e => { e.preventDefault(); actDown(); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => actEl.addEventListener(ev, actUp));
addEventListener('keydown', e => {
  if (EDIT || (e.target && e.target.tagName === 'INPUT')) return; keys[e.code] = true;
  if (['Space', 'KeyE', 'Enter'].includes(e.code)) { e.preventDefault(); if (!e.repeat) actDown(); }
});
addEventListener('keyup', e => { keys[e.code] = false; if (['Space', 'KeyE', 'Enter'].includes(e.code)) actUp(); });
function inputVec() {
  if (joy.mag > 0) return [joy.vx * joy.mag, joy.vy * joy.mag];
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1; if (keys.KeyW || keys.ArrowUp) y -= 1; if (keys.KeyS || keys.ArrowDown) y += 1;
  const l = Math.hypot(x, y); return l ? [x / l, y / l] : [0, 0];
}

// ---- helpers --------------------------------------------------------------
function dirOf(dx, dy) { return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u'); }
function stepToward(e, tx, ty, sp, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy); if (d < 1) return false;
  const s = Math.min(d, sp * dt); e.dir = dirOf(dx, dy); e.face = faceOf(dx, dy); e.faceDir = e.dir; return moveEnt(e, dx / d * s, dy / d * s);
}
function burst(x, y, col, n, sp, life, grav, sz) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = rnd(0.3, 1) * sp; PT.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.4, g: grav == null ? 60 : grav, life: rnd(0.5, 1) * life, max: life, col, sz: sz || 1 }); }
}
function floater(x, y, txt, col) { FL.push({ x, y, txt, col: col || '#fff', t: 0 }); }
function ripple(x, y, big) { RP.push({ x, y, t: 0, max: big ? 1.1 : 0.9, big }); }
function doEmote(e) {
  ME.bubble = e; ME.bt = 2.6; sfx('pop'); if (e === '👋' && !A) ME.wave = { t: 0 };
  NPCS.forEach(n => { if (Math.hypot(n.x - ME.x, n.y - ME.y) < 90 && Math.random() < 0.4) setTimeout(() => { n.bubble = pick(['👋', '❤️', '😄', '✨']); n.bt = 2.4; }, rnd(700, 1600)); });
}

const walkSp = () => 58;

// ---- player ---------------------------------------------------------------
function updateMe(dt) {
  const v = inputVec(), mag = Math.hypot(v[0], v[1]);
  ME.moving = false;
  if (ME.wave) { ME.wave.t += dt; if (ME.wave.t > 1.3 || mag > 0.3) ME.wave = null; }
  if (ME.hold) { const h = ME.hold; h.t += dt; if (h.t > h.dur || (h.t > 0.6 && mag > 0.3)) ME.hold = null; else if (h.t < 0.6) return; }
  if (UI.isOpen) return;
  if (A) { if (mag > 0.4) endAct(); else return; }   // digging: you stand still; pushing the stick stops it
  if (mag > 0.05) {
    autoWalk = null; const sp = walkSp() * Math.min(1, mag);
    const nd = dirOf(v[0], v[1]); if (nd !== ME.dir && Math.abs(Math.abs(v[0]) - Math.abs(v[1])) > 0.25 || !DV[ME.dir]) ME.dir = nd; else if (Math.abs(Math.abs(v[0]) - Math.abs(v[1])) <= 0.25) { /* keep */ } else ME.dir = nd;
    ME.face = faceOf(v[0], v[1]); ME.faceDir = ME.dir; ME.moving = moveEnt(ME, v[0] * sp * dt, v[1] * sp * dt); ME.t += dt * Math.max(0.25, Math.min(1, mag)); { const sn = Math.floor(ME.t * WALK_FPS / 2); if (ME.moving && sn !== ME.lastStep) { ME.lastStep = sn; footstep(); } }   // the walk animation runs at the pace you move

  }
}

// ---- update ---------------------------------------------------------------
function tick(dt) {
  timeNow = performance.now() / 1000;
  const night = isNight(); updateMe(dt);
  target = findTarget(); updateAct(dt); if (A) target = null;
  if (ME.bt > 0) { ME.bt -= dt; if (ME.bt <= 0) ME.bubble = null; }
  const st = actState();
  if (st) { UI.setAct(st.icon, st.prog, st.alert); UI.setHint(st.hint); }
  else if (target) { const ti = targetInfo(target); UI.setAct(ti.icon, 0, false); UI.setHint(ti.hint); }
  else { UI.setAct(null, 0, false); UI.setHint(''); }
  tickHoles(dt); tickTrees(dt);
  for (let i = PT.length - 1; i >= 0; i--) { const p = PT[i]; p.life -= dt; if (p.life <= 0) { PT.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  for (let i = FL.length - 1; i >= 0; i--) { FL[i].t += dt; if (FL[i].t > 1.3) FL.splice(i, 1); }
  for (let i = RP.length - 1; i >= 0; i--) { RP[i].t += dt; if (RP[i].t > RP[i].max) RP.splice(i, 1); }
  // the camera eases toward the player instead of being locked to them (snaps on teleports / first frame)
  const ctx_ = clamp(ME.x - VW / 2, 0, Math.max(0, PW - VW)), cty_ = clamp(ME.y + pitZ(ME.x, ME.y) * PIT_U - VH / 2 - 10, 0, Math.max(0, PH - VH));
  if (Math.hypot(ctx_ - cam.x, cty_ - cam.y) > 120) { cam.x = ctx_; cam.y = cty_; }
  else { const k = 1 - Math.exp(-dt * 3.5); cam.x += (ctx_ - cam.x) * k; cam.y += (cty_ - cam.y) * k; if (Math.abs(ctx_ - cam.x) < 0.02) cam.x = ctx_; if (Math.abs(cty_ - cam.y) < 0.02) cam.y = cty_; }
}

// ---- render ---------------------------------------------------------------
function lineG(x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); g.fillStyle = col;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy, n = 0;
  for (; n++ < 200;) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
const WALK_FPS = 6;   // walk frames per second (the walk is 4 frames per direction)
const heroFrameOf = e => e.moving ? 1 + Math.floor(e.t * WALK_FPS) % 4 : 0;   // 0 = idle, 1-4 = walk cycle
function drawChar(e, cx, cy, now) {
  const digging = e === ME && A && A.k === 'dig', holding = e === ME && ME.hold;
  const bob = digging ? -Math.round(Math.max(0, Math.sin(A.t * 15))) : e === ME && ME.wave ? -(Math.floor(ME.wave.t * 8) % 2) : 0;
  const spr = heroSprite(faceIdx(e), digging || holding ? 0 : heroFrameOf(e), e === ME ? null : e.look);
  g.drawImage(shadowSpr(14, 5), Math.round(e.x - 7 - cx), Math.round(e.y - 3 - cy));
  const anim = e === ME ? (digging ? digAnim(A.dir) : holding && ME.hold.pose && digAnim(ME.hold.pose.dir)) : null;   // the hand-drawn dig animation (all four directions) replaces the placeholder
  if (anim) {
    const dd = digging ? A.dir : ME.hold.pose.dir, fi = digging ? digFrameE(A) : DIGE.reward[3];
    g.drawImage(digSprite(dd, fi), Math.round(e.x - anim.ax - cx), Math.round(e.y - anim.ay - cy));
    if (digging && A.ph === 'brush' && A.res) { const ob = digObjAt(dd, fi), ic = itemIcon(A.res.id), ox = Math.round(e.x - anim.ax - cx), oy = Math.round(e.y - anim.ay - cy); if (ob) { g.drawImage(ic, Math.round(ox + ob.x - ic.width / 2), Math.round(oy + ob.y - ic.height / 2)); g.drawImage(digBlob(dd, fi, A.bt / A.bdur), ox, oy); } }   // the find sits under the dirt blob, which is brushed away pixel by pixel
  } else g.drawImage(spr, Math.round(e.x - spr.ax - cx), Math.round(e.y - spr.ay - cy + bob));
  if (digging && !anim) drawMattock(e, cx, cy, now);
  if (holding) drawHoldIcon(e, cx, cy, now);
}
const snapDev = v => Math.round(v * DPR * Z) / (DPR * Z); // snap a fractional native-pixel offset to whole device pixels
function drawEnt(o, cx, cy, now) {
  switch (o.k) {
    case 'leaf': drawLeaf(o.l, cx, cy); return;
    case 'me': case 'npc': {
      const z = pitZ(o.x, o.y), zo = Math.round(z * PIT_U); g.save();
      if (z > 0.01) { const ry = rimY(o.x, o.y); if (ry != null) { g.beginPath(); g.rect(o.x - cx - 40, -1000, 80, ry - cy + 1000); g.clip(); } }   // in a pit, the rim in front hides your feet
      if (o === ME) g.translate(snapDev(o.x - Math.round(o.x)), snapDev(o.y - Math.round(o.y)));
      g.translate(0, zo); drawChar(o, cx, cy, now); g.restore(); break;
    }
    default: {
      const spr = o.spr; if (!spr) return;
      if (o.k === 'tree') { g.globalAlpha = 0.3; g.drawImage(o.shadow, Math.round(o.x - o.shadow.ax - cx + (o.sx || 0)), Math.round(o.y - o.shadow.ay - cy)); g.globalAlpha = 1; }   // the crown's shadow on the ground
      const fa = o.k === 'tree' ? 1 : behindAlpha(o); if (fa < 1) g.globalAlpha = fa;
      if (o.ang) { const q = Math.round(o.ang / 1.5708) & 3, w = spr.width, h = spr.height; g.save(); g.translate(Math.round(o.x - cx), Math.round(o.y - cy) - h / 2); g.rotate(q * Math.PI / 2); g.drawImage(spr, -w / 2, -h / 2); g.restore(); } else if (Math.abs(o.lean) > 0.04) { const px = Math.round(o.x - spr.ax - cx), py = Math.round(o.y - spr.ay - cy), H = spr.height; for (let r = 0; r < H; r += 2) g.drawImage(spr, 0, r, spr.width, Math.min(2, H - r), px + Math.round(o.lean * Math.pow(1 - (r + 1) / H, 1.5) * 3), py + r, spr.width, Math.min(2, H - r)); } else if (o.sq > 0.02) { const sw = Math.round(spr.width * (1 + 0.14 * o.sq)), sh = Math.round(spr.height * (1 - 0.32 * o.sq)); g.drawImage(spr, Math.round(o.x - cx - spr.ax * sw / spr.width), Math.round(o.y - cy - spr.ay * sh / spr.height), sw, sh); } else g.drawImage(spr, Math.round(o.x - spr.ax - cx), Math.round(o.y - spr.ay - cy)); g.globalAlpha = 1;
    }
  }
}
function render(now) {
  const cx = Math.round(cam.x), cy = Math.round(cam.y), K = DPR * Z;
  // the world is drawn on whole native pixels, then the whole scene is slid by the camera's fractional part (in device pixels): the camera glides instead of stepping
  g.setTransform(K, 0, 0, K, Math.round((cx - cam.x) * K), Math.round((cy - cam.y) * K)); g.imageSmoothingEnabled = false;
  g.fillStyle = '#2c5a86'; g.fillRect(-2, -2, VW + 4, VH + 4); g.drawImage(W.terrain, -cx, -cy);
  if (fxOn()) fxWater(cx, cy, now);
  drawLockedShade(cx, cy); drawHoles(cx, cy);
  const sb = Math.floor(now * 2);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 70; i++) { const x = cx + hash2(i, sb, 31) * VW, y = cy + hash2(i, sb, 32) * VH; if (hash2(i, sb, 33) < 0.55 && isWater(x, y)) g.fillRect(Math.round(x - cx), Math.round(y - cy), 2, 1); }
  for (const r of RP) {
    const u = r.t / r.max, rx = 2 + u * (r.big ? 10 : 7), ry = rx * 0.5; g.fillStyle = `rgba(235,248,252,${(1 - u) * 0.8})`;
    for (let i = 0; i < 16; i++) { const a = i * 0.3927; g.fillRect(Math.round(r.x + Math.cos(a) * rx - cx), Math.round(r.y + Math.sin(a) * ry - cy), 1, 1); }
  }
  const L = [];
  for (const o of W.objs) if (o.x > cx - 70 && o.x < cx + VW + 70 && o.y > cy - 10 && o.y < cy + VH + 90) L.push(o);
  for (const l of LEAVES) if (l.x > cx - 10 && l.x < cx + VW + 10 && l.y > cy - 10 && l.y < cy + VH + 10) L.push({ k: 'leaf', x: l.x, y: l.gy, l });   // leaves sort with everything else by where they will land, so they pass behind you or in front like anything on the ground
  L.push(ME); for (const n of NPCS) if (n.x > cx - 30 && n.x < cx + VW + 30 && n.y > cy - 10 && n.y < cy + VH + 60) L.push(n);
  L.sort((a, b) => a.y - b.y); for (const o of L) drawEnt(o, cx, cy, now); drawCrowns(cx, cy, now); drawGhost(L, cx, cy);
  drawMarker(cx, cy, now);
  for (const p of PT) { g.globalAlpha = clamp(p.life / (p.max * 0.5), 0, 1); g.fillStyle = p.col; g.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.sz, p.sz); } g.globalAlpha = 1;
  if (FEATURES.fx) {   // lighting and atmosphere (off for now, see FEATURES in data.js)
  // light
  const cave = W.theme === 'cave', h = hourNow(), tc = cave ? [84, 94, 138] : tintAt(h), rain = !cave && isRain();
  g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${tc[0]},${tc[1]},${tc[2]})`; g.fillRect(-2, -2, VW + 4, VH + 4);
  if (rain) { g.fillStyle = 'rgb(196,206,222)'; g.fillRect(-2, -2, VW + 4, VH + 4); }
  g.globalCompositeOperation = 'source-over';
  const fdt = Math.min(0.1, now - (FX.t || now)); FX.t = now;
  if (fxOn() && !cave) { fxClouds(cx, cy, now, clamp(((tc[0] + tc[1] + tc[2]) / 3 - 110) / 140, 0, 1) * (rain ? 0.4 : 1)); }
  const dark = clamp((255 - (tc[0] + tc[1] + tc[2]) / 3) / 100, 0, 1) + (rain ? 0.15 : 0);
  if (dark > 0.15) {
    g.globalCompositeOperation = 'lighter';
    for (const f of W.fires) { const x = f.x - cx, y = f.y - 8 - cy; if (x < -90 || x > VW + 90 || y < -90 || y > VH + 90) continue; const fl = 0.85 + Math.sin(now * 13 + f.x) * 0.1, rg = g.createRadialGradient(x, y, 2, x, y, 72); rg.addColorStop(0, `rgba(255,170,80,${0.6 * Math.min(1, dark) * fl})`); rg.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = rg; g.fillRect(x - 74, y - 74, 148, 148); }
    for (const gl of W.glows) { const x = gl.x - cx, y = gl.y - 8 - cy; if (x < -60 || x > VW + 60 || y < -60 || y > VH + 60) continue; const pulse = 0.75 + Math.sin(now * 2 + gl.x * 0.1) * 0.2, rg = g.createRadialGradient(x, y, 1, x, y, 40); rg.addColorStop(0, `rgba(${gl.gc},${0.5 * pulse})`); rg.addColorStop(1, `rgba(${gl.gc},0)`); g.fillStyle = rg; g.fillRect(x - 42, y - 42, 84, 84); }
    for (const l of W.lamps) { const x = l.x - cx, y = l.y - 22 - cy; if (x < -60 || x > VW + 60 || y < -60 || y > VH + 60) continue; const rg = g.createRadialGradient(x, y, 2, x, y, 46); rg.addColorStop(0, `rgba(255,190,100,${0.5 * Math.min(1, dark)})`); rg.addColorStop(1, 'rgba(255,190,100,0)'); g.fillStyle = rg; g.fillRect(x - 48, y - 48, 96, 96); }
    g.globalCompositeOperation = 'source-over';
  }
  if (rain) { g.fillStyle = 'rgba(190,215,240,0.55)'; for (let i = 0; i < 90; i++) { const sp = 150 + hash2(i, 3, 5) * 70, x = (hash2(i, 1, 5) * (VW + 40) + now * 30) % (VW + 40) - 20, y = (hash2(i, 2, 5) * VH + now * sp) % VH; g.fillRect(Math.round(x), Math.round(y), 1, 4); } }
  if (fxOn()) fxVignette();
  }
  // text layer
  g.textAlign = 'center'; g.font = '6px "Pixelify Sans", monospace'; g.lineJoin = 'round';
  drawHoldText(cx, cy);
  for (const o of L) if (o.k === 'me' || o.k === 'npc') {
    if (o === ME && ME.hold) continue;
    if (o === ME) { g.save(); g.translate(snapDev(o.x - Math.round(o.x)), snapDev(o.y - Math.round(o.y)) + Math.round(pitZ(o.x, o.y) * PIT_U)); }
    const nm = o === ME ? S.name : o.name, x = Math.round(o.x - cx), y = Math.round(o.y - 46 - cy);
    g.lineWidth = 2.2; g.strokeStyle = 'rgba(20,16,24,0.85)'; g.strokeText(nm, x, y); g.fillStyle = o === ME ? '#ffd877' : '#f5e9cf'; g.fillText(nm, x, y);
    if (o.bubble) { const bw = Math.max(14, g.measureText(o.bubble).width + 8), by = y - 14; g.fillStyle = '#f5e9cf'; g.fillRect(Math.round(x - bw / 2), by, Math.round(bw), 11); g.fillStyle = '#2a1c1c'; g.fillRect(Math.round(x - bw / 2), by + 11, Math.round(bw), 1); g.fillRect(x - 1, by + 12, 2, 2); g.fillStyle = '#f5e9cf'; g.fillRect(x - 1, by + 11, 2, 2); g.fillStyle = '#2a1c1c'; g.fillText(o.bubble, x, by + 8); }
    if (o === ME) g.restore();
  }

  g.font = 'bold 7px "Pixelify Sans", monospace';
  for (const f of FL) { const u = f.t / 1.3; g.globalAlpha = 1 - u * u; g.lineWidth = 2.4; g.strokeStyle = 'rgba(20,16,24,0.9)'; g.strokeText(f.txt, Math.round(f.x - cx), Math.round(f.y - cy - u * 14)); g.fillStyle = f.col; g.fillText(f.txt, Math.round(f.x - cx), Math.round(f.y - cy - u * 14)); } g.globalAlpha = 1;
  g.textAlign = 'left';
}

// ---- boot ------------------------------------------------------------------
let last = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
  try { tick(dt); render(ts / 1000); } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
const areaDraftKey = a => a === 'island' ? MAP_DRAFT_KEY : MAP_DRAFT_KEY + '.' + a;
const defaultFor = a => a === 'cave' ? generateDefaultCave() : generateDefaultMap();
function goArea(to, sx, sy) { // fade out, load the other map, drop the player at its target spot
  if (fading) return; fading = true; const f = $('#fade'); f.classList.add('on'); sfx('pop');
  setTimeout(() => {
    const done = map => {
      AREA = to; initWorld(map, false); ME.x = sx || W.spawn.x; ME.y = sy || W.spawn.y; ME.dir = 'd'; autoWalk = null; A = null; ME.hold = null;
      FX.leaves = [];
      setTimeout(() => { f.classList.remove('on'); fading = false; }, 140);
    };
    fetch('maps/' + to + '.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(m => done(validMap(m) ? m : defaultFor(to))).catch(() => done(defaultFor(to)));
  }, 330);
}
function loadMapData(cb) {
  AREA = qs.get('area') || 'island';
  const ok = m => validMap(m) ? m : null;
  let draft = null; try { if (qs.get('map') === 'draft' || EDIT) draft = ok(JSON.parse(localStorage.getItem(areaDraftKey(AREA)))); } catch (e) { }
  if (draft) return cb(draft, 'draft');
  fetch('maps/' + AREA + '.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(m => ok(m) ? cb(m, 'file') : cb(defaultFor(AREA), 'default')).catch(() => cb(defaultFor(AREA), 'default'));
}
function boot() {
  loadState(); resize(); addEventListener('resize', resize);
  loadAssets(failed => {
  if (failed.length) console.error('Missing assets:', failed.join(', '));
  buildSprites(); if (ASSET.ok) heroInit(); buildClouds(); if (!EDIT) UI.init();
  setTimeout(() => prepareAtlas(() => loadMapData((map, src) => {
    initWorld(map, EDIT);
    if (EDIT) { startEditor(src); return; }
    ME = { k: 'me', x: W.spawn.x, y: W.spawn.y, dir: 'd', t: 0, moving: false, bubble: null, bt: 0 };
    $('#loading').classList.add('hidden'); requestAnimationFrame(loop);
    if (!S.created) setTimeout(() => UI.openMe(true), 600);
    if (src === 'draft') UI.toast('Playing your draft map', 'info');
    window.__game = { get ME() { return ME; }, get A() { return A; }, S, W, NPCS, get target() { return target; } };
  })), 40);
  });
}
boot();
