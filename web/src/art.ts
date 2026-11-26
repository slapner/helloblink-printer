// Ready-made art: shapes, frames, lettering, stamps lists, badges.
import { W } from './printer';
import { emojiStamp } from './raster';

const C = W / 2, TAU = Math.PI * 2;
type Ctx = CanvasRenderingContext2D;
/** The die-cut of the stickers on the roll. Both print the same 384×384 dots; frames and words follow the edge. */
export type Shape = 'circle' | 'square';

// ---- shapes (outlined and white inside, so they can be filled with the bucket) ----
function poly(c: Ctx, pts: [number, number][]) { c.moveTo(...pts[0]); pts.slice(1).forEach((p) => c.lineTo(...p)); c.closePath(); }
function starPts(n: number, ro: number, ri: number): [number, number][] {
  return Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? ri : ro, a = -Math.PI / 2 + (i * Math.PI) / n; return [r * Math.cos(a), r * Math.sin(a)] as [number, number]; });
}
export const SHAPES: Record<string, (c: Ctx, r: number) => void> = {
  circle: (c, r) => c.arc(0, 0, r, 0, TAU),
  square: (c, r) => c.roundRect(-r * 0.88, -r * 0.88, r * 1.76, r * 1.76, r * 0.12),
  triangle: (c, r) => poly(c, [[0, -r], [r * 0.95, r * 0.8], [-r * 0.95, r * 0.8]]),
  star: (c, r) => poly(c, starPts(5, r, r * 0.42)),
  burst: (c, r) => poly(c, starPts(12, r, r * 0.72)),
  heart: (c, r) => { c.moveTo(0, r * 0.9); c.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.75, -r * 1.15, 0, -r * 0.4); c.bezierCurveTo(r * 0.75, -r * 1.15, r * 1.5, -r * 0.1, 0, r * 0.9); c.closePath(); },
  diamond: (c, r) => poly(c, [[0, -r], [r * 0.75, 0], [0, r], [-r * 0.75, 0]]),
  moon: (c, r) => { c.arc(0, 0, r, Math.PI * 0.35, Math.PI * 1.65); c.arc(r * 0.55, 0, r * 0.82, Math.PI * 1.42, Math.PI * 0.58, true); c.closePath(); },
  cloud: (c, r) => { c.arc(-r * 0.5, r * 0.2, r * 0.42, Math.PI * 0.5, Math.PI * 1.5); c.arc(-r * 0.12, -r * 0.25, r * 0.48, Math.PI, Math.PI * 1.9); c.arc(r * 0.48, r * 0.05, r * 0.45, Math.PI * 1.35, Math.PI * 0.5); c.closePath(); },
  flower: (c, r) => { for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; c.moveTo(r * 0.55 * Math.cos(a) + r * 0.42, r * 0.55 * Math.sin(a)); c.arc(r * 0.55 * Math.cos(a), r * 0.55 * Math.sin(a), r * 0.42, 0, TAU); } },
  bolt: (c, r) => poly(c, [[r * 0.25, -r], [-r * 0.6, r * 0.12], [-r * 0.05, r * 0.12], [-r * 0.3, r], [r * 0.6, -r * 0.22], [r * 0.05, -r * 0.22]]),
  bubble: (c, r) => { c.roundRect(-r, -r * 0.8, r * 2, r * 1.3, r * 0.4); c.moveTo(-r * 0.45, r * 0.45); c.lineTo(-r * 0.6, r); c.lineTo(-r * 0.05, r * 0.45); },
  crown: (c, r) => poly(c, [[-r, r * 0.7], [-r, -r * 0.5], [-r * 0.5, r * 0.05], [0, -r * 0.8], [r * 0.5, r * 0.05], [r, -r * 0.5], [r, r * 0.7]]),
  arrow: (c, r) => poly(c, [[-r, -r * 0.3], [r * 0.2, -r * 0.3], [r * 0.2, -r * 0.75], [r, 0], [r * 0.2, r * 0.75], [r * 0.2, r * 0.3], [-r, r * 0.3]]),
};

export interface Stamp { kind: 'emoji' | 'shape'; v: string }
export function drawStamp(c: Ctx, s: Stamp, x: number, y: number, size: number) {
  if (s.kind === 'emoji') { const k = emojiStamp(s.v, size); c.drawImage(k, Math.round(x - k.width / 2), Math.round(y - k.height / 2)); return; }
  const lw = Math.min(10, Math.max(4, size * 0.06)), r = size / 2 - lw / 2;
  c.save(); c.translate(x, y); c.beginPath(); (SHAPES[s.v] ?? SHAPES.circle)(c, r);
  c.fillStyle = '#fff'; c.fill();
  c.strokeStyle = '#000'; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
  if (s.v === 'flower') { c.beginPath(); c.arc(0, 0, r * 0.32, 0, TAU); c.fill(); c.stroke(); }
  c.restore();
}

