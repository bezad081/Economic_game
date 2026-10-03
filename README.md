# MACROSTATE V12 — Dynamic Policy Command

V12 turns the project into a more dynamic economic-policy simulation with a professional dashboard UX.

## Core loop

**Diagnose → Decide → Advance → React → Learn**

## What changed in V12

- Dynamic Live mode with 1× / 2× speed and automatic pause on critical events
- Smarter policy advisor that scores instruments against current macro needs, active events, mission goals, policy capacity and trade-offs
- Multi-stage event chains: unresolved shocks can propagate into follow-up banking, inflation, currency, debt or real-economy crises
- Endogenous event generation from the state of the economy rather than pre-selected starting scenarios
- More animated and polished analytical charts with reference lines, animated redraws, trend feedback and longer history
- Left-side Core Systems monitor and right-side Advisor / Risk / Policy rail
- UX and rendering optimization through memoized analytical components and CSS-native animations

The project remains React + TypeScript + Vite and can be deployed with the existing GitHub Pages workflow.

```bash
npm install
npm run build
```
