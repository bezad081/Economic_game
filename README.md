# MACROSTATE V8 — Stable Living City

V8 removes Phaser from the critical render path after repeated browser blank-screen crashes. The city is now rendered as responsive SVG with browser-native motion, while the economic simulation remains React + TypeScript + Vite.

## V8 goals
- No mysterious black-screen failure: root error boundary and guarded quarter updates.
- Manual quarter progression by default; optional Auto mode must be explicitly enabled.
- Responsive living city with animated traffic, pedestrians, construction, protests, bank queues, weather/atmosphere and economy-linked district health.
- Full-width chart deck with separate economic charts that stay inside their cards.
- Clear cabinet-style intro and role / scenario / difficulty setup.
- Beginner decision coach preserved; advanced tools remain available.

## Build
```bash
npm install
npm run build
```

The existing GitHub Pages Vite workflow can deploy `dist/`.
