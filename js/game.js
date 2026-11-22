'use strict';
const cv = $('#game'); let g = cv.getContext('2d'); const G0 = g;   // g is swapped for the entity layer while the world's things are drawn (see light.js)
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
['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mouseup', 'keydown', 'keyup', 'click'].forEach(ev => addEventListener(ev, () => { audioInit(); if (AC && AC.state !== 'running') AC.resume(); }, true));   // browsers only allow sound after a real tap, click or key press (a touch that only starts, or a stick drag, doesn't count until the finger lifts), so every kind of press and release tries to switch it on or wake it
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
  if (MIX && MIX.context === AC) return; MIX = AC.createGain(); MIX.gain.value = 0.35; MIX.connect(AC.destination);
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
STEPS.water = () => { const j = rj(0.1), v = rj(0.15); nz(0, { color: 'pink', filter: 'bandpass', f: 1100 * j, fTo: 520 * j, q: 0.9, a: 0.01, dur: 0.14 + Math.random() * 0.04, gain: 0.26 * v, wet: 0.08 }); tn(0.03, { freq: 330 * j, to: 190 * j, glide: 0.06, a: 0.004, d: 0.07, lp: 900, gain: 0.05 * v, wet: 0.08 }); };   // a wet slosh
function footstep() {
  if (!S.sound || !AC) return; const x = ME.x, y = ME.y - 2; let k = 'grass';
  if (DECK[Math.floor(y / TS) * MW + Math.floor(x / TS)]) k = 'wood'; else if (siteAt(x, y) || pitZ(x, y) > 0.05) k = 'dirt'; else { const t = typeAt(x, y); k = (t === 1 || t === 6) ? 'water' : t === 2 ? 'sand' : t === 4 ? 'dirt' : t === 5 ? 'stone' : 'grass'; }
  try { STEPS[k](); } catch (e) { }
}
function brushSfx(l) { if (!S.sound || !AC) return; try { nz(0, { color: 'pink', filter: 'bandpass', f: 1900, fTo: 1100, q: 0.7, a: 0.025, dur: 0.16, gain: 0.22 * l, wet: 0.05 }); } catch (e) { } }   // a soft brushing swish while you press
const NSFX = { splash: () => { for (let i = 0; i < 3; i++) nz(i * 0.035, { color: 'white', filter: 'bandpass', f: 2600 * rj(0.1), fTo: 900, q: 0.8, a: 0.004, dur: 0.12, gain: 0.2 * rj(0.2), wet: 0.1 }); tn(0, { freq: 220, to: 110, glide: 0.1, a: 0.004, d: 0.14, lp: 700, gain: 0.08, wet: 0.08 }); }, rustle: () => {   // walking onto a bush: three soft pink-noise rustles that sweep down, with a gentle low whump
  for (let i = 0; i < 3; i++) { const j = rj(0.1); nz(i * 0.06, { color: 'pink', filter: 'bandpass', f: 2200 * j, fTo: 1000 * j, q: 0.7, a: 0.02, dur: 0.12 + Math.random() * 0.04, gain: 0.22 * rj(0.2), wet: 0.06 }); }
  tn(0, { freq: 130, to: 75, glide: 0.09, a: 0.006, d: 0.13, lp: 400, gain: 0.07, wet: 0.05 });
} };
function sfx(n) { if (!S.sound || !AC) return; if (NSFX[n]) { try { NSFX[n](); } catch (e) { } return; } const s = SFX[n]; if (!s) return; try { s.forEach(a => tone(a[0], a[1], a[2], a[3], a[4], a[5])); } catch (e) { } }
const vib = ms => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) { } };

// ---- canvas ---------------------------------------------------------------
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 3); const r = cv.getBoundingClientRect(), w = r.width || innerWidth, h = r.height || innerHeight;   // the canvas fills the page by CSS; its size is read back from the page, so it matches exactly on phones with browser bars, notches and folding screens
  cv.width = Math.ceil(w * DPR); cv.height = Math.ceil(h * DPR);   // rounded up, and the world is drawn over the whole buffer, so no strip at the edge is left unpainted
  Z = Math.max(2, Math.round(Math.min(w, h * 0.62) / 190)); VW = cv.width / (DPR * Z); VH = cv.height / (DPR * Z);
}

