import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../web-next/src', import.meta.url)).replace(/\\/g, '/');
const { STRINGS: BASE } = await import(pathToFileURL(join(src, 'strings.js')).href);
const { STRINGS_MORE } = await import(pathToFileURL(join(src, 'strings-more.js')).href);
const STRINGS = { es: { ...BASE.es, ...STRINGS_MORE.es }, en: { ...BASE.en, ...STRINGS_MORE.en } };
const { SOUND_IDS } = await import(pathToFileURL(join(src, 'store.js')).href).catch(() => ({ SOUND_IDS: null }));
const es = Object.keys(STRINGS.es), en = Object.keys(STRINGS.en);
const out = [];
es.filter((k) => !en.includes(k)).forEach((k) => out.push('missing in en: ' + k));
en.filter((k) => !es.includes(k)).forEach((k) => out.push('missing in es: ' + k));

const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') && files.push(p); } })(src);
const used = new Set();
for (const f of files) {
  if (f.endsWith('strings.js')) continue;
  const txt = readFileSync(f, 'utf8');
  for (const m of txt.matchAll(/\bt\('([^']+)'/g)) used.add(m[1]);
}
used.forEach((k) => { if (!k.endsWith('.') && !(k in STRINGS.es)) out.push('unknown key: ' + k); });

const fam = {
  'kind.': ['partial', 'exam', 'quiz', 'project', 'other'], 'why.': ['failing', 'borderline', 'declining', 'belowAvg', 'examSoon', 'littleStudy'], 'trend.': ['up', 'down', 'flat', 'none'],
  'nav.': ['home', 'calendar', 'examweeks', 'plan', 'tasks', 'results', 'tutor', 'cards', 'notes', 'goals', 'streaks', 'stats', 'timer', 'timetable', 'history', 'design'],
  'ach.': ['first', 'hour1', 'hour10', 'hour50', 'streak3', 'streak7', 'tasks5', 'tasks25', 'notes3', 'cards10', 'known10', 'exam', 'review', 'miniexam', 'tutor'],
  'bg.': ['plain', 'paper', 'grid', 'blush', 'sunset', 'sky', 'mint', 'lavender', 'night', 'aurora', 'stars', 'rain', 'snow', 'bubbles', 'hearts', 'ocean', 'fireflies', 'photo'],
  'break.': ['patio', 'lunch'], 'chal.': ['days', 'minutes', 'long'], 'font.': ['system', 'rounded', 'hand', 'comic', 'serif', 'classic', 'trebuchet', 'verdana', 'gill', 'mono'],
  'imp.': ['alta', 'media', 'baja'], 'mode.': ['timer', 'stopwatch', 'pomodoro', 'manual', 'lightTheme', 'darkTheme', 'systemTheme'], 'period.': ['day', 'week', 'month'],
  'shape.': ['sharp', 'soft', 'rounded', 'pill'], 'sndg.': ['noise', 'nature', 'ambient', 'music', 'binaural'], 'tab.': ['goals', 'objectives', 'achievements'],
  'snd.': ['none', 'white', 'pink', 'brown', 'blue', 'violet', 'rain', 'storm', 'waves', 'stream', 'wind', 'birds', 'crickets', 'cafe', 'keyboard', 'tick', 'elevator', 'piano', 'rainwindow', 'forest', 'dawn', 'fountain', 'satie', 'satie2', 'gymnopedie', 'debussy', 'delta', 'theta', 'alpha', 'beta'],
  'subj.': ['Maths', 'Language', 'English', 'Science', 'History'],
};
for (const [p, ids] of Object.entries(fam)) for (const id of ids) {
  if (!((p + id) in STRINGS.es)) out.push('missing family key: ' + p + id);
  if (p === 'ach.' && !((p + id + '.d') in STRINGS.es)) out.push('missing family key: ' + p + id + '.d');
}
console.log(out.length ? out.join('\n') : 'all keys present');
console.log('es keys', es.length, 'en keys', en.length);
