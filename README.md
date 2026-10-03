# MACROSTATE V9 — Policy Command Dashboard

V9 changes the project from a city visualization into a professional economic-policy command simulation.

## Core loop

**Diagnose → Decide → Advance → Observe → Learn**

The player acts as a Chief Economist, Central Bank Governor, Finance Minister, or Planning Minister. The interface combines:

- Separate macroeconomic charts and KPI telemetry
- Monetary, fiscal, structural, trade, and emergency policy instruments
- Policy-transmission visualization
- Inflation, growth, fiscal and financial driver decomposition
- Endogenous policy events with deadlines and policy-response matching
- Guided campaigns and open sandbox play
- Quarter-by-quarter learning/debrief notes
- Banking, firms, households, elections, public approval and policy capacity

## V9 economic depth

The simulation now explicitly tracks core inflation, wage growth, the output gap, real wages, policy credibility, sovereign spreads, FX reserves and the current account in addition to the existing macro-financial system.

The event engine can generate currency, banking, energy, global demand, housing, wage, sovereign-debt and technology events. Events create macroeconomic effects and identify policy responses that can contain them before escalation.

## Web deployment

The project is React + TypeScript + Vite and works with the existing GitHub Pages workflow used by the previous native-web versions.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```
