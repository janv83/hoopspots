// Web worker: holds the worldwide overview dataset (~336k courts) and a
// Supercluster index over it, so clustering never blocks the UI thread.

import Supercluster from 'supercluster';
import { decodeOverview } from './codec';
import type { OverviewRequest, OverviewResponse } from './protocol';

// The DOM lib types `self` as Window; narrow it to what a worker actually has.
const worker = self as unknown as {
  postMessage(message: OverviewResponse): void;
  onmessage: ((event: MessageEvent<OverviewRequest>) => void) | null;
};

let index: Supercluster | null = null;

async function loadDataset(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const raw = await response.arrayBuffer();

  // The file is gzipped; if a CDN already decoded it transparently the gzip
  // magic bytes are gone and the buffer can be used as is.
  const bytes = new Uint8Array(raw);
  const isGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip) return raw;

  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

async function init(url: string): Promise<void> {
  const points = decodeOverview(await loadDataset(url));
  index = new Supercluster({ radius: 56, maxZoom: 17 });
  index.load(
    points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {},
    })),
  );
  worker.postMessage({ type: 'ready', total: points.length });
}

worker.onmessage = (event) => {
  const message = event.data;

  if (message.type === 'init') {
    init(message.url).catch((error: unknown) => {
      worker.postMessage({ type: 'error', message: String(error) });
    });
    return;
  }

  if (!index) return;

  if (message.type === 'clusters') {
    const { bbox, zoom, requestId } = message;
    const clusters = index
      .getClusters([bbox.west, bbox.south, bbox.east, bbox.north], zoom)
      .map((feature) => {
        const [lon, lat] = feature.geometry.coordinates;
        const isCluster = 'cluster' in feature.properties;
        return {
          lat,
          lon,
          count: isCluster ? feature.properties.point_count : 1,
          clusterId: isCluster ? feature.properties.cluster_id : null,
        };
      });
    worker.postMessage({ type: 'clusters', requestId, clusters });
    return;
  }

  if (message.type === 'expansionZoom') {
    worker.postMessage({
      type: 'expansionZoom',
      requestId: message.requestId,
      zoom: index.getClusterExpansionZoom(message.clusterId),
    });
  }
};
