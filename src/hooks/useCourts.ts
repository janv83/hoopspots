import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bboxContains, padBBox } from '../geo';
import type { BBox } from '../geo';
import { fetchCourts } from '../api/overpass';
import type { Court } from '../types';
import type { Viewport } from '../components/MapView';

/** Below this zoom an Overpass query would cover too much area. */
export const MIN_FETCH_ZOOM = 10;

const DEBOUNCE_MS = 350;
/** Fetch a generously padded area so small pans hit the cache. */
const PAD_RATIO = 0.25;

export type CourtsStatus = 'idle' | 'zoomedOut' | 'loading' | 'ready' | 'error';

interface CourtsResult {
  courts: Court[];
  courtsById: ReadonlyMap<string, Court>;
  status: CourtsStatus;
  retry: () => void;
}

/**
 * Loads courts for the current map viewport: debounced, abortable, and with
 * a bbox cache — areas that were already fetched are never requested again.
 * Results accumulate, so panning back and forth stays instant and offline-friendly.
 */
export function useCourts(viewport: Viewport | null): CourtsResult {
  const [courtsById, setCourtsById] = useState<ReadonlyMap<string, Court>>(new Map());
  const [status, setStatus] = useState<CourtsStatus>('idle');
  const [attempt, setAttempt] = useState(0);
  const fetchedAreas = useRef<BBox[]>([]);

  useEffect(() => {
    if (!viewport) return;
    if (viewport.zoom < MIN_FETCH_ZOOM) {
      setStatus('zoomedOut');
      return;
    }
    if (fetchedAreas.current.some((area) => bboxContains(area, viewport.bbox))) {
      setStatus('ready');
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStatus('loading');
      const area = padBBox(viewport.bbox, PAD_RATIO);
      fetchCourts(area, controller.signal).then(
        (courts) => {
          fetchedAreas.current.push(area);
          setCourtsById((prev) => {
            const next = new Map(prev);
            for (const court of courts) next.set(court.id, court);
            return next;
          });
          setStatus('ready');
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
  }, [viewport, attempt]);

  const courts = useMemo(() => [...courtsById.values()], [courtsById]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { courts, courtsById, status, retry };
}
