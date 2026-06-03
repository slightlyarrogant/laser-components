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

// A natural sales-analyst journey: overview -> drill into a sector -> drill into
// a company -> geographic view. Each turn should trigger a different connector
// widget. Company/sector names are REAL rows from the database.
const QUESTIONS = [
  'Using the LC Connect connector, give me the big picture of our customer base ' +
    '— how do our customers split by industry? Show it as a bar chart.',
  'Defense Electronics looks strong. Search our leads for the companies we have in that sector.',
  'Tell me more about PIT-RADWAR — what do we know about them?',
  'Now show me where our customers are located across Europe.',
];

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

// True while ChatGPT is still generating (the send button becomes a stop button).
async function isStreaming(page) {
  try {
    const c = await page.locator('[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label*="Zatrzymaj" i]').count();
    return c > 0;
  } catch { return false; }
}

// Wait for one assistant turn to finish: see streaming start, then stop. Falls
// back to a content/settle heuristic for instant/cached answers.
async function waitForTurnComplete(page, timeoutMs) {
  const start = Date.now();
  let sawStreaming = false, stoppedAt = 0;
  while (Date.now() - start < timeoutMs) {
    await dismissConnectorPrompts(page);
    const streaming = await isStreaming(page);
    if (streaming) { sawStreaming = true; stoppedAt = 0; }
    else if (sawStreaming) {
      if (!stoppedAt) stoppedAt = Date.now();
      if (Date.now() - stoppedAt > 2500) return true; // stable for a beat
    } else if (Date.now() - start > 9000) {
      return true; // never visibly streamed (instant answer) — proceed
    }
    await page.waitForTimeout(1200);
  }
  return false;
}

async function revealNewestWidget(page) {
  try {
    const frames = await page.$$('iframe');
    // Scroll to the NEWEST widget = the LAST iframe in DOM order whose bounding
    // box is tall enough to be a real widget (> 120px). On later turns the
    // tallest iframe may be an EARLIER (bigger) widget further up the page, which
    // would scroll back up instead of to the one just rendered.
    let newest = null;
    for (const f of frames) {
      const box = await f.boundingBox().catch(() => null);
      if (box && box.height > 120) newest = f;
    }
    if (newest) {
      await newest.scrollIntoViewIfNeeded().catch(() => {});
      await page.mouse.wheel(0, 200);
    } else {
      // No widget this turn — just scroll to the bottom so the answer shows.
      await page.keyboard.press('End').catch(() => {});
      await page.mouse.wheel(0, 600);
    }
  } catch {}
}

async function record() {
  if (!fs.existsSync(PROFILE_DIR)) { console.log('[record] No profile. Run login first.'); process.exit(2); }
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  const { ctx, page } = await launch(true);
  // Temporary chat ignores the account's Custom Instructions + memory, so the
  // connector's own instructions dominate and the model stays terse (no
  // "Facts and Evidence" preambles). Connectors remain available in temp chat.
  const CHAT_URL = process.env.LC_CHAT_URL || 'https://chatgpt.com/?temporary-chat=true';
  console.log(`[record] opening ${CHAT_URL} …`);
  await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});

  let user = null;
  for (let i = 0; i < 12 && !user; i++) { user = await sessionUser(page); if (!user) await page.waitForTimeout(2000); }
  if (!user) { console.log('[record] FAILED: not authenticated. Run login first.'); await ctx.close(); process.exit(2); }
  console.log(`[record] authenticated as ${user.email || user.name}.`);

  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape').catch(() => {});

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const composer = page.locator(COMPOSER_SEL).first();
    await composer.waitFor({ state: 'visible', timeout: 25000 });
    await composer.click();
    await page.waitForTimeout(400);
    await page.keyboard.type(q, { delay: 18 });
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    console.log(`[record] Q${i + 1} sent: ${q.slice(0, 60)}…`);

    const done = await waitForTurnComplete(page, 150000);
    console.log(`[record] Q${i + 1} turn ${done ? 'complete' : 'TIMEOUT'} — revealing widget.`);
    await page.waitForTimeout(1500);
    await revealNewestWidget(page);
    // Hold so the widget is readable in the recording, longer on the final turn.
    await page.waitForTimeout(i === QUESTIONS.length - 1 ? 4500 : 2800);
  }

  let videoPath = null;
  try { videoPath = await page.video()?.path(); } catch {}
  await ctx.close();

  const vids = fs.existsSync(VIDEO_DIR)
    ? fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'))
        .map((f) => ({ f, t: fs.statSync(path.join(VIDEO_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t)
    : [];
  console.log(`[record] saved video: ${vids[0] ? path.join(VIDEO_DIR, vids[0].f) : videoPath}`);
}

const fn = MODE === 'record' ? record : MODE === 'login' ? login : null;
if (!fn) { console.log('usage: node demo/chatgpt-record.mjs [login|record]'); process.exit(1); }
fn().catch((e) => { console.error('[fatal]', e && e.message ? e.message : e); process.exit(1); });
