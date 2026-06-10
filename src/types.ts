// Domain model. Parsed once at the API boundary so the rest of the app
// never touches raw OSM tags.

export type CourtAccess = 'public' | 'restricted' | 'private';

export interface Court {
  /** OSM element id, e.g. "node/123" or "way/456" — globally unique & stable. */
  id: string;
  lat: number;
  lon: number;
  name: string | null;
  surface: string | null;
  hoops: number | null;
  lit: boolean | null;
  covered: boolean | null;
  indoor: boolean | null;
  access: CourtAccess | null;
  openingHours: string | null;
  website: string | null;
  address: string | null;
}