// ---- input ----------------------------------------------------------------
// the joystick ring stays where you touched down; the knob inside it slides on whole art pixels (each is 3 screen pixels)
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
  if (joy.moved) { joy.vx = dx / (d || 1); joy.vy = dy / (d || 1); joy.mag = d < 8 ? 0 : Math.min(1, (d - 6) / (R - 6)); const k = Math.min(d, R) / R * 6, qx = Math.round(joy.vx * k) * 3, qy = Math.round(joy.vy * k) * 3; knob.style.transform = `translate(${qx}px,${qy}px)`;  }
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
const SHK = { a: 0, t: 0, d: 0.12 };
function shake(a, d) { if (a >= SHK.a * SHK.t / SHK.d || SHK.t <= 0) { SHK.a = a; SHK.d = d || 0.12; SHK.t = SHK.d; } }   // a short screen thump: whole pixels, fading out
function burst(x, y, col, n, sp, life, grav, sz) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = rnd(0.3, 1) * sp; PT.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.4, g: grav == null ? 60 : grav, life: rnd(0.5, 1) * life, max: life, col, sz: sz || 1 }); }
}
function floater(x, y, txt, col) { FL.push({ x, y, txt, col: col || '#fff', t: 0 }); }
function ripple(x, y, big) { RP.push({ x, y, t: 0, max: big ? 1.1 : 0.9, big }); }
function doEmote(e) {
  ME.bubble = e; ME.bt = 2.6; sfx('pop'); if (e === '👋' && !A) ME.wave = { t: 0 };
  NPCS.forEach(n => { if (Math.hypot(n.x - ME.x, n.y - ME.y) < 90 && Math.random() < 0.4) setTimeout(() => { n.bubble = pick(['👋', '❤️', '😄', '✨']); n.bt = 2.4; }, rnd(700, 1600)); });
}

const walkSp = () => 58 * (1 - 0.28 * ((ME && ME.sub) || 0));   // wading is slower

// ---- player ---------------------------------------------------------------
function updateMe(dt) {
  const v = inputVec(), mag = Math.hypot(v[0], v[1]);
  ME.moving = false;
  if (ME.wave) { ME.wave.t += dt; if (ME.wave.t > 1.3 || mag > 0.3) ME.wave = null; }
  if (ME.hold) { const h = ME.hold; h.t += dt; if (h.t > h.dur || (h.t > 0.6 && mag > 0.3)) ME.hold = null; else if (h.t < 0.6) return; }
  if (UI.isOpen) return;
  if (A) { if (mag > 0.4) cancelAct(); else return; }   // digging: you stand still; pushing the stick stops it
  if (mag > 0.05) {
    autoWalk = null; const sp = walkSp() * Math.min(1, mag);
    const nd = dirOf(v[0], v[1]); if (nd !== ME.dir && Math.abs(Math.abs(v[0]) - Math.abs(v[1])) > 0.25 || !DV[ME.dir]) ME.dir = nd; else if (Math.abs(Math.abs(v[0]) - Math.abs(v[1])) <= 0.25) { /* keep */ } else ME.dir = nd;
    ME.face = faceOf(v[0], v[1]); ME.faceDir = ME.dir; ME.moving = moveEnt(ME, v[0] * sp * dt, v[1] * sp * dt); ME.t += dt * Math.max(0.25, Math.min(1, mag)); { const sn = Math.floor(ME.t * WALK_FPS / 2); if (ME.moving && sn !== ME.lastStep) { ME.lastStep = sn; footstep(); wetPrint(); } }   // the walk animation runs at the pace you move

  }
}

