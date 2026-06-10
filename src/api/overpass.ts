// Overpass API client: loads basketball pitches from OpenStreetMap.
// Parsing is a pure, exported function so it can be unit-tested without network.

import type { BBox } from '../geo';
import type { Court, CourtAccess } from '../types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Matches sport=basketball including multi-values like "basketball;soccer".
const SPORT_FILTER = '["leisure"="pitch"]["sport"~"(^|;)basketball($|;)"]';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function parseYesNo(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  return value !== 'no';
}

function parseHoops(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseAccess(value: string | undefined): CourtAccess | null {
  switch (value) {
    case 'yes':
    case 'public':
    case 'permissive':
      return 'public';
    case 'customers':
    case 'students':
    case 'members':
      return 'restricted';
    case 'private':
    case 'no':
      return 'private';
    default:
      return null;
  }
}

function buildAddress(tags: Record<string, string>): string | null {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  const address = [street, city].filter(Boolean).join(', ');
  return address || null;
}

export function courtFromElement(el: OverpassElement): Court | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined) return null;

  const tags = el.tags ?? {};
  return {
    id: `${el.type}/${el.id}`,
    lat,
    lon,
    name: tags.name ?? null,
    surface: tags.surface ?? null,
    hoops: parseHoops(tags.hoops),
    lit: parseYesNo(tags.lit),
    covered: parseYesNo(tags.covered),
    indoor: parseYesNo(tags.indoor),
    access: parseAccess(tags.access),
    openingHours: tags.opening_hours ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    address: buildAddress(tags),
    image: tags.image?.startsWith('http') ? tags.image : null,
    wikimediaCommons: tags.wikimedia_commons?.startsWith('File:')
      ? tags.wikimedia_commons
      : null,
  };
}

async function runQuery(query: string, signal?: AbortSignal): Promise<Court[]> {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!response.ok) throw new Error(`Overpass error ${response.status}`);
  const data = (await response.json()) as { elements?: OverpassElement[] };
  return (data.elements ?? [])
    .map(courtFromElement)
    .filter((court): court is Court => court !== null);
}

export function fetchCourts(bbox: BBox, signal?: AbortSignal): Promise<Court[]> {
  const bb = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return runQuery(`[out:json][timeout:25];nwr${SPORT_FILTER}(${bb});out tags center;`, signal);
}

/** Loads a single court for deep links like "#…&court=way/123". */
export async function fetchCourtById(id: string, signal?: AbortSignal): Promise<Court | null> {
  const [type, num] = id.split('/');
  if (!['node', 'way', 'relation'].includes(type) || !/^\d+$/.test(num ?? '')) return null;
  const courts = await runQuery(`[out:json][timeout:25];${type}(${num});out tags center;`, signal);
  return courts[0] ?? null;
}
