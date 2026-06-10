// Nominatim geocoding (place search). Called debounced and low-volume,
// in line with the public usage policy.

export interface Place {
  id: number;
  label: string;
  lat: number;
  lon: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export async function searchPlaces(
  query: string,
  language: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  url.searchParams.set('accept-language', language);
  url.searchParams.set('q', query);

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Nominatim error ${response.status}`);
  const results = (await response.json()) as NominatimResult[];
  return results.map((r) => ({
    id: r.place_id,
    label: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
  }));
}

export interface ReverseAddress {
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  country?: string;
}

/** "Lehen, Salzburg, Österreich" — most specific available part first. */
export function formatArea(address: ReverseAddress): string | null {
  const local = address.suburb ?? address.neighbourhood ?? address.quarter ?? address.hamlet;
  const place = address.city ?? address.town ?? address.village ?? address.municipality;
  const parts = [local, place, address.country].filter(
    (part, i, all) => part && part !== all[i - 1],
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Reverse-geocodes the surrounding area name of a court. */
export async function reverseArea(
  lat: number,
  lon: number,
  language: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '14');
  url.searchParams.set('accept-language', language);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Nominatim error ${response.status}`);
  const result = (await response.json()) as { address?: ReverseAddress };
  return result.address ? formatArea(result.address) : null;
}
