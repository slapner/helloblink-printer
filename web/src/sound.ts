// Tiny synth so there are no audio files to load.
let ac: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem('muted') === '1'; } catch { /* private mode */ }

export const isMuted = () => muted;
export function setMuted(v: boolean) { muted = v; try { localStorage.setItem('muted', v ? '1' : '0'); } catch { /* ignore */ } }

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', vol = 0.12, slideTo?: number) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}

export type Sfx = 'tap' | 'pop' | 'fill' | 'undo' | 'clear' | 'magic' | 'snap' | 'oops' | 'start' | 'tada';
export function play(name: Sfx) {
  if (muted) return;
  try {
    ac ??= new AudioContext();
    if (ac.state === 'suspended') void ac.resume();
    switch (name) {
      case 'tap': tone(660, 0, 0.06, 'triangle', 0.08); break;
      case 'pop': tone(320, 0, 0.12, 'sine', 0.16, 900); break;
      case 'fill': tone(900, 0, 0.25, 'sine', 0.12, 220); break;
      case 'undo': tone(520, 0, 0.1, 'triangle', 0.1, 300); break;
      case 'clear': tone(400, 0, 0.3, 'sawtooth', 0.06, 80); break;
      case 'magic': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.06, 0.18, 'triangle', 0.09)); break;
      case 'snap': tone(1800, 0, 0.04, 'square', 0.06); tone(900, 0.05, 0.05, 'square', 0.05); break;
      case 'oops': tone(330, 0, 0.15, 'triangle', 0.1); tone(247, 0.16, 0.25, 'triangle', 0.1); break;
      case 'start': [392, 494, 587].forEach((f, i) => tone(f, i * 0.09, 0.12, 'square', 0.05)); break;
      case 'tada': [523, 659, 784].forEach((f, i) => tone(f, i * 0.11, 0.16, 'triangle', 0.12)); [1047, 1319, 1568].forEach((f) => tone(f, 0.36, 0.7, 'triangle', 0.08)); break;
    }
  } catch { /* no audio, no problem */ }
}
