// Pure geo helpers — framework-free and unit-tested.

export interface LatLon {
  lat: number;
  lon: number;
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLon, b: LatLon): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Expands a bbox by `ratio` of its own size on every side. */
export function padBBox(b: BBox, ratio: number): BBox {
  const dLat = (b.north - b.south) * ratio;
  const dLon = (b.east - b.west) * ratio;
  return {
    south: b.south - dLat,
    west: b.west - dLon,
    north: b.north + dLat,
    east: b.east + dLon,
  };
}

export function bboxContains(outer: BBox, inner: BBox): boolean {
  return (
    outer.south <= inner.south &&
    outer.west <= inner.west &&
    outer.north >= inner.north &&
    outer.east >= inner.east
  );
}

export function bboxContainsPoint(b: BBox, p: LatLon): boolean {
  return p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east;
}

export function formatDistance(km: number, locale: string): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  const digits = km < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(km)} km`;
}
