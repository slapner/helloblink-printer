// The sticker being made. Drawing is imperative (canvas + pointer events); React only reads `version`.
import { H, W, blankRows, packRows } from './printer';
import { BADGES, FRAMES, SHAPE_IDS, SHOUTS, STAMP_SETS, type Badge, type Stamp, drawFrame, drawStamp, drawWords } from './art';
import { bitsToCanvas, ctx2d, floodMask, fsDither, luma, makeCanvas, patternById, patternTile } from './raster';
import { play } from './sound';

export type Tool = 'draw' | 'fill' | 'stamp' | 'words' | 'frame' | 'photo' | 'badge' | 'magic';
export interface Doc { frame: string; frameEmoji: string; top: string; mid: string; bottom: string; font: number }
export interface Opts { tool: Tool; pen: number; eraserSize: number; eraser: boolean; pattern: string; mirror: 1 | 2 | 4 | 12; stamp: Stamp; stampSize: number; fillPattern: string }
interface View { z: number; x: number; y: number }   // photo zoom (1 = just fills the sticker) and offset in dots
interface Snap { ink: ImageData; photo: HTMLCanvasElement | null; src: HTMLCanvasElement | null; view: View; level: number; doc: Doc }

const C = W / 2;
export const PENS = [5, 12, 24, 44];
export const STAMP_SIZES = [56, 110, 170, 250];
const EMPTY: Doc = { frame: 'none', frameEmoji: '⭐', top: '', mid: '', bottom: '', font: 0 };
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const isPng = (v: unknown): v is string => typeof v === 'string' && v.startsWith('data:image/png;base64,');   // saved pictures are only ever our own PNGs
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const SAVE_KEY = 'sticker-now', GALLERY_KEY = 'sticker-gallery', GALLERY_MAX = 24;

export class Studio {
  ink = makeCanvas(); private ictx = ctx2d(this.ink);
  private comp = makeCanvas(); private cctx = ctx2d(this.comp);
  photo: HTMLCanvasElement | null = null;       // already dithered to black/white
  private src: HTMLCanvasElement | null = null; // the original picture, so it can be moved, zoomed and re-brightened
  private pv: View = { z: 1, x: 0, y: 0 };
  private gesture: Map<number, [number, number]> | null = null;   // fingers (or the mouse) currently moving the photo
  private photoDirty = false;                   // re-dither once per frame, not once per pointer event
  photoLevel = 0;
  doc: Doc = { ...EMPTY };
  opts: Opts = { tool: 'draw', pen: 12, eraserSize: 24, eraser: false, pattern: 'solid', mirror: 1, stamp: { kind: 'emoji', v: '🦄' }, stampSize: 110, fillPattern: 'dots' };
  gallery: string[] = [];
  version = 0;
  private undoStack: Snap[] = []; private redoStack: Snap[] = [];
  private listeners = new Set<() => void>();
  private view: HTMLCanvasElement | null = null;
  private queued = false; private saveTimer = 0;
  private ghost: { x: number; y: number } | null = null;
  private hover: [number, number] | null = null;   // mouse position, for the brush ring
  private stroke: { id: number; last: [number, number][] } | null = null;
  private stamping: number | null = null;
  private lastEdit = '';
  private viewData: ImageData | null = null;
  /** False for a photo restored after a reload: the original picture is not saved, so it can't be moved or re-brightened. */
  get canTunePhoto() { return !!this.src; }

  constructor() { this.restore(); }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  private emit() { this.version++; this.listeners.forEach((f) => f()); }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  set(o: Partial<Opts>) { this.opts = { ...this.opts, ...o }; this.ghost = null; this.emit(); this.render(); }

