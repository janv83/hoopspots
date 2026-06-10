import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { I18nProvider, useI18n } from './i18n';
import type { Lang } from './i18n';
import { MapView } from './components/MapView';
import type { MapTarget, Viewport } from './components/MapView';
import { SearchBar } from './components/SearchBar';
import { CourtList } from './components/CourtList';
import type { ListedCourt } from './components/CourtList';
import { CourtDetails } from './components/CourtDetails';
import { IconBall, IconLocate, IconMoon, IconSun } from './components/Icons';
import { useCourts, MIN_FETCH_ZOOM } from './hooks/useCourts';
import { startOverview } from './overview/overviewClient';
import type { OverviewSource } from './overview/overviewClient';
import { fetchCourtById } from './api/overpass';
import { bboxContainsPoint, haversineKm } from './geo';
import type { Place } from './api/nominatim';
import type { Court } from './types';

const DEFAULT_VIEW = { lat: 47.8095, lon: 13.055, zoom: 14 }; // Salzburg
const LIST_LIMIT = 40;
const THEME_KEY = 'hoopspots-theme';

type Theme = 'light' | 'dark';

interface MapInit {
  lat: number;
  lon: number;
  zoom: number;
}

// URL format: #map=14/47.80950/13.05500&court=node/123 — deep-linkable views.
function parseHash(): { view: MapInit; courtId: string | null } {
  const params = new URLSearchParams(location.hash.slice(1));
  const courtId = params.get('court');
  const parts = (params.get('map') ?? '').split('/').map(Number);
  const [zoom, lat, lon] = parts;
  const valid =
    parts.length === 3 && parts.every(Number.isFinite) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  return { view: valid ? { lat, lon, zoom } : DEFAULT_VIEW, courtId };
}

function writeHash(viewport: Viewport, courtId: string | null): void {
  const { zoom, center } = viewport;
  const map = `map=${Math.round(zoom)}/${center.lat.toFixed(5)}/${center.lon.toFixed(5)}`;
  const hash = courtId ? `#${map}&court=${courtId}` : `#${map}`;
  history.replaceState(null, '', hash);
}

