// Drives the built app in Chrome with real pointer input and saves screenshots.
// usage: npm run build && npm run preview &   then   node scripts/tour.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'shots'; mkdirSync(out, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:8377/';
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];

// A stand-in printer: records every write so the print path can be checked without paper.
const fakePrinter = () => {
  window.__writes = [];
  const ch = { writeValueWithResponse: async (v) => { window.__writes.push(Array.from(v)); await new Promise((r) => setTimeout(r, 2)); }, addEventListener() {}, startNotifications: async () => {} };
  const device = { name: 'HB-TEST', addEventListener() {}, gatt: { connected: true, disconnect() {}, connect: async () => ({ getPrimaryService: async () => ({ getCharacteristic: async () => ch }) }) } };
  Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: async () => device, getDevices: async () => [] }, configurable: true });
};

async function open(width, height, dsf = 2) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf });
  await ctx.addInitScript(fakePrinter);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL); await page.waitForSelector('canvas');
  const box = async () => (await page.locator('.sticker canvas').boundingBox());
  const at = async (fx, fy) => { const b = await box(); return [b.x + b.width * fx, b.y + b.height * fy]; };
  const drag = async (pts) => { const [x, y] = await at(...pts[0]); await page.mouse.move(x, y); await page.mouse.down(); for (const p of pts.slice(1)) { const [a, b] = await at(...p); await page.mouse.move(a, b, { steps: 6 }); } await page.mouse.up(); };
  const tap = async (fx, fy) => { const [x, y] = await at(fx, fy); await page.mouse.click(x, y); };
  const tool = (name) => page.locator('.rail .tool', { hasText: name }).click();
  const shot = async (name) => { await page.mouse.move(2, 2); await page.waitForTimeout(350); await page.screenshot({ path: `${out}/${name}.png` }); };
  const ink = () => page.evaluate(() => window.__studio.bits().reduce((n, b) => n + b, 0));   // the sticker's own dots, not the screen
  return { page, drag, tap, tool, shot, ink, ctx };
}
const checks = {};

