// usage: node scripts/shot.mjs <url> <out.png> [width] [height]
import { chromium } from 'playwright';
const [url, out, w = 1220, h = 580] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto(url); await p.waitForTimeout(500);
await p.screenshot({ path: out }); await b.close();