export const STAMP_SETS: { id: string; icon: string; items: string[] }[] = [
  { id: 'faces', icon: '😀', items: ['😀', '😎', '🤩', '😜', '🥳', '😍', '🤪', '😴', '🤓', '😇', '🤠', '👻', '🤖', '👽', '💩', '🎃', '👑', '👀'] },
  { id: 'animals', icon: '🐶', items: ['🐶', '🐱', '🦄', '🦖', '🐸', '🐼', '🦊', '🐰', '🐵', '🦁', '🐯', '🐷', '🐧', '🦉', '🦋', '🐢', '🐙', '🦈', '🐝', '🐞'] },
  { id: 'food', icon: '🍕', items: ['🍕', '🍦', '🍩', '🍪', '🎂', '🧁', '🍭', '🍓', '🍉', '🍌', '🍎', '🌮', '🍔', '🍟', '🥨', '🍿'] },
  { id: 'things', icon: '🚀', items: ['🚀', '⚽', '🏀', '🎈', '🎁', '🏆', '🎸', '🎨', '🚗', '🚂', '✈️', '🚁', '🛸', '🧸', '🎮', '🪁', '🦷', '📚', '💎', '🔥'] },
  { id: 'nature', icon: '🌈', items: ['🌈', '⭐', '🌟', '☀️', '🌙', '☁️', '⚡', '❄️', '🌸', '🌻', '🌵', '🌴', '🍄', '🍀', '🌍', '❤️', '💖', '✨'] },
];
export const SHAPE_IDS = Object.keys(SHAPES);

// ---- frames that follow the edge of the sticker ----
export const FRAMES = ['none', 'ring', 'double', 'dots', 'dashes', 'scallop', 'sun', 'zigzag', 'stars', 'hearts', 'checks', 'emoji'] as const;
export function drawFrame(c: Ctx, id: string, emoji: string, shape: Shape = 'circle') {
  if (shape === 'square') return drawSquareFrame(c, id, emoji);
  c.save(); c.fillStyle = c.strokeStyle = '#000'; c.lineJoin = 'round';
  const ring = (r: number, lw: number) => { c.beginPath(); c.arc(C, C, r, 0, TAU); c.lineWidth = lw; c.stroke(); };
  const around = (n: number, r: number, fn: (a: number) => void, off = 0) => { for (let i = 0; i < n; i++) { const a = off + (i * TAU) / n; c.save(); c.translate(C + r * Math.cos(a), C + r * Math.sin(a)); c.rotate(a + Math.PI / 2); fn(a); c.restore(); } };
  switch (id) {
    case 'ring': ring(180, 9); break;
    case 'double': ring(182, 7); ring(168, 3); break;
    case 'dots': around(30, 178, () => { c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.fill(); }); break;
    case 'dashes': c.setLineDash([22, 14]); c.lineCap = 'round'; ring(178, 8); break;
    case 'scallop': c.beginPath(); c.rect(0, 0, W, W); c.arc(C, C, 176, 0, TAU, true); c.fill('evenodd'); around(26, 176, () => { c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.fill(); }); break;
    case 'sun': around(36, 0, (a) => { c.rotate(-(a + Math.PI / 2)); c.rotate(a); c.beginPath(); c.moveTo(160, -9); c.lineTo(192, 0); c.lineTo(160, 9); c.closePath(); c.fill(); }); ring(158, 4); break;
    case 'zigzag': c.beginPath(); for (let i = 0; i <= 72; i++) { const a = (i * TAU) / 72, r = i % 2 ? 166 : 186; c.lineTo(C + r * Math.cos(a), C + r * Math.sin(a)); } c.closePath(); c.lineWidth = 6; c.stroke(); break;
    case 'stars': around(16, 174, () => { c.beginPath(); poly(c, starPts(5, 15, 6.3)); c.fill(); }); break;
    case 'hearts': around(16, 174, () => { c.beginPath(); SHAPES.heart(c, 13); c.fill(); }); break;
    case 'checks': for (let k = 0; k < 2; k++) for (let i = 0; i < 40; i++) if ((i + k) % 2 === 0) { const a0 = (i * TAU) / 40, a1 = ((i + 1) * TAU) / 40, r0 = 164 + k * 13, r1 = r0 + 13; c.beginPath(); c.arc(C, C, r1, a0, a1); c.arc(C, C, r0, a1, a0, true); c.closePath(); c.fill(); } ring(163, 2); break;
    case 'emoji': around(12, 166, () => { const k = emojiStamp(emoji, 44); c.drawImage(k, -k.width / 2, -k.height / 2); }); break;
  }
  c.restore();
}

