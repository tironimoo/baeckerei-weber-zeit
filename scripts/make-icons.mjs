// Erzeugt die PNG-Symbole aus den SVG-Dateien (einmalig ausführen, Ergebnis liegt im Repository).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFile, writeFile } from 'node:fs/promises';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const jobs = [['icon.svg', 'icon-192.png', 192], ['icon.svg', 'icon-512.png', 512], ['icon-maskable.svg', 'icon-maskable-512.png', 512]];
for (const [src, dst, size] of jobs) {
  const svg = await readFile(`public/icons/${src}`, 'utf8');
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}"></body>`);
  await writeFile(`public/icons/${dst}`, await p.screenshot({ omitBackground: true }));
  await p.close();
}
// Quellbilder für die Android-App (capacitor-assets): Symbol, Vordergrund (Ähre), Hintergrund
const ear = (await readFile('public/icons/icon-maskable.svg', 'utf8')).match(/<g[\s\S]*<\/g>/)[0];
const extra = [
  ['icon-only.png', await readFile('public/icons/icon.svg', 'utf8')],
  ['icon-foreground.png', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(112 112) scale(9)" fill="#E4B04E">${ear.replace(/^<g[^>]*>/, '').replace(/<\/g>$/, '')}</g></svg>`],
  ['icon-background.png', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#3B2A1F"/></svg>'],
];
for (const [dst, svg] of extra) {
  const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  await p.setContent(`<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="1024" height="1024"></body>`);
  await writeFile(`assets/${dst}`, await p.screenshot({ omitBackground: true }));
  await p.close();
}
await b.close();
