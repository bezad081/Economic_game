# MACROSTATE — Economic Policy Simulation

MACROSTATE is an interactive economic-policy game focused on macroeconomic decision-making, policy trade-offs, shocks, and endogenous event chains.

## Project structure

The repository deliberately separates the two implementations:

```text
Economic_game/
├── src/                    # React + TypeScript web application
│   ├── components/         # Dashboard and UI components
│   ├── game/               # TypeScript economic engine and rules
│   ├── phaser/             # Web rendering helpers
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── python/                 # Python/Pygame implementation
│   ├── main.py             # Desktop game entry point
│   ├── economy.py          # Economic simulation engine
│   ├── visuals.py          # Pygame rendering and world visuals
│   ├── validate_economy.py # Deterministic economic smoke tests
│   ├── requirements.txt
│   ├── requirements-web.txt
│   └── run_game.bat
├── .github/workflows/      # GitHub Pages deployment
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig*.json
```

## Web version

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The web version is deployed to GitHub Pages through `.github/workflows/deploy.yml`.

## Python version

```bash
python -m pip install -r python/requirements.txt
python python/main.py
```

Windows users can run `python/run_game.bat`.

Run the deterministic economic validation:

```bash
python python/validate_economy.py
```

## Core game loop

**Diagnose → Decide → Advance → React → Learn**

The simulation includes monetary and fiscal policy, inflation, growth, unemployment, debt, financial conditions, exchange-rate pressure, policy capacity, political constraints, shocks, and policy trade-offs.

## Web gameplay

- Mission Campaign and Sandbox modes
- Live simulation with adjustable speed
- Economic KPI dashboard
- Policy advisor and decision console
- Dynamic economic events and event chains
- Analytical charts and policy transmission views
- Quarterly learning/debrief system
- Local save/continue state
