// Node test for web-next/src/sound.js with a mocked AudioContext and fetch.
import { pathToFileURL, fileURLToPath } from 'node:url';
const src = fileURLToPath(new URL('../web-next/src/sound.js', import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setValueCurveAtTime() { this.curves = (this.curves || 0) + 1; } });
const node = (extra) => Object.assign({ connect(n) { return n; }, disconnect() {} }, extra);
let sources = [], oscs = 0, lastCtx = null;
class AC {
  constructor() { lastCtx = this; this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = node(); }
  resume() {}
  createGain() { return node({ gain: param() }); }
  createBiquadFilter() { return node({ frequency: param(), Q: param() }); }
  createDelay() { return node({ delayTime: param() }); }
  createBuffer(c, l) { return { duration: l / 8000, getChannelData: () => new Float32Array(l) }; }
  createBufferSource() { const s = node({ started: [], stopped: 0, start(t) { this.started.push(t); }, stop() { this.stopped++; } }); sources.push(s); return s; }
  createOscillator() { oscs++; return node({ frequency: param(), start() {}, stop() {} }); }
  decodeAudioData(data, ok2, bad) { if (data.bad) bad(new Error('decode')); else ok2({ duration: 30 }); }
}
globalThis.window = { AudioContext: AC };
let fetched = [], failFetch = false;
globalThis.fetch = (url) => { fetched.push(url); return failFetch ? Promise.reject(new Error('net')) : Promise.resolve({ ok: true, arrayBuffer: async () => ({}) }); };
const timers = new Set(), pending = new Map(), realST = setTimeout, realCT = clearTimeout;
globalThis.setTimeout = (f, ms) => { const id = realST(() => { timers.delete(id); pending.delete(id); f(); }, ms); timers.add(id); pending.set(id, { f, ms }); return id; };
globalThis.clearTimeout = (id) => { timers.delete(id); pending.delete(id); realCT(id); };
const wait = (ms) => new Promise((r) => realST(r, ms));
const { Sound } = await import(pathToFileURL(src).href);

Sound.play('rain'); Sound.play('rain'); // second call while loading must not start twice
await wait(20);
ok(fetched.length === 1 && fetched[0] === 'sounds/rain.mp3', 'recorded id fetches sounds/rain.mp3 exactly once: ' + fetched);
ok(sources.length === 1 && sources[0].started.length === 1, 'one pass started (no double start)');
ok(oscs === 0, 'no generated oscillators for recorded rain');
Sound.play('rain'); await wait(5);
ok(sources.length === 1, 'replaying the same id is a no-op');
Sound.stop();
await wait(400);
ok(sources[0].stopped >= 1, 'stop() stops the pass source');
ok(Sound.playing() === null, 'nothing playing after stop');

// the loop scheduler: advance audio time and let the timer fire
sources = []; fetched = [];
Sound.play('piano'); await wait(20);
ok(fetched.length === 1 && fetched[0] === 'sounds/piano.mp3', 'piano fetched (cached decode may skip): ' + fetched);
const n0 = sources.length;
Sound.play('tick'); await wait(20);
ok(sources.length > n0, 'switching ids starts the new id');
ok(fetched.includes('sounds/tick.mp3'), 'tick fetched');
await wait(400);
ok(sources[0].stopped >= 1, 'switching ids stops the previous sound sources');
ok(Sound.playing() === 'tick', 'tick is current');
// next pass is scheduled with a timer (tick: 18? mocked 30 s duration -> pending timer)
ok(timers.size >= 1, 'a timer is pending for the next looping pass');
Sound.stop(); await wait(400);
ok(timers.size === 0, 'stop() cleared the pending loop timer: ' + timers.size);

// stop while loading: nothing starts afterwards
sources = []; fetched = [];
Sound.play('wind'); Sound.stop(); await wait(400);
ok(sources.length === 0 && timers.size === 0, 'stop during load starts nothing and leaves no timers');

