import { describe, expect, it } from 'vitest';
import { courtFromElement } from '../api/overpass';
import type { OverpassElement } from '../api/overpass';

function node(tags: Record<string, string> = {}, id = 1): OverpassElement {
  return { type: 'node', id, lat: 47.8, lon: 13.05, tags };
}

describe('courtFromElement', () => {
  it('maps a fully tagged node', () => {
    const court = courtFromElement(
      node({
        name: 'Lehener Park Court',
        surface: 'asphalt',
        hoops: '2',
        lit: 'yes',
        covered: 'no',
        access: 'yes',
        opening_hours: 'sunrise-sunset',
        website: 'https://example.org',
      }),
    );
    expect(court).toEqual({
      id: 'node/1',
      lat: 47.8,
      lon: 13.05,
      name: 'Lehener Park Court',
      surface: 'asphalt',
      hoops: 2,
      lit: true,
      covered: false,
      indoor: null,
      access: 'public',
      openingHours: 'sunrise-sunset',
      website: 'https://example.org',
      address: null,
    });
  });

  it('uses the centroid for ways and relations', () => {
    const court = courtFromElement({
      type: 'way',
      id: 42,
      center: { lat: 48.2, lon: 16.37 },
      tags: {},
    });
    expect(court).toMatchObject({ id: 'way/42', lat: 48.2, lon: 16.37 });
  });

  it('returns null when coordinates are missing', () => {
    expect(courtFromElement({ type: 'way', id: 7, tags: { name: 'x' } })).toBeNull();
  });

  it('treats missing tags as unknown, not false', () => {
    const court = courtFromElement(node());
    expect(court).toMatchObject({ name: null, hoops: null, lit: null, access: null });
  });

  it('parses hoops defensively', () => {
    expect(courtFromElement(node({ hoops: '4' }))?.hoops).toBe(4);
    expect(courtFromElement(node({ hoops: 'two' }))?.hoops).toBeNull();
    expect(courtFromElement(node({ hoops: '0' }))?.hoops).toBeNull();
  });

  it('maps access values to the three app categories', () => {
    expect(courtFromElement(node({ access: 'permissive' }))?.access).toBe('public');
    expect(courtFromElement(node({ access: 'customers' }))?.access).toBe('restricted');
    expect(courtFromElement(node({ access: 'private' }))?.access).toBe('private');
    expect(courtFromElement(node({ access: 'unknown-value' }))?.access).toBeNull();
  });

  it('falls back to contact:website', () => {
    expect(courtFromElement(node({ 'contact:website': 'https://b.org' }))?.website).toBe(
      'https://b.org',
    );
  });

  it('builds an address from addr tags', () => {
    const court = courtFromElement(
      node({
        'addr:street': 'Warwitzstraße',
        'addr:housenumber': '8',
        'addr:postcode': '5020',
        'addr:city': 'Salzburg',
      }),
    );
    expect(court?.address).toBe('Warwitzstraße 8, 5020 Salzburg');
  });
});
