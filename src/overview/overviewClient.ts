// Main-thread handle for the overview worker: turns the postMessage protocol
// into promise-based calls and keeps only the latest pending requests.

import type { BBox } from '../geo';
import type { OverviewCluster, OverviewResponse } from './protocol';

export interface OverviewSource {
  getClusters(bbox: BBox, zoom: number): Promise<OverviewCluster[]>;
  getExpansionZoom(clusterId: number): Promise<number>;
  dispose(): void;
}

export const OVERVIEW_DATA_URL = '/data/courts-overview.bin.gz';

export function startOverview(
  onReady: (total: number) => void,
  onError: (message: string) => void,
): OverviewSource {
  const worker = new Worker(new URL('./overview.worker.ts', import.meta.url), {
    type: 'module',
  });
  const pending = new Map<number, (response: OverviewResponse) => void>();
  let nextRequestId = 1;

  worker.onmessage = (event: MessageEvent<OverviewResponse>) => {
    const message = event.data;
    if (message.type === 'ready') return onReady(message.total);
    if (message.type === 'error') return onError(message.message);
    pending.get(message.requestId)?.(message);
    pending.delete(message.requestId);
  };
  worker.onerror = () => onError('worker failed');
  worker.postMessage({ type: 'init', url: OVERVIEW_DATA_URL });

  function request<T>(
    build: (requestId: number) => unknown,
    pick: (response: OverviewResponse) => T,
  ): Promise<T> {
    const requestId = nextRequestId++;
    return new Promise((resolve) => {
      pending.set(requestId, (response) => resolve(pick(response)));
      worker.postMessage(build(requestId));
    });
  }

  return {
    getClusters: (bbox, zoom) =>
      request(
        (requestId) => ({ type: 'clusters', requestId, bbox, zoom }),
        (response) => (response.type === 'clusters' ? response.clusters : []),
      ),
    getExpansionZoom: (clusterId) =>
      request(
        (requestId) => ({ type: 'expansionZoom', requestId, clusterId }),
        (response) => (response.type === 'expansionZoom' ? response.zoom : 0),
      ),
    dispose: () => worker.terminate(),
  };
}
