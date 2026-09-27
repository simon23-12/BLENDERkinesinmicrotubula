# Kinesin läuft – Kinesin-1 auf dem Mikrotubulus

Interaktive 3D-Animation (Blender → Three.js): Kinesin-1 läuft Hand über Hand entlang eines Mikrotubulus – mit klickbaren Annotationen, stufenlosem Zoom und Phasen-Erklärungen. LMG TECH.

## Starten

```bash
npm --prefix web install
npm --prefix web run dev
```

Dann http://127.0.0.1:5173 öffnen.

## Aufbau

- `blender/build_kinesin.py` – erzeugt Szene, Animation und Export prozedural (in Blender ausführen). Schreibt `blender/kinesin.blend`, `web/public/models/kinesin.glb` und `web/public/models/timeline.json`.
- `web/` – Vite + Three.js Viewer; Texte der Annotationen in `web/src/content.js`.

Maßstab: 1 Einheit = 1 nm. Die ATP/ADP-Moleküle sind zur Sichtbarkeit ≈ 2,5× vergrößert.
