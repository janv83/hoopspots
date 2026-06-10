import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'de' | 'en';

const de = {
  'header.langLabel': 'Sprache',
  'header.theme': 'Dunkles Design',

  'search.label': 'Ort suchen',
  'search.placeholder': 'Stadt oder Adresse suchen …',
  'search.noResults': 'Keine Orte gefunden',
  'search.error': 'Suche fehlgeschlagen — bitte erneut versuchen',

  'locate.label': 'Meinen Standort anzeigen',
  'locate.error': 'Standort nicht verfügbar',

  'status.loading': 'Lade Courts …',
  'status.zoomedOut': 'Zoome näher heran, um Courts zu laden',
  'status.error': 'Courts konnten nicht geladen werden.',
  'status.retry': 'Erneut versuchen',

  'list.title': 'Courts im Sichtbereich',
  'list.count': '{count} Courts',
  'list.countOne': '1 Court',
  'list.empty': 'Keine Courts in diesem Ausschnitt. Verschiebe die Karte oder suche einen Ort.',
  'list.more': '+ {count} weitere — zoome näher heran',

  'court.unnamed': 'Basketballplatz',
  'court.hoops': 'Körbe',
  'court.surface': 'Belag',
  'court.lit': 'Beleuchtet',
  'court.covered': 'Überdacht',
  'court.indoor': 'Halle',
  'court.access': 'Zugang',
  'court.openingHours': 'Öffnungszeiten',
  'court.website': 'Webseite',
  'court.address': 'Adresse',

  'access.public': 'öffentlich',
  'access.restricted': 'eingeschränkt',
  'access.private': 'privat',

  'surface.asphalt': 'Asphalt',
  'surface.concrete': 'Beton',
  'surface.paving_stones': 'Pflastersteine',
  'surface.tartan': 'Tartan',
  'surface.acrylic': 'Acryl',
  'surface.rubber': 'Gummi',
  'surface.wood': 'Holz',
  'surface.grass': 'Rasen',
  'surface.dirt': 'Erde',

  'details.directions': 'Route planen',
  'details.osm': 'Auf OpenStreetMap ansehen',
  'details.share': 'Link kopieren',
  'details.shared': 'Kopiert!',
  'details.close': 'Schließen',
  'details.source': 'Quelle',

  'common.yes': 'Ja',
  'common.no': 'Nein',

  'footer.credit': 'Konzept & Umsetzung: Jan Veit',
  'footer.data': 'Daten © OpenStreetMap-Mitwirkende (ODbL)',
} as const;

export type TranslationKey = keyof typeof de;

const en: Record<TranslationKey, string> = {
  'header.langLabel': 'Language',
  'header.theme': 'Dark mode',

  'search.label': 'Search for a place',
  'search.placeholder': 'Search city or address …',
  'search.noResults': 'No places found',
  'search.error': 'Search failed — please try again',

  'locate.label': 'Show my location',
  'locate.error': 'Location unavailable',

  'status.loading': 'Loading courts …',
  'status.zoomedOut': 'Zoom in to load courts',
  'status.error': 'Courts could not be loaded.',
  'status.retry': 'Try again',

  'list.title': 'Courts in view',
  'list.count': '{count} courts',
  'list.countOne': '1 court',
  'list.empty': 'No courts in this area. Move the map or search for a place.',
  'list.more': '+ {count} more — zoom in',

  'court.unnamed': 'Basketball court',
  'court.hoops': 'Hoops',
  'court.surface': 'Surface',
  'court.lit': 'Lit',
  'court.covered': 'Covered',
  'court.indoor': 'Indoor',
  'court.access': 'Access',
  'court.openingHours': 'Opening hours',
  'court.website': 'Website',
  'court.address': 'Address',

  'access.public': 'public',
  'access.restricted': 'restricted',
  'access.private': 'private',

  'surface.asphalt': 'Asphalt',
  'surface.concrete': 'Concrete',
  'surface.paving_stones': 'Paving stones',
  'surface.tartan': 'Tartan',
  'surface.acrylic': 'Acrylic',
  'surface.rubber': 'Rubber',
  'surface.wood': 'Wood',
  'surface.grass': 'Grass',
  'surface.dirt': 'Dirt',

  'details.directions': 'Get directions',
  'details.osm': 'View on OpenStreetMap',
  'details.share': 'Copy link',
  'details.shared': 'Copied!',
  'details.close': 'Close',
  'details.source': 'Source',

  'common.yes': 'Yes',
  'common.no': 'No',

  'footer.credit': 'Concept & development: Jan Veit',
  'footer.data': 'Data © OpenStreetMap contributors (ODbL)',
};

const dicts: Record<Lang, Record<TranslationKey, string>> = { de, en };

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('de');

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string>) => {
      let text: string = dicts[lang][key];
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replace(`{${name}}`, value);
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
