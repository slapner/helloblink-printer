import { describe, expect, it } from 'vitest';
import { H, W, WB, blankRows, packRows, rowPacket } from './printer';

// The row packing of the original single-file app, kept here as the reference.
function legacyRows(bits: Uint8Array) {
  const rows = [];
  for (let y = 0; y < H; y++) {
    const r = new Uint8Array(WB);
    for (let x = 0; x < W; x++) if (bits[y * W + x]) r[x >> 3] |= 0x80 >> (x & 7);
    rows.push(r);
  }
  return rows;
}

describe('printer protocol', () => {
  it('packs rows exactly as the original app did', () => {
    const bits = new Uint8Array(W * H);
    let s = 12345;
    for (let i = 0; i < bits.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; bits[i] = s & 0x10000 ? 1 : 0; }
    expect(packRows(bits)).toEqual(legacyRows(bits));
  });
  it('puts the leftmost dot in the most significant bit', () => {
    const bits = new Uint8Array(W * H); bits[0] = 1; bits[W - 1] = 1; bits[W + 8] = 1;
    const rows = packRows(bits);
    expect(rows).toHaveLength(384);
    expect(rows[0][0]).toBe(0x80); expect(rows[0][47]).toBe(0x01); expect(rows[1][1]).toBe(0x80);
  });
  it('wraps each row in a one-row GS v 0 command', () => {
    const row = new Uint8Array(WB).fill(0xaa);
    const pkt = rowPacket(row);
    expect([...pkt.slice(0, 8)]).toEqual([0x1d, 0x76, 0x30, 0x00, 0x30, 0x00, 0x01, 0x00]);
    expect(pkt).toHaveLength(56); expect([...pkt.slice(8)]).toEqual([...row]);
  });
  it('clamps blank feed rows', () => {
    expect(blankRows(120)).toHaveLength(120); expect(blankRows(-5)).toHaveLength(0); expect(blankRows(99999)).toHaveLength(2000);
  });
});
