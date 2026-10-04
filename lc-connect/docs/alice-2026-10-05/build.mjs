// Build LC-Connect-briefing-2026-10-05.html (self-contained: Ubuntu fonts embedded,
// diagram inlined) and render the 16:9 PDF with Playwright Chromium.
// Run: node lc-connect/docs/alice-2026-10-05/build.mjs
import pw from '/home/bogdan/node_modules/playwright/index.js';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = pw;
const dir = path.dirname(fileURLToPath(import.meta.url));
const F = '/usr/share/fonts/truetype/ubuntu/';
const face = (fam, w, file) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/ttf;base64,${readFileSync(F + file).toString('base64')}) format('truetype');}`;
const fonts = [face('Ubuntu', 300, 'Ubuntu-L.ttf'), face('Ubuntu', 400, 'Ubuntu-R.ttf'), face('Ubuntu', 500, 'Ubuntu-M.ttf'),
  face('Ubuntu Mono', 400, 'UbuntuMono-R.ttf')].join('\n');
const svg = readFileSync(path.join(dir, 'harness-diagram.svg'), 'utf8').replace(/^<\?xml[^>]*>\s*/, '');
const html = readFileSync(path.join(dir, 'briefing.src.html'), 'utf8').replace('/*FONTS*/', fonts).replace('<!--DIAGRAM-->', svg);
const out = path.join(dir, 'LC-Connect-briefing-2026-10-05.html');
writeFileSync(out, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.emulateMedia({ media: 'print', colorScheme: 'light' });
await page.goto(pathToFileURL(out).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
// overflow check: any element whose box escapes its slide
const issues = await page.evaluate(() => [...document.querySelectorAll('.slide')].flatMap((s, i) => {
  const r = s.getBoundingClientRect(); const out = [];
  s.querySelectorAll('*').forEach(e => { const b = e.getBoundingClientRect();
    if (b.width && (b.bottom > r.bottom + 0.5 || b.right > r.right + 0.5)) out.push(`slide ${i + 1}: <${e.tagName.toLowerCase()} class="${e.className?.baseVal ?? e.className}">`); });
  if (s.scrollHeight > s.clientHeight + 1) out.push(`slide ${i + 1}: content taller than slide`);
  return out; }));
console.log(issues.length ? issues.join('\n') : 'no overflow');
await page.pdf({ path: path.join(dir, 'LC-Connect-briefing-2026-10-05.pdf'), width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('written', out);
