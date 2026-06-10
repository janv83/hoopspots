// Binary format of the worldwide overview dataset (public/data/courts-overview.bin.gz):
//   uint32 LE magic "HSP1" | uint32 LE count | count × (int32 LE lat·1e5, int32 LE lon·1e5)
// ~8 bytes per court instead of ~90 bytes of JSON. The encoder lives in
// scripts/build-overview.mjs; both sides are covered by a round-trip test.

import type { LatLon } from '../geo';

export const OVERVIEW_MAGIC = 0x48535031; // "HSP1"

const SCALE = 1e5;

export function encodeOverview(points: LatLon[]): ArrayBuffer {
  const buffer = new ArrayBuffer(8 + points.length * 8);
  const view = new DataView(buffer);
  view.setUint32(0, OVERVIEW_MAGIC, true);
  view.setUint32(4, points.length, true);
  points.forEach((p, i) => {
    view.setInt32(8 + i * 8, Math.round(p.lat * SCALE), true);
    view.setInt32(12 + i * 8, Math.round(p.lon * SCALE), true);
  });
  return buffer;
}

export function decodeOverview(buffer: ArrayBuffer): LatLon[] {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8 || view.getUint32(0, true) !== OVERVIEW_MAGIC) {
    throw new Error('Not an overview dataset');
  }
  const count = view.getUint32(4, true);
  if (buffer.byteLength < 8 + count * 8) throw new Error('Overview dataset truncated');

  const points: LatLon[] = new Array(count);
  for (let i = 0; i < count; i++) {
    points[i] = {
      lat: view.getInt32(8 + i * 8, true) / SCALE,
      lon: view.getInt32(12 + i * 8, true) / SCALE,
    };
  }
  return points;
}