function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  const prefersDark =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function Page() {
  const { t, lang, setLang } = useI18n();
  const initial = useMemo(parseHash, []);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initial.courtId);
  const [target, setTarget] = useState<MapTarget | null>(null);
  const [locateError, setLocateError] = useState(false);
  const { courts, courtsById, status, retry } = useCourts(viewport);
  // Holds a deep-linked court until its area has been loaded normally.
  const [linkedCourt, setLinkedCourt] = useState<Court | null>(null);
  // Worldwide static dataset, clustered in a web worker.
  const [overview, setOverview] = useState<OverviewSource | null>(null);
  const [worldTotal, setWorldTotal] = useState<number | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const source = startOverview(
      (total) => {
        setWorldTotal(total);
        setOverview(source);
      },
      () => {
        /* dataset unavailable — the app degrades to live-only loading */
      },
    );
    return () => source.dispose();
  }, []);

  const flyTo = useCallback((lat: number, lon: number, zoom: number) => {
    seq.current += 1;
    setTarget({ lat, lon, zoom, seq: seq.current });
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* private mode — non-critical */
    }
  }, [theme]);

  useEffect(() => {
    if (viewport) writeHash(viewport, selectedId);
  }, [viewport, selectedId]);

  // Resolve a deep-linked court that is not in the loaded data yet.
  useEffect(() => {
    if (!selectedId || courtsById.has(selectedId) || linkedCourt?.id === selectedId) return;
    const controller = new AbortController();
    fetchCourtById(selectedId, controller.signal).then(
      (court) => {
        if (!court) return;
        setLinkedCourt(court);
        flyTo(court.lat, court.lon, 16);
      },
      () => {
        /* deep link could not be resolved — map stays usable */
      },
    );
    return () => controller.abort();
  }, [selectedId, courtsById, linkedCourt, flyTo]);

  const selected = selectedId
    ? (courtsById.get(selectedId) ?? (linkedCourt?.id === selectedId ? linkedCourt : null))
    : null;

  const listed: ListedCourt[] = useMemo(() => {
    if (!viewport) return [];
    return courts
      .filter((court) => bboxContainsPoint(viewport.bbox, court))
      .map((court) => ({ court, distanceKm: haversineKm(viewport.center, court) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [courts, viewport]);

  const pickCourt = (court: Court) => {
    setSelectedId(court.id);
    flyTo(court.lat, court.lon, Math.max(viewport?.zoom ?? 16, 16));
  };

  const pickPlace = (place: Place) => flyTo(place.lat, place.lon, 14);

  const locate = () => {
    setLocateError(false);
    navigator.geolocation.getCurrentPosition(
      (position) => flyTo(position.coords.latitude, position.coords.longitude, 15),
      () => setLocateError(true),
      { timeout: 10_000 },
    );
  };

  const zoomedOut = (viewport?.zoom ?? MIN_FETCH_ZOOM) < MIN_FETCH_ZOOM;
  const countLabel = zoomedOut
    ? worldTotal !== null
      ? t('list.count', { count: new Intl.NumberFormat(lang).format(worldTotal) })
      : ''
    : listed.length === 1
      ? t('list.countOne')
      : t('list.count', { count: String(listed.length) });

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar__brand">
          <IconBall className="topbar__logo" />
          hoopspots
        </span>
        <SearchBar onPick={pickPlace} />
        <div className="topbar__controls">
          <button
            type="button"
            className={`iconbtn ${locateError ? 'iconbtn--error' : ''}`}
            aria-label={locateError ? t('locate.error') : t('locate.label')}
            title={locateError ? t('locate.error') : t('locate.label')}
            onClick={locate}
          >
            <IconLocate />
          </button>
          <div className="langswitch" role="group" aria-label={t('header.langLabel')}>
            {(['de', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                className={`langswitch__btn ${lang === l ? 'langswitch__btn--active' : ''}`}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="iconbtn"
            aria-pressed={theme === 'dark'}
            aria-label={t('header.theme')}
            title={t('header.theme')}
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="sidebar" aria-label={t('list.title')}>
          <div className="sidebar__head">
            <h1 className="sidebar__title">{t('list.title')}</h1>
            <span className="sidebar__count">{countLabel}</span>
          </div>
          <div className="sidebar__scroll">
            {zoomedOut ? (
              <p className="list__empty">
                {worldTotal !== null
                  ? t('list.world', { count: new Intl.NumberFormat(lang).format(worldTotal) })
                  : t('status.zoomedOut')}
              </p>
            ) : (
              <CourtList
                courts={listed.slice(0, LIST_LIMIT)}
                hiddenCount={Math.max(0, listed.length - LIST_LIMIT)}
                selectedId={selectedId}
                onPick={pickCourt}
              />
            )}
          </div>
          <footer className="sidebar__footer">
            <span>{t('footer.data')}</span>
            <span>
              {t('footer.credit')} ·{' '}
              <a href="https://github.com/janv83" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </span>
          </footer>
        </section>

        <section className="maparea">
          <MapView
            courts={courts}
            selectedId={selectedId}
            target={target}
            theme={theme}
            initialView={initial.view}
            overview={overview}
            liveMinZoom={MIN_FETCH_ZOOM}
            onSelect={setSelectedId}
            onDeselect={() => setSelectedId(null)}
            onViewportChange={setViewport}
          />
          {status === 'loading' && (
            <p className="mapstatus" role="status">
              <span className="spinner" aria-hidden="true" /> {t('status.loading')}
            </p>
          )}
          {status === 'zoomedOut' && zoomedOut && overview === null && (
            <p className="mapstatus" role="status">
              {t('status.zoomedOut')}
            </p>
          )}
          {status === 'error' && (
            <p className="mapstatus mapstatus--error" role="alert">
              {t('status.error')}{' '}
              <button type="button" className="mapstatus__retry" onClick={retry}>
                {t('status.retry')}
              </button>
            </p>
          )}
          {selected && <CourtDetails court={selected} onClose={() => setSelectedId(null)} />}
        </section>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <Page />
    </I18nProvider>
  );
}
