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

- **Clustering statt Punktwolke** — Gruppen mit Anzahl, Klick zoomt hinein
  (Supercluster)
- **Liste und Karte synchron** — die Seitenleiste zeigt die Courts im
  Sichtbereich, nach Entfernung zur Kartenmitte sortiert
- **Ortssuche + Geolocation** — Nominatim-Geocoding mit Tastaturbedienung
  (Pfeiltasten/Enter/Escape) und „Mein Standort"-Button
- **Detail-Panel statt Popup** — alle OSM-Daten aufbereitet, mit Routenlink
  und „Link kopieren"
- **Teilbare Deep-Links** — Kartenausschnitt und ausgewählter Court stehen in
  der URL (`#map=zoom/lat/lon&court=node/…`)
- **Es lädt nie doppelt** — Viewport-Anfragen sind debounced, abbrechbar und
  durch einen BBox-Cache gedeckt; einmal geladene Gebiete bleiben im Speicher

## Daten

- **Courts:** [Overpass API](https://overpass-api.de) —
  `leisure=pitch` + `sport=basketball`, weltweit, live
- **Ortssuche:** [Nominatim](https://nominatim.org) (debounced, sparsam,
  gemäß Usage Policy)
- **Karte:** OpenStreetMap-Tiles via CARTO (hell/dunkel)
- Daten © OpenStreetMap-Mitwirkende (ODbL)

## Architektur

```
src/
├── geo.ts               pure Geo-Helfer (Haversine, BBox) — unit-getestet
├── types.ts             Domänenmodell Court (OSM-Tags nur an der API-Grenze)
├── api/
│   ├── overpass.ts      Overpass-Client; Parsing als pure Funktion, getestet
│   └── nominatim.ts     Geocoding
├── hooks/
│   └── useCourts.ts     Viewport → Daten: Debounce, Abort, BBox-Cache
└── components/
    ├── MapView.tsx      dünner Leaflet+Supercluster-Wrapper (Props rein,
    │                    Events raus; alles Mutable lebt in Refs)
    ├── SearchBar.tsx    a11y-Combobox mit Debounce
    ├── CourtList.tsx    Sichtbereichs-Liste
    └── CourtDetails.tsx Detail-Panel
```

## Entwicklung

```bash
npm install
npm run dev      # Dev-Server
npm test         # Vitest: Unit- + Komponententests
npm run build    # Produktionsbuild nach dist/
```

## Deployment (Netlify)

Git-basiert: Repo in Netlify importieren — Build-Kommando und
Publish-Verzeichnis kommen aus `netlify.toml`. Oder ohne Git:
`npm run build` und den `dist/`-Ordner auf https://app.netlify.com/drop ziehen.
