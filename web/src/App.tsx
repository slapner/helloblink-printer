import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { BADGES, FONTS, FRAMES, SHAPE_IDS, STAMP_SETS, drawFrame, drawStamp, type Stamp } from './art';
import { W, blankRows, printer } from './printer';
import { PATTERNS, patternTile } from './raster';
import { isMuted, play, setMuted } from './sound';
import { studio, type Tool } from './studio';
import { HoldButton, Icon, Mini, Modal, useStored } from './ui';

const TOOLS: { id: Tool; label: string; icon: string; color: string }[] = [
  { id: 'draw', label: 'Draw', icon: 'pen', color: '#4DA3FF' },
  { id: 'fill', label: 'Fill', icon: 'bucket', color: '#FFC83D' },
  { id: 'stamp', label: 'Stamps', icon: 'stamp', color: '#FF8A3D' },
  { id: 'words', label: 'Words', icon: 'words', color: '#B58CFF' },
  { id: 'frame', label: 'Frames', icon: 'frame', color: '#FF6B6B' },
  { id: 'photo', label: 'Photo', icon: 'camera', color: '#3DD6D0' },
  { id: 'badge', label: 'Badges', icon: 'badge', color: '#5BD68A' },
  { id: 'magic', label: 'Magic', icon: 'magic', color: '#FF9EC4' },
];
const PENS = [5, 12, 24, 44];
const STAMP_SIZES = [56, 110, 170, 250];
const CONFETTI = ['#4DA3FF', '#FFC83D', '#FF8A3D', '#B58CFF', '#FF6B6B', '#3DD6D0', '#5BD68A', '#FF9EC4'];
const tileUrl = (id: string) => patternTile(id).toDataURL();

type Phase = null | 'wake' | 'printing' | 'done' | 'failed';

