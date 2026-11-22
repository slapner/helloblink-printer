// Everything that turns pictures into pure black and white dots.
import { H, W } from './printer';

export function makeCanvas(w = W, h = H): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d', { willReadFrequently: true })!;
}

/** Floyd–Steinberg, as the official app does. g is 0..255 and is modified. Returns 1 = black. */
export function fsDither(g: Float32Array, w: number, h: number, mask?: Uint8Array): Uint8Array {
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (mask && !mask[i]) continue;
    const old = Math.max(0, Math.min(255, g[i])), nv = old < 128 ? 0 : 255, e = old - nv;
    bits[i] = nv === 0 ? 1 : 0;
    if (x + 1 < w) g[i + 1] += e * 7 / 16;
    if (y + 1 < h) { if (x > 0) g[i + w - 1] += e * 3 / 16; g[i + w] += e * 5 / 16; if (x + 1 < w) g[i + w + 1] += e / 16; }
  }
  return bits;
}

export function luma(d: Uint8ClampedArray, n: number): Float32Array {
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255;
    g[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a + 255 * (1 - a);
  }
  return g;
}

/** Writes bits into a canvas as opaque black/white (or transparent where mask is 0). */
export function bitsToCanvas(bits: Uint8Array, w: number, h: number, mask?: Uint8Array): HTMLCanvasElement {
  const c = makeCanvas(w, h), x = ctx2d(c), im = x.createImageData(w, h), d = im.data;
  for (let i = 0; i < w * h; i++) {
    const v = bits[i] ? 0 : 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = mask && !mask[i] ? 0 : 255;
  }
  x.putImageData(im, 0, 0); return c;
}

const EMOJI_FONT = '"Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif';
const stampCache = new Map<string, HTMLCanvasElement>();

/** A colour emoji as a black-and-white sticker: boosted contrast, dithered, with a black outline so pale ones survive. */
export function emojiStamp(emoji: string, size: number): HTMLCanvasElement {
  const key = emoji + '@' + size; const hit = stampCache.get(key); if (hit) return hit;
  const n = Math.round(size) + 8, k = makeCanvas(n, n), x = ctx2d(k);
  x.font = `${size * 0.82}px ${EMOJI_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(emoji, n / 2, n / 2 + size * 0.04);
  const d = x.getImageData(0, 0, n, n).data, g = new Float32Array(n * n), a = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    a[i] = d[i * 4 + 3] > 100 ? 1 : 0;
    g[i] = ((0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) - 128) * 1.5 + 148;
  }
  const bits = fsDither(g, n, n, a), r = size < 70 ? 1 : 2;
  for (let y = 0; y < n; y++) for (let X = 0; X < n; X++) {
    const i = y * n + X; if (!a[i]) continue;
    edge: for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const yy = y + dy, xx = X + dx;
      if (yy < 0 || xx < 0 || yy >= n || xx >= n || !a[yy * n + xx]) { bits[i] = 1; break edge; }
    }
  }
  const out = bitsToCanvas(bits, n, n, a);
  if (stampCache.size > 400) stampCache.clear();
  stampCache.set(key, out); return out;
}

// ---- patterns: the "colours" of a black-and-white sticker ----
export interface Pattern { id: string; name: string; fn: (x: number, y: number) => boolean }
const TILE = 48;
const m = (a: number, b: number) => ((a % b) + b) % b;
export const PATTERNS: Pattern[] = [
  { id: 'solid', name: 'Black', fn: () => true },
  { id: 'white', name: 'White', fn: () => false },
  { id: 'grey', name: 'Grey', fn: (x, y) => (x + y) % 2 === 0 },
  { id: 'dots', name: 'Dots', fn: (x, y) => (m(x, 8) - 4) ** 2 + (m(y, 8) - 4) ** 2 < 5 },
  { id: 'spots', name: 'Spots', fn: (x, y) => (m(x, 24) - 6) ** 2 + (m(y, 24) - 6) ** 2 < 26 || (m(x, 24) - 18) ** 2 + (m(y, 24) - 18) ** 2 < 26 },
  { id: 'stripes', name: 'Stripes', fn: (_x, y) => m(y, 8) < 4 },
  { id: 'diag', name: 'Candy', fn: (x, y) => m(x + y, 12) < 5 },
  { id: 'checks', name: 'Checks', fn: (x, y) => (Math.floor(x / 6) + Math.floor(y / 6)) % 2 === 0 },
  { id: 'grid', name: 'Grid', fn: (x, y) => m(x, 12) < 2 || m(y, 12) < 2 },
  { id: 'bricks', name: 'Bricks', fn: (x, y) => m(y, 8) < 2 || m(x + (Math.floor(y / 8) % 2 ? 8 : 0), 16) < 2 },
  { id: 'waves', name: 'Waves', fn: (x, y) => m(y + Math.round(3 * Math.sin((x * 2 * Math.PI) / 24)), 8) < 3 },
  { id: 'zigzag', name: 'Zigzag', fn: (x, y) => m(y + Math.abs(m(x, 16) - 8), 8) < 3 },
  { id: 'hearts', name: 'Hearts', fn: (x, y) => { const hx = (m(x, 24) - 12) / 9, hy = -(m(y, 24) - 11) / 9; return (hx * hx + hy * hy - 1) ** 3 - hx * hx * hy ** 3 < 0; } },
  { id: 'sparkle', name: 'Sparkle', fn: (x, y) => { const o = Math.floor(y / 16) % 2 ? 8 : 0, cx = Math.abs(m(x + o, 16) - 8), cy = Math.abs(m(y, 16) - 8); return (cx < 1 && cy < 5) || (cy < 1 && cx < 5); } },
];
export const patternById = (id: string) => PATTERNS.find((p) => p.id === id) ?? PATTERNS[0];

const tiles = new Map<string, HTMLCanvasElement>();
export function patternTile(id: string): HTMLCanvasElement {
  let t = tiles.get(id); if (t) return t;
  const p = patternById(id), bits = new Uint8Array(TILE * TILE);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) bits[y * TILE + x] = p.fn(x, y) ? 1 : 0;
  t = bitsToCanvas(bits, TILE, TILE); tiles.set(id, t); return t;
}

/** 4-connected region of same-coloured dots around (x, y). */
export function floodMask(bits: Uint8Array, x: number, y: number): Uint8Array {
  const mask = new Uint8Array(W * H); x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return mask;
  const want = bits[y * W + x], stack = [y * W + x]; mask[y * W + x] = 1;
  while (stack.length) {
    const i = stack.pop()!, px = i % W;
    if (px > 0 && !mask[i - 1] && bits[i - 1] === want) { mask[i - 1] = 1; stack.push(i - 1); }
    if (px < W - 1 && !mask[i + 1] && bits[i + 1] === want) { mask[i + 1] = 1; stack.push(i + 1); }
    if (i >= W && !mask[i - W] && bits[i - W] === want) { mask[i - W] = 1; stack.push(i - W); }
    if (i < W * (H - 1) && !mask[i + W] && bits[i + W] === want) { mask[i + W] = 1; stack.push(i + W); }
  }
  return mask;
}
