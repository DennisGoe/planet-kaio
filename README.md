# PLANET 1.5° 🌍

Eine interaktive Klimaschutz-Website im Awwwards-Stil — mit einem drehbaren
Mini-Planeten im Zentrum, inspiriert von Meister Kaios kleinem Planeten aus
Dragon Ball Z.

## Die Geschichte

Beim Scrollen erzählen die Klima-Daten eine Geschichte: Jede Zahl macht den
Planeten sichtbar kranker — das Gras vergilbt, aus Wolken wird Smog, der Ozean
kippt, der letzte Schnee schmilzt. Erst die vier Hebel und die CTA ganz unten
machen den Planeten wieder vollständig gesund. Der Bogen ist direkt an die
Scroll-Position gekoppelt und läuft in beide Richtungen.

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
