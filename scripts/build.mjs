import { build } from 'esbuild';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({ entryPoints: [path.join(root, 'src/App.jsx')], bundle: true, write: false,
  minify: true, legalComments: 'inline', charset: 'utf8', target: ['es2020'], format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } });
const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#09090b"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Дневник питания">
<meta name="description" content="Личный дневник питания: КБЖУ по дням, продукты по категориям и резервные копии.">
<title>Дневник питания</title><style>${css}</style></head><body><div id="root"></div><noscript>Для работы дневника включите JavaScript в браузере.</noscript><script>${js}</script></body></html>`;
await mkdir(path.join(root, 'dist'), { recursive: true });
const web = await build({ entryPoints: { app: path.join(root, 'src/App.jsx'), vendor: path.join(root, 'src/vendor.mjs') },
  bundle: true, splitting: true, format: 'esm', outdir: path.join(root, 'assets'), write: false,
  minify: true, legalComments: 'inline', charset: 'utf8', target: ['es2020'],
  entryNames: '[name]-[hash]', chunkNames: 'shared-[hash]', define: { 'process.env.NODE_ENV': '"production"' } });
const appFile = web.outputFiles.find(file => path.basename(file.path).startsWith('app-'));
// Keep previously published hashed modules available for cached pages during updates.
await rm(path.join(root, 'dist/assets'), { recursive: true, force: true });
await mkdir(path.join(root, 'assets'), { recursive: true });
await mkdir(path.join(root, 'dist/assets'), { recursive: true });
for (const file of web.outputFiles) {
  const name = path.basename(file.path);
  if (name.startsWith('vendor-')) continue; // Only the shared module is loaded by the application.
  await writeFile(path.join(root, 'assets', name), file.contents);
  await writeFile(path.join(root, 'dist/assets', name), file.contents);
}
const hostedHtml = html.slice(0, html.indexOf('<script>')) + `<script type="module" src="./assets/${path.basename(appFile.path)}"></script></body></html>`;
const hostedWithIcons = hostedHtml.replace('</head>', '<link rel="apple-touch-icon" sizes="180x180" href="icon-180.png"><link rel="icon" type="image/png" sizes="192x192" href="icon-192.png"><link rel="manifest" href="manifest.webmanifest"></head>');
await writeFile(path.join(root, 'index.html'), hostedWithIcons);
await writeFile(path.join(root, 'dist/index.html'), hostedWithIcons);
await writeFile(path.join(root, 'Дневник-питания.html'), html);
console.log(`Ready: index.html + Дневник-питания.html (${Math.round(Buffer.byteLength(html) / 1024)} KB), no CDN dependencies.`);