export default function App() {
  useSyncExternalStore(studio.subscribe, studio.getVersion);
  useSyncExternalStore(printer.subscribe, printer.getVersion);
  const o = studio.opts, tool = TOOLS.find((t) => t.id === o.tool)!;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [crisp, setCrisp] = useState(true);
  const [phase, setPhase] = useState<Phase>(null);
  const [fake, setFake] = useState(0);
  const [preview, setPreview] = useState('');
  const [thenPrint, setThenPrint] = useState(true);
  const wakeTicket = useRef(0);   // closing the wake card cancels the print that was waiting on it
  const closeWake = () => { wakeTicket.current++; setPhase(null); };
  const [panel, setPanel] = useState<null | 'gallery' | 'camera' | 'grownups'>(null);
  const [toast, setToast] = useState('');
  const [muted, setMute] = useState(isMuted());
  const [copies, setCopies] = useState(1);
  const [name, setName] = useStored('kid-name', '');
  const [inset, setInset] = useStored('print-inset', 0);
  const [tail, setTail] = useStored('print-tail', 120);
  const [practice, setPractice] = useStored('practice', false);
  const [thunk, setThunk] = useState(0);

  useEffect(() => {
    const el = canvas.current!; const detach = studio.attach(el);
    const ro = new ResizeObserver(() => setCrisp(Number.isInteger((el.clientWidth * devicePixelRatio) / W)));
    ro.observe(el);
    void printer.reconnect();
    return () => { detach(); ro.disconnect(); };
  }, []);
  useEffect(() => { setThunk((n) => n + 1); }, [studio.canUndo, studio.doc.frame]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || !(e.metaKey || e.ctrlKey)) return;
      const a = document.activeElement as HTMLElement | null; if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
      e.preventDefault(); e.shiftKey ? studio.redo() : studio.undo();
    };
    const paste = (e: ClipboardEvent) => { const f = [...(e.clipboardData?.files ?? [])][0]; if (f) loadFile(f); };
    addEventListener('keydown', key); addEventListener('paste', paste);
    return () => { removeEventListener('keydown', key); removeEventListener('paste', paste); };
  }, []);

  function pickTool(id: Tool) { play('tap'); studio.set({ tool: id }); }
  function loadFile(f?: File | null) {
    if (!f || !f.type.startsWith('image/')) return;
    const img = new Image();
    img.onload = () => { studio.setPhoto(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(img.src); };
    img.onerror = () => { play('oops'); setToast("That picture wouldn't open. Try another one!"); };
    img.src = URL.createObjectURL(f);
  }

  async function run() {
    setPreview(studio.toDataURL()); setPhase('printing'); play('start');
    let ok: boolean;
    if (practice) {
      ok = true;
      for (let i = 0; i <= 30; i++) { setFake(i / 30); await new Promise((r) => setTimeout(r, 70)); }
    } else ok = await printer.sendRows(studio.printRows(inset, tail, copies));
    if (ok) { studio.keep(); play('tada'); setPhase('done'); } else { play('oops'); setPhase('failed'); }
  }
  async function onPrint() {
    if (phase === 'printing' || printer.state === 'printing') return;
    if (studio.isBlank()) { play('oops'); setToast('Make a sticker first, then print it!'); return; }
    if (practice || printer.state === 'awake') return run();
    setThenPrint(true); setPhase('wake');
  }
  async function wake() {
    const ticket = ++wakeTicket.current, ok = await printer.connect();
    if (ticket !== wakeTicket.current) return;
    if (!ok) { play('oops'); return; }
    if (thenPrint) await run(); else { play('magic'); setPhase(null); setToast('The printer is awake!'); }
  }

  const progress = practice ? fake : printer.progress;
  const face = printer.state === 'awake' || printer.state === 'printing' ? 'awake' : printer.state === 'waking' ? 'waking' : 'asleep';

  return (
    <div className="app" style={{ '--accent': tool.color } as CSSProperties}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); }}>
      <header className="top">
        <h1><span className="logo"><Icon name="spark" size={26} /></span>Sticker Studio</h1>
        <div className="top-right">
          <button className={'btn pill face ' + face} onClick={() => { play('tap'); if (practice) setToast('Practice mode: no paper is used.'); else if (printer.connected) setToast('The printer is awake and ready!'); else { setThenPrint(false); setPhase('wake'); } }}>
            <Icon name="printer" size={26} />
            <span>{practice ? 'Practice' : printer.state === 'unsupported' ? 'No printer' : face === 'awake' ? 'Ready' : face === 'waking' ? 'Waking…' : 'Asleep'}</span>
          </button>
          <button className="btn pill" onClick={() => { play('tap'); setPanel('gallery'); }}><Icon name="grid" size={26} /><span>My stickers</span>{studio.gallery.length > 0 && <b className="count">{studio.gallery.length}</b>}</button>
          <button className="btn round" aria-label={muted ? 'Sound on' : 'Sound off'} onClick={() => { setMuted(!muted); setMute(!muted); if (muted) play('tap'); }}><Icon name={muted ? 'mute' : 'sound'} size={26} /></button>
          <HoldButton label="Grown-ups: hold for two seconds" onHeld={() => setPanel('grownups')}><Icon name="lock" size={26} /></HoldButton>
        </div>
      </header>

      <div className="acts acts-a">
        <button className="btn act" disabled={!studio.canUndo} onClick={() => studio.undo()}><Icon name="undo" /><span>Undo</span></button>
        <button className="btn act" disabled={!studio.canRedo} onClick={() => studio.redo()}><Icon name="redo" /><span>Redo</span></button>
      </div>

      <section className="stage">
        <div className="backing">
          <div className={'sticker'}>
            <canvas ref={canvas} width={W} height={W} className={(crisp ? 'crisp ' : '') + 'tool-' + o.tool} aria-label="Your sticker. Draw here." />
            <i className="thunk" key={thunk} />
          </div>
          <i className="peel" />
        </div>
      </section>

      <div className="acts acts-b">
        <button className="btn act" onClick={() => { const ok = studio.keep(); play(ok ? 'tap' : 'oops'); setToast(ok ? 'Saved to My stickers!' : studio.isBlank() ? 'Make a sticker first, then keep it!' : 'My stickers is full. Throw some away first.'); }}><Icon name="heart" /><span>Keep</span></button>
        <button className="btn act danger" onClick={() => studio.clear()}><Icon name="trash" /><span>Start over</span></button>
      </div>

      <nav className="rail" aria-label="Tools">
        {TOOLS.map((t) => (
          <button key={t.id} className="btn tool" aria-pressed={o.tool === t.id} style={{ '--c': t.color } as CSSProperties} onClick={() => pickTool(t.id)}>
            <Icon name={t.icon} size={34} /><span>{t.label}</span>
          </button>
        ))}
      </nav>

      <section className="tray" key={o.tool} aria-label={tool.label + ' choices'}>
        <Tray name={name} setName={setName} openCamera={() => setPanel('camera')} loadFile={loadFile} />
      </section>

      <footer className="go">
        <button className="btn surprise" onClick={() => studio.surprise()}><Icon name="spark" size={34} /><span>Surprise me!</span></button>
        <button className="btn copy cycle" aria-label={'How many stickers: ' + copies} onClick={() => { play('tap'); setCopies((copies % 3) + 1); }}>×{copies}</button>
        <div className="copies" role="group" aria-label="How many stickers">
          {[1, 2, 3].map((n) => (
            <button key={n} className="btn copy" aria-pressed={copies === n} onClick={() => { play('tap'); setCopies(n); }}>×{n}</button>
          ))}
        </div>
        <button className={'btn print' + (studio.canUndo ? ' wiggle' : '')} onClick={onPrint} disabled={phase === 'printing'}>
          <Icon name="printer" size={40} /><span>Print!</span>
        </button>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}

      {phase === 'wake' && (
        <Modal onClose={closeWake} label="Wake up the printer" className="center">
          <div className={'bigface ' + (printer.state === 'waking' ? 'waking' : 'asleep')}><Icon name="printer" size={96} /><b>z</b><b>z</b><b>z</b></div>
          {printer.state === 'unsupported' ? (
            <>
              <h2>This screen can't reach the printer</h2>
              <p>You can still draw and keep your stickers. Ask a grown-up about printing.</p>
              <p className="fine">{window.isSecureContext
                ? 'Grown-ups: this browser has no Web Bluetooth. Safari and Chrome on iPad and iPhone cannot connect to Bluetooth printers from a web page. Use Chrome on a Mac, PC or Android device, or an iPad browser app that adds Web Bluetooth, such as Bluefy (it needs an https address).'
                : 'Grown-ups: Bluetooth only works on a secure address (https, or localhost on the computer running the app). This page was opened over plain http.'}</p>
            </>
          ) : (
            <>
              <h2>The printer is asleep</h2>
              <p>Turn it on, then ask a grown-up to help wake it up.</p>
              <button className="btn print" disabled={printer.state === 'waking'} onClick={wake}><Icon name="printer" size={36} /><span>{printer.state === 'waking' ? 'Waking up…' : 'Wake up printer'}</span></button>
            </>
          )}
        </Modal>
      )}
      {phase === 'printing' && (
        <Modal label="Printing" className="center">
          <div className="machine"><div className="paper" style={{ transform: `translateY(${-18 - 60 * progress}%)` }}><img src={preview} alt="" /></div><div className="slot" /></div>
          <h2>Printing{copies > 1 ? ` ${copies} stickers` : ''}…</h2>
          <div className="bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        </Modal>
      )}
      {phase === 'done' && (
        <Modal onClose={() => setPhase(null)} label="Printed" className="center">
          <Confetti />
          <div className="tada"><img src={preview} alt="Your sticker" /></div>
          <h2>Ta-da! {practice ? 'Practice print done' : 'Your sticker is ready'}</h2>
          <div className="row">
            <button className="btn big" onClick={() => { setPhase(null); studio.clear(); }}><Icon name="spark" /><span>Make a new one</span></button>
            <button className="btn big alt" onClick={() => setPhase(null)}><Icon name="pen" /><span>Keep going</span></button>
          </div>
        </Modal>
      )}
      {phase === 'failed' && (
        <Modal onClose={() => setPhase(null)} label="Printing stopped" className="center">
          <div className="bigface asleep"><Icon name="printer" size={96} /></div>
          <h2>Oops, the printer stopped</h2>
          <p>Your sticker is safe. Check the printer is on, then try again.</p>
          <button className="btn print" onClick={onPrint}><Icon name="printer" size={36} /><span>Try again</span></button>
        </Modal>
      )}
      {panel === 'gallery' && (
        <Modal onClose={() => setPanel(null)} label="My stickers">
          <h2>My stickers</h2>
          {studio.gallery.length === 0 ? <p>Stickers you print or keep will show up here.</p> : (
            <div className="gallery">
              {studio.gallery.map((g, i) => (
                <div className="saved" key={g.slice(-48) + i}>
                  <button className="thumb" aria-label={'Open sticker ' + (i + 1)} onClick={() => { studio.open(g); setPanel(null); }}><img src={g} alt="" /></button>
                  <button className="btn round bin" aria-label={'Throw away sticker ' + (i + 1)} onClick={() => studio.forget(i)}><Icon name="trash" size={20} /></button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      {panel === 'camera' && <Camera onClose={() => setPanel(null)} />}
      {panel === 'grownups' && (
        <Modal onClose={() => setPanel(null)} label="Grown-ups" className="grown">
          <h2>Grown-ups</h2>
          <p className="status">Printer: <b>{printer.state === 'unsupported' ? 'this browser has no Web Bluetooth' : printer.connected ? 'connected to ' + printer.name : printer.state === 'waking' ? 'connecting…' : 'not connected'}</b></p>
          <div className="row">
            {printer.connected
              ? <button className="btn small" onClick={() => printer.disconnect()}>Disconnect</button>
              : <button className="btn small" disabled={printer.state !== 'asleep'} onClick={() => void printer.connect()}>Connect printer</button>}
            <button className="btn small" disabled={printer.state !== 'awake'} onClick={() => void printer.sendRows(blankRows(80))}>Feed paper</button>
          </div>
          <label className="check"><input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} /> Practice mode: Print plays the animation but sends nothing to the printer</label>
          <label>Shrink the print towards the middle: {inset} dots<input type="range" min={0} max={80} value={inset} onChange={(e) => setInset(+e.target.value)} /></label>
          <label>Blank rows fed after each sticker<input type="number" min={0} max={2000} value={tail} onChange={(e) => setTail(Math.max(0, Math.min(2000, +e.target.value || 0)))} /></label>
          <RawHex />
          <pre className="log">{printer.log.map((l, i) => <div key={i} className={l.bad ? 'bad' : ''}>{l.text}</div>)}</pre>
        </Modal>
      )}
    </div>
  );
}

function Tray({ name, setName, openCamera, loadFile }: { name: string; setName: (v: string) => void; openCamera: () => void; loadFile: (f?: File | null) => void }) {
  const o = studio.opts, d = studio.doc;
  const [set, setSet] = useState('animals');
  const file = useRef<HTMLInputElement>(null);
  const tap = (fn: () => void) => () => { play('tap'); fn(); };
  const patterns = (current: string, choose: (id: string) => void, skip: string[] = []) => PATTERNS.filter((p) => !skip.includes(p.id)).map((p) => (
    <button key={p.id} className="btn chip swatch" aria-pressed={current === p.id} aria-label={p.name} title={p.name} style={{ backgroundImage: `url(${tileUrl(p.id)})` }} onClick={tap(() => choose(p.id))} />
  ));

  switch (o.tool) {
    case 'draw': return (
      <>
        <div className="group">
          {PENS.map((s) => (
            <button key={s} className="btn chip" aria-pressed={(o.eraser ? o.eraserSize : o.pen) === s} aria-label={'Size ' + s} onClick={tap(() => studio.set(o.eraser ? { eraserSize: s } : { pen: s }))}><i className="dot" style={{ width: Math.min(40, s), height: Math.min(40, s) }} /></button>
          ))}
          <button className="btn chip wide" aria-pressed={o.eraser} onClick={tap(() => studio.set({ eraser: !o.eraser }))}><Icon name="eraser" /><span>Rub out</span></button>
        </div>
        <div className="group">{patterns(o.pattern, (id) => studio.set({ pattern: id, eraser: false }))}</div>
        <div className="group">
          {([[1, 'line', 'One'], [2, 'mirror', 'Mirror'], [4, 'four', 'Four'], [12, 'flake', 'Snowflake']] as const).map(([m, icon, label]) => (
            <button key={m} className="btn chip wide" aria-pressed={o.mirror === m} onClick={tap(() => studio.set({ mirror: m }))}><Icon name={icon} /><span>{label}</span></button>
          ))}
        </div>
      </>
    );
    case 'fill': return (
      <>
        <p className="hint">Pick a pattern, then tap inside a shape to fill it.</p>
        <div className="group">{patterns(o.fillPattern, (id) => studio.set({ fillPattern: id }))}</div>
      </>
    );
    case 'stamp': {
      const items: Stamp[] = set === 'shapes' ? SHAPE_IDS.map((v) => ({ kind: 'shape', v })) : (STAMP_SETS.find((s) => s.id === set) ?? STAMP_SETS[0]).items.map((v) => ({ kind: 'emoji', v }));
      return (
        <>
          <div className="group">
            {STAMP_SIZES.map((s, i) => (
              <button key={s} className="btn chip" aria-pressed={o.stampSize === s} aria-label={['Small', 'Medium', 'Big', 'Huge'][i]} onClick={tap(() => studio.set({ stampSize: s }))}><i className="size" style={{ fontSize: 14 + i * 9 }}>★</i></button>
            ))}
            <span className="sep" />
            {STAMP_SETS.map((s) => (
              <button key={s.id} className="btn chip tab" aria-pressed={set === s.id} aria-label={s.id} onClick={tap(() => setSet(s.id))}><Mini px={96} dep={s.icon} draw={(c) => drawStamp(c, { kind: 'emoji', v: s.icon }, 48, 48, 80)} /></button>
            ))}
            <button className="btn chip tab" aria-pressed={set === 'shapes'} aria-label="shapes" onClick={tap(() => setSet('shapes'))}><Mini px={96} dep="shape" draw={(c) => drawStamp(c, { kind: 'shape', v: 'star' }, 48, 48, 80)} /></button>
          </div>
          <div className="group">
            {items.map((s) => (
              <button key={s.v} className="btn chip" aria-pressed={o.stamp.v === s.v} aria-label={s.v} onClick={tap(() => studio.set({ stamp: s }))}><Mini px={96} dep={s.v} draw={(c) => drawStamp(c, s, 48, 48, 84)} /></button>
            ))}
          </div>
        </>
      );
    }
    case 'words': return (
      <>
        <div className="fields">
          <label><span>Round the top</span><input value={d.top} maxLength={28} placeholder="SUPER STAR" enterKeyHint="done" onChange={(e) => studio.setWords('top', e.target.value)} /></label>
          <label><span>In the middle</span><input value={d.mid} maxLength={18} placeholder="Hello!" enterKeyHint="done" onChange={(e) => studio.setWords('mid', e.target.value)} /></label>
          <label><span>Round the bottom</span><input value={d.bottom} maxLength={24} placeholder="YOUR NAME" enterKeyHint="done" onChange={(e) => studio.setWords('bottom', e.target.value)} /></label>
        </div>
        <div className="group">
          {FONTS.map((f, i) => (
            <button key={f.name} className="btn chip wide font" aria-pressed={d.font === i} style={{ fontFamily: f.css, fontWeight: f.weight as 'bold' }} onClick={() => studio.setFont(i)}>Abc</button>
          ))}
        </div>
      </>
    );
    case 'frame': return (
      <div className="group">
        {FRAMES.map((f) => (
          <button key={f} className="btn chip frame" aria-pressed={d.frame === f} aria-label={f + ' frame'} onClick={() => studio.setFrame(f)}>
            <Mini px={144} dep={f + (f === 'emoji' ? (o.stamp.kind === 'emoji' ? o.stamp.v : d.frameEmoji) : '')} draw={(c) => { c.scale(144 / W, 144 / W); c.fillStyle = '#fff'; c.beginPath(); c.arc(192, 192, 192, 0, 7); c.fill(); if (f === 'none') { c.strokeStyle = '#bbb'; c.lineWidth = 6; c.setLineDash([16, 16]); c.beginPath(); c.arc(192, 192, 170, 0, 7); c.stroke(); } else drawFrame(c, f, o.stamp.kind === 'emoji' ? o.stamp.v : d.frameEmoji); }} />
          </button>
        ))}
      </div>
    );
    case 'photo': return (
      <>
        <div className="group">
          <button className="btn chip wide" onClick={tap(() => file.current?.click())}><Icon name="image" /><span>Pick a picture</span></button>
          <button className="btn chip wide" onClick={tap(openCamera)}><Icon name="camera" /><span>Camera</span></button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {studio.photo ? (
          <div className="group">
            {studio.canTunePhoto && <button className="btn chip wide" disabled={studio.photoLevel >= 2} onClick={() => studio.setPhotoLevel(studio.photoLevel + 1)}><Icon name="sun" /><span>Lighter</span></button>}
            {studio.canTunePhoto && <button className="btn chip wide" disabled={studio.photoLevel <= -2} onClick={() => studio.setPhotoLevel(studio.photoLevel - 1)}><Icon name="moon" /><span>Darker</span></button>}
            <button className="btn chip wide" onClick={() => studio.removePhoto()}><Icon name="trash" /><span>Take away</span></button>
          </div>
        ) : <p className="hint">Add a photo, then draw and stamp on top of it.</p>}
      </>
    );
    case 'badge': return (
      <>
        <div className="fields one"><label><span>Your name</span><input value={name} maxLength={14} placeholder="Type your name" enterKeyHint="done" onChange={(e) => setName(e.target.value)} /></label></div>
        <div className="group">
          {BADGES.map((b) => (
            <button key={b.id} className="btn chip wide badge" onClick={() => studio.badge(b, name)}>
              {b.emoji ? <Mini px={96} dep={b.emoji} draw={(c) => drawStamp(c, { kind: 'emoji', v: b.emoji! }, 48, 48, 84)} /> : <Icon name="words" />}<span>{b.label}</span>
            </button>
          ))}
        </div>
      </>
    );
    case 'magic': return (
      <div className="group">
        {([['invert', 'half', 'Swap black & white'], ['flip', 'mirror', 'Flip'], ['spin', 'spin', 'Spin'], ['kaleido', 'flake', 'Kaleidoscope'], ['outline', 'dashes', 'Outlines']] as const).map(([k, icon, label]) => (
          <button key={k} className="btn chip wide" onClick={() => studio.effect(k)}><Icon name={icon} /><span>{label}</span></button>
        ))}
      </div>
    );
  }
}

function Camera({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'starting' | 'live' | 'none'>('starting');
  useEffect(() => {
    let stream: MediaStream | null = null, gone = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false })
      .then((s) => { stream = s; if (gone) { s.getTracks().forEach((t) => t.stop()); return; } video.current!.srcObject = s; setState('live'); })
      .catch(() => setState('none'));
    if (!navigator.mediaDevices) setState('none');
    return () => { gone = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  const snap = () => { const v = video.current!; if (!v.videoWidth) return; studio.setPhoto(v, v.videoWidth, v.videoHeight); onClose(); };
  return (
    <Modal onClose={onClose} label="Camera" className="center">
      <div className="lens"><video ref={video} autoPlay playsInline muted /></div>
      {state === 'none' ? <><h2>The camera is hiding</h2><p>Ask a grown-up to let this page use the camera.</p></> : (
        <button className="btn print" disabled={state !== 'live'} onClick={snap}><Icon name="camera" size={36} /><span>Snap!</span></button>
      )}
    </Modal>
  );
}

function RawHex() {
  const [hex, setHex] = useState('');
  const send = async () => {
    const h = hex.replace(/[^0-9a-f]/gi, '');
    if (!h || h.length % 2) { printer.addLog('Hex must be whole bytes', true); return; }
    try { await printer.sendRaw(h.match(/../g)!.map((x) => parseInt(x, 16))); } catch (e) { printer.addLog(String((e as Error).message), true); }
  };
  return (
    <label>Send raw bytes (hex), for testing
      <span className="row"><input value={hex} placeholder="1d 67 53" onChange={(e) => setHex(e.target.value)} /><button className="btn small" disabled={printer.state !== 'awake'} onClick={send}>Send</button></span>
    </label>
  );
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.5, dur: 1.4 + Math.random() * 1.2, color: CONFETTI[i % CONFETTI.length], rot: Math.random() * 360, w: 8 + Math.random() * 8 })), []);
  return <div className="confetti" aria-hidden="true">{bits.map((b, i) => <i key={i} style={{ left: b.left + '%', background: b.color, width: b.w, height: b.w * 1.6, animationDelay: b.delay + 's', animationDuration: b.dur + 's', transform: `rotate(${b.rot}deg)` }} />)}</div>;
}
