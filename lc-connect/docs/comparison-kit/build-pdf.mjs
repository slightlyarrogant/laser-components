// Build LC-Connect-Comparison.pdf (A4) from LC-Connect-Comparison.md.
// Run from lc-connect/: node docs/comparison-kit/build-pdf.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const dir = path.dirname(fileURLToPath(import.meta.url));
const md = path.join(dir, 'LC-Connect-Comparison.md');
const body = execFileSync('python3', ['-m', 'markdown', '-x', 'tables', md], { encoding: 'utf8' });
const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Mono&display=swap');
:root{--ink:#14213a;--muted:#5b6478;--rule:#d9dde5;--rule-strong:#b9c0cd;--accent:#c9861f;--accent-soft:#fbf1e0;--accent-ink:#8a5a0e}
body{margin:0;background:#fff;color:var(--ink);font-family:"IBM Plex Sans",Helvetica,Arial,sans-serif;font-size:10.5pt;line-height:1.45}
h1,h2,h3{font-family:"IBM Plex Sans Condensed","IBM Plex Sans",sans-serif;font-weight:600}
h1{font-size:24pt;margin:0 0 10px}
h2{font-size:15pt;margin:26px 0 8px;padding-top:8px;border-top:2px solid var(--ink);break-after:avoid}
h3{font-size:11.5pt;margin:16px 0 6px;break-after:avoid}
p,li{max-width:none} code{font-family:"IBM Plex Mono",monospace;font-size:.88em;background:var(--accent-soft);color:var(--accent-ink);padding:0 4px;border-radius:3px}
table{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:8.8pt}
th,td{text-align:left;vertical-align:top;padding:4px 6px 4px 0;border-bottom:1px solid var(--rule)}
th{font-family:"IBM Plex Mono",monospace;font-weight:500;font-size:7.8pt;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-bottom:1px solid var(--rule-strong)}
tr{break-inside:avoid}
img{max-width:100%;border:1px solid var(--rule);margin-top:6px}
p:has(> img){break-inside:avoid}
em{color:var(--muted)}
`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>LC Connect Comparison</title><style>${css}</style></head><body>${body}</body></html>`;
const out = path.join(dir, 'LC-Connect-Comparison.html');
fs.writeFileSync(out, html);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(out).href, { waitUntil: 'networkidle' });
await page.pdf({ path: path.join(dir, 'LC-Connect-Comparison.pdf'), format: 'A4', printBackground: true,
  margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:7pt;color:#5b6478;width:100%;text-align:center;font-family:sans-serif">LC Connect Comparison Kit · page <span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
await browser.close();
fs.unlinkSync(out);
console.log('pdf written');
