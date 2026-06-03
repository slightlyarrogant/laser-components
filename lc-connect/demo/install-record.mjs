// Record the REAL ChatGPT connector-install flow for the demo film.
//
// Flow (mapped from the live UI): profile menu -> Settings -> Apps -> Create app
// -> fill the form (Name + MCP Server URL + the security checkbox) -> Create.
// LC Connect is already installed, so this demonstrates "how easy it is" — we
// fill the one form with the real connector URL and submit; the OAuth login that
// follows is the user's step (the script never types credentials).
//
//   node demo/install-record.mjs            # records demo/video-install/*.webm
//
// Reuses the persistent logged-in profile from chatgpt-record.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, '.chatgpt-profile');
const VIDEO_DIR = path.join(__dirname, 'video-install');
const VIEW = { width: 1440, height: 900 };
const MCP_URL = 'https://lasercomponents.ngrok.app/mcp';
const NAME = 'LC Connect';

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false, channel: 'chrome', viewport: VIEW,
  args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check'],
  recordVideo: { dir: VIDEO_DIR, size: VIEW },
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.setViewportSize(VIEW).catch(() => {});
page.setDefaultTimeout(8000); // cap auto-waits so a missed element can't hang 30s
const dlg = () => page.locator('[role="dialog"]').last();

async function main() {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2500);

  // Open profile menu -> Settings.
  await page.locator('div[aria-label*="profile menu" i], #accounts-profile-button').first().click({ force: true, timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.getByRole('menuitem', { name: /^Settings$/i }).first().click({ timeout: 6000 }).catch(() => {});
  await dlg().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);

  // Apps tab.
  await dlg().getByText(/^Apps$/i).first().click({ timeout: 6000 }).catch(() => {});
  await dlg().getByRole('button', { name: /Create app/i }).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);

  // Create app -> the New App form.
  await dlg().getByRole('button', { name: /Create app/i }).first().click({ timeout: 6000 }).catch(() => {});
  await dlg().getByPlaceholder(/^Name$/i).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);

  // Fill Name (slow, human cadence).
  const nameInput = dlg().getByPlaceholder(/^Name$/i).first();
  await nameInput.click().catch(() => {});
  await page.keyboard.type(NAME, { delay: 70 });
  await page.waitForTimeout(700);

  // Fill MCP Server URL.
  const urlInput = dlg().getByPlaceholder(/example\.com\/sse/i).first();
  await urlInput.click().catch(async () => {
    await dlg().getByText(/MCP Server URL/i).first().click().catch(() => {});
  });
  await page.keyboard.type(MCP_URL, { delay: 45 });
  await page.waitForTimeout(900);

  // Tick the "I understand and want to continue" checkbox.
  const box = dlg().locator('input[type="checkbox"]').first();
  if (await box.count()) { await box.click().catch(() => {}); }
  await page.waitForTimeout(1200);

  // Hold on the completed form so the recording reads clearly.
  await dlg().getByRole('button', { name: /^Create$/i }).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(1800);

  // Click Create and capture the result (returns to the Apps list = connected).
  await dlg().getByRole('button', { name: /^Create$/i }).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(4000);

  await ctx.close();
  const vids = fs.existsSync(VIDEO_DIR)
    ? fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'))
        .map((f) => ({ f, t: fs.statSync(path.join(VIDEO_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t)
    : [];
  console.log('[install] saved video:', vids[0] ? path.join(VIDEO_DIR, vids[0].f) : '(none)');
}

main().catch(async (e) => { console.error('[install] error:', e.message); try { await ctx.close(); } catch {} process.exit(1); });
