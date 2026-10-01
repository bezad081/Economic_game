# MACROSTATE V7 — Phaser Edition

V7 replaces the hand-written city renderer with Phaser 3.90 + WebGL while keeping the React + TypeScript + Vite economic UI and simulation engine.

## Main upgrades
- Phaser/WebGL city renderer with independent game loop
- Smoother lane traffic, signal logic, headway braking, buses/taxis/bikes
- Pedestrians constrained to sidewalks and district loops
- Procedural building, tree, street-light and vehicle textures
- Non-blocking quarter review (opened from Review button)
- Separate economic indicator chart cards
- Cinematic Cabinet Briefing start screen
- Role selection: Chief Economist, Central Bank Governor, Finance Minister, Development Minister
- Starting scenarios: Balanced, Inflation Shock, Recession, Financial Crisis
- Accessible / Standard / Expert difficulty presets
- Responsive layout aimed at 1366x768 and larger displays

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

The included GitHub Pages workflow deploys `dist/` automatically.