// ---------- MacBook ----------
{
  const { page, drag, tap, tool, shot, ink, ctx } = await open(1440, 780);
  checks.blankAtStart = await ink();
  await page.locator('.print').click(); await page.waitForTimeout(200);
  checks.blankPrintToast = await page.locator('.toast').innerText();

  // snowflake drawing
  await page.locator('.tray button', { hasText: 'Snowflake' }).click();
  await drag([[0.5, 0.46], [0.5, 0.14]]); await drag([[0.5, 0.26], [0.57, 0.19]]); await drag([[0.5, 0.36], [0.6, 0.3]]);
  checks.snowflakeInk = await ink();
  await shot('01-draw-snowflake');
  await page.locator('.acts button', { hasText: 'Undo' }).click(); const afterUndo = await ink();
  await page.locator('.acts button', { hasText: 'Redo' }).click(); checks.undoRedo = [afterUndo < checks.snowflakeInk * 0.8, Math.abs((await ink()) - checks.snowflakeInk) < checks.snowflakeInk * 0.02];
  await page.locator('.acts button', { hasText: 'Keep' }).click();

  // shapes + pattern fill + stamps + frame
  await page.locator('.acts button', { hasText: 'Start over' }).click(); checks.cleared = await ink();
  await tool('Stamps');
  await page.locator('.tray button[aria-label="shapes"]').click(); await page.locator('.tray button[aria-label="heart"]').click();
  await page.locator('.tray button[aria-label="Huge"]').click(); await tap(0.5, 0.52);
  await tool('Fill'); await page.locator('.tray button[aria-label="Spots"]').click(); await tap(0.5, 0.55); checks.fillInk = await ink();
  await page.locator('.tray button[aria-label="Candy"]').click(); await tap(0.08, 0.5);
  await tool('Stamps'); await page.locator('.tray button[aria-label="animals"]').click(); await page.locator('.tray button[aria-label="🦄"]').click();
  await page.locator('.tray button[aria-label="Big"]').click(); await tap(0.5, 0.5);
  await page.locator('.tray button[aria-label="nature"]').click(); await page.locator('.tray button[aria-label="⭐"]').click();
  await page.locator('.tray button[aria-label="Small"]').click(); for (const p of [[0.2, 0.3], [0.8, 0.3], [0.25, 0.75], [0.76, 0.76]]) await tap(...p);
  await shot('02-stamps-and-fill');
  await tool('Frames'); await page.locator('.tray button[aria-label="scallop frame"]').click(); await shot('03-frames');
  await page.locator('.acts button', { hasText: 'Keep' }).click();

  // badge with a name
  await tool('Badges'); await page.locator('.tray input').fill('Maya'); await page.locator('.tray button', { hasText: 'Super star' }).click(); await shot('04-badge');
  await page.locator('.acts button', { hasText: 'Keep' }).click();
  // words
  await tool('Words'); const f = page.locator('.tray input'); await f.nth(0).fill('BEST BIG SISTER'); await f.nth(2).fill('MAYA ROCKS'); await page.locator('.tray .font').nth(1).click(); await shot('05-words');

  // photo with drawing on top
  await tool('Photo');
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d');
    const sky = x.createLinearGradient(0, 0, 0, 600); sky.addColorStop(0, '#16356b'); sky.addColorStop(0.6, '#f59a5b'); sky.addColorStop(1, '#ffe2a8'); x.fillStyle = sky; x.fillRect(0, 0, 800, 600);
    const sun = x.createRadialGradient(400, 380, 10, 400, 380, 170); sun.addColorStop(0, '#fff'); sun.addColorStop(0.5, '#ffd76a'); sun.addColorStop(1, 'rgba(255,200,90,0)'); x.fillStyle = sun; x.fillRect(0, 0, 800, 600);
    x.fillStyle = '#1d2433'; x.beginPath(); x.moveTo(0, 600); x.lineTo(0, 470); x.lineTo(220, 330); x.lineTo(380, 480); x.lineTo(560, 300); x.lineTo(800, 500); x.lineTo(800, 600); x.fill();
    const blob = await new Promise((r) => c.toBlob(r, 'image/png')); const dt = new DataTransfer(); dt.items.add(new File([blob], 'sunset.png', { type: 'image/png' }));
    const input = document.querySelector('.tray input[type=file]'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(500); checks.photoInk = await ink();
  await tool('Stamps'); await page.locator('.tray button[aria-label="things"]').click(); await page.locator('.tray button[aria-label="🚀"]').click(); await page.locator('.tray button[aria-label="Big"]').click(); await tap(0.5, 0.36);
  await tool('Words'); await page.locator('.tray input').nth(0).fill(''); await page.locator('.tray input').nth(2).fill('TO THE MOON'); await shot('06-photo');

  // magic + surprise
  await page.locator('.surprise').click(); await shot('07-surprise'); checks.surpriseInk = await ink();
  await tool('Magic'); await page.locator('.tray button', { hasText: 'Kaleidoscope' }).click(); await shot('08-magic-kaleidoscope');
  await page.locator('.acts button', { hasText: 'Undo' }).click();

  // print: asleep -> wake -> printing -> ta-da
  await page.locator('.copies .copy', { hasText: '×2' }).click();
  await page.locator('.go .print').click(); await shot('09-printer-asleep');
  await page.locator('.modal .print').click(); await page.waitForTimeout(450); await shot('10-printing');
  await page.waitForSelector('.tada', { timeout: 30000 }); await page.waitForTimeout(700); await page.screenshot({ path: `${out}/11-printed.png` });
  checks.print = await page.evaluate(() => ({ writes: window.__writes.length, sizes: [...new Set(window.__writes.map((w) => w.length))], headers: [...new Set(window.__writes.map((w) => w.slice(0, 8).join(' ')))], inkBytes: window.__writes.slice(0, 384).flat().filter((b, i) => i % 56 >= 8 && b).length > 0 }));
  await page.locator('.modal button', { hasText: 'Keep going' }).click();
  await page.locator('.top button', { hasText: 'My stickers' }).click(); await shot('12-my-stickers'); checks.gallery = await page.locator('.gallery .thumb').count();
  await page.locator('.gallery .thumb').nth(1).click(); await page.waitForTimeout(300); checks.reopenedInk = await ink();

  // grown-ups: a tap must not open it, a two second hold must
  const lock = page.locator('.hold'); await lock.click(); checks.tapOpensGrownups = await page.locator('.grown').count();
  const lb = await lock.boundingBox(); await page.mouse.move(lb.x + 20, lb.y + 20); await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
  checks.holdShowsSum = await page.locator('.modal .sum').count();
  const [a, b] = (await page.locator('.modal .sum').innerText()).match(/\d+/g).map(Number);
  await page.locator('.modal .answer').fill('1'); await page.keyboard.press('Enter'); checks.wrongAnswerOpens = await page.locator('.grown').count();
  await page.mouse.move(lb.x + 20, lb.y + 20); await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
  const [c, d] = (await page.locator('.modal .sum').innerText()).match(/\d+/g).map(Number); await page.locator('.modal .answer').fill(String(c * d)); await page.keyboard.press('Enter');
  checks.holdOpensGrownups = await page.locator('.grown').count(); await shot('13-grown-ups');
  await page.keyboard.press('Escape');

  // reload keeps the sticker
  const before = await ink(); await page.waitForTimeout(600); await page.reload(); await page.waitForSelector('canvas'); await page.waitForTimeout(600); checks.survivesReload = [before, await ink()];
  await ctx.close();
}
// ---------- other window sizes ----------
for (const [name, w, h] of [['20-mac-1280x720', 1280, 720], ['21-mac-1680x960', 1680, 960], ['22-small-window', 1024, 640], ['23-tablet-portrait', 820, 1106], ['24-phone', 390, 750], ['25-phone-landscape', 844, 390], ['26-narrow-landscape', 760, 600], ['27-wide-and-short', 1440, 450]]) {
  const { page, tool, tap, shot, ctx } = await open(w, h, /phone/.test(name) ? 3 : 2);
  await page.locator('.surprise').click(); await page.locator('.rail .tool').nth(2).click();
  if (w >= 1000) { await page.keyboard.press('1'); await page.keyboard.press(']'); checks[name + '-keys'] = await page.evaluate(() => [window.__studio.opts.tool, window.__studio.opts.pen]); await page.keyboard.press('3'); }
  checks[name] = await page.evaluate(() => ({ canvas: document.querySelector('.sticker canvas').clientWidth, crisp: document.querySelector('.sticker canvas').classList.contains('crisp'), labels: getComputedStyle(document.querySelector('.tool span')).display !== 'none', overlaps: (() => { const r = (q) => document.querySelector(q).getBoundingClientRect(), hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1; const b = r('.backing'); return ['.rail', '.tray', '.go', '.top'].filter((q) => hit(b, r(q))); })(), scrollsX: document.documentElement.scrollWidth > innerWidth, scrollsY: document.documentElement.scrollHeight > innerHeight }));
  await shot(name); await ctx.close();
}
await browser.close();
console.log(JSON.stringify({ checks, errors }, null, 1));
