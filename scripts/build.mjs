// Baut die App nach dist/: ein gebündeltes Skript, ein Stylesheet, Schriften, Symbole, Installationsdateien.
import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;

const out = 'dist';
await rm(out, { recursive: true, force: true });
await mkdir(`${out}/fonts`, { recursive: true });

await build({ entryPoints: { app: 'src/main.js' }, bundle: true, minify: true, format: 'iife', target: 'es2020', outdir: out, logLevel: 'warning', define: { __APP_VERSION__: JSON.stringify(version) } });
await build({ entryPoints: { app: 'src/styles.css' }, bundle: false, minify: true, outdir: out, logLevel: 'warning' });

const fonts = ['figtree-latin-400-normal', 'figtree-latin-600-normal', 'figtree-latin-700-normal'];
for (const f of fonts) await cp(`node_modules/@fontsource/figtree/files/${f}.woff2`, `${out}/fonts/${f}.woff2`);
await cp('node_modules/@fontsource/young-serif/files/young-serif-latin-400-normal.woff2', `${out}/fonts/young-serif-latin-400-normal.woff2`);
await cp('public/icons', `${out}/icons`, { recursive: true });
await cp('public/manifest.webmanifest', `${out}/manifest.webmanifest`);

const js = await readFile(`${out}/app.js`);
const css = await readFile(`${out}/app.css`);
const build_id = createHash('sha256').update(js).update(css).digest('hex').slice(0, 10);
for (const [src, dst] of [['index.html', 'index.html'], ['public/sw.js', 'sw.js']]) {
  const t = (await readFile(src, 'utf8')).replaceAll('__BUILD__', build_id);
  await writeFile(`${out}/${dst}`, t);
}
await writeFile(`${out}/.nojekyll`, '');
console.log('Gebaut:', build_id, `(${(js.length / 1024).toFixed(0)} KB Skript)`);
