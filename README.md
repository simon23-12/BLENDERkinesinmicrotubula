# Kinesin läuft – Kinesin-1 auf dem Mikrotubulus

Interaktive 3D-Animation (Blender → Three.js): Kinesin-1 läuft Hand über Hand entlang eines Mikrotubulus – mit klickbaren Annotationen, stufenlosem Zoom und Phasen-Erklärungen. LMG TECH.

## Online

https://simon23-12.github.io/BLENDERkinesinmicrotubula/

Jeder Push auf `main` veröffentlicht den Ordner `web/` automatisch über GitHub Pages – ohne Build-Schritt, ohne npm.

## Lokal ansehen

```bash
node serve.mjs
```

(Kein `npm install` nötig – `serve.mjs` nutzt nur Node-Bordmittel. Alternativ geht jeder statische Server, z. B. `python3 -m http.server 5173 --directory web`.)

Dann http://127.0.0.1:5173 öffnen. (Three.js wird per Import-Map vom CDN jsDelivr geladen.)

## Aufbau

- `blender/build_kinesin.py` – erzeugt Szene, Animation und Export prozedural (in Blender ausführen). Schreibt `blender/kinesin.blend`, `web/models/kinesin.glb` und `web/models/timeline.json`.
- `web/` – statische Seite (Three.js per Import-Map, kein Build); Texte der Annotationen in `web/src/content.js`.

Maßstab: 1 Einheit = 1 nm. Die ATP/ADP-Moleküle sind zur Sichtbarkeit ≈ 2,5× vergrößert.
