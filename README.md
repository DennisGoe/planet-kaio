# PLANET 1.5° 🌍

Eine interaktive Klimaschutz-Website im Awwwards-Stil — mit einem drehbaren
Mini-Planeten im Zentrum, inspiriert von Meister Kaios kleinem Planeten aus
Dragon Ball Z.

## Die Geschichte

Beim Scrollen erzählen die Klima-Daten eine Geschichte — und jede Zahl löst
genau die Veränderung aus, von der sie erzählt, sobald ihr Inhalt auf
Scrollhöhe ist:

1. **+1,5 °C** — die Vegetation vertrocknet, das Licht wird hart
2. **424 ppm CO₂** — die Atmosphäre kippt, aus Wolken wird Smog
3. **4,4 mm/Jahr** — die Meere kippen: trüb, matt, leblos
4. **−12,2 % Eis** — die Polkappen schmelzen sichtbar ab, der Meeresspiegel steigt

Erst die vier Hebel und die CTA ganz unten machen den Planeten wieder
vollständig gesund. Der Bogen ist direkt an die Scroll-Position gekoppelt
und läuft in beide Richtungen.

## Features

- **Three.js**: prozeduraler PBR-Planet (Noise-Terrain, Ozean, Atmosphären-Glow),
  Kaio-Hommage mit Kuppelhaus, Palmen und einem ewig fahrenden roten Auto
- **GSAP + ScrollTrigger**: Scroll-Choreografie, Char-Reveals, Stat-Counter,
  Card-Tilt, Magnetic Button, Custom Cursor
- **Lenis**: Smooth Scrolling
- Interaktion: Planet greifen und drehen (mit Trägheit), Klick für
  Squash-&-Stretch
- Krankheits-System: Terrain blendet per Shader zwischen gesunden und toten
  Vertex-Farben; Vegetation verdorrt, die Akzentfarbe der Seite kippt mit

## Lokal starten

Kein Build nötig — alle Libraries kommen per CDN:

```bash
python3 -m http.server 4173
# → http://localhost:4173
```
