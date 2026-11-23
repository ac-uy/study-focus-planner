// Builds the web app, then runs every test file and prints a summary. Exit code is 1 if anything fails.
// Usage: node tests/run.mjs [--no-build] [suite]      suite: keys | sound | music | app
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const noBuild = args.includes('--no-build');
const only = args.find((a) => !a.startsWith('--'));

// "expect" is a line the suite must print when it finishes cleanly.
const SUITES = [
  { name: 'public', file: 'tests/public.test.mjs', expect: /public-safe: ok/ },
  { name: 'keys', file: 'tests/keys.test.mjs', expect: /all keys present/ },
  { name: 'sound', file: 'tests/sound.test.mjs', expect: /all sound tests PASS/ },
  { name: 'music', file: 'tests/music.test.js' },
  { name: 'authz', file: 'tests/authz.test.js' },
  { name: 'app', file: 'tests/app.test.js' },
];

if (!noBuild) {
  const b = spawnSync(process.execPath, ['web-next/build.mjs'], { cwd: root, encoding: 'utf8' });
  if (b.status !== 0) { console.log((b.stdout || '') + (b.stderr || '')); console.log('BUILD FAILED'); process.exit(1); }
  console.log('build ok');
}

let failed = 0;
for (const s of SUITES.filter((x) => !only || x.name === only)) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [s.file], { cwd: root, encoding: 'utf8', timeout: 5 * 60 * 1000, maxBuffer: 50 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split(/\r?\n/);
  const pass = lines.filter((l) => /^PASS /.test(l)).length;
  const bad = lines.filter((l) => /^(FAIL |EXCEPTION|(local|cloud) errors:)/.test(l));
  const problem = r.status !== 0 || bad.length > 0 || (s.expect && !s.expect.test(out)) || (!s.expect && pass === 0);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const shown = s.expect ? '  ok' : String(pass).padStart(4) + ' passed';
  console.log(s.name.padEnd(6) + shown + (problem ? '   FAILED' : '') + '   (' + secs + ' s)');
  if (problem) {
    failed++;
    console.log((bad.length ? bad : lines.slice(-15)).map((l) => '    ' + l).join('\n'));
  }
}
console.log(failed ? '\n' + failed + ' suite(s) failed' : '\nall suites passed');
process.exit(failed ? 1 : 0);
