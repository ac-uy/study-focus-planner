// The repository is public. This test fails if anything personal or deployment-specific is in a file git tracks
// (or would track): a value from infra/config.local.json, an AWS account id, an email address, a live address,
// a Cognito pool id, or a key. It prints where the problem is, never the value itself.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
  .split(/\r?\n/).filter(Boolean);
const TEXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.json', '.md', '.html', '.css', '.txt', '.yml', '.yaml']);
const SKIP = /(^|\/)package-lock\.json$/;

// Exact values from the local config must never appear anywhere.
const local = [];
const cfgPath = join(root, 'infra', 'config.local.json');
if (existsSync(cfgPath)) {
  const c = JSON.parse(readFileSync(cfgPath, 'utf8'));
  for (const k of ['account', 'ownerEmail', 'childEmail']) if (c[k]) local.push({ key: k, value: String(c[k]).toLowerCase() });
}

const PATTERNS = [
  ['AWS account id', /(?<![\d.])(?!123456789012)\d{12}(?![\d.])/], // 123456789012 is AWS's documented example
  ['email address', /[A-Za-z0-9._%+-]+@(?!example\.com\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ['CloudFront address', /[a-z0-9]{10,}\.cloudfront\.net/i],
  ['API Gateway address', /[a-z0-9]{8,}\.execute-api\.[a-z0-9-]+\.amazonaws\.com/i],
  ['Cognito pool id', /\b[a-z]{2}-[a-z]+-\d_[A-Za-z0-9]{9}\b/],
  ['Cognito domain', /\.auth\.[a-z0-9-]+\.amazoncognito\.com/i],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
];

const hits = [];
let scanned = 0;
for (const f of files) {
  if (SKIP.test(f) || !TEXT.has(extname(f).toLowerCase())) continue;
  const p = join(root, f);
  if (!existsSync(p)) continue;
  scanned++;
  readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const low = line.toLowerCase();
    for (const l of local) if (low.includes(l.value)) hits.push(f + ':' + (i + 1) + '  a value from infra/config.local.json (' + l.key + ')');
    for (const [kind, re] of PATTERNS) if (re.test(line)) hits.push(f + ':' + (i + 1) + '  looks like ' + kind);
  });
}

if (hits.length) {
  hits.forEach((h) => console.log('FAIL ' + h));
  console.log(hits.length + ' problem(s) in ' + scanned + ' files');
  process.exit(1);
}
console.log('public-safe: ok (' + scanned + ' text files checked' + (local.length ? ', including your local config values' : ', no local config found') + ')');
