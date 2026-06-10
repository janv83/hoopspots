import { describe, expect, it } from 'vitest';
import { decodeOverview, encodeOverview } from '../overview/codec';

describe('overview codec', () => {
  it('round-trips points at 1e-5 precision', () => {
    const points = [
      { lat: 47.80951, lon: 13.05501 },
      { lat: -33.86882, lon: 151.20929 },
      { lat: 0, lon: 0 },
    ];
    expect(decodeOverview(encodeOverview(points))).toEqual(points);
  });

  it('handles the empty dataset', () => {
    expect(decodeOverview(encodeOverview([]))).toEqual([]);
  });

  it('rejects foreign buffers', () => {
    expect(() => decodeOverview(new ArrayBuffer(4))).toThrow();
    expect(() => decodeOverview(new TextEncoder().encode('not a dataset').buffer)).toThrow();
  });

  it('rejects truncated datasets', () => {
    const valid = encodeOverview([{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }]);
    expect(() => decodeOverview(valid.slice(0, 12))).toThrow(/truncated/);
  });
});
