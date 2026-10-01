# MACROSTATE — Native Web Edition

A browser-native rewrite of the original Python/Pygame economic strategy game.

## Stack

- React
- TypeScript
- Vite
- HTML5 Canvas for the living city
- SVG for lightweight economic charts
- GitHub Pages deployment via GitHub Actions

There is **no Python runtime, Pygame or WebAssembly** in this edition. The simulation engine and UI run directly in JavaScript/TypeScript in the browser.

## Why this rewrite is faster

The original web build ran a Python/Pygame application through Pygbag/WebAssembly and then scaled one fixed-resolution surface. That is convenient for compatibility but expensive in the browser and makes dense UI text blurry at many window sizes.

This edition separates responsibilities:

- Canvas renders only the animated city at `requestAnimationFrame` speed.
- Macro simulation advances quarterly and does not force 60 React renders per second.
- Policy panels, text and dashboards are native HTML/CSS, so they remain sharp and responsive.
- Device pixel ratio is capped to reduce GPU cost on high-DPI displays.
- Traffic and citizen physics are independent from the economic quarter loop.

## Included systems

- GDP / potential GDP / output gap
- inflation and expectations
- unemployment / Okun-style response
- policy and real interest rates
- credit conditions and bank health
- exchange rate
- public debt / primary balance / treasury
- housing prices and affordability
- poverty and inequality
- technology and productivity
- energy security and emissions
- business / consumer confidence
- FCI and macro-risk score
- lagged policy transmission
- monetary, fiscal, structural, trade and emergency policies
- random macro developments and scenario shocks
- mission and sandbox modes
- quarterly report and history chart
- local auto-save
- responsive city, traffic lights, vehicles, citizens, protests, weather-ready canvas

## Local run

```bash
npm install
npm run dev
```

## GitHub Pages

The project includes `.github/workflows/deploy.yml`.

1. Upload the project to the repository root.
2. Settings → Pages → Source: **GitHub Actions**.
3. Push to `main`.
4. Wait for `Deploy MACROSTATE Native Web` to finish.

For repository `bezad081/Economic_game`, the public URL will remain:

`https://bezad081.github.io/Economic_game/`

## Migration note

This is a web-native rewrite rather than a byte-for-byte port of every Pygame drawing routine. It preserves and expands the central gameplay loop and economic systems while replacing the old rendering architecture with browser-native components. Additional original campaign missions, citizen/business microdata, and specialized event chains can be ported incrementally without changing the deployment architecture.


## V3 Systems Edition

This build adds a persistent firm microeconomy, three household balance-sheet cohorts, a four-year election cycle, rule-based Cabinet AI recommendations, and improved browser city traffic physics. The macro engine remains quarterly while Canvas animation remains frame-based, keeping policy simulation deterministic and the interface responsive.

### New systems
- 18+ simulated firms across industry, services, technology, construction, exports and energy; employment, wages, cash, leverage, health, profit, investment, entry and restructuring evolve each quarter.
- Lower-, middle- and upper-income household cohorts with income, wealth, consumption, unemployment and sentiment dynamics.
- Election cycle with campaign phase, government/opposition vote shares, turnout and mandate effects on political capital.
- Cabinet AI room with Central Bank, Treasury, Industry, Social Affairs and Energy recommendations.
- Improved vehicle headway/braking and lighter Canvas rendering for better browser performance.

Use the **Systems** button in the top bar to inspect these layers.
