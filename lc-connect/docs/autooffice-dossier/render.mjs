// Render dossier.html to A4 PDF with a running Ubuntu wordmark + page number.
// The footer template does not inherit page fonts, so Ubuntu is embedded there
// as an inline @font-face data URI.
import pw from '/home/bogdan/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const DIR = '/home/bogdan/Desktop/Projects/laser_components/lc-connect/docs/autooffice-dossier';
const b64 = (p) => readFileSync(p).toString('base64');

const ubuntuR = b64('/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf');
const ubuntuL = b64('/usr/share/fonts/truetype/ubuntu/Ubuntu-L.ttf');
const ubuntuMono = b64('/usr/share/fonts/truetype/ubuntu/UbuntuMono-R.ttf');

const fontCss = `
@font-face{font-family:'UbuntuEmbed';font-weight:400;src:url(data:font/ttf;base64,${ubuntuR}) format('truetype');}
@font-face{font-family:'UbuntuEmbed';font-weight:300;src:url(data:font/ttf;base64,${ubuntuL}) format('truetype');}
@font-face{font-family:'UbuntuMonoEmbed';font-weight:400;src:url(data:font/ttf;base64,${ubuntuMono}) format('truetype');}
`;

const footerTemplate = `
<style>${fontCss}
  #ft{
    width:100%;
    font-family:'UbuntuEmbed', sans-serif;
    font-size:8pt;
    color:#3a3d42;
    padding:0 20mm;
    box-sizing:border-box;
    display:flex;
    align-items:baseline;
    justify-content:space-between;
    border-top:0;
  }
  #ft .wm{ font-weight:300; font-size:9.5pt; letter-spacing:-.01em; color:#3a3d42; }
  #ft .mid{ font-family:'UbuntuMonoEmbed', monospace; font-size:6.8pt; letter-spacing:.12em; color:#9aa0a6; text-transform:uppercase; }
  #ft .pn{ font-family:'UbuntuMonoEmbed', monospace; font-size:7.6pt; color:#71767d; letter-spacing:.06em; }
</style>
<div id="ft">
  <span class="wm">autooffice</span>
  <span class="mid">COMPANY DOSSIER &middot; SEPTEMBER 2026 &middot; CONFIDENTIAL</span>
  <span class="pn"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;

const headerTemplate = `<style>#hd{display:none}</style><div id="hd"></div>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(DIR, 'dossier.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

await page.pdf({
  path: path.join(DIR, 'AutoOffice-Company-Dossier.pdf'),
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate,
  footerTemplate,
  margin: { top: '17mm', right: '20mm', bottom: '15mm', left: '20mm' },
});

await browser.close();
console.log('rendered');