  /** Next bigger or smaller pen, eraser or stamp, whichever is in use. */
  nudgeSize(dir: 1 | -1) {
    if (this.opts.tool === 'photo') { this.zoomPhoto(dir > 0 ? 1.15 : 1 / 1.15); return; }
    if (this.opts.tool !== 'draw' && this.opts.tool !== 'stamp') return;
    const o = this.opts, stamp = o.tool === 'stamp', list = stamp ? STAMP_SIZES : PENS, now = stamp ? o.stampSize : o.eraser ? o.eraserSize : o.pen;
    const i = Math.max(0, Math.min(list.length - 1, list.indexOf(now) + dir)), keepGhost = this.ghost, keepHover = this.hover;
    if (list[i] === now) return;
    this.set(stamp ? { stampSize: list[i] } : o.eraser ? { eraserSize: list[i] } : { pen: list[i] }); this.ghost = keepGhost; this.hover = keepHover; this.render();
  }

  // ---- history ----
  private snap(): Snap { return { ink: this.ictx.getImageData(0, 0, W, H), photo: this.photo, src: this.src, view: { ...this.pv }, level: this.photoLevel, doc: { ...this.doc } }; }
  private put(s: Snap) { this.stroke = null; this.ictx.putImageData(s.ink, 0, 0); this.gesture = null; this.photoDirty = false; this.photo = s.photo; this.src = s.src; this.pv = { ...s.view }; this.photoLevel = s.level; this.doc = { ...s.doc }; }
  /** Call before every change that should be one Undo step. */
  private begin(kind = '') {
    this.lastEdit = kind;
    this.undoStack.push(this.snap()); if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack = [];
  }
  private done() { this.emit(); this.render(); this.autosave(); }
  undo() { const s = this.undoStack.pop(); if (!s) return; this.redoStack.push(this.snap()); this.put(s); this.lastEdit = ''; play('undo'); this.done(); }
  redo() { const s = this.redoStack.pop(); if (!s) return; this.undoStack.push(this.snap()); this.put(s); this.lastEdit = ''; play('tap'); this.done(); }
  clear() { if (this.isBlank()) return; this.begin(); this.wipe(); play('clear'); this.done(); }
  private wipe() { this.stroke = null; this.ictx.clearRect(0, 0, W, H); this.gesture = null; this.photoDirty = false; this.photo = null; this.src = null; this.pv = { z: 1, x: 0, y: 0 }; this.photoLevel = 0; this.doc = { ...EMPTY }; }

  // ---- words, frames ----
  setWords(slot: 'top' | 'mid' | 'bottom', v: string) {
    if (this.lastEdit !== 'words:' + slot) this.begin('words:' + slot);
    this.doc = { ...this.doc, [slot]: v }; this.done();
  }
  setFont(font: number) { this.begin(); this.doc = { ...this.doc, font }; play('tap'); this.done(); }
  setFrame(frame: string) {
    this.begin(); this.doc = { ...this.doc, frame, frameEmoji: this.opts.stamp.kind === 'emoji' ? this.opts.stamp.v : this.doc.frameEmoji };
    play('pop'); this.done();
  }

