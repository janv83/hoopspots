import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n';
import type { Court } from '../types';
import { IconClose, IconExternal, IconRoute, IconShare } from './Icons';

const SURFACE_KEYS: Record<string, TranslationKey> = {
  asphalt: 'surface.asphalt',
  concrete: 'surface.concrete',
  'concrete:plates': 'surface.concrete',
  paving_stones: 'surface.paving_stones',
  tartan: 'surface.tartan',
  acrylic: 'surface.acrylic',
  rubber: 'surface.rubber',
  wood: 'surface.wood',
  grass: 'surface.grass',
  dirt: 'surface.dirt',
};

interface CourtDetailsProps {
  court: Court;
  onClose: () => void;
}

export function CourtDetails({ court, onClose }: CourtDetailsProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => setCopied(false), [court.id]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      /* clipboard unavailable — button simply stays unchanged */
    }
  };

  const surfaceLabel = court.surface
    ? SURFACE_KEYS[court.surface]
      ? t(SURFACE_KEYS[court.surface])
      : court.surface
    : null;

  const yesNo = (value: boolean) => (value ? t('common.yes') : t('common.no'));

  const rows: [string, string][] = [];
  if (court.hoops !== null) rows.push([t('court.hoops'), String(court.hoops)]);
  if (surfaceLabel) rows.push([t('court.surface'), surfaceLabel]);
  if (court.lit !== null) rows.push([t('court.lit'), yesNo(court.lit)]);
  if (court.indoor !== null) rows.push([t('court.indoor'), yesNo(court.indoor)]);
  else if (court.covered !== null) rows.push([t('court.covered'), yesNo(court.covered)]);
  if (court.access) rows.push([t('court.access'), t(`access.${court.access}`)]);
  if (court.openingHours) rows.push([t('court.openingHours'), court.openingHours]);
  if (court.address) rows.push([t('court.address'), court.address]);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${court.lat},${court.lon}`;
  const osmUrl = `https://www.openstreetmap.org/${court.id}`;

  return (
    <aside className="details" aria-label={court.name ?? t('court.unnamed')}>
      <header className="details__head">
        <h2 className="details__title">{court.name ?? t('court.unnamed')}</h2>
        <button type="button" className="iconbtn" aria-label={t('details.close')} onClick={onClose}>
          <IconClose />
        </button>
      </header>

      {rows.length > 0 && (
        <dl className="details__facts">
          {rows.map(([label, value]) => (
            <div className="details__row" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {court.website && (
        <p className="details__website">
          <a href={court.website} target="_blank" rel="noreferrer">
            {t('court.website')} <IconExternal />
          </a>
        </p>
      )}

      <div className="details__actions">
        <a className="btn btn--primary" href={directionsUrl} target="_blank" rel="noreferrer">
          <IconRoute /> {t('details.directions')}
        </a>
        <button type="button" className="btn" onClick={share}>
          <IconShare /> {copied ? t('details.shared') : t('details.share')}
        </button>
      </div>

      <p className="details__source">
        {t('details.source')}:{' '}
        <a href={osmUrl} target="_blank" rel="noreferrer">
          {t('details.osm')}
        </a>
      </p>
    </aside>
  );
}
