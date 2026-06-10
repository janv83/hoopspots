import { useEffect, useRef, useState } from 'react';
import { searchPlaces } from '../api/nominatim';
import type { Place } from '../api/nominatim';
import { useI18n } from '../i18n';
import { IconSearch } from './Icons';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SearchBarProps {
  onPick: (place: Place) => void;
}

export function SearchBar({ onPick }: SearchBarProps) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setPlaces([]);
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus('loading');
      searchPlaces(trimmed, lang, controller.signal).then(
        (results) => {
          setPlaces(results);
          setActiveIndex(0);
          setStatus('ready');
          setOpen(true);
        },
        () => {
          if (!controller.signal.aborted) setStatus('error');
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, lang]);

  // Close the dropdown when focus or clicks leave the component.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const pick = (place: Place) => {
    onPick(place);
    setQuery('');
    setPlaces([]);
    setOpen(false);
    setStatus('idle');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || places.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % places.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + places.length) % places.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(places[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showDropdown = open && status !== 'idle';

  return (
    <div className="search" ref={rootRef}>
      <IconSearch className="search__icon" />
      <input
        className="search__input"
        type="text"
        role="combobox"
        aria-label={t('search.label')}
        aria-expanded={showDropdown}
        aria-controls="search-results"
        aria-activedescendant={showDropdown && places[activeIndex] ? `place-${places[activeIndex].id}` : undefined}
        aria-autocomplete="list"
        placeholder={t('search.placeholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showDropdown && (
        <ul className="search__results" id="search-results" role="listbox">
          {status === 'error' && <li className="search__note">{t('search.error')}</li>}
          {status === 'ready' && places.length === 0 && (
            <li className="search__note">{t('search.noResults')}</li>
          )}
          {places.map((place, index) => (
            <li key={place.id} role="presentation">
              <button
                type="button"
                id={`place-${place.id}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`search__result ${index === activeIndex ? 'search__result--active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(place)}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