  // ---- composite ----
  private paint(c: CanvasRenderingContext2D, extras = true) {
    if (this.photoDirty) { this.photoDirty = false; this.redither(); }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    if (this.photo) c.drawImage(this.photo, 0, 0);
    c.drawImage(this.ink, 0, 0);
    if (extras) { if (this.doc.frame !== 'none') drawFrame(c, this.doc.frame, this.doc.frameEmoji); drawWords(c, this.doc, this.doc.frame !== 'none'); }
    c.restore();
  }
  /** The sticker as dots, 1 = black. inset shrinks the whole picture towards the middle (grown-ups setting). */
  bits(inset = 0, extras = true, dx = 0): Uint8Array {
    this.paint(this.cctx, extras);
    if (inset > 0 || dx !== 0) {
      const t = makeCanvas(), x = ctx2d(t); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      x.imageSmoothingEnabled = false;   // keep dither dots as dots; smoothing would turn them into grey mush
      x.drawImage(this.comp, inset + dx, inset, W - 2 * inset, H - 2 * inset); this.cctx.drawImage(t, 0, 0);
    }
    const d = this.cctx.getImageData(0, 0, W, H).data, out = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2] < 128 ? 1 : 0;
    return out;
  }
  isBlank() { return !this.bits().some(Boolean); }
  printRows(inset: number, tail: number, copies: number, dx = 0): Uint8Array[] {
    const one = packRows(this.bits(inset, true, dx)).concat(blankRows(tail));
    return Array.from({ length: Math.max(1, copies) }, () => one).flat();
  }
  toDataURL() { return bitsToCanvas(this.bits(), W, H).toDataURL('image/png'); }

  // ---- screen ----
  attach(view: HTMLCanvasElement) {
    this.view = view;
    const pt = (e: PointerEvent): [number, number] => {
      const r = view.getBoundingClientRect();
      return [((e.clientX - r.left - view.clientLeft) * W) / view.clientWidth, ((e.clientY - r.top - view.clientTop) * H) / view.clientHeight];
    };
    const down = (e: PointerEvent) => {
      if (e.button > 0 || this.stroke || this.stamping !== null) return;   // one finger at a time: a resting palm must not cut the line
      if (this.gesture && this.opts.tool !== 'photo') return;
      e.preventDefault(); try { view.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      const p = pt(e), t = this.opts.tool;
      if (t === 'stamp') { this.stamping = e.pointerId; this.ghost = { x: p[0], y: p[1] }; this.render(); }
      else if (t === 'fill') this.fillAt(p[0], p[1]);
      else if (t === 'photo' && this.src) { if (!this.gesture) { this.begin(); this.gesture = new Map(); } this.gesture.set(e.pointerId, p); this.emit(); }   // one finger moves, two pinch
      else if (t === 'photo') return;                       // nothing to move yet; don't scribble by accident
      else { if (t !== 'draw') this.set({ tool: 'draw' }); this.begin(); this.stroke = { id: e.pointerId, last: [] }; this.extend([p]); this.emit(); }
    };
    const move = (e: PointerEvent) => {
      if (this.gesture?.has(e.pointerId)) {
        const g = this.gesture, before = [...g.values()]; g.set(e.pointerId, pt(e)); const after = [...g.values()];
        const mid = (a: [number, number][]) => [a.reduce((n, q) => n + q[0], 0) / a.length, a.reduce((n, q) => n + q[1], 0) / a.length];
        const spread = (a: [number, number][]) => Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
        const m0 = mid(before), m1 = mid(after), f = after.length >= 2 && spread(before) > 8 ? spread(after) / spread(before) : 1;
        this.nudgeView(f, m0[0], m0[1], m1[0] - m0[0], m1[1] - m0[1]); this.render(); return;
      }
      if (e.pointerType === 'mouse' && this.opts.tool === 'draw') { this.hover = pt(e); this.render(); }
      if (this.stroke && e.pointerId === this.stroke.id) {
        const evs = e.getCoalescedEvents?.() ?? []; this.extend(evs.length ? evs.map(pt) : [pt(e)]);
      } else if (this.opts.tool === 'stamp' && (this.stamping === e.pointerId || e.pointerType === 'mouse')) {
        const p = pt(e); this.ghost = { x: p[0], y: p[1] }; this.render();
      }
    };
    const up = (e: PointerEvent) => {
      if (this.gesture?.delete(e.pointerId)) { if (!this.gesture.size) { this.gesture = null; this.done(); } return; }
      if (this.stroke && e.pointerId === this.stroke.id) { this.stroke = null; this.autosave(); }
      if (this.stamping === e.pointerId) {
        this.stamping = null; const p = pt(e);
        if (e.type === 'pointerup') this.stampAt(p[0], p[1]);
        if (e.pointerType !== 'mouse' || e.type !== 'pointerup') this.ghost = null;
        this.render();
      }
    };
    const leave = () => { if (this.hover) { this.hover = null; this.render(); } if (this.stamping === null && this.ghost) { this.ghost = null; this.render(); } };
    let spun = 0, last = 0, stepped = false;
    const wheel = (e: WheelEvent) => {   // scroll over the sticker to change pen or stamp size
      if (this.opts.tool === 'photo' && this.src) {                          // scroll or pinch to zoom the photo
        e.preventDefault(); const r = view.getBoundingClientRect();
        this.zoomPhoto(Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0025)), ((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height, false); return;
      }
      if (e.ctrlKey || e.metaKey) return;                                    // a trackpad pinch: leave zooming alone
      if (this.opts.tool !== 'draw' && this.opts.tool !== 'stamp') return;
      e.preventDefault();
      if (e.timeStamp - last > 180) { spun = 0; stepped = false; }           // one size step per swipe, however long it coasts
      last = e.timeStamp; if (stepped) return;
      spun += e.deltaY;
      if (Math.abs(spun) >= 30) { this.nudgeSize(spun < 0 ? 1 : -1); stepped = true; }
    };
    view.addEventListener('wheel', wheel, { passive: false });
    view.addEventListener('pointerdown', down); view.addEventListener('pointermove', move);
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up); view.addEventListener('pointerleave', leave);
    this.render();
    return () => {
      view.removeEventListener('wheel', wheel); view.removeEventListener('pointerdown', down); view.removeEventListener('pointermove', move);
      view.removeEventListener('pointerup', up); view.removeEventListener('pointercancel', up); view.removeEventListener('pointerleave', leave);
      if (this.view === view) this.view = null;
    };
  }
  render() {
    if (this.queued) return; this.queued = true;
    requestAnimationFrame(() => { this.queued = false; this.draw(); });
  }
  private draw() {
    const v = this.view; if (!v) return;
    const c = v.getContext('2d')!, b = this.bits(), im = (this.viewData ??= c.createImageData(W, H)), px = new Uint32Array(im.data.buffer);
    for (let i = 0; i < W * H; i++) px[i] = b[i] ? 0xff000000 : 0xffffffff;   // one reused buffer: no canvas per frame
    c.putImageData(im, 0, 0);
    if (this.opts.tool === 'draw' && this.opts.mirror > 1) {   // guide lines, on screen only
      c.save(); c.strokeStyle = 'rgba(77,163,255,.9)'; c.lineWidth = 1.5; c.setLineDash([6, 6]);
      const n = this.opts.mirror === 2 ? 1 : this.opts.mirror === 4 ? 2 : 6;
      for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i * Math.PI) / n; c.beginPath(); c.moveTo(C - 200 * Math.cos(a), C - 200 * Math.sin(a)); c.lineTo(C + 200 * Math.cos(a), C + 200 * Math.sin(a)); c.stroke(); }
      c.restore();
    }
    if (this.hover && this.opts.tool === 'draw') {
      const r = Math.max(2, (this.opts.eraser ? this.opts.eraserSize : this.opts.pen) / 2);
      c.save(); c.beginPath(); c.arc(this.hover[0], this.hover[1], r, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke(); c.lineWidth = 1.5; c.strokeStyle = '#4DA3FF'; c.stroke(); c.restore();
    }
    if (this.ghost && this.opts.tool === 'stamp') { c.save(); c.globalAlpha = 0.6; drawStamp(c, this.opts.stamp, this.ghost.x, this.ghost.y, this.opts.stampSize); c.restore(); }
  }

  // ---- drawing ----
  private images(p: [number, number]): [number, number][] {
    const [x, y] = p, m = this.opts.mirror;
    if (m === 1) return [p];
    if (m === 2) return [p, [W - x, y]];
    if (m === 4) return [p, [W - x, y], [x, H - y], [W - x, H - y]];
    const out: [number, number][] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3, cs = Math.cos(a), sn = Math.sin(a);
      for (const sx of [1, -1]) { const dx = (x - C) * sx, dy = y - C; out.push([C + dx * cs - dy * sn, C + dx * sn + dy * cs]); }
    }
    return out;
  }
  private extend(pts: [number, number][]) {
    const s = this.stroke; if (!s) return;
    const c = this.ictx, o = this.opts;
    c.save(); c.lineCap = c.lineJoin = 'round'; const size = o.eraser ? o.eraserSize : o.pen; c.lineWidth = size;
    if (o.eraser) { c.globalCompositeOperation = 'destination-out'; c.strokeStyle = c.fillStyle = '#000'; }
    else { const pat = o.pattern === 'solid' ? '#000' : o.pattern === 'white' ? '#fff' : c.createPattern(patternTile(o.pattern), 'repeat')!; c.strokeStyle = c.fillStyle = pat; }
    for (const p of pts) {
      const im = this.images(p);
      im.forEach((q, i) => {
        const from = s.last[i];
        if (!from) { c.beginPath(); c.arc(q[0], q[1], size / 2, 0, Math.PI * 2); c.fill(); }
        else { c.beginPath(); c.moveTo(from[0], from[1]); c.lineTo(q[0], q[1]); c.stroke(); }
      });
      s.last = im;
    }
    c.restore(); this.render();
  }
  stampAt(x: number, y: number, quiet = false) {
    if (!quiet) this.begin();
    drawStamp(this.ictx, this.opts.stamp, x, y, this.opts.stampSize);
    if (!quiet) { play('pop'); this.done(); }
  }
  fillAt(x: number, y: number) {
    const mask = floodMask(this.bits(), x, y), fn = patternById(this.opts.fillPattern).fn;
    this.begin();
    const im = this.ictx.getImageData(0, 0, W, H), d = im.data;
    for (let i = 0; i < W * H; i++) if (mask[i]) { const v = fn(i % W, (i / W) | 0) ? 0 : 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    this.ictx.putImageData(im, 0, 0); play('fill'); this.done();
  }

  // ---- photo ----
  setPhoto(img: CanvasImageSource, sw: number, sh: number) {
    const k = Math.min(1, 1400 / Math.max(sw, sh)), c = makeCanvas(Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k)));
    ctx2d(c).drawImage(img, 0, 0, c.width, c.height);
    this.begin(); this.src = c; this.pv = { z: 1, x: 0, y: 0 }; this.photoLevel = 0; this.redither(); play('snap'); this.done();
  }
  private redither() {
    const src = this.src; if (!src) return;
    const t = makeCanvas(), x = ctx2d(t); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.imageSmoothingQuality = 'high';
    const s = Math.max(W / src.width, H / src.height) * this.pv.z, w = src.width * s, h = src.height * s;
    x.drawImage(src, (W - w) / 2 + this.pv.x, (H - h) / 2 + this.pv.y, w, h);
    const g = luma(x.getImageData(0, 0, W, H).data, W * H);
    for (let i = 0; i < g.length; i++) g[i] = (g[i] - 128) * 1.15 + 128 + this.photoLevel * 35;
    this.photo = bitsToCanvas(fsDither(g, W, H), W, H);
  }
  setPhotoLevel(level: number) { if (!this.src) return; this.begin(); this.photoLevel = Math.max(-2, Math.min(2, level)); this.redither(); play('tap'); this.done(); }
  /** Applies a zoom about (px, py) and keeps a sliver of the picture on the sticker so it can't be lost off the edge. */
  private nudgeView(factor: number, px: number, py: number, dx = 0, dy = 0) {
    const src = this.src; if (!src) return;
    const v = this.pv, z = Math.max(0.25, Math.min(6, v.z * factor)), f = z / v.z;
    v.x = px - C - (px - C - v.x) * f + dx; v.y = py - C - (py - C - v.y) * f + dy; v.z = z;
    const s = Math.max(W / src.width, H / src.height) * z, mx = (src.width * s + W) / 2 - 40, my = (src.height * s + H) / 2 - 40;
    v.x = Math.max(-mx, Math.min(mx, v.x)); v.y = Math.max(-my, Math.min(my, v.y));
    this.photoDirty = true;
  }
  /** Zooms the photo. `step` makes it one Undo step with a click sound (buttons, keys); scrolling passes false. */
  zoomPhoto(factor: number, px = C, py = C, step = true) {
    if (!this.src) return;
    if (step) this.begin(); else if (this.lastEdit !== 'photo-zoom') this.begin('photo-zoom');
    this.nudgeView(factor, px, py); if (step) play('tap'); this.done();
  }
  fitPhoto() { if (!this.src) return; this.begin(); this.pv = { z: 1, x: 0, y: 0 }; this.redither(); play('tap'); this.done(); }
  removePhoto() { if (!this.photo) return; this.begin(); this.photo = null; this.src = null; play('undo'); this.done(); }

  // ---- magic ----
  /** Squashes photo and ink into one layer, then lets fn rewrite the dots. */
  private remap(fn: (src: Uint8Array, x: number, y: number) => number) {
    const src = this.bits(0, false); this.begin();
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = fn(src, x, y);
    this.photo = null; this.src = null; this.ictx.clearRect(0, 0, W, H); this.ictx.drawImage(bitsToCanvas(out, W, H), 0, 0);
    play('magic'); this.done();
  }
  effect(kind: 'invert' | 'flip' | 'spin' | 'kaleido' | 'outline') {
    const at = (s: Uint8Array, x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : s[y * W + x]);
    if (kind === 'invert') this.remap((s, x, y) => ((x - C) ** 2 + (y - C) ** 2 <= C * C ? 1 - s[y * W + x] : 0));
    if (kind === 'flip') this.remap((s, x, y) => s[y * W + (W - 1 - x)]);
    if (kind === 'spin') this.remap((s, x, y) => s[(H - 1 - x) * W + y]);
    if (kind === 'outline') this.remap((s, x, y) => (s[y * W + x] && !(at(s, x - 2, y) && at(s, x + 2, y) && at(s, x, y - 2) && at(s, x, y + 2)) ? 1 : 0));
    if (kind === 'kaleido') this.remap((s, x, y) => {
      const dx = x - C, dy = y - C, r = Math.hypot(dx, dy), w = Math.PI / 4;
      let a = Math.atan2(dy, dx) + Math.PI / 2; a = ((a % (2 * w)) + 2 * w) % (2 * w); if (a > w) a = 2 * w - a; a -= Math.PI / 2;
      return at(s, Math.round(C + r * Math.cos(a)), Math.round(C + r * Math.sin(a)));
    });
  }
  badge(b: Badge, name: string) {
    this.begin(); this.wipe();
    const n = name.trim();
    this.doc = { frame: b.frame, frameEmoji: b.emoji ?? '⭐', top: b.top ?? '', mid: b.mid ?? (b.name === 'mid' ? n || 'ME' : ''), bottom: b.bottom ?? (b.name === 'bottom' ? n.toUpperCase() : ''), font: b.font ?? 0 };
    if (b.emoji) { const keep = this.opts; this.opts = { ...keep, stamp: { kind: 'emoji', v: b.emoji }, stampSize: 150 }; this.stampAt(C, C + 6, true); this.opts = keep; }
    play('magic'); this.done();
  }
  surprise() {
    this.begin(); this.wipe();
    const all = STAMP_SETS.flatMap((s) => s.items), keep = this.opts, hero = pick(all);
    const frame = pick(FRAMES.filter((f) => f !== 'none'));
    this.doc = { ...EMPTY, frame, frameEmoji: pick(all), font: Math.floor(Math.random() * 4), top: Math.random() < 0.6 ? pick(SHOUTS) : '' };
    const style = Math.random();
    if (style < 0.35) {               // one big hero with little friends around it
      const friend = pick(all), n = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) { const a = Math.PI * (0.15 + (0.7 * i) / (n - 1)); this.opts = { ...keep, stamp: { kind: 'emoji', v: friend }, stampSize: 44 }; this.stampAt(C + 112 * Math.cos(a), C + 30 + 96 * Math.sin(a), true); }
      this.opts = { ...keep, stamp: { kind: 'emoji', v: hero }, stampSize: 150 }; this.stampAt(C, C, true);
    } else if (style < 0.65) {        // hero inside a patterned shape
      this.opts = { ...keep, stamp: { kind: 'shape', v: pick(['star', 'burst', 'heart', 'circle', 'cloud', 'flower']) }, stampSize: 250 }; this.stampAt(C, C + 8, true);
      this.opts = { ...keep, stamp: { kind: 'emoji', v: hero }, stampSize: 110 }; this.stampAt(C, C + 10, true);
    } else {                          // patterned background, hero on a white spot
      const fn = patternById(pick(['dots', 'spots', 'stripes', 'diag', 'checks', 'waves', 'zigzag', 'hearts', 'sparkle'])).fn;
      const bits = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) bits[i] = fn(i % W, (i / W) | 0) ? 1 : 0;
      this.ictx.drawImage(bitsToCanvas(bits, W, H), 0, 0);
      this.opts = { ...keep, stamp: { kind: 'shape', v: pick(['circle', 'burst', 'star']) }, stampSize: 230 }; this.stampAt(C, C + 6, true);
      this.opts = { ...keep, stamp: { kind: 'emoji', v: hero }, stampSize: 120 }; this.stampAt(C, C + 8, true);
    }
    this.opts = keep; play('magic'); this.done();
  }
  randomShape() { return pick(SHAPE_IDS); }
  badges() { return BADGES; }

  // ---- saving ----
  private autosave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ink: this.ink.toDataURL('image/png'), photo: this.photo?.toDataURL('image/png') ?? null, doc: this.doc })); } catch { /* storage full or off */ }
    }, 400);
  }
  private restore() {
    try {
      const g: unknown = JSON.parse(localStorage.getItem(GALLERY_KEY) ?? '[]');
      this.gallery = Array.isArray(g) ? g.filter(isPng).slice(0, GALLERY_MAX) : [];
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); if (!s || typeof s !== 'object') return;
      const d = (s.doc && typeof s.doc === 'object' ? s.doc : {}) as Record<string, unknown>;
      this.doc = { frame: (FRAMES as readonly string[]).includes(d.frame as string) ? (d.frame as string) : 'none', frameEmoji: str(d.frameEmoji, 8) || '⭐', top: str(d.top, 28), mid: str(d.mid, 18), bottom: str(d.bottom, 24), font: [0, 1, 2, 3].includes(d.font as number) ? (d.font as number) : 0 };
      const load = (url: string, fn: (i: HTMLImageElement) => void) => { const i = new Image(); i.onload = () => { fn(i); this.emit(); this.render(); }; i.src = url; };
      if (isPng(s.ink)) load(s.ink, (i) => this.ictx.drawImage(i, 0, 0));
      if (isPng(s.photo)) load(s.photo, (i) => { const c = makeCanvas(); ctx2d(c).drawImage(i, 0, 0); this.photo = c; });
    } catch { /* nothing saved */ }
  }
  /** Keeps a copy in "My stickers". Newest first; the oldest fall off the end. */
  keep(): boolean {
    if (this.isBlank()) return false;
    const url = this.toDataURL(); if (this.gallery[0] === url) return true;
    this.gallery = [url, ...this.gallery.filter((g) => g !== url)].slice(0, GALLERY_MAX);
    const ok = this.storeGallery(); this.emit(); return ok;
  }
  forget(i: number) { this.gallery = this.gallery.filter((_, k) => k !== i); this.storeGallery(); play('undo'); this.emit(); }
  private storeGallery() { try { localStorage.setItem(GALLERY_KEY, JSON.stringify(this.gallery)); return true; } catch { return false; } }
  /** Forgets every saved sticker and the one on screen (grown-ups panel). */
  eraseAll() {
    this.undoStack = []; this.redoStack = []; this.wipe(); this.gallery = [];
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(GALLERY_KEY); } catch { /* ignore */ }
    clearTimeout(this.saveTimer); this.emit(); this.render();
  }
  get hasPhoto() { return !!this.photo; }
  open(url: string) {
    if (!isPng(url)) return;
    const i = new Image();
    i.onload = () => { this.begin(); this.wipe(); this.ictx.drawImage(i, 0, 0); play('pop'); this.done(); };
    i.src = url;
  }
}

export const studio = new Studio();
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) (window as unknown as { __studio: Studio }).__studio = studio;   // for scripts/tour.mjs; not on the live site