// failed fetch -> generated fallback
failFetch = true; sources = []; oscs = 0; fetched = [];
Sound.play('forest'); await wait(30);
ok(fetched.includes('sounds/forest.mp3'), 'forest attempted fetch');
ok(oscs > 0, 'failed fetch falls back to generated crickets (oscillators created)');
Sound.stop(); await wait(400);
Sound.play('rain'); await wait(30);
ok(sources.length >= 1 && oscs > 0, 'failed fetch for rain falls back to generated rain (noise source)');
Sound.stop(); await wait(400);
ok(timers.size === 0, 'no timers left after final stop');
failFetch = false;
ok(Sound.has('waves') && Sound.has('debussy') && !Sound.has('nope'), 'has() covers generated and new ids');
// loop scheduling: fire the pending timer and check the second, overlapping pass and the fade curves
const gains = [];
const origCG = AC.prototype.createGain;
AC.prototype.createGain = function () { const g = origCG.call(this); gains.push(g); return g; };
async function loopCheck(id, fade) {
  sources = []; gains.length = 0;
  Sound.play(id); await wait(20);
  ok(sources.length === 1 && sources[0].started.length === 1, id + ': first pass only before the timer fires');
  const firstGain = gains[gains.length - 1];
  ok((firstGain.gain.curves || 0) === 1, id + ': first pass has no fade-in, only the fade-out curve');
  const pendIds = [...pending.keys()], pend = [...pending.values()];
  ok(pend.length === 1, id + ': exactly one pending timer');
  lastCtx.currentTime = 20; // pretend audio time advanced
  clearTimeout(pendIds[0]); pend[0].f();
  ok(sources.length === 2, id + ': timer schedules a second pass');
  const t1 = sources[0].started[0], t2 = sources[1].started[0];
  ok(Math.abs(t2 - (t1 + 30 - fade)) < 1e-9, id + ': second pass starts ' + fade + ' s before the first ends (' + t2 + ')');
  const secondGain = gains[gains.length - 1];
  ok(secondGain.gain.curves === 2, id + ': second pass has fade-in and fade-out curves');
  ok(pending.size === 1, id + ': next timer armed');
  Sound.stop(); await wait(400);
  ok(sources.every((s) => s.stopped >= 1), id + ': stop() stops both overlapping passes');
  ok(timers.size === 0 && pending.size === 0, id + ': no timers after stop');
}
await loopCheck('rain', 3);
await loopCheck('tick', 0.03);
// fallbacks: reset counters per case
failFetch = true;
for (const [id, kind] of [['rainwindow', 'noise'], ['storm', 'noise'], ['forest', 'osc'], ['dawn', 'osc'], ['fountain', 'noise'], ['satie', 'osc'], ['debussy', 'osc'], ['gymnopedie', 'osc'], ['satie2', 'osc']]) {
  sources = []; oscs = 0; Sound.stop(); await wait(380);
  sources = []; oscs = 0; fetched = [];
  Sound.play(id); await wait(30);
  ok(fetched.includes('sounds/' + id + '.mp3'), id + ': tried the recording');
  ok(kind === 'osc' ? oscs > 0 : kind === 'noise' ? sources.length > 0 : sources.length + oscs > 0, id + ': generated fallback is audible (' + sources.length + ' sources, ' + oscs + ' oscs)');
  ok(!sources.some((s) => s.started.length && s.started[0] === lastCtx.currentTime + 0.05), id + ': no recorded pass started');
}
// storm must use generated rain: its fallback creates no recorded rain fetch beyond sounds/storm.mp3
Sound.stop(); await wait(400);
// memory: only the two most recently used decoded sounds are kept
failFetch = false;
globalThis.fetch = (url) => { fetched.push(url); return Promise.resolve({ ok: true, arrayBuffer: async () => ({}) }); };
fetched = [];
for (const id of ['rainwindow', 'forest', 'dawn']) { Sound.play(id); await wait(25); Sound.stop(); await wait(380); }
ok(fetched.length === 3, 'three different recordings were fetched: ' + fetched);
fetched = [];
Sound.play('dawn'); await wait(25); Sound.stop(); await wait(380);
ok(fetched.length === 0, 'most recent recording is still decoded (no refetch)');
Sound.play('forest'); await wait(25); Sound.stop(); await wait(380);
ok(fetched.length === 0, 'second most recent is still decoded (no refetch)');
Sound.play('rainwindow'); await wait(25); Sound.stop(); await wait(380);
ok(fetched.length === 1 && fetched[0] === 'sounds/rainwindow.mp3', 'the oldest one was evicted and is fetched again: ' + fetched);
// decode failure falls back too
failFetch = false;
globalThis.fetch = (url) => { fetched.push(url); return Promise.resolve({ ok: true, arrayBuffer: async () => ({ bad: true }) }); };
sources = []; oscs = 0; fetched = [];
Sound.play('fountain'); await wait(30);
ok(fetched.length === 1 && oscs > 0, 'decode failure falls back to the generated stream');
Sound.stop(); await wait(400);
ok(timers.size === 0, 'no timers left at the end');
console.log(fails ? fails + ' FAILED' : 'all sound tests PASS');
process.exit(fails ? 1 : 0);
