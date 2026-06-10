# hoopspots — Streetball-Courts weltweit

Eine Karten-App, die Basketball- und Streetball-Courts weltweit findet —
mit Live-Daten aus OpenStreetMap. Karte verschieben, Ort suchen oder den
eigenen Standort nutzen; ein Klick auf einen Court zeigt alle bekannten
Details (Körbe, Belag, Beleuchtung, Zugang …).

Konzept-Demo und zugleich echte App von Jan Veit, entwickelt mit
AI-Unterstützung (Claude Code) — konzipiert, geprüft und verantwortet von mir.

## UX-Entscheidungen

Typische Standort-Finder zeigen tausende identische Punkte auf einer Karte —
ohne Suche, ohne Liste, ohne Details. hoopspots macht es bewusst anders:

- **Die Weltkarte ist nie leer** — ein vorkompilierter Datensatz aller
  ~336.000 Courts weltweit (8 Bytes pro Court, gzipped) wird lazy geladen und
  in einem **Web Worker** geclustert; der UI-Thread bleibt frei. Ab Zoom 10
  übernimmt das Live-Loading mit vollen Details
- **Clustering statt Punktwolke** — Gruppen mit Anzahl, Klick zoomt hinein
  (Supercluster)
- **Liste und Karte synchron** — die Seitenleiste zeigt die Courts im
  Sichtbereich, nach Entfernung zur Kartenmitte sortiert
- **Ortssuche + Geolocation** — Nominatim-Geocoding mit Tastaturbedienung
  (Pfeiltasten/Enter/Escape) und „Mein Standort"-Button
- **Detail-Panel statt Popup** — alle OSM-Daten aufbereitet, dazu lazy
  nachgeladen: der Name der Umgebung (Nominatim Reverse-Geocoding) und ein
  Foto (OSM-Bild-Tags oder Wikimedia-Commons-Geosearch im Umkreis von 120 m),
  plus Routenlink und „Link kopieren"
- **Teilbare Deep-Links** — Kartenausschnitt und ausgewählter Court stehen in
  der URL (`#map=zoom/lat/lon&court=node/…`)
- **Es lädt nie doppelt** — Viewport-Anfragen sind debounced, abbrechbar und
  durch einen BBox-Cache gedeckt; einmal geladene Gebiete bleiben im Speicher

## Daten

- **Courts (Detail, live):** [Overpass API](https://overpass-api.de) —
  `leisure=pitch` + `sport=basketball`
- **Courts (Weltübersicht, statisch):** `npm run build:data` erntet alle
  Courts weltweit über adaptive Overpass-Regionsabfragen und schreibt
  `public/data/courts-overview.bin.gz` (Binärformat, siehe
  `src/overview/codec.ts`)
- **Ortssuche & Umgebungsname:** [Nominatim](https://nominatim.org)
  (debounced, sparsam, gemäß Usage Policy)
- **Fotos:** OSM-Tags `image`/`wikimedia_commons`, sonst Wikimedia-Commons-
  Geosearch in Court-Nähe
- **Karte:** OpenStreetMap-Tiles via CARTO (hell/dunkel)
- Daten © OpenStreetMap-Mitwirkende (ODbL)

## Architektur

```
scripts/
└── build-overview.mjs   erntet alle Courts weltweit (adaptive Splits,
                         Endpoint-Rotation) → public/data/…bin.gz
src/
├── geo.ts               pure Geo-Helfer (Haversine, BBox) — unit-getestet
├── types.ts             Domänenmodell Court (OSM-Tags nur an der API-Grenze)
├── api/
│   ├── overpass.ts      Overpass-Client; Parsing als pure Funktion, getestet
│   ├── nominatim.ts     Geocoding + Reverse-Geocoding (Umgebungsname)
│   └── commons.ts       Wikimedia-Commons-Fotos (Parsing pure, getestet)
├── overview/
│   ├── codec.ts         Binärformat encode/decode (Round-Trip-getestet)
│   ├── protocol.ts      typisiertes Worker-Protokoll
│   ├── overview.worker.ts  Supercluster über 336k Punkten, off-main-thread
│   └── overviewClient.ts   Promise-Wrapper um postMessage
├── hooks/
│   └── useCourts.ts     Viewport → Daten: Debounce, Abort, BBox-Cache
└── components/
    ├── MapView.tsx      dünner Leaflet+Supercluster-Wrapper (Props rein,
    │                    Events raus; alles Mutable lebt in Refs)
    ├── SearchBar.tsx    a11y-Combobox mit Debounce
    ├── CourtList.tsx    Sichtbereichs-Liste
    └── CourtDetails.tsx Detail-Panel mit Lazy-Anreicherung (Gebiet, Foto)
```

## Entwicklung

```bash
npm install
npm run dev         # Dev-Server
npm test            # Vitest: Unit- + Komponententests
npm run build       # Produktionsbuild nach dist/
npm run build:data  # Weltdatensatz neu ernten (dauert einige Minuten)
```

## Deployment (Netlify)

Git-basiert: Repo in Netlify importieren — Build-Kommando und
Publish-Verzeichnis kommen aus `netlify.toml`. Oder ohne Git:
`npm run build` und den `dist/`-Ordner auf https://app.netlify.com/drop ziehen.
