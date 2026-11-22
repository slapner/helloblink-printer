// Small shared pieces: icons, mini previews, hold-to-open, stored settings.
import { useEffect, useRef, useState, type ReactNode } from 'react';

const PATHS: Record<string, string> = {
  pen: 'M4 20l1-5L16 4l4 4L9 19l-5 1z M14 6l4 4',
  eraser: 'M9 20h11 M4.5 14.5l9-9a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3L11 20H8l-3.5-3.5a1.5 1.5 0 0 1 0-2z M9.5 9.5l6 6',
  bucket: 'M3 12l8-8 8 8-7 7a2 2 0 0 1-3 0l-6-7z M8 4l3 3 M21.5 18c0 1.4-.8 2.5-1.5 2.5s-1.5-1.1-1.5-2.5S20 15 20 15s1.5 1.6 1.5 3z',
  stamp: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 14c1 2 2.5 3 4 3s3-1 4-3 M9 9.5v.6 M15 9.5v.6',
  words: 'M3 19L8 5h1l5 14 M5 14h7 M21 19v-7 M21 15.5a3 3 0 1 0-6 0 3 3 0 0 0 6 0z',
  frame: 'M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  badge: 'M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M8 3l2.5 6 M16 3l-2.5 6 M8 3h8 M12 13v4',
  magic: 'M4 20L15 9 M13 7l4 4 M19 2v4 M17 4h4 M7 3v3 M5.5 4.5h3 M20 14v3 M18.5 15.5h3',
  undo: 'M8 5L3 10l5 5 M3 10h11a5.5 5.5 0 0 1 0 11h-3',
  redo: 'M16 5l5 5-5 5 M21 10H10a5.5 5.5 0 0 0 0 11h3',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  spark: 'M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z',
  printer: 'M7 8V3h10v5 M17 17h3a1 1 0 0 0 1-1v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a1 1 0 0 0 1 1h3 M7 13h10v8H7z',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  lock: 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3',
  sound: 'M4 9h4l5-4v14l-5-4H4z M16.5 9a4 4 0 0 1 0 6 M19 6.5a8 8 0 0 1 0 11',
  mute: 'M4 9h4l5-4v14l-5-4H4z M17 9l4 6 M21 9l-4 6',
  close: 'M6 6l12 12 M18 6L6 18',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  image: 'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M15 9v.5',
  mirror: 'M12 3v18 M8 7l-5 5 5 5z M16 7l5 5-5 5z',
  four: 'M12 3v18 M3 12h18 M6 6l3 3 M18 6l-3 3 M6 18l3-3 M18 18l-3-3',
  flake: 'M12 2v20 M3.3 7l17.4 10 M3.3 17L20.7 7 M12 6l-2-2 M12 6l2-2 M12 18l-2 2 M12 18l2 2',
  spin: 'M20 12a8 8 0 1 1-3-6.2 M20 3v5h-5',
  half: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 3v18 M12 7h5 M12 11h8 M12 15h7.5 M12 19h3',
  dashes: 'M12 3a9 9 0 0 1 6 2.3 M20.5 9a9 9 0 0 1 0 6 M18 18.7A9 9 0 0 1 12 21 M6 18.7A9 9 0 0 1 3.5 15 M3.5 9A9 9 0 0 1 6 5.3',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  line: 'M5 19L19 5',
  check: 'M4 12l5 5L20 6',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
};
export function Icon({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.spark} />
    </svg>
  );
}

/** A small canvas drawn once per `dep`. `px` is the drawing size; CSS decides how big it looks. */
export function Mini({ px, draw, dep, className }: { px: number; draw: (c: CanvasRenderingContext2D) => void; dep?: unknown; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current!.getContext('2d')!; c.clearRect(0, 0, px, px); c.save(); draw(c); c.restore(); }, [dep, px]); // eslint-disable-line
  return <canvas ref={ref} width={px} height={px} className={className} />;
}

/** Button that only fires after being held down, so small fingers don't wander into settings. */
export function HoldButton({ ms = 2000, onHeld, children, label }: { ms?: number; onHeld: () => void; children: ReactNode; label: string }) {
  const [holding, setHolding] = useState(false); const t = useRef(0);
  const stop = () => { clearTimeout(t.current); setHolding(false); };
  const start = () => { clearTimeout(t.current); setHolding(true); t.current = window.setTimeout(() => { setHolding(false); onHeld(); }, ms); };
  useEffect(() => stop, []);
  return (
    <button className={'btn round hold' + (holding ? ' holding' : '')} style={{ ['--ms' as string]: ms + 'ms' }} aria-label={label}
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}>
      {children}
    </button>
  );
}

export function useStored<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); return s === null ? init : (JSON.parse(s) as T); } catch { return init; } });
  return [v, (n: T) => { setV(n); try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* ignore */ } }];
}

export function Modal({ onClose, children, className = '', label }: { onClose?: () => void; children: ReactNode; className?: string; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="veil" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={'modal ' + className} role="dialog" aria-modal="true" aria-label={label}>
        {onClose && <button className="btn round close" onClick={onClose} aria-label="Close"><Icon name="close" size={26} /></button>}
        {children}
      </div>
    </div>
  );
}
