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
