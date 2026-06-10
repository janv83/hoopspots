import { formatDistance } from '../geo';
import { useI18n } from '../i18n';
import type { Court } from '../types';

export interface ListedCourt {
  court: Court;
  distanceKm: number;
}

interface CourtListProps {
  courts: ListedCourt[];
  hiddenCount: number;
  selectedId: string | null;
  onPick: (court: Court) => void;
}

export function CourtList({ courts, hiddenCount, selectedId, onPick }: CourtListProps) {
  const { t, lang } = useI18n();

  if (courts.length === 0) {
    return <p className="list__empty">{t('list.empty')}</p>;
  }

  return (
    <>
      <ul className="list">
        {courts.map(({ court, distanceKm }) => (
          <li key={court.id}>
            <button
              type="button"
              className={`list__item ${court.id === selectedId ? 'list__item--selected' : ''}`}
              aria-pressed={court.id === selectedId}
              onClick={() => onPick(court)}
            >
              <span className="list__name">{court.name ?? t('court.unnamed')}</span>
              <span className="list__meta">
                <span className="list__distance">{formatDistance(distanceKm, lang)}</span>
                {court.hoops !== null && (
                  <span className="badge">{`${court.hoops} ${t('court.hoops')}`}</span>
                )}
                {court.lit === true && <span className="badge">{t('court.lit')}</span>}
                {(court.indoor === true || court.covered === true) && (
                  <span className="badge">
                    {court.indoor === true ? t('court.indoor') : t('court.covered')}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <p className="list__more">{t('list.more', { count: String(hiddenCount) })}</p>
      )}
    </>
  );
}
