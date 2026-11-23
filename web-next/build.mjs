// Bundles src/ into dist/ (index.html, app.js, app.css). Run before `cdk deploy`.
import { build } from 'esbuild';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [join(root, 'src', 'main.js')],
  bundle: true,
  minify: !process.env.NO_MINIFY,
  format: 'iife',
  target: ['es2020'],
  outfile: join(dist, 'app.js'),
  // The version shown in the sidebar comes from the root package.json, so it always matches the tag.
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(join(root, '..', 'package.json'), 'utf8')).version) },
  logLevel: 'info',
});
copyFileSync(join(root, 'src', 'styles.css'), join(dist, 'app.css'));
copyFileSync(join(root, 'src', 'index.html'), join(dist, 'index.html'));
if (existsSync(join(root, 'public'))) cpSync(join(root, 'public'), dist, { recursive: true });
console.log('web-next built to', dist);
