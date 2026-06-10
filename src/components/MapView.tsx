// Thin React wrapper around Leaflet + Supercluster. All mutable map objects
// live in refs; React props flow one way into the map, map events flow back
// up via callbacks. The event handlers only ever touch refs, so the closures
// created on mount stay valid for the lifetime of the map.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import Supercluster from 'supercluster';
import type { BBox, LatLon } from '../geo';
import type { Court } from '../types';
import type { OverviewSource } from '../overview/overviewClient';

export interface Viewport {
  bbox: BBox;
  zoom: number;
  center: LatLon;
}

export interface MapTarget {
  lat: number;
  lon: number;
  zoom: number;
  /** Fresh value per request so the same place can be targeted twice. */
  seq: number;
}

const TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const MAX_ZOOM = 19;

type CourtProps = { courtId: string };

function readViewport(map: L.Map): Viewport {
  const bounds = map.getBounds();
  const center = map.getCenter();
  return {
    bbox: {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    },
    zoom: map.getZoom(),
    center: { lat: center.lat, lon: center.lng },
  };
}

function courtIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span class="pin${selected ? ' pin--selected' : ''}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function clusterIcon(count: number): L.DivIcon {
  const size = count >= 100 ? 46 : count >= 25 ? 40 : 34;
  return L.divIcon({
    className: '',
    html: `<span class="cluster" style="width:${size}px;height:${size}px">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function buildIndex(courts: Court[]): Supercluster<CourtProps> {
  const index = new Supercluster<CourtProps>({ radius: 56, maxZoom: 17 });
  index.load(
    courts.map((court) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [court.lon, court.lat] },
      properties: { courtId: court.id },
    })),
  );
  return index;
}

interface MapViewProps {
  courts: Court[];
  selectedId: string | null;
  target: MapTarget | null;
  theme: 'light' | 'dark';
  initialView: { lat: number; lon: number; zoom: number };
  /** Worldwide static dataset, shown below `liveMinZoom`. */
  overview: OverviewSource | null;
  liveMinZoom: number;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onViewportChange: (viewport: Viewport) => void;
}

export function MapView({
  courts,
  selectedId,
  target,
  theme,
  initialView,
  overview,
  liveMinZoom,
  onSelect,
  onDeselect,
  onViewportChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const indexRef = useRef<Supercluster<CourtProps>>(buildIndex([]));
  const courtsByIdRef = useRef<Map<string, Court>>(new Map());
  const selectedRef = useRef(selectedId);
  const overviewRef = useRef(overview);
  const overviewRequest = useRef(0);
  const liveMinZoomRef = useRef(liveMinZoom);
  const onSelectRef = useRef(onSelect);
  const onDeselectRef = useRef(onDeselect);
  const onViewportChangeRef = useRef(onViewportChange);
  overviewRef.current = overview;
  liveMinZoomRef.current = liveMinZoom;
  onSelectRef.current = onSelect;
  onDeselectRef.current = onDeselect;
  onViewportChangeRef.current = onViewportChange;

  // Stable by construction: reads only refs, never props or state.
  const renderMarkers = () => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;

    if (Math.round(map.getZoom()) < liveMinZoomRef.current) {
      renderOverview(map, layer);
      return;
    }

    const bounds = map.getBounds();
    const features = indexRef.current.getClusters(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      Math.round(map.getZoom()),
    );

    layer.clearLayers();
    for (const feature of features) {
      const [lon, lat] = feature.geometry.coordinates;
      if ('cluster' in feature.properties) {
        const { cluster_id: clusterId, point_count: count } = feature.properties;
        L.marker([lat, lon], {
          icon: clusterIcon(count),
          title: String(count),
          bubblingMouseEvents: false,
        })
          .on('click', () => {
            const zoom = Math.min(indexRef.current.getClusterExpansionZoom(clusterId), MAX_ZOOM);
            map.flyTo([lat, lon], zoom, { duration: 0.5 });
          })
          .addTo(layer);
      } else {
        const { courtId } = feature.properties;
        const court = courtsByIdRef.current.get(courtId);
        L.marker([lat, lon], {
          icon: courtIcon(courtId === selectedRef.current),
          title: court?.name ?? '',
          riseOnHover: true,
          bubblingMouseEvents: false,
        })
          .on('click', () => onSelectRef.current(courtId))
          .addTo(layer);
      }
    }
  };

  // Async path for the worldwide dataset: ask the worker for clusters and
  // drop the response if the user has moved on in the meantime.
  const renderOverview = (map: L.Map, layer: L.LayerGroup) => {
    const source = overviewRef.current;
    if (!source) {
      layer.clearLayers();
      return;
    }
    const requestId = ++overviewRequest.current;
    const bounds = map.getBounds();
    const bbox = {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    };
    source.getClusters(bbox, Math.round(map.getZoom())).then((clusters) => {
      if (requestId !== overviewRequest.current || !mapRef.current) return;
      if (Math.round(mapRef.current.getZoom()) >= liveMinZoomRef.current) return;

      layer.clearLayers();
      for (const cluster of clusters) {
        const { lat, lon, count, clusterId } = cluster;
        if (clusterId !== null && count > 1) {
          L.marker([lat, lon], {
            icon: clusterIcon(count),
            title: String(count),
            bubblingMouseEvents: false,
          })
            .on('click', () => {
              source.getExpansionZoom(clusterId).then((zoom) => {
                mapRef.current?.flyTo([lat, lon], Math.min(zoom, MAX_ZOOM), { duration: 0.5 });
              });
            })
            .addTo(layer);
        } else {
          // Single court in the static dataset: zooming in loads its details live.
          L.marker([lat, lon], { icon: courtIcon(false), bubblingMouseEvents: false })
            .on('click', () => {
              mapRef.current?.flyTo([lat, lon], liveMinZoomRef.current, { duration: 0.6 });
            })
            .addTo(layer);
        }
      }
    });
  };

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      center: [initialView.lat, initialView.lon],
      zoom: initialView.zoom,
      maxZoom: MAX_ZOOM,
      worldCopyJump: true,
    });
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    map.on('moveend zoomend', () => {
      onViewportChangeRef.current(readViewport(map));
      renderMarkers();
    });
    map.on('click', () => onDeselectRef.current());
    onViewportChangeRef.current(readViewport(map));

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // initialView is intentionally read only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tilesRef.current?.remove();
    tilesRef.current = L.tileLayer(TILE_URLS[theme], {
      attribution: ATTRIBUTION,
      maxZoom: MAX_ZOOM,
    }).addTo(map);
  }, [theme]);

  useEffect(() => {
    courtsByIdRef.current = new Map(courts.map((court) => [court.id, court]));
    indexRef.current = buildIndex(courts);
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courts]);

  useEffect(() => {
    selectedRef.current = selectedId;
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // First render of the world view once the overview dataset is ready.
  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview]);

  useEffect(() => {
    if (target && mapRef.current) {
      mapRef.current.flyTo([target.lat, target.lon], target.zoom, { duration: 0.8 });
    }
  }, [target]);

  return <div ref={containerRef} className="map" role="application" aria-label="Map" />;
}