/** Point i of n round a square of half-side r, clockwise from the top-left corner, and the way out from it. */
function onSquare(i: number, n: number, r: number): [number, number, number] {
  const u = (i * 4) / n, side = Math.floor(u) % 4, d = (u - Math.floor(u)) * 2 * r;
  const [x, y] = ([[-r + d, -r], [r, -r + d], [r - d, r], [-r, r - d]] as const)[side];
  return [C + x, C + y, (side - 1) * (Math.PI / 2) - (d < 1e-6 ? Math.PI / 4 : 0)];
}
/** The same frames along a square edge. Counts are multiples of four, so every corner gets a piece. */
function drawSquareFrame(c: Ctx, id: string, emoji: string) {
  c.save(); c.fillStyle = c.strokeStyle = '#000'; c.lineJoin = 'round';
  const ring = (r: number, lw: number) => { c.lineWidth = lw; c.strokeRect(C - r, C - r, 2 * r, 2 * r); };
  const around = (n: number, r: number, fn: () => void) => { for (let i = 0; i < n; i++) { const [x, y, a] = onSquare(i, n, r); c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); fn(); c.restore(); } };
  switch (id) {
    case 'ring': ring(180, 9); break;
    case 'double': ring(182, 7); ring(168, 3); break;
    case 'dots': around(36, 178, () => { c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.fill(); }); break;
    case 'dashes': c.setLineDash([21.6, 14]); c.lineDashOffset = 10.8; c.lineCap = 'round'; ring(178, 8); break;
    case 'scallop': c.beginPath(); c.rect(0, 0, W, W); c.rect(C - 176, C - 176, 352, 352); c.fill('evenodd'); around(32, 176, () => { c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.fill(); }); break;
    case 'sun': around(44, 160, () => { c.beginPath(); c.moveTo(-9, 0); c.lineTo(0, -30); c.lineTo(9, 0); c.closePath(); c.fill(); }); ring(158, 4); break;
    case 'zigzag': c.beginPath(); for (let i = 0; i < 88; i++) { const [x, y] = onSquare(i, 88, i % 2 ? 166 : 186); c.lineTo(x, y); } c.closePath(); c.lineWidth = 6; c.stroke(); break;
    case 'stars': around(20, 174, () => { c.beginPath(); poly(c, starPts(5, 15, 6.3)); c.fill(); }); break;
    case 'hearts': around(20, 174, () => { c.beginPath(); SHAPES.heart(c, 13); c.fill(); }); break;
    case 'checks': {   // two rows of a 30×30 checkerboard, kept only in the band along the edge
      const n = 30, o = C - 190, s = 380 / n;
      c.beginPath(); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if ((i + j) % 2 === 0 && (i < 2 || j < 2 || i >= n - 2 || j >= n - 2)) c.rect(o + i * s, o + j * s, s, s);
      c.fill(); ring(190 - 2 * s, 2); break;
    }
    case 'emoji': around(16, 166, () => { const k = emojiStamp(emoji, 44); c.drawImage(k, -k.width / 2, -k.height / 2); }); break;
  }
  c.restore();
}

