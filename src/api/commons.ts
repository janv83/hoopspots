// Wikimedia Commons: photo URLs for tagged files and a geosearch fallback
// that finds a photo taken right next to a court. Parsing is pure and tested.

export interface CourtPhoto {
  thumbUrl: string;
  pageUrl: string | null;
  /** True when the photo was found nearby rather than tagged on the court. */
  nearby: boolean;
}

const PHOTO_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

export function commonsThumbUrl(file: string, width: number): string {
  const name = file.replace(/^File:/, '');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`;
}

export function commonsPageUrl(file: string): string {
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(file.replace(/ /g, '_'))}`;
}

interface GeosearchPage {
  title?: string;
  index?: number;
  imageinfo?: { thumburl?: string; descriptionurl?: string }[];
}

export function parseGeosearch(data: unknown): CourtPhoto | null {
  const pages = (data as { query?: { pages?: Record<string, GeosearchPage> } }).query?.pages;
  if (!pages) return null;

  const candidates = Object.values(pages)
    .filter((page) => page.title && PHOTO_EXTENSIONS.test(page.title))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  for (const page of candidates) {
    const info = page.imageinfo?.[0];
    if (info?.thumburl) {
      return { thumbUrl: info.thumburl, pageUrl: info.descriptionurl ?? null, nearby: true };
    }
  }
  return null;
}

/** Finds a Commons photo taken within ~120 m of the court. */
export async function findNearbyPhoto(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<CourtPhoto | null> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('generator', 'geosearch');
  url.searchParams.set('ggscoord', `${lat}|${lon}`);
  url.searchParams.set('ggsradius', '120');
  url.searchParams.set('ggslimit', '5');
  url.searchParams.set('ggsnamespace', '6');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url');
  url.searchParams.set('iiurlwidth', '640');

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Commons error ${response.status}`);
  return parseGeosearch(await response.json());
}
