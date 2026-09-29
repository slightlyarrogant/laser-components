// Comparison-kit runner: the same prompt in Claude.ai and ChatGPT, WITH and WITHOUT
// the LC Connect connector, captured verbatim (text + full-page screenshot + timing)
// into docs/comparison-kit/raw/.
//
// Uses persistent Playwright profiles (gitignored):
//   demo/.chatgpt-profile   (shared with chatgpt-record.mjs)
//   demo/.claude-profile
//
//   node demo/compare-run.mjs check                         # are both sessions logged in?
//   node demo/compare-run.mjs login chatgpt|claude          # headed window; YOU log in; never types credentials
//   node demo/compare-run.mjs run <chatgpt|claude> <with|without> <q1|q2>
//   node demo/compare-run.mjs all                           # all 8 runs, sequentially
//
// LC Connect sign-in: if a run opens our OAuth page, the script fills Łukasz Abramek's
// account from demo/ACCESS.local.md — ONLY when the page host is lasercomponents.ngrok.app.
// Any other sign-in host stops the run.
//
// NOTE: connector-toggle selectors were written without a logged-in session to test
// against. Each run saves a screenshot of the tools menu state (<run>_toggle.png) so the
// WITH/WITHOUT state is evidenced; if the toggle is not found, the run aborts rather than guess.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'docs', 'comparison-kit', 'raw');
const VIEW = { width: 1440, height: 900 };
const LC_HOST = 'lasercomponents.ngrok.app';
const CONNECTOR = /LC\s*Connect/i;

export const PROMPTS = {
  q1: 'List companies in Poland that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.',
  q2: 'List companies in the Czech Republic that use pulsed laser diodes (PLD, 905 nm or 1550 nm) in their products, for example laser rangefinders, LiDAR or proximity fuzes. For each company give: name, city, the product or application, and how confident you are.',
};

const P = {
  chatgpt: {
    profile: path.join(__dirname, '.chatgpt-profile'),
    home: 'https://chatgpt.com/',
    newChat: 'https://chatgpt.com/',
    composer: '#prompt-textarea, div[contenteditable="true"]#prompt-textarea, textarea[data-testid="prompt-textarea"]',
    streaming: '[data-testid="stop-button"], button[aria-label*="Stop" i]',
    answer: '[data-message-author-role="assistant"]',
    toolsBtn: 'button[data-testid="composer-plus-btn"], button[aria-label*="Add files and more" i], button[aria-label*="Tools" i]',
    async loggedIn(page) {
      try {
        return await page.evaluate(async () => {
          const r = await fetch('/api/auth/session', { credentials: 'include' });
          if (!r.ok) return false; const j = await r.json(); return !!(j && j.user);
        });
      } catch { return false; }
    },
  },
  claude: {
    profile: path.join(__dirname, '.claude-profile'),
    home: 'https://claude.ai/',
    newChat: 'https://claude.ai/new',
    composer: 'div[contenteditable="true"].ProseMirror, div[contenteditable="true"][role="textbox"], [data-testid="chat-input"]',
    streaming: 'button[aria-label*="Stop" i], [data-is-streaming="true"]',
    answer: '.font-claude-response, .font-claude-message, [data-testid="assistant-message"]',
    toolsBtn: 'button[data-testid="input-menu-tools"], button[aria-label*="tools" i], button[aria-label*="connectors" i]',
    async loggedIn(page) {
      try {
        return await page.evaluate(async () => {
          const r = await fetch('/api/organizations', { credentials: 'include' });
          return r.ok;
        });
      } catch { return false; }
    },
  },
};

