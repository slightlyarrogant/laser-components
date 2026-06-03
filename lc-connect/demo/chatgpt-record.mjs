// Drive a REAL ChatGPT session with the LC Connect connector in Playwright and
// record the interaction as video (later sped up by ffmpeg into the deck animation).
//
// Why Playwright (not the in-Chrome extension): Playwright records native video
// to disk reliably and reuses a persistent login profile.
//
// Phases:
//   node demo/chatgpt-record.mjs login    # headed window that STAYS OPEN and stable
//                                          # while YOU complete the OpenAI/Google login
//                                          # (cross-domain redirects included). The
//                                          # script NEVER types credentials and never
//                                          # closes the window mid-login — it polls the
//                                          # /api/auth/session endpoint (UI-independent)
//                                          # and only finishes once you are authenticated.
//   node demo/chatgpt-record.mjs record   # already logged in; asks the English question,
//                                          # waits for the connector widget, saves the .webm
//
// Profile + video live under demo/ (gitignored).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, '.chatgpt-profile');
const VIDEO_DIR = path.join(__dirname, 'video');
const STATE_FILE = path.join(__dirname, 'chatgpt-state.json');
const VIEW = { width: 1440, height: 900 };
const MODE = process.argv[2] || 'login';

const QUESTION =
  'Using the LC Connect connector, give me a breakdown of how many customers ' +
  'we have per industry / application, shown as a bar chart.';

const COMPOSER_SEL = 'div[contenteditable="true"]#prompt-textarea, #prompt-textarea, textarea[data-testid="prompt-textarea"]';

// UI-independent auth check: NextAuth session endpoint returns { user, expires }
// when logged in, or {} when not. Cross-origin during the Google redirect → caught.
async function sessionUser(page) {
  try {
    const data = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/auth/session', { credentials: 'include' });
        if (!r.ok) return null;
        return await r.json();
      } catch { return null; }
    });
    return data && data.user ? data.user : null;
  } catch { return null; }
}

async function launch(record) {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: 'chrome',
    viewport: VIEW,
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
    ...(record ? { recordVideo: { dir: VIDEO_DIR, size: VIEW } } : {}),
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.setViewportSize(VIEW).catch(() => {});
  return { ctx, page };
}

async function login() {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const { ctx, page } = await launch(false);
  console.log('[login] opening chatgpt.com — the window stays open until you are logged in.');
  await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

  const deadline = Date.now() + 15 * 60 * 1000;
  let lastMsg = 0;
  while (Date.now() < deadline) {
    const user = await sessionUser(page);
    if (user) {
      console.log(`[login] OK — authenticated as ${user.email || user.name || 'user'}.`);
      // Persist a storageState backup too (belt and suspenders).
      try { await ctx.storageState({ path: STATE_FILE }); console.log(`[login] saved ${STATE_FILE}`); } catch {}
      await page.waitForTimeout(2500);
      await ctx.close();
      console.log('[login] done. Next:  node demo/chatgpt-record.mjs record');
      return;
    }
    if (Date.now() - lastMsg > 20000) {
      let url = '';
      try { url = page.url(); } catch {}
      console.log(`[login] not authenticated yet (at ${url || 'page'}). Complete the login in the window; I am waiting…`);
      lastMsg = Date.now();
    }
    await page.waitForTimeout(2500);
  }
  console.log('[login] FAILED: timed out after 15 min without authentication.');
  await ctx.close();
  process.exit(2);
}

async function dismissConnectorPrompts(page) {
  for (const t of ['Allow', 'Zezwól', 'Always allow', 'Zawsze zezwalaj', 'Confirm', 'Potwierdź', 'Run', 'Uruchom']) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(`^${t}$`, 'i') });
      if (await btn.count()) { await btn.first().click({ timeout: 1200 }); console.log(`[record] clicked "${t}"`); }
    } catch {}
  }
}

async function record() {
  if (!fs.existsSync(PROFILE_DIR)) { console.log('[record] No profile. Run login first.'); process.exit(2); }
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  const { ctx, page } = await launch(true);
  console.log('[record] opening chatgpt.com …');
  await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

  // Confirm auth via the session endpoint (UI-independent).
  let user = null;
  for (let i = 0; i < 12 && !user; i++) { user = await sessionUser(page); if (!user) await page.waitForTimeout(2000); }
  if (!user) { console.log('[record] FAILED: not authenticated. Run login first.'); await ctx.close(); process.exit(2); }
  console.log(`[record] authenticated as ${user.email || user.name}.`);

  // Make sure we are on a fresh chat and the composer is present & interactive.
  await page.waitForTimeout(1500);
  // Dismiss a stray no-auth modal if one appears (Escape is harmless when none).
  await page.keyboard.press('Escape').catch(() => {});

  const composer = page.locator(COMPOSER_SEL).first();
  await composer.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(800);

  // Type via locator (re-resolves; survives React re-renders) then send.
  await composer.click();
  await page.keyboard.type(QUESTION, { delay: 26 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  console.log('[record] question sent; waiting for connector response + widget …');

  const start = Date.now();
  let widgetSeen = false;
  while (Date.now() - start < 150000) {
    await dismissConnectorPrompts(page);
    try {
      const frames = await page.$$('iframe');
      for (const f of frames) {
        const box = await f.boundingBox().catch(() => null);
        const src = (await f.getAttribute('src').catch(() => '')) || '';
        if (box && box.height > 120 && (/sandbox|oaiusercontent|web-sandbox/i.test(src) || src === '')) widgetSeen = true;
      }
    } catch {}
    if (widgetSeen) break;
    await page.waitForTimeout(1500);
  }
  console.log(widgetSeen ? '[record] widget iframe detected — letting it settle.' : '[record] no widget detected within timeout (saving video anyway).');

  // Let streaming finish, then reveal the FULL widget (it renders below the fold,
  // partly hidden by the composer). Scroll the tallest connector iframe into view
  // and nudge up so the whole bar chart is visible for the final frames.
  await page.waitForTimeout(2500);
  try {
    const frames = await page.$$('iframe');
    let tallest = null, maxH = 0;
    for (const f of frames) {
      const box = await f.boundingBox().catch(() => null);
      if (box && box.height > maxH) { maxH = box.height; tallest = f; }
    }
    if (tallest) {
      await tallest.scrollIntoViewIfNeeded().catch(() => {});
      await page.mouse.wheel(0, 220);
      await page.waitForTimeout(1200);
    }
  } catch {}
  // Hold the final composed frame.
  await page.waitForTimeout(3500);
  let videoPath = null;
  try { videoPath = await page.video()?.path(); } catch {}
  await ctx.close();

  const vids = fs.existsSync(VIDEO_DIR)
    ? fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'))
        .map((f) => ({ f, t: fs.statSync(path.join(VIDEO_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t)
    : [];
  console.log(`[record] saved video: ${vids[0] ? path.join(VIDEO_DIR, vids[0].f) : videoPath}`);
  console.log('[record] widgetSeen=' + widgetSeen);
}

const fn = MODE === 'record' ? record : MODE === 'login' ? login : null;
if (!fn) { console.log('usage: node demo/chatgpt-record.mjs [login|record]'); process.exit(1); }
fn().catch((e) => { console.error('[fatal]', e && e.message ? e.message : e); process.exit(1); });
