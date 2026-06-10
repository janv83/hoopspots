// Message protocol between the app and the overview worker.

import type { BBox } from '../geo';

export interface OverviewCluster {
  lat: number;
  lon: number;
  count: number;
  /** Supercluster id — null for single courts. */
  clusterId: number | null;
}

export type OverviewRequest =
  | { type: 'init'; url: string }
  | { type: 'clusters'; requestId: number; bbox: BBox; zoom: number }
  | { type: 'expansionZoom'; requestId: number; clusterId: number };

export type OverviewResponse =
  | { type: 'ready'; total: number }
  | { type: 'error'; message: string }
  | { type: 'clusters'; requestId: number; clusters: OverviewCluster[] }
  | { type: 'expansionZoom'; requestId: number; zoom: number };
