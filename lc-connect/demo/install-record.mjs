// Record the REAL ChatGPT connector-install flow for the demo film, end to end.
// Every step waits for its target element before acting (deterministic order,
// no auto-wait bloat):
//   profile card -> Settings -> Apps -> Advanced settings -> Developer mode (on)
//   -> Create app -> fill form (Name + MCP URL + checkbox) -> Create
//   -> the connector's OAuth "Sign in" screen (shown, NOT logged in).
//
//   node demo/install-record.mjs        # records demo/video-install/*.webm

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, '.chatgpt-profile');
const VIDEO_DIR = path.join(__dirname, 'video-install');
const VIEW = { width: 1440, height: 900 };
const BASE = 'https://lasercomponents.ngrok.app';
const MCP_URL = `${BASE}/mcp`;
const NAME = 'LC Connect';
const TO = 12000;

async function authorizeUrl() {
  const r = await fetch(`${BASE}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'], client_name: 'ChatGPT' }),
  });
  const { client_id } = await r.json();
  const u = new URL(`${BASE}/authorize`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', client_id);
  u.searchParams.set('redirect_uri', 'https://chatgpt.com/connector_platform_oauth_redirect');
  u.searchParams.set('state', 'demo');
  u.searchParams.set('scope', 'lc:read lc:write');
  return u.toString();
}

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false, channel: 'chrome', viewport: VIEW,
  args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
  recordVideo: { dir: VIDEO_DIR, size: VIEW },
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.setViewportSize(VIEW).catch(() => {});
const dlg = () => page.locator('[role="dialog"]').last();
const pause = (ms) => page.waitForTimeout(ms);

// Click a locator only once it is visible; pace with a short hold first.
async function show(locator, hold = 700) {
  await locator.waitFor({ state: 'visible', timeout: TO });
  await locator.hover().catch(() => {});
  await pause(hold);
}

async function main() {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  const oauth = await authorizeUrl();

  await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
  await pause(2500);

  // 1) Profile card (a <div>, hence force) -> Settings.
  const profile = page.locator('div[aria-label*="profile menu" i], #accounts-profile-button').first();
  await show(profile, 900);
  await profile.click({ force: true });
  const settings = page.getByRole('menuitem', { name: /^Settings$/i }).first();
  await show(settings, 800);
  await settings.click();

  // 2) Apps tab.
  await dlg().waitFor({ state: 'visible', timeout: TO });
  const apps = dlg().getByText(/^Apps$/i).first();
  await show(apps, 900);
  await apps.click();

  // 3) Advanced settings -> Developer mode (off, then on, to show enabling it).
  const adv = dlg().getByText(/Advanced settings/i).first();
  await show(adv, 1000);
  await adv.click();
  // Show the Developer mode toggle (already on) with the cursor on it — narration
  // explains "turn Developer mode on". (Toggling it off/on destabilises the modal,
  // so we present it rather than flip it.)
  const devSwitch = dlg().locator('button[role="switch"]').first();
  await show(devSwitch, 2600);

  // Back to the Apps panel, where "Create app" opens the form reliably.
  const back = dlg().getByRole('button', { name: /^Back$/i }).first();
  await show(back, 900);
  await back.click();

  // 4) Create app (from the Apps panel).
  const createApp = dlg().getByRole('button', { name: /^Create app$/i }).first();
  await show(createApp, 900);
  await createApp.click();

  // 5) Fill the one form. Name = first text input (placeholder varies:
  // "Name" / "Custom Tool"); URL = the example.com/sse field.
  const nameInput = dlg().getByPlaceholder(/^Custom Tool$|^Name$/i).first();
  await show(nameInput, 800);
  await nameInput.click();
  await page.keyboard.type(NAME, { delay: 80 });
  await pause(600);
  const urlInput = dlg().getByPlaceholder(/example\.com\/sse/i).first();
  await urlInput.click();
  await page.keyboard.type(MCP_URL, { delay: 45 });
  await pause(700);
  const box = dlg().locator('input[type="checkbox"]').first();
  if (await box.count()) await box.click().catch(() => {});
  await pause(1100);

  // 6) Create.
  const create = dlg().getByRole('button', { name: /^Create$/i }).first();
  await show(create, 1200);
  await create.click({ timeout: 5000 }).catch(() => {});
  await pause(2600);

  // 7) The genuine OAuth "Sign in" screen — shown, not filled.
  await page.goto(oauth, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pause(1100);
  await page.locator('#email').hover().catch(() => {});
  await pause(4200);

  await ctx.close();
  const vids = fs.existsSync(VIDEO_DIR)
    ? fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'))
        .map((f) => ({ f, t: fs.statSync(path.join(VIDEO_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t)
    : [];
  console.log('[install] saved video:', vids[0] ? path.join(VIDEO_DIR, vids[0].f) : '(none)');
}

main().catch(async (e) => { console.error('[install] error:', e.message); try { await ctx.close(); } catch {} process.exit(1); });
