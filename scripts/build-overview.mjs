// Harvests every basketball court on the planet from Overpass and writes a
// compact binary overview dataset for the world map (see src/overview/codec.ts
// for the format: "HSP1" magic, uint32 count, int32-LE lat/lon pairs ×1e5).
//
// Usage: node scripts/build-overview.mjs
// Output: public/data/courts-overview.bin.gz

import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// overpass-api.de answers 406 to requests without a User-Agent; the OSM
// usage policy asks for an identifiable one anyway.
const USER_AGENT = 'hoopspots-build/1.0 (https://github.com/janv83/hoopspots)';

const FILTER = '["leisure"="pitch"]["sport"~"(^|;)basketball($|;)"]';
const PAUSE_MS = 1500;
const MIN_SPAN_DEG = 2; // do not split below this latitude span

const courts = new Map(); // "type/id" -> [lat, lon]
let endpointIndex = 0;
let queryCount = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function queryBox({ south, west, north, east }) {
  const query =
    `[out:json][timeout:180][maxsize:536870912];` +
    `nwr${FILTER}(${south},${west},${north},${east});out skel center qt;`;
  const endpoint = ENDPOINTS[endpointIndex % ENDPOINTS.length];
  queryCount += 1;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${endpoint}`);
  const data = await response.json();
  // Overpass reports server-side timeouts as HTTP 200 with a "remark" and a
  // truncated (often empty) element list — that is a failure, not a result.
  if (data.remark) throw new Error(`Overpass remark: ${String(data.remark).slice(0, 120)}`);
  if (!Array.isArray(data.elements)) throw new Error('No elements array in response');
  return data.elements;
}

function addElements(elements) {
  let added = 0;
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const key = `${el.type}/${el.id}`;
    if (!courts.has(key)) added += 1;
    courts.set(key, [lat, lon]);
  }
  return added;
}

async function harvest(box, depth = 0) {
  const label = `(${box.south},${box.west})..(${box.north},${box.east})`;
  for (let attempt = 0; attempt < ENDPOINTS.length; attempt++) {
    try {
      const elements = await queryBox(box);
      const added = addElements(elements);
      console.log(`ok   ${label} -> ${elements.length} elements (${added} new, total ${courts.size})`);
      await sleep(PAUSE_MS);
      return;
    } catch (error) {
      console.warn(`fail ${label} attempt ${attempt + 1}: ${error.message}`);
      endpointIndex += 1; // rotate endpoint
      await sleep(8000);
    }
  }
  // Both attempts failed: split the box along its latitude midline and recurse.
  if (box.north - box.south <= MIN_SPAN_DEG) {
    throw new Error(`Giving up on ${label} — box already minimal`);
  }
  const midLat = (box.south + box.north) / 2;
  console.log(`split ${label} at lat ${midLat} (depth ${depth + 1})`);
  await harvest({ ...box, north: midLat }, depth + 1);
  await harvest({ ...box, south: midLat }, depth + 1);
}

function encode() {
  const points = [...courts.values()];
  const buffer = new ArrayBuffer(8 + points.length * 8);
  const view = new DataView(buffer);
  view.setUint32(0, 0x48535031, true); // "HSP1"
  view.setUint32(4, points.length, true);
  points.forEach(([lat, lon], i) => {
    view.setInt32(8 + i * 8, Math.round(lat * 1e5), true);
    view.setInt32(12 + i * 8, Math.round(lon * 1e5), true);
  });
  return Buffer.from(buffer);
}

const bands = [];
for (let west = -180; west < 180; west += 15) {
  bands.push({ south: -60, west, north: 72, east: west + 15 });
}

const startedAt = Date.now();
for (const band of bands) {
  await harvest(band);
}

const raw = encode();
const gzipped = gzipSync(raw, { level: 9 });
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'courts-overview.bin.gz');
writeFileSync(outFile, gzipped);

console.log('');
console.log(`courts:   ${courts.size}`);
console.log(`queries:  ${queryCount}`);
console.log(`raw:      ${(raw.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`gzipped:  ${(gzipped.length / 1024 / 1024).toFixed(2)} MB -> ${outFile}`);
console.log(`duration: ${Math.round((Date.now() - startedAt) / 1000)}s`);
