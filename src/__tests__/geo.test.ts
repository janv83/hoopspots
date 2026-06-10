import { describe, expect, it } from 'vitest';
import {
  bboxContains,
  bboxContainsPoint,
  formatDistance,
  haversineKm,
  padBBox,
} from '../geo';

const SALZBURG = { lat: 47.8095, lon: 13.055 };
const VIENNA = { lat: 48.2082, lon: 16.3738 };

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(SALZBURG, SALZBURG)).toBe(0);
  });

  it('matches the known Salzburg–Vienna distance (~251 km)', () => {
    const km = haversineKm(SALZBURG, VIENNA);
    expect(km).toBeGreaterThan(240);
    expect(km).toBeLessThan(260);
  });
});

describe('bbox helpers', () => {
  const box = { south: 47, west: 13, north: 48, east: 14 };

  it('padBBox expands on every side', () => {
    expect(padBBox(box, 0.5)).toEqual({ south: 46.5, west: 12.5, north: 48.5, east: 14.5 });
  });

  it('bboxContains detects full containment', () => {
    expect(bboxContains(padBBox(box, 0.1), box)).toBe(true);
    expect(bboxContains(box, padBBox(box, 0.1))).toBe(false);
  });

  it('bboxContainsPoint checks all four edges', () => {
    expect(bboxContainsPoint(box, { lat: 47.5, lon: 13.5 })).toBe(true);
    expect(bboxContainsPoint(box, { lat: 46.9, lon: 13.5 })).toBe(false);
    expect(bboxContainsPoint(box, { lat: 47.5, lon: 14.1 })).toBe(false);
  });
});

describe('formatDistance', () => {
  it('uses metres below one kilometre', () => {
    expect(formatDistance(0.4231, 'de')).toBe('423 m');
  });

  it('uses one decimal below ten kilometres', () => {
    expect(formatDistance(2.46, 'en')).toBe('2.5 km');
    expect(formatDistance(2.46, 'de')).toBe('2,5 km');
  });

  it('drops decimals for long distances', () => {
    expect(formatDistance(123.4, 'en')).toBe('123 km');
  });
});