// ---- lettering ----
export const FONTS = [
  { name: 'Round', css: '"Arial Rounded MT Bold","Varela Round","Segoe UI",Roboto,system-ui,sans-serif', weight: 'bold' },
  { name: 'Marker', css: '"Marker Felt","Chalkboard SE","Comic Sans MS","Comic Neue",cursive', weight: 'bold' },
  { name: 'Block', css: 'Impact,"Arial Black","Roboto Black",sans-serif', weight: 'normal' },
  { name: 'Type', css: '"American Typewriter","Courier New",monospace', weight: 'bold' },
];
export interface Words { top: string; mid: string; bottom: string; font: number }
const fontCss = (f: number, px: number) => { const F = FONTS[f] ?? FONTS[0]; return `${F.weight} ${px}px ${F.css}`; };
function inked(c: Ctx, ch: string, x: number, y: number, px: number) {
  c.lineWidth = Math.max(5, px * 0.2); c.strokeStyle = '#fff'; c.lineJoin = 'round'; c.strokeText(ch, x, y);
  c.fillStyle = '#000'; c.fillText(ch, x, y);
}
function arcText(c: Ctx, text: string, f: number, R: number, top: boolean) {
  const chars = Array.from(text); if (!chars.length) return;
  let px = 46, widths: number[] = [], total = 0;
  for (; px >= 14; px -= 2) {
    c.font = fontCss(f, px); widths = chars.map((ch) => c.measureText(ch).width + px * 0.04); total = widths.reduce((a, b) => a + b, 0);
    if (total <= R * (top ? 2.7 : 2.3)) break;
  }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  let acc = 0;
  chars.forEach((ch, i) => {
    const off = (acc + widths[i] / 2 - total / 2) / R; acc += widths[i];
    const a = top ? -Math.PI / 2 + off : Math.PI / 2 - off;
    c.save(); c.translate(C + R * Math.cos(a), C + R * Math.sin(a)); c.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2); inked(c, ch, 0, 0, px); c.restore();
  });
}
/** One straight line across the sticker, shrunk until it fits. */
function lineText(c: Ctx, text: string, f: number, y: number, box: number) {
  if (!text) return;
  let px = 46;
  for (; px > 14; px -= 2) { c.font = fontCss(f, px); if (c.measureText(text).width <= box) break; }
  c.textAlign = 'center'; c.textBaseline = 'middle'; inked(c, text, C, y, px);
}
export function drawWords(c: Ctx, w: Words, framed: boolean, shape: Shape = 'circle') {
  c.save();
  const R = framed ? 132 : 152;
  if (w.mid.trim()) {
    const lines = w.mid.split('\n').slice(0, 3), box = framed ? 250 : 300;
    let px = lines.length > 1 ? 80 : 120;
    for (; px > 14; px -= 2) { c.font = fontCss(w.font, px); if (Math.max(...lines.map((l) => c.measureText(l).width)) <= box) break; }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const lh = px * 1.05, y0 = C - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => inked(c, l, C, y0 + i * lh, px));
  }
  if (shape === 'square') { const box = framed ? 280 : 340; lineText(c, w.top.trim(), w.font, C - R, box); lineText(c, w.bottom.trim(), w.font, C + R, box); }
  else { arcText(c, w.top.trim(), w.font, R, true); arcText(c, w.bottom.trim(), w.font, R, false); }
  c.restore();
}

// ---- badges: one tap gives a finished sticker to make your own ----
export interface Badge { id: string; label: string; emoji?: string; top?: string; bottom?: string; mid?: string; frame: string; name?: 'mid' | 'bottom'; font?: number }
export const BADGES: Badge[] = [
  { id: 'name', label: 'My name', top: 'HELLO, MY NAME IS', frame: 'double', name: 'mid' },
  { id: 'star', label: 'Super star', top: 'SUPER STAR', emoji: '⭐', frame: 'stars', name: 'bottom' },
  { id: 'done', label: 'Well done', top: 'WELL DONE!', emoji: '🏆', frame: 'sun', name: 'bottom' },
  { id: 'mine', label: 'Mine!', top: 'THIS BELONGS TO', frame: 'dashes', name: 'mid', font: 1 },
  { id: 'bday', label: 'Birthday', top: 'HAPPY BIRTHDAY', emoji: '🎂', frame: 'dots', name: 'bottom' },
  { id: 'tooth', label: 'Lost a tooth', top: 'I LOST A TOOTH!', emoji: '🦷', frame: 'scallop', name: 'bottom' },
  { id: 'brave', label: 'So brave', top: 'I WAS SO BRAVE', emoji: '🦁', frame: 'zigzag', name: 'bottom' },
  { id: 'help', label: 'Helper', top: 'GREAT HELPER', emoji: '🙌', frame: 'checks', name: 'bottom' },
  { id: 'read', label: 'Reader', top: 'READING CHAMP', emoji: '📚', frame: 'ring', name: 'bottom' },
  { id: 'love', label: 'Love you', top: 'I LOVE YOU', emoji: '❤️', frame: 'hearts', bottom: 'XOXO', font: 1 },
  { id: 'teeth', label: 'Clean teeth', top: 'SPARKLY TEETH', emoji: '🪥', frame: 'dots', name: 'bottom' },
  { id: 'kind', label: 'Kind friend', top: 'KIND FRIEND', emoji: '🤗', frame: 'hearts', name: 'bottom' },
];
export const SHOUTS = ['WOW!', 'YAY!', 'SO COOL', 'HELLO!', 'ZOOM!', 'ROAR!', 'BEST DAY EVER', 'HIGH FIVE', 'YOU ROCK', 'AWESOME', 'BOOP!', 'PARTY TIME', 'OH YEAH', 'SUPER DUPER'];
