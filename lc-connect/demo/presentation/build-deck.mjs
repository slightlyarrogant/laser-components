// Build the LC Connect client deck from the template + captured widget shots.
//
// Inputs (same dir):
//   _template.html        — slide markup with placeholders:
//                             /*__FONTS__*/      -> inlined @font-face CSS
//                             src="__IMG_<name>__" -> data: URI of demo/shots/<name>.png
//   fonts_embedded.css    — base64 @font-face rules (self-contained, offline)
//   ../shots/<name>.png   — the 6 captured widget cards
//
// Outputs (same dir):
//   _images.json          — { <name>: "data:image/png;base64,…" } (cache/inspect)
//   index.html            — fully self-contained slideshow (fonts + images inlined)
//   LC-Connect.pdf        — chrome --headless print of index.html (@page 1280x720)
//
// Run: node demo/presentation/build-deck.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, '..', 'shots');
const WIDGETS = ['analytics', 'map', 'dataset', 'kpi', 'messages', 'action'];

const template = fs.readFileSync(path.join(__dirname, '_template.html'), 'utf8');
const fonts = fs.readFileSync(path.join(__dirname, 'fonts_embedded.css'), 'utf8');

// 1. Encode each widget PNG to a data URI.
const images = {};
for (const name of WIDGETS) {
  const file = path.join(SHOTS, `${name}.png`);
  if (!fs.existsSync(file)) throw new Error(`missing shot: ${file} (run demo/capture.mjs first)`);
  images[name] = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}
fs.writeFileSync(path.join(__dirname, '_images.json'), JSON.stringify(images, null, 2));

// 2. Inline fonts + images into the template.
let html = template.replace('/*__FONTS__*/', () => fonts);
for (const name of WIDGETS) {
  const token = `__IMG_${name}__`;
  if (!html.includes(token)) throw new Error(`template missing placeholder ${token}`);
  html = html.split(token).join(images[name]);
}
const leftover = html.match(/__IMG_[a-z]+__|\/\*__FONTS__\*\//g);
if (leftover) throw new Error(`unfilled placeholders: ${[...new Set(leftover)].join(', ')}`);

const indexPath = path.join(__dirname, 'index.html');
fs.writeFileSync(indexPath, html);
console.log(`index.html  ${html.length} bytes, 0 placeholders`);

// 3. Render the PDF with headless Chrome (honours @page{size:1280px 720px;margin:0}).
const pdfPath = path.join(__dirname, 'LC-Connect.pdf');
const chrome = ['/usr/bin/google-chrome', 'google-chrome-stable', 'chromium'].find((c) => {
  try { execFileSync('test', ['-x', c]); return true; } catch { return c.indexOf('/') < 0; }
}) || '/usr/bin/google-chrome';
execFileSync(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--no-pdf-header-footer',
  `--print-to-pdf=${pdfPath}`,
  `file://${indexPath}`,
], { stdio: 'inherit' });

const kb = (fs.statSync(pdfPath).size / 1024).toFixed(0);
console.log(`LC-Connect.pdf  ${kb}KB`);