// ---- update ---------------------------------------------------------------
function tick(dt) {
  timeNow = performance.now() / 1000;
  // indoors there is no sun
  updateWet(dt); SUN = FEATURES.light && W.theme !== 'museum' ? sunAmt(hourNow()) : 1; checkExits(); const night = isNight(); updateMe(dt);
  target = findTarget(); updateAct(dt); if (A) target = null;
  if (ME.bt > 0) { ME.bt -= dt; if (ME.bt <= 0) ME.bubble = null; }
  const st = actState();
  if (UI.isOpen) { }   // while a book or window is open, the action button and hint stay exactly as they were (they used to pop away and back)
  else if (st) { UI.setAct(st.icon, st.prog, st.alert); UI.setHint(st.hint); }
  else if (target) { const ti = targetInfo(target); UI.setAct(ti.icon, 0, false); UI.setHint(ti.hint); }
  else { UI.setAct(null, 0, false); UI.setHint(''); }
  if (SHK.t > 0) SHK.t -= dt;
  if (ME.moving && !A) { ME.dt = (ME.dt || 0) - dt; if (ME.dt <= 0) { ME.dt = 0.17; const ty = typeAt(ME.x, ME.y); if (ty >= 2 && ty <= 5) burst(ME.x + rnd(-2, 2), ME.y - 1, ty === 2 ? '#ead9ae' : ty === 4 ? '#b58a64' : '#c9cfa4', 1, 12, 0.32, -14, 1); } }   // little dust puffs at your feet while you run on land
  tickHoles(dt); tickTrees(dt);
  for (let i = PT.length - 1; i >= 0; i--) { const p = PT[i]; p.life -= dt; if (p.life <= 0) { PT.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  for (let i = FL.length - 1; i >= 0; i--) { FL[i].t += dt; if (FL[i].t > 1.3) FL.splice(i, 1); }
  for (let i = RP.length - 1; i >= 0; i--) { RP[i].t += dt; if (RP[i].t > RP[i].max) RP.splice(i, 1); }
  // the camera eases toward the player instead of being locked to them (snaps on teleports / first frame)
  const ctx_ = PW <= VW ? (PW - VW) / 2 : clamp(ME.x - VW / 2, 0, Math.max(0, PW - VW)), cty_ = PH <= VH ? (PH - VH) / 2 : clamp(ME.y + pitZ(ME.x, ME.y) * PIT_U - VH / 2 - 10, 0, Math.max(0, PH - VH));   // a room smaller than the screen sits in the middle of it
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
const PRINTS = [];   // wet footprints left on dry ground after wading
function wetPrint() {   // each step you take with wet feet leaves a dark print that dries out in a second or two (longer the wetter you are)
  if (!ME || !(ME.wet > 0.25) || ME.sub > 0.05 || !(ME.wetH > 1)) return; const t = typeAt(ME.x, ME.y - 1); if (t < 2 || t > 5) return;
  ME.pside = -(ME.pside || 1); const v = DV[ME.dir] || [0, 1], px = -v[1] * ME.pside * 2, py = v[0] * ME.pside * 2;   // left and right feet alternate, to either side of your line
  PRINTS.push({ x: ME.x + px, y: ME.y - 1 + py, t: 0, life: 0.6 + 2.4 * ME.wet, a: 0.12 + 0.38 * ME.wet, dir: ME.dir });
  if (PRINTS.length > 40) PRINTS.shift();
}
function drawPrints(cx, cy, dt) {
  for (let i = PRINTS.length - 1; i >= 0; i--) {
    const p = PRINTS[i]; p.t += dt; if (p.t >= p.life) { PRINTS.splice(i, 1); continue; }
    const a = p.a * Math.pow(1 - p.t / p.life, 1.3), x = Math.round(p.x - cx), y = Math.round(p.y - cy), vert = p.dir === 'u' || p.dir === 'd'; g.fillStyle = `rgba(16,30,44,${a.toFixed(3)})`;
    if (vert) { g.fillRect(x - 1, y - 3, 2, 4); g.fillRect(x, y - 4, 1, 1); } else { g.fillRect(x - 2, y - 1, 4, 2); g.fillRect(x + 2, y - 1, 1, 1); }   // a small foot, long ways along the way you walk, with a toe
  }
}
const WET = { hold: 1.5, fade: 5, soak: 1.4 };   // seconds: you stay soaked this long after leaving, then take this long to dry; and about this long in knee-deep water to get fully soaked   // seconds your clothes stay fully dark after leaving the water, then the seconds they take to dry
function updateWet(dt) {   // wading: how deep you are (it slopes down gradually from the shore), and how wet your clothes are
  if (!ME) return; const t = typeAt(ME.x, ME.y - 1), dpx = (t === 1 || t === 6) ? waterDepth(ME.x, ME.y - 1) : 0, inW = (t === 1 || t === 6) && dpx > 0.4; if (ME.wasW == null) { ME.wasW = inW; ME.dry = 99; ME.sub = dpx / 9; ME.wetH = 0; }
  ME.splT = Math.max(0, (ME.splT || 0) - dt); if (inW !== ME.wasW) { ME.wasW = inW; if (!ME.splT) { ME.splT = 0.9; burst(ME.x, ME.y - 2, '#d8f0f8', inW ? 9 : 5, 42, 0.6, 100, 1); RP.push({ x: ME.x, y: ME.y, t: 0, max: 0.8, big: true }); } }   // a splash going in, a smaller one coming out (not again and again if you skim the edge)
  const tgt = dpx / 9; ME.sub = tgt < ME.sub ? Math.max(tgt, ME.sub - dt * 16) : Math.min(tgt, ME.sub + dt * 6);   // follows the ground's slope; coming up is quick, so your feet are above the ground as soon as you are out
  if (inW) { ME.dry = 0; ME.wetH = Math.max(ME.wetH || 0, dpx); ME.soak = Math.min(1, (ME.soak || 0) + dt * (0.2 + 0.8 * dpx / 9) / WET.soak); } else { ME.dry += dt; if (ME.dry > WET.hold) ME.soak = Math.max(0, (ME.soak || 0) - dt / WET.fade); }   // you get wet gradually: a brush with the edge barely dampens you, a proper wade soaks you in a second or two
  ME.wet = ME.soak || 0; if (ME.wet <= 0) ME.wetH = 0;
  if (inW && ME.moving) { ME.rpt = (ME.rpt || 0) - dt; if (ME.rpt <= 0) { ME.rpt = 0.22; RP.push({ x: ME.x + rnd(-2, 2), y: ME.y, t: 0, max: 0.8, big: false }); } }
  if (!inW && ME.wet > 0.25 && ME.moving && ME.wetH > 1) { ME.dpt = (ME.dpt || 0) - dt; if (ME.dpt <= 0) { ME.dpt = 0.28 + (1 - ME.wet) * 0.7; burst(ME.x + rnd(-3, 3), ME.y - rnd(3, Math.max(4, ME.wetH)), '#8cc0dc', 1, 6, 0.5, 130, 1); } }   // drips
}
function wetOf(c, lv, hg) {   // the same sprite with the part that was in the water darker and bluer: the bottom `hg` rows (the water reached your knees), darker the wetter you are
  const m = c._wet || (c._wet = {}), key = lv * 16 + hg; if (m[key]) return m[key]; const w = c.width, h = c.height, o = mk(w, h); o.g.drawImage(c, 0, 0); const id = o.g.getImageData(0, 0, w, h), d = id.data; let bot = 0;
  for (let y = h - 1; y >= 0 && !bot; y--) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { bot = y; break; }
  const f = 1 - 0.42 * lv / 4;
  for (let y = Math.max(0, bot - hg + 1); y <= bot; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3]) { d[i] = Math.round(d[i] * f * 0.9); d[i + 1] = Math.round(d[i + 1] * f * 0.97); d[i + 2] = Math.min(255, Math.round(d[i + 2] * f * 1.06)); } }
  o.g.putImageData(id, 0, 0); o.ax = c.ax; o.ay = c.ay; return m[key] = o;
}
function waterTint(im) { if (im._wt) return im._wt; const t = mk(im.width, im.height); t.g.drawImage(im, 0, 0); t.g.globalCompositeOperation = 'source-atop'; t.g.fillStyle = 'rgba(26,70,104,0.65)'; t.g.fillRect(0, 0, im.width, im.height); return im._wt = t; }
function drawChar(e, cx, cy, now) {
  const digging = e === ME && A && A.k === 'dig', holding = e === ME && ME.hold;
  const bob = digging ? -Math.round(Math.max(0, Math.sin(A.t * 15))) : e === ME && ME.wave ? -(Math.floor(ME.wave.t * 8) % 2) : 0;
  const spr0 = heroSprite(faceIdx(e), digging || holding ? 0 : heroFrameOf(e), e === ME ? null : e.look), wl = e === ME && (ME.wetH || 0) >= 1 && ME.wet > 0.1 ? Math.max(1, Math.round(clamp(ME.wet, 0, 1) * 4)) : 0, wh = e === ME ? Math.max(1, Math.round(ME.wetH * clamp(ME.wet * 1.3, 0, 1))) : 0, spr = wl ? wetOf(spr0, wl, wh) : spr0;   // wet: darker and up to the knee, shrinking as you dry
  const wy = e === ME && ME.sub > 0.03 ? Math.round(e.y - cy - 9 * ME.sub) : null;   // the water line on your legs
  if (!(wy != null && ME.sub > 0.5)) G0.drawImage(shadowSpr(14, 5), Math.round(e.x - 7 - cx), Math.round(e.y - 3 - cy));   // soft shadows go straight on the ground layer, so the night tint darkens them like the ground (on the people layer they came out pale)
  const anim = e === ME ? (digging ? digAnim(A.dir) : holding && ME.hold.pose && digAnim(ME.hold.pose.dir)) : null;   // the hand-drawn dig animation (all four directions) replaces the placeholder
  if (wy != null) { g.save(); g.beginPath(); g.rect(-1000, -1000, 3000, 1000 + wy); g.clip(); }   // only what is above the water is drawn normally
  if (anim) {
    const dd = digging ? A.dir : ME.hold.pose.dir, fi = digging ? digFrameE(A) : DIGE.reward[3];
    { const ds0 = digSprite(dd, fi), ds = wl ? wetOf(ds0, wl, wh) : ds0, qx = Math.round(e.x - anim.ax - cx), qy = Math.round(e.y - anim.ay - cy); g.drawImage(ds, qx, qy); e._last = [ds, qx, qy]; }
    if (digging && A.ph === 'brush' && A.res) { const ob = digObjAt(dd, fi), ic = itemIcon(A.res.id), ox = Math.round(e.x - anim.ax - cx), oy = Math.round(e.y - anim.ay - cy); if (ob) { g.drawImage(ic, Math.round(ox + ob.x - ic.width / 2), Math.round(oy + ob.y - ic.height / 2)); g.drawImage(digBlob(dd, fi, A.rv || 0), ox, oy); } }   // the find sits under the dirt blob, which is brushed away pixel by pixel
  } else { const qx = Math.round(e.x - spr.ax - cx), qy = Math.round(e.y - spr.ay - cy + bob); g.drawImage(spr, qx, qy); e._last = [spr, qx, qy]; }
  if (wy != null) {
    g.restore(); const im = e._last;
    if (im) { g.save(); g.beginPath(); g.rect(im[1] - 2, wy, im[0].width + 4, 60); g.clip(); g.globalAlpha = 0.4; g.drawImage(waterTint(im[0]), im[1], im[2]); g.restore(); }   // under the surface you are only a dark, bluish shape
    const hw = 7 + Math.round(Math.sin(now * 5) * 1.5), fx = Math.round(e.x - cx); g.fillStyle = 'rgba(228,246,252,0.75)'; g.fillRect(fx - hw, wy, hw * 2, 1); g.fillStyle = 'rgba(30,76,110,0.5)'; g.fillRect(fx - hw + 2, wy + 1, hw * 2 - 4, 1);   // the waterline
  }
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
      if (o.frames) o.spr = o.frames[Math.floor(now * 6 + o.ph) % o.frames.length];   // the furnace's flames flicker and its smoke curls: five frames, six a second
      const spr = o.spr; if (!spr) return;
      if (o.k === 'shop') { drawShop(o, cx, cy, now); return; }
      if (o.k === 'museum') { drawMuseum(o, cx, cy, now); return; }
      if (o.k === 'tree') { G0.globalAlpha = 0.3; G0.drawImage(o.shadow, Math.round(o.x - o.shadow.ax - cx + (o.sx || 0)), Math.round(o.y - o.shadow.ay - cy)); G0.globalAlpha = 1; }   // the crown's shadow on the ground
      const fa = o.k === 'tree' ? 1 : behindAlpha(o); if (fa < 1) g.globalAlpha = fa;
      const zo = o.pz > 0.02 ? Math.round(o.pz * PIT_U) : 0; if (zo) { g.save(); const ry = rimY(o.x, o.y); if (ry != null) { g.beginPath(); g.rect(o.x - cx - 40, -1000, 80, ry - cy + 1000); g.clip(); } g.translate(0, zo); }   // a stone that has dropped into a pit is drawn lower, and the higher ground in front hides its bottom
      if (o.ang) { const q = Math.round(o.ang / 1.5708) & 3, w = spr.width, h = spr.height; g.save(); g.translate(Math.round(o.x - cx), Math.round(o.y - cy) - h / 2); g.rotate(q * Math.PI / 2); g.drawImage(spr, -w / 2, -h / 2); g.restore(); } else if (Math.abs(o.lean) > 0.04) { const px = Math.round(o.x - spr.ax - cx), py = Math.round(o.y - spr.ay - cy), H = spr.height; for (let r = 0; r < H; r += 2) g.drawImage(spr, 0, r, spr.width, Math.min(2, H - r), px + Math.round(o.lean * Math.pow(1 - (r + 1) / H, 1.5) * 3), py + r, spr.width, Math.min(2, H - r)); } else if (o.sq > 0.02) { const sw = Math.round(spr.width * (1 + 0.14 * o.sq)), sh = Math.round(spr.height * (1 - 0.32 * o.sq)); g.drawImage(spr, Math.round(o.x - cx - spr.ax * sw / spr.width), Math.round(o.y - cy - spr.ay * sh / spr.height), sw, sh); } else g.drawImage(spr, Math.round(o.x - spr.ax - cx), Math.round(o.y - spr.ay - cy)); g.globalAlpha = 1;
      if (o.k === 'mprop' && spr.over) g.drawImage(spr.over, Math.round(o.x - spr.ax - cx), Math.round(o.y - spr.ay - cy));   // a case's glass goes over what is in it
      if (zo) g.restore();
      if (spr.nrm) litProp(o, spr, Math.round(o.x - spr.ax - cx), Math.round(o.y - spr.ay - cy), fa);   // sun shading and point lights on props that have a bump map
    }
  }
}
let SUN = 1;   // how strong cast shadows and sun shading are: 1 = full daylight, 0 = none (night). Follows the clock when FEATURES.light is on
const shadowStrength = () => FEATURES.shadows === false ? 0 : SUN;
function drawMuseum(o, cx, cy, now) {   // the building, its doors, and the banner swaying a little on its ropes
  const s = o.spr, bx = Math.round(o.x - s.ax - cx), by = Math.round(o.y - s.ay - cy); g.drawImage(s, bx, by); g.drawImage(s.door, bx, by);
  const sw = Math.round(Math.sin(now * 1.3 + o.x * 0.01) * 1.2), sg = s.sign; g.drawImage(sg, 0, 0, sg.width, 44, bx, by, sg.width, 44); g.drawImage(sg, 0, 44, sg.width, sg.height - 44, bx + sw, by + 44, sg.width, sg.height - 44);   // the ropes stay put, the banner swings
}
function drawShop(o, cx, cy, now) {   // the merchant stands behind the counter and breathes: the shopkeeper's upper body rises a pixel now and then; the stall is drawn over them
  const s = o.spr, m = s.merchant, bx = Math.round(o.x - s.ax - cx), by = Math.round(o.y - s.ay - cy), fa = behindAlpha(o); if (fa < 1) g.globalAlpha = fa;
  const up = Math.sin(now * 1.6 + (o.src.x | 0)) > 0.55 ? 1 : 0;
  g.drawImage(m, 0, 0, m.width, 42, bx, by - up, m.width, 42); g.drawImage(m, 0, 42, m.width, m.height - 42, bx, by + 42, m.width, m.height - 42);
  litProp(o, m, bx, by, fa);   // the shopkeeper's sun shading goes on before the stall is drawn over him
  if (fa < 1) g.globalAlpha = fa; g.drawImage(s, bx, by); g.globalAlpha = 1;
  litProp(o, s, bx, by, fa);
}
function render(now) {
  const sk = SHK.t > 0 ? SHK.a * SHK.t / SHK.d : 0, cx = Math.round(cam.x + (sk ? (Math.random() * 2 - 1) * sk : 0)), cy = Math.round(cam.y + (sk ? (Math.random() * 2 - 1) * sk : 0)), K = DPR * Z;
  // the world is drawn on whole native pixels, then the whole scene is slid by the camera's fractional part (in device pixels): the camera glides instead of stepping
  g.setTransform(K, 0, 0, K, Math.round((cx - cam.x) * K), Math.round((cy - cam.y) * K)); g.imageSmoothingEnabled = false;
  g.fillStyle = W.theme === 'museum' ? '#14161c' : '#2c5a86'; g.fillRect(-2, -2, VW + 4, VH + 4); g.drawImage(W.terrain, -cx, -cy);
  if (fxOn()) fxWater(cx, cy, now);
  drawLockedShade(cx, cy); drawHoles(cx, cy); drawDigMarker(cx, cy, now); drawPrints(cx, cy, Math.min(0.1, Math.max(0, now - (drawPrints.last || now)))); drawPrints.last = now;
  const sb = Math.floor(now * 2);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 70; i++) { const x = cx + hash2(i, sb, 31) * VW, y = cy + hash2(i, sb, 32) * VH; if (W.theme !== 'museum' && hash2(i, sb, 33) < 0.55 && isWater(x, y)) g.fillRect(Math.round(x - cx), Math.round(y - cy), 2, 1); }
  for (const r of RP) {
    const u = r.t / r.max, rx = 2 + u * (r.big ? 10 : 7), ry = rx * 0.5; g.fillStyle = `rgba(235,248,252,${(1 - u) * 0.8})`;
    for (let i = 0; i < 16; i++) { const a = i * 0.3927; g.fillRect(Math.round(r.x + Math.cos(a) * rx - cx), Math.round(r.y + Math.sin(a) * ry - cy), 1, 1); }
  }
  collectLights(now);
  for (const o of W.objs) if (o.spr && o.spr.shadow && (o.k === 'shop' || o.k === 'bench' || o.k === 'anvil' || o.k === 'hammer' || o.k === 'furnace') && o.x > cx - 70 && o.x < cx + VW + 70 && o.y > cy - 10 && o.y < cy + VH + 90) { const sh = o.spr.shadow, a = sh.own ? SUN : shadowStrength(); if (a > 0.01) { g.globalAlpha = a; g.drawImage(sh, Math.round(o.x - sh.ax - cx), Math.round(o.y - sh.ay - cy)); g.globalAlpha = 1; } }   // the stall's shadow lies flat on the ground, under everything that stands
  const L = [];
  for (const o of W.objs) if (o.x > cx - 70 && o.x < cx + VW + 70 && o.y > cy - 10 && o.y < cy + VH + 90) L.push(o);
  for (const l of LEAVES) if (l.x > cx - 10 && l.x < cx + VW + 10 && l.y > cy - 10 && l.y < cy + VH + 10) L.push({ k: 'leaf', x: l.x, y: l.gy, l });   // leaves sort with everything else by where they will land, so they pass behind you or in front like anything on the ground
  L.push(ME); for (const n of NPCS) if (n.x > cx - 30 && n.x < cx + VW + 30 && n.y > cy - 10 && n.y < cy + VH + 60) L.push(n);
  lightGround(cx, cy, now);   // night tint and the glow on the ground (light.js), then the things standing on it are drawn on their own layer
  entBegin();
  L.sort((a, b) => a.y - b.y); LORD = L; for (const o of L) drawEnt(o, cx, cy, now); drawCrowns(cx, cy, now); drawGhost(L, cx, cy);
  drawMarker(cx, cy, now);
  entEnd(cx, cy, now);   // tint that layer, add the light on props and people, lay it over the ground
  { const tcn = FEATURES.light ? nightTint() : null; for (const p of PT) { g.globalAlpha = clamp(p.life / (p.max * 0.5), 0, 1); g.fillStyle = tcn ? tintHex(p.col, tcn) : p.col; g.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.sz, p.sz); } g.globalAlpha = 1; }   // dust and leaves, drawn over the finished scene in the night's tint
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
const AREAHOLES = {};
function checkExits() { if (fading || !W.objs) return; for (const o of W.objs) if (o.k === 'mexit' && Math.abs(ME.x - o.x) < 10 && Math.abs(ME.y - o.y) < 22) { goArea(o.to, o.to === 'island' && MDOOR ? MDOOR.x : o.sx, o.to === 'island' && MDOOR ? MDOOR.y : o.sy, 'd'); return; } }   // walking into the museum's exit takes you outside, at its door
function goArea(to, sx, sy, dir) { // fade out, load the other map, drop the player at its target spot
  if (fading) return; fading = true; const f = $('#fade'); f.classList.add('on'); sfx('pop');
  setTimeout(() => {
    const done = map => {
      AREAHOLES[AREA] = HOLES.slice(); HOLES.length = 0; (AREAHOLES[to] || []).forEach(h => HOLES.push(h));   // each place keeps its own dug holes
      AREA = to; initWorld(map, false); ME.x = sx || W.spawn.x; ME.y = sy || W.spawn.y; ME.dir = dir || 'd'; ME.face = FACE_OF_DIR[ME.dir]; autoWalk = null; A = null; ME.hold = null;
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
const LOAD_MIN = 1600;   // the loading screen stays up at least this long (ms), so the title can be seen; add ?loadhold to the address to keep it up for design work
function loadProgress(p) { const b = document.getElementById('lbar'); if (b) b.style.width = Math.round(p * 100) + '%'; }
function boot() {
  const t0 = performance.now(); loadState(); resize(); addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 150)); if (window.visualViewport) visualViewport.addEventListener('resize', resize);
  loadAssets(failed => {
  if (failed.length) console.error('Missing assets:', failed.join(', '));
  loadProgress(0.8); buildSprites(); if (ASSET.ok) heroInit(); buildClouds(); FEATURES.light = S.light !== false; FEATURES.shadows = S.objShadow === true; FEATURES.rim = S.rim !== false; if (!EDIT) UI.init(); loadProgress(0.9);
  setTimeout(() => prepareAtlas(() => loadMapData((map, src) => {
    initWorld(map, EDIT);
    if (EDIT) { startEditor(src); return; }
    ME = { k: 'me', x: W.spawn.x, y: W.spawn.y, dir: 'd', t: 0, moving: false, bubble: null, bt: 0 };
    loadProgress(1); if (!qs.has('loadhold')) setTimeout(() => $('#loading').classList.add('hidden'), Math.max(250, LOAD_MIN - (performance.now() - t0))); requestAnimationFrame(loop);
    if (!S.created) setTimeout(() => UI.openMe(true), 600);
    if (src === 'draft') UI.toast('Playing your draft map', 'info');
    window.__game = { get ME() { return ME; }, get A() { return A; }, S, W, NPCS, get target() { return target; } };
  })), 40);
  });
}
boot();
