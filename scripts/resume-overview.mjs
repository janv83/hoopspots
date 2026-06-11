// Resumes an interrupted build-overview.mjs run: loads the existing
// courts-overview.bin.gz, harvests only the longitude bands given on the
// command line, and rewrites the merged file after every completed chunk so
// an interruption never loses progress.
//
// Usage: node scripts/resume-overview.mjs 0 15
//        (band west edges; each band is 15 deg wide, lat -60..72 as in the full build)

import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const USER_AGENT = 'hoopspots-build/1.0 (https://github.com/janv83/hoopspots)';
const FILTER = '["leisure"="pitch"]["sport"~"(^|;)basketball($|;)"]';
const PAUSE_MS = 1500;
const MIN_SPAN_DEG = 2;

const outFile = join(
  dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'courts-overview.bin.gz',
);

// The binary format stores no OSM ids, so the merged set is keyed by the
// coordinates as stored (1e5 fixed point) — exact-duplicate points collapse.
const courts = new Map(); // "lat1e5,lon1e5" -> [lat1e5, lon1e5]
let endpointIndex = 0;
let queryCount = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function addPoint(lat, lon) {
  const la = Math.round(lat * 1e5);
  const lo = Math.round(lon * 1e5);
  const key = `${la},${lo}`;
  const isNew = !courts.has(key);
  courts.set(key, [la, lo]);
  return isNew;
}

function loadExisting() {
  if (!existsSync(outFile)) return;
  const raw = gunzipSync(readFileSync(outFile));
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  if (view.getUint32(0, true) !== 0x48535031) throw new Error('Bad magic in existing file');
  const count = view.getUint32(4, true);
  for (let i = 0; i < count; i++) {
    const la = view.getInt32(8 + i * 8, true);
    const lo = view.getInt32(12 + i * 8, true);
    courts.set(`${la},${lo}`, [la, lo]);
  }
  console.log(`loaded ${courts.size} existing courts from ${outFile}`);
}

function save() {
  const points = [...courts.values()];
  const buffer = new ArrayBuffer(8 + points.length * 8);
  const view = new DataView(buffer);
  view.setUint32(0, 0x48535031, true); // "HSP1"
  view.setUint32(4, points.length, true);
  points.forEach(([la, lo], i) => {
    view.setInt32(8 + i * 8, la, true);
    view.setInt32(12 + i * 8, lo, true);
  });
  const gzipped = gzipSync(Buffer.from(buffer), { level: 9 });
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, gzipped);
  console.log(`saved ${points.length} courts (${(gzipped.length / 1024 / 1024).toFixed(2)} MB)`);
}

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
  if (data.remark) throw new Error(`Overpass remark: ${String(data.remark).slice(0, 120)}`);
  if (!Array.isArray(data.elements)) throw new Error('No elements array in response');
  return data.elements;
}

async function harvest(box, depth = 0) {
  const label = `(${box.south},${box.west})..(${box.north},${box.east})`;
  for (let attempt = 0; attempt < ENDPOINTS.length; attempt++) {
    try {
      const elements = await queryBox(box);
      let added = 0;
      for (const el of elements) {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (lat === undefined || lon === undefined) continue;
        if (addPoint(lat, lon)) added += 1;
      }
      console.log(`ok   ${label} -> ${elements.length} elements (${added} new, total ${courts.size})`);
      await sleep(PAUSE_MS);
      return;
    } catch (error) {
      console.warn(`fail ${label} attempt ${attempt + 1}: ${error.message}`);
      endpointIndex += 1;
      await sleep(8000);
    }
  }
  if (box.north - box.south <= MIN_SPAN_DEG) {
    throw new Error(`Giving up on ${label} — box already minimal`);
  }
  const midLat = (box.south + box.north) / 2;
  console.log(`split ${label} at lat ${midLat} (depth ${depth + 1})`);
  await harvest({ ...box, north: midLat }, depth + 1);
  await harvest({ ...box, south: midLat }, depth + 1);
}

const bandWests = process.argv.slice(2).map(Number);
if (bandWests.length === 0 || bandWests.some((w) => !Number.isInteger(w) || w < -180 || w >= 180)) {
  console.error('Usage: node scripts/resume-overview.mjs <bandWest> [bandWest...]');
  process.exit(1);
}

loadExisting();
const before = courts.size;
const startedAt = Date.now();

// Pre-split each band: dense European latitudes in 6-deg chunks so the first
// query per chunk usually succeeds; sparser latitudes in larger spans.
for (const bandWest of bandWests) {
  const east = bandWest + 15;
  const chunks = [
    { south: -60, north: 0 },
    { south: 0, north: 36 },
    { south: 36, north: 42 },
    { south: 42, north: 48 },
    { south: 48, north: 54 },
    { south: 54, north: 60 },
    { south: 60, north: 72 },
  ];
  for (const { south, north } of chunks) {
    await harvest({ south, west: bandWest, north, east });
    save(); // checkpoint after every chunk
  }
}

console.log('');
console.log(`new courts: ${courts.size - before} (total ${courts.size})`);
console.log(`queries:    ${queryCount}`);
console.log(`duration:   ${Math.round((Date.now() - startedAt) / 1000)}s`);
