// The study timer. It lives outside the pages so it keeps running when she opens another section.
import { state, save, LIMITS } from './store.js';
import { Sound } from './sound.js';
import { todayKey, uid } from './util.js';

export const clock = {
  mode: 'timer', phase: 'focus', running: false, seconds: 0, total: 0,
  subject: '', title: '', acc: 0, resumeAt: 0, endAt: 0, startAt: 0, preview: false,
};
let handle = null;
let hooks = { tick: () => {}, done: () => {} };
export function setHooks(h) { hooks = h; }

function loadMode() {
  if (clock.mode === 'timer') { clock.total = state.settings.timerMin * 60; clock.seconds = clock.total; }
  else if (clock.mode === 'pomodoro') { clock.total = state.settings.focusMin * 60; clock.seconds = clock.total; }
  else { clock.total = 0; clock.seconds = 0; }
  clock.phase = 'focus'; clock.acc = 0;
}
export function initClock() { loadMode(); }

export function setMode(mode) {
  if (clock.running) return;
  clock.mode = mode;
  loadMode();
  hooks.tick();
}
export function setPreset(min) {
  if (clock.running || clock.mode !== 'timer') return;
  state.settings.timerMin = Math.max(1, Math.min(300, Math.round(min)));
  save('settings');
  loadMode();
  hooks.tick();
}
// Settings (focus/break length) changed: reload the display if she is not mid-session.
export function settingsChanged() {
  if (!clock.running && clock.acc === 0) loadMode();
}

export function audio() {
  const want = (clock.running && clock.phase === 'focus') || clock.preview;
  const id = state.settings.sound;
  if (want && id !== 'none') { Sound.setVolume(state.settings.volume); Sound.play(id); }
  else if (Sound.playing()) Sound.stop();
}

function accrue() {
  if (clock.running && clock.phase === 'focus') clock.acc += (Date.now() - clock.resumeAt) / 1000;
  clock.resumeAt = Date.now();
}
function logSession() {
  const minutes = Math.round(clock.acc / 60);
  clock.acc = 0;
  if (minutes < 1) return;
  state.sessions.push({ id: uid(), date: todayKey(), minutes: Math.min(1440, minutes), mode: clock.mode, subject: clock.subject, title: clock.title, ts: Date.now() });
  if (state.sessions.length > LIMITS.sessions) state.sessions.splice(0, state.sessions.length - LIMITS.sessions);
  save('sessions');
}

function tick() {
  if (clock.mode === 'stopwatch') clock.seconds = Math.floor((Date.now() - clock.startAt) / 1000);
  else {
    clock.seconds = Math.max(0, Math.ceil((clock.endAt - Date.now()) / 1000));
    if (clock.seconds <= 0) { finish(); return; }
  }
  hooks.tick();
}

function finish() {
  accrue();
  Sound.ding();
  if (clock.mode === 'pomodoro' && clock.phase === 'focus') {
    logSession();
    clock.phase = 'break';
    clock.total = state.settings.breakMin * 60; clock.seconds = clock.total;
    clock.endAt = Date.now() + clock.seconds * 1000; clock.resumeAt = Date.now();
    audio(); hooks.done('break'); hooks.tick();
    return;
  }
  clearInterval(handle);
  clock.running = false;
  const wasTimer = clock.mode === 'timer';
  if (wasTimer) logSession();
  loadMode(); audio();
  hooks.done(wasTimer ? 'timer' : 'cycle'); hooks.tick();
}

export function start() {
  if (clock.running) return;
  clock.running = true;
  clock.resumeAt = Date.now();
  if (clock.mode === 'stopwatch') clock.startAt = Date.now() - clock.seconds * 1000;
  else clock.endAt = Date.now() + clock.seconds * 1000;
  clearInterval(handle);
  handle = setInterval(tick, 250);
  audio(); hooks.tick();
}
export function pause() {
  if (!clock.running) return;
  accrue();
  clock.running = false;
  clearInterval(handle);
  audio(); hooks.tick();
}
// Stop for good: the time studied so far (at least one minute) is saved as a session.
export function reset() {
  accrue();
  clearInterval(handle);
  clock.running = false;
  if (clock.phase === 'focus') logSession();
  loadMode(); audio(); hooks.tick(); hooks.done('reset');
}
export function setPreview(on) { clock.preview = on; audio(); }
export function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (n) => (n < 10 ? '0' : '') + n;
  return (hh ? hh + ':' : '') + p(mm) + ':' + p(ss);
}
