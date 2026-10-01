# MACROSTATE — Systems Edition (Web V2)

This package upgrades the original **MACROSTATE FINAL** while preserving its core three-file architecture and gameplay identity. It is prepared for both **desktop Pygame** and **browser deployment with Pygbag + GitHub Pages**.

## What changed in Web V2

### Browser / deployment
- Async-aware launch screens and game loop for WebAssembly/browser execution.
- `pygame-ce` dependency, compatible with Pygbag.
- Ready-to-use GitHub Pages workflow in `.github/workflows/deploy.yml`.
- Economic validation runs in CI before the browser package is built.

### Economic systems
- New `EconomyV12` systems layer on top of the existing V11 simulation.
- Explicit inflation target and expectation anchoring through central-bank credibility.
- Endogenous sovereign risk premium and banking lending spread.
- Long bond yields now carry a transparent risk-premium channel.
- Financial Conditions Index (FCI), Household Stress Index and Macro Risk Score.
- Live macro-regime classification: balanced expansion, overheating, recession, stagflation, tight conditions, etc.
- Quarterly reports also store the new financial and risk diagnostics.

### City / physics / graphics
- Traffic lights with alternating signal phases.
- Lightweight car-following and braking logic so road vehicles no longer pass through one another as often.
- Vehicle acceleration/deceleration instead of instant speed changes.
- Traffic activity responds modestly to the macroeconomy and crisis conditions.
- Cinematic atmospheric grading for night, sunrise/sunset, rain, crisis stress and very high inflation.
- Dashboard now exposes the sovereign spread, macro regime and financial conditions.

### Validation
Run:

```bash
python validate_economy.py
```

The validation suite runs multiple deterministic policy/shock paths and checks that core macro/financial state variables remain finite and within safe ranges.

See **WEB_DEPLOY.md** for the GitHub Pages deployment steps.

---

# MACROSTATE — The Economic Strategy Game
## Final Edition

MACROSTATE is a 2D economic strategy/simulation game built with Python + Pygame.
You govern a living economy through monetary, fiscal, structural, trade and emergency policy while households, firms, housing, transport, markets, crises and politics respond over time.

## Final game loop

**Observe → Diagnose → Decide → Wait → Explain → Adapt**

- Observe the city, dashboard, news, citizens and firms.
- Diagnose inflation, jobs, debt, banking, housing, FX and structural problems.
- Decide with individual policies, combined packages, or your own Cabinet Mix.
- Wait for lagged transmission instead of button-spamming.
- Explain outcomes using the quarterly GDP/inflation attribution report.
- Adapt as missions, ordinary macro developments and crises change the economy.

## Launch flow

1. Cinematic MACROSTATE intro
2. Title screen
3. START
4. Choose:
   - **Mission Campaign** — periodic objectives, rewards, deadlines and guided learning.
   - **Free Economy / Sandbox** — no fixed mission; ordinary macro developments and occasional crises create an open-ended economic story.

## Major final features

### Economic simulation
- GDP, inflation, unemployment, expectations, rates, credit, FX and debt
- fiscal budget and debt-service dynamics
- housing prices, rent, affordability, mortgages and defaults
- banking health and credit transmission
- trade, sanctions, exports/imports and port logistics
- sectors, technology, productivity, startups and rival economy
- poverty, inequality, approval and elections
- policy lags / transmission channels
- random ordinary developments separated from major crises

### Living microeconomy
- 165 citizens with jobs, cash, assets, debt, health and happiness
- physical citizen-to-citizen interactions can create purchases and peer loans
- citizens visit businesses and actually spend/deposit/borrow
- firms track cash, debt, inventory, employees, revenue and profit
- hiring, layoffs and business distress
- housing tenure and household housing costs
- citizen inspection now shows recent economic events

### Policy gameplay
- Monetary, Fiscal, Structural, Trade and Emergency policy rooms
- preset Combined Policy packages
- **K — Cabinet Mix Builder:** select 2–4 individual policies, then ENTER to deploy the custom mix
- policy capacity, political capital, prerequisites and cooldowns
- policy clash detection
- hover an individual policy for a no-policy counterfactual:
  - immediate impact
  - 1-quarter differential
  - 4-quarter differential
  - risk level

### Advisor system
The Advisor no longer gives only one answer.

- Mission Coach provides an exact route: **Tab → Policy → Why → Watch → Reassess**
- Sandbox Advisor diagnoses the most urgent current problem
- Cabinet Council exposes three competing lenses:
  - **Central Bank:** prices, FX, banks
  - **Treasury:** jobs, households, debt
  - **Development:** productivity, housing, trade
- 4-quarter strategy simulations remain available

### Player feedback
- **Q — Quarterly Economic Brief**
  - GDP change
  - inflation change
  - unemployment change
  - debt/GDP change
  - approval change
  - inflation-driver attribution
  - GDP-driver attribution
- **P — Economic Legacy Snapshot**
  - Stability
  - Prosperity
  - Society
  - Resilience
  - mandate averages
  - start-to-current comparison
- campaign end automatically opens the final Legacy report

### City / graphics
- 2D and pseudo-2.5D modes
- day/night cycle
- weather/rain
- lit windows at night
- wealth heatmap
- smog/emissions overlay
- visible policy-transmission pulses
- bank-run links and peer-transaction links
- protests under severe inflation/unemployment
- infrastructure construction visualization
- factory fire response
- cars, motorcycles, buses, taxis, trains, planes, ships, firetruck and animals
- citizens/businesses can be clicked and inspected
- Focus Mode for a cleaner map


## Final advisor UI polish

The final presentation build includes a cleaned Advisor tab designed for narrow side panels:

- Mission/diagnosis status is separated from recommendations instead of repeating the same advice twice.
- **Next Steps** uses three fixed-height ranked rows; long policy names and explanations are safely ellipsized.
- **Cabinet Council** is presented as three distinct compact desks: Central Bank, Treasury and Development.
- **4Q Strategy Outlook** uses a compact table with a dedicated risk column.
- **Key Economic Drivers** shows only the most important inflation/GDP contributors; press **Q** for the full attribution report.
- All Advisor text is width-bounded so it cannot spill outside cards or overlap neighboring sections.

## Controls

| Key | Action |
|---|---|
| Space | Pause / resume |
| 1 / 2 / 3 | Simulation speed |
| N | Advance one quarter |
| G | Mission / Advisor detailed guide |
| K | Toggle Cabinet Mix builder |
| Enter | Deploy Cabinet Mix when builder is active |
| Backspace | Clear Cabinet Mix |
| Q | Open/close quarterly economic brief |
| P | Open current Economic Legacy report |
| F | Focus Mode |
| V | Toggle 2D / 2.5D |
| L | Labels |
| H | Wealth heatmap |
| J | Chirper citizen feed |
| O | Objective panel |
| T | Rain |
| C | Random crises on/off |
| M | Switch Mission / Sandbox |
| F1 | Full controls help |
| F2 | Mode selection |
| R | Restart current mode |
| 0 | Reset camera |
| WASD / Arrows | Pan map |
| Mouse wheel / +/- | Zoom |
| Right-drag | Drag map |

## Install and run

Python 3.10+ recommended.

```bash
python -m pip install -r requirements.txt
python main.py
```

On Windows you can also run:

```text
run_game.bat
```

## Core project files

The game remains intentionally organized around the three core files:

- `economy.py` — economy, policies, missions, advisors, microeconomy and game-state logic
- `visuals.py` — city, characters, charts, overlays, panels and visual feedback
- `main.py` — game loop, intro/title flow, input, modes and orchestration

No 3D/Ursina code is included in this final package.
