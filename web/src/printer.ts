// HelloBlink sticker printer (advertises as "HB-xxxx").
// Transport: Microchip transparent-UART BLE service. Protocol, read from the official app:
// each image row is its own raster command  1d 76 30 00 30 00 01 00 + 48 bytes (384 dots, 1 = black, MSB left).
export const W = 384, H = 384, WB = W / 8;
const SVC = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
const WR = '49535343-8841-43f4-a8d4-ecbe34729bb3';
const NT = '49535343-1e4d-4bd9-ba61-23c647249616';
export const ROW_HDR = [0x1d, 0x76, 0x30, 0x00, WB, 0x00, 0x01, 0x00];

/** bits: W*H entries, non-zero = black. Returns one 48-byte row per image row. */
export function packRows(bits: Uint8Array): Uint8Array[] {
  const rows: Uint8Array[] = [];
  for (let y = 0; y < H; y++) {
    const r = new Uint8Array(WB);
    for (let x = 0; x < W; x++) if (bits[y * W + x]) r[x >> 3] |= 0x80 >> (x & 7);
    rows.push(r);
  }
  return rows;
}
export function blankRows(n: number): Uint8Array[] {
  return Array.from({ length: Math.max(0, Math.min(2000, n | 0)) }, () => new Uint8Array(WB));
}
export function rowPacket(row: Uint8Array): Uint8Array {
  const pkt = new Uint8Array(8 + WB); pkt.set(ROW_HDR); pkt.set(row, 8); return pkt;
}

export type PrinterState = 'unsupported' | 'asleep' | 'waking' | 'awake' | 'printing';
type Listener = () => void;

// Web Bluetooth has no types in lib.dom; keep the surface we use loose.
type Bt = any;

class Printer {
  state: PrinterState = 'asleep';
  name = '';
  progress = 0;
  log: { text: string; bad?: boolean }[] = [];
  private device: Bt = null;
  private wr: Bt = null;
  private listeners = new Set<Listener>();
  private bt(): Bt { return (navigator as any).bluetooth; }

  constructor() { if (typeof navigator !== 'undefined' && !this.bt()) this.state = 'unsupported'; }
  subscribe = (fn: Listener) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private emit() { this.version++; this.listeners.forEach((f) => f()); }
  version = 0;
  getVersion = () => this.version;
  addLog(text: string, bad?: boolean) { this.log = [...this.log.slice(-200), { text, bad }]; this.emit(); }
  private set(s: PrinterState) { this.state = s; this.emit(); }
  get connected() { return this.state === 'awake' || this.state === 'printing'; }

  private async open(device: Bt) {
    this.device = device;
    device.addEventListener('gattserverdisconnected', () => { this.wr = null; this.addLog('disconnected'); this.set('asleep'); });
    const svc = await (await device.gatt.connect()).getPrimaryService(SVC);
    this.wr = await svc.getCharacteristic(WR);
    const nt = await svc.getCharacteristic(NT);
    nt.addEventListener('characteristicvaluechanged', (e: any) => {
      const b = new Uint8Array(e.target.value.buffer);
      const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ');
      const txt = String.fromCharCode(...[...b].filter((x) => x >= 32 && x < 127));
      this.addLog(`← ${hex}${txt.length > 2 ? '  "' + txt + '"' : ''}`);
    });
    await nt.startNotifications();
    this.name = device.name ?? 'printer';
    this.addLog('connected to ' + this.name);
    this.set('awake');
  }

  /** Must be called from a tap: opens the browser's Bluetooth chooser. Resolves true when connected. */
  async connect(): Promise<boolean> {
    if (!this.bt()) { this.set('unsupported'); return false; }
    if (this.connected) return true;
    try {
      this.set('waking');
      const device = await this.bt().requestDevice({ filters: [{ namePrefix: 'HB-' }], optionalServices: [SVC] });
      await this.open(device);
      return true;
    } catch (e: any) {
      this.addLog('connect: ' + (e?.message ?? e), e?.name !== 'NotFoundError');
      this.set('asleep');
      return false;
    }
  }

  /** Quietly reconnect to a printer this browser was already allowed to use. */
  async reconnect() {
    try {
      const devices: Bt[] = (await this.bt()?.getDevices?.()) ?? [];
      const d = devices.find((x) => (x.name ?? '').startsWith('HB-'));
      if (!d || this.connected || this.state !== 'asleep') return;
      // Stays "asleep" while trying, so a stalled attempt never blocks the Wake up button.
      const timeout = new Promise<never>((_, no) => setTimeout(() => no(new Error('timed out')), 6000));
      try { await Promise.race([this.open(d), timeout]); }
      catch (e) { if (!this.connected) d.gatt?.disconnect?.(); throw e; }
    } catch (e: any) { this.addLog('reconnect: ' + (e?.message ?? e)); }
  }

  disconnect() { this.device?.gatt?.disconnect(); }

  async sendRaw(bytes: number[]) {
    if (!this.wr) throw new Error('not connected');
    await this.wr.writeValueWithResponse(Uint8Array.from(bytes));
    this.addLog('→ ' + bytes.map((x) => x.toString(16).padStart(2, '0')).join(' '));
  }

  /** Sends rows one raster command at a time. Refuses to start while another job runs. */
  async sendRows(rows: Uint8Array[]): Promise<boolean> {
    if (this.state !== 'awake' || !this.wr) return false;
    this.progress = 0; this.set('printing');
    try {
      for (let i = 0; i < rows.length; i++) {
        await this.wr.writeValueWithResponse(rowPacket(rows[i]));
        if (i % 8 === 0) { this.progress = i / rows.length; this.emit(); }
      }
      this.progress = 1;
      return true;
    } catch (e: any) { this.addLog('print stopped: ' + (e?.message ?? e), true); return false; }
    finally { this.set(this.wr ? 'awake' : 'asleep'); }
  }
}

export const printer = new Printer();
