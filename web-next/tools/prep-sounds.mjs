// Downloads public domain / CC0 recordings from Wikimedia Commons and turns them into small, loudness-matched MP3 files.
// Usage: node tools/prep-sounds.mjs   (needs ffmpeg; set FFMPEG=<path to ffmpeg.exe> if it is not on PATH)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'sounds-src');
const outDir = join(root, 'public', 'sounds');
mkdirSync(srcDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
// Wikimedia's User-Agent policy wants a contact URL; without one upload.wikimedia.org answers 429.
const UA = 'StudyFocusPlanner-SoundPrep/1.1 (https://github.com/ac-uy; personal study app, one-off download of public domain sounds)';
const ALLOWED = ['Public domain', 'CC0'];

// id -> list of Commons files (joined in order). ss/t cut a section (seconds) from a single long file.
const SOUNDS = {
  rain: { files: ['Rain (1).ogg'] },
  rainwindow: { files: ['Rain against the window.ogg'] },
  storm: { files: ['Thunderstorm after hot summer day 17 minutes 01 of 04.ogg'], ss: 0, t: 180 },
  wind: { files: ['Howling wind.ogg'] },
  birds: { files: ['Birds singing in garden.ogg', 'Gentle breeze and birds singing.ogg', 'Breeze birds and geese.ogg'] },
  forest: { files: ['20090610 0 ambience.ogg'] },
  dawn: { files: ['Dawnchorus-uk.ogg'], ss: 120, t: 180 },
  fountain: { files: ['Fountain in toulouse.ogg'] },
  cafe: { files: ['Cafe ambiance.ogg'], ss: 60, t: 180 },
  keyboard: { files: ['Computer keyboard.ogg'] },
  tick: { files: ['Clock ticking.ogg'] },
  piano: { files: ['Robert Schumann - scenes from childhood, op. 15 - vii. dreaming.ogg', 'Robert Schumann - scenes from childhood, op. 15 - xii. child falling asleep.ogg'], kbps: 80 },
  satie: { files: ['Satie - Gnossienne 1.ogg', 'Gnossienne 6 (Satie).ogg'], kbps: 80 },
  satie2: { files: ['Gnossienne 2 (Satie).ogg', 'Gnossienne 3 (Satie).ogg', 'Gnossienne 4 (Satie).ogg', 'Gnossienne 5 (Satie).ogg'], kbps: 80 },
  gymnopedie: { files: ['Gymnopedie No. 1..ogg'], kbps: 80 },
  debussy: { files: ['Clair de lune (Claude Debussy) Suite bergamasque.ogg'], kbps: 80 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Wikimedia asks clients to go slowly; back off when it answers 429/503.
async function politeFetch(url) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status !== 429 && res.status !== 503) return res;
    const wait = (Number(res.headers.get('retry-after')) || 15 * attempt) * 1000;
    console.log('  rate limited, waiting ' + Math.round(wait / 1000) + ' s');
    await sleep(wait);
  }
  throw new Error('still rate limited: ' + url);
}

async function info(title) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&titles=' + encodeURIComponent('File:' + title) + '&prop=imageinfo&iiprop=url|extmetadata&format=json';
  const r = await (await politeFetch(u)).json();
  const page = Object.values(r.query.pages)[0];
  if (!page.imageinfo) throw new Error('not found on Commons: ' + title);
  const ii = page.imageinfo[0];
  const lic = ii.extmetadata.LicenseShortName.value;
  if (!ALLOWED.includes(lic)) throw new Error('license is "' + lic + '" for ' + title + ' (only ' + ALLOWED.join(' or ') + ' allowed)');
  return { url: ii.url, license: lic, page: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(title.replace(/ /g, '_')) };
}

async function download(title) {
  const meta = await info(title);
  const file = join(srcDir, title.replace(/[^A-Za-z0-9._-]+/g, '_'));
  if (!existsSync(file) || statSync(file).size < 1000) {
    const res = await politeFetch(meta.url);
    if (!res.ok) throw new Error('download failed ' + res.status + ' for ' + title);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    await sleep(4000);
  }
  return { file, ...meta, title };
}

const report = {};
for (const [id, spec] of Object.entries(SOUNDS)) {
  const parts = [];
  for (const f of spec.files) parts.push(await download(f));
  const out = join(outDir, id + '.mp3');
  const args = ['-y', '-v', 'error'];
  parts.forEach((p, i) => {
    if (parts.length === 1 && spec.ss != null) args.push('-ss', String(spec.ss), '-t', String(spec.t));
    args.push('-i', p.file);
  });
  const prep = parts.map((_, i) => '[' + i + ':a]aformat=sample_rates=44100:channel_layouts=mono[a' + i + ']').join(';');
  const join_ = parts.map((_, i) => '[a' + i + ']').join('') + 'concat=n=' + parts.length + ':v=0:a=1[c]';
  args.push('-filter_complex', prep + ';' + join_ + ';[c]loudnorm=I=-23:TP=-2:LRA=11[o]', '-map', '[o]', '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', (spec.kbps || 56) + 'k', out);
  const r = spawnSync(FFMPEG, args, { encoding: 'utf8' });
  if (r.status !== 0) { console.error('ffmpeg failed for ' + id + ':\n' + r.stderr); process.exit(1); }
  report[id] = { file: id + '.mp3', sizeKB: Math.round(statSync(out).size / 1024), sources: parts.map((p) => ({ title: p.title, license: p.license, page: p.page })) };
  console.log(id.padEnd(11), String(report[id].sizeKB).padStart(5) + ' KB', parts.map((p) => p.license).join(', '));
}
writeFileSync(join(outDir, 'sources.json'), JSON.stringify(report, null, 2));
console.log('done: ' + Object.keys(report).length + ' sounds');