function lcCredentials() {
  const t = fs.readFileSync(path.join(__dirname, 'ACCESS.local.md'), 'utf8');
  const sec = t.split(/^## /m).find((s) => s.startsWith('Łukasz Abramek'));
  if (!sec) throw new Error('ACCESS.local.md: section "Łukasz Abramek" not found');
  const email = (sec.match(/Email:\s*(\S+)/) || [])[1];
  const password = (sec.match(/Password:\s*(\S+)/) || [])[1];
  if (!email || !password) throw new Error('ACCESS.local.md: email/password not found');
  return { email, password };
}

async function launch(product, headless = false) {
  const cfg = P[product];
  fs.mkdirSync(cfg.profile, { recursive: true });
  const ctx = await chromium.launchPersistentContext(cfg.profile, {
    headless, channel: 'chrome', viewport: VIEW,
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  return { ctx, page, cfg };
}

async function check() {
  const out = {};
  for (const product of ['chatgpt', 'claude']) {
    const { ctx, page, cfg } = await launch(product);
    await page.goto(cfg.home, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(6000);
    const ok = await cfg.loggedIn(page);
    const shot = path.join(RAW, `session-check_${product}.png`);
    await page.screenshot({ path: shot }).catch(() => {});
    out[product] = { loggedIn: ok, url: page.url(), title: await page.title().catch(() => '') };
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  return out;
}

async function login(product) {
  const { ctx, page, cfg } = await launch(product);
  await page.goto(cfg.home, { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log(`[login] ${product}: log in in the window; waiting up to 15 min (credentials are never typed by this script).`);
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    if (await cfg.loggedIn(page)) { console.log(`[login] ${product}: OK`); await page.waitForTimeout(2000); await ctx.close(); return; }
    await page.waitForTimeout(3000);
  }
  console.log(`[login] ${product}: timed out`); await ctx.close(); process.exit(2);
}

// Handle our own OAuth sign-in (popup or same tab). Never types anywhere else.
function attachSignIn(ctx, log) {
  const handle = async (p) => {
    try {
      await p.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
      const host = new URL(p.url()).host;
      const hasPwd = await p.locator('input[type="password"]').count().catch(() => 0);
      if (!hasPwd) return;
      if (host !== LC_HOST) { log.signInBlocked = host; log.events.push(`sign-in form on foreign host ${host} — NOT filled`); return; }
      const { email, password } = lcCredentials();
      await p.fill('#email', email); await p.fill('#password', password);
      await p.click('button[type="submit"]');
      log.events.push(`signed in to LC Connect on ${LC_HOST}`);
    } catch (e) { log.events.push(`sign-in handler error: ${e.message}`); }
  };
  ctx.on('page', (p) => { p.on('load', () => handle(p)); });
  for (const p of ctx.pages()) p.on('load', () => handle(p));
}

async function approvePrompts(page, log) {
  for (const t of ['Always allow', 'Allow always', 'Allow once', 'Allow', 'Confirm', 'Connect', 'Continue']) {
    try {
      const b = page.getByRole('button', { name: new RegExp(`^${t}$`, 'i') });
      if (await b.count()) { await b.first().click({ timeout: 1500 }); log.events.push(`clicked "${t}"`); }
    } catch {}
  }
}

// Open the composer tools menu, find the LC Connect entry, set it on/off, screenshot as evidence.
async function setConnector(page, cfg, want, product, tag, log) {
  const btn = page.locator(cfg.toolsBtn).first();
  if (!(await btn.count())) { log.events.push('tools button not found'); return false; }
  await btn.click(); await page.waitForTimeout(1200);
  if (product === 'chatgpt') {
    // ChatGPT: "+" menu → "More" → apps/connectors list
    const more = page.getByRole('menuitem', { name: /^More$/i });
    if (await more.count()) { await more.first().hover(); await page.waitForTimeout(800); }
  }
  const item = page.getByText(CONNECTOR).first();
  if (!(await item.count())) {
    await page.screenshot({ path: path.join(RAW, `${tag}_toggle.png`) });
    if (!want) { log.events.push('LC Connect not listed in tools menu → treated as not enabled'); await page.keyboard.press('Escape'); return true; }
    log.events.push('LC Connect entry not found in tools menu'); await page.keyboard.press('Escape'); return false;
  }
  const row = item.locator('xpath=ancestor::*[@role="menuitem" or @role="menuitemcheckbox" or @role="option" or self::button or self::label][1]');
  const sw = row.locator('[role="switch"], input[type="checkbox"], [aria-checked]').first();
  let state = null;
  if (await sw.count()) state = (await sw.getAttribute('aria-checked')) ?? String(await sw.isChecked().catch(() => null));
  else if (await row.count()) state = await row.getAttribute('aria-checked');
  const on = state === 'true';
  log.events.push(`connector state before: ${state}`);
  if (product === 'chatgpt' && state === null) {
    // ChatGPT apps are "picked" per message; picking = enabled for this chat.
    if (want) { await item.click(); log.events.push('picked LC Connect app for this chat'); }
    else await page.keyboard.press('Escape');
  } else if (on !== want) { await (await sw.count() ? sw : row).click(); log.events.push(`toggled connector → ${want}`); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(RAW, `${tag}_toggle.png`) });
  await page.keyboard.press('Escape').catch(() => {});
  return true;
}

async function waitDone(page, cfg, log, timeoutMs = 180000) {
  const t0 = Date.now(); let saw = false, stopAt = 0;
  while (Date.now() - t0 < timeoutMs) {
    await approvePrompts(page, log);
    const s = (await page.locator(cfg.streaming).count().catch(() => 0)) > 0;
    if (s) { saw = true; stopAt = 0; }
    else if (saw) { if (!stopAt) stopAt = Date.now(); if (Date.now() - stopAt > 4000) return true; }
    else if (Date.now() - t0 > 20000) return true;
    await page.waitForTimeout(1500);
  }
  return false;
}

async function run(product, mode, q) {
  const tag = `${product}_${mode}_${q}`;
  const log = { product, mode, question: q, prompt: PROMPTS[q], startedAt: new Date().toISOString(), events: [] };
  const { ctx, page, cfg } = await launch(product);
  attachSignIn(ctx, log);
  try {
    await page.goto(cfg.newChat, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);
    if (!(await cfg.loggedIn(page))) { log.error = 'not logged in'; return log; }
    // Model label shown in the UI (best effort)
    log.modelLabel = await page.locator('[data-testid="model-switcher-dropdown-button"], button[data-testid*="model-selector" i]').first().innerText({ timeout: 3000 }).catch(() => null);
    const ok = await setConnector(page, cfg, mode === 'with', product, tag, log);
    if (!ok) { log.error = 'could not set connector state'; return log; }
    const composer = page.locator(cfg.composer).first();
    await composer.waitFor({ state: 'visible', timeout: 25000 });
    await composer.click();
    await page.keyboard.insertText(PROMPTS[q]);
    await page.waitForTimeout(500);
    const tSend = Date.now();
    await page.keyboard.press('Enter');
    const done = await waitDone(page, cfg, log);
    log.responseSeconds = Math.round((Date.now() - tSend) / 1000);
    log.completed = done;
    if (log.signInBlocked) log.error = `sign-in requested on foreign host ${log.signInBlocked}`;
    await page.waitForTimeout(2000);
    const answers = page.locator(cfg.answer);
    const n = await answers.count();
    log.answerText = n ? await answers.nth(n - 1).innerText() : '';
    // Evidence whether the connector was actually called in this turn
    const body = await page.locator('main').innerText().catch(() => '');
    log.connectorMentionedOnPage = CONNECTOR.test(body);
    log.iframeWidgets = await page.locator('iframe').count();
    log.chatUrl = page.url();
    fs.writeFileSync(path.join(RAW, `${tag}.txt`), `PROMPT:\n${PROMPTS[q]}\n\nANSWER (verbatim, innerText):\n${log.answerText}\n`);
    await page.screenshot({ path: path.join(RAW, `${tag}.png`), fullPage: true });
    // Chat UIs scroll inside a container; also save a tall capture of the thread.
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY.match(/auto|scroll/));
      els.sort((a, b) => b.scrollHeight - a.scrollHeight);
      const s = els[0]; if (s) { s.style.height = s.scrollHeight + 'px'; s.style.maxHeight = 'none'; s.style.overflow = 'visible'; }
      document.documentElement.style.height = 'auto'; document.body.style.height = 'auto'; document.body.style.overflow = 'visible';
    }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(RAW, `${tag}_full.png`), fullPage: true }).catch(() => {});
  } catch (e) { log.error = e.message; }
  finally {
    log.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(RAW, `${tag}.json`), JSON.stringify(log, null, 1));
    await ctx.close();
  }
  console.log(`[run] ${tag}: ${log.error ? 'ERROR ' + log.error : 'ok'} (${log.responseSeconds ?? '-'} s)`);
  return log;
}

fs.mkdirSync(RAW, { recursive: true });
const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === 'check') await check();
else if (cmd === 'login') await login(a);
else if (cmd === 'run') await run(a, b, c);
else if (cmd === 'all') {
  for (const product of ['claude', 'chatgpt']) for (const q of ['q1', 'q2']) for (const mode of ['without', 'with']) await run(product, mode, q);
} else console.log('usage: check | login <chatgpt|claude> | run <chatgpt|claude> <with|without> <q1|q2> | all');
