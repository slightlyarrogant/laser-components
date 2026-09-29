// Build LC-Connect-Comparison-Sales.pdf (A4) from LC-Connect-Comparison-Sales.html.
// Run from lc-connect/: node docs/comparison-kit/build-sales-pdf.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(dir, 'LC-Connect-Comparison-Sales.html');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.emulateMedia({ media: 'print', colorScheme: 'light' });
await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: path.join(dir, 'LC-Connect-Comparison-Sales.pdf'), format: 'A4', printBackground: true,
  preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:7pt;color:#5b6478;width:100%;text-align:center;font-family:sans-serif">LC Connect · Same question, with and without · page <span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
await browser.close();
console.log('pdf written');
