# MACROSTATE / Economic Game — Phase 0 Audit

Audit date: 2026-10-13  
Repository: `bezad081/Economic_game`  
Branch reviewed: `main`  
Purpose: establish a prioritized baseline before major changes for the first public release.

## Executive summary

The project is not a blank prototype. The web version already has a React + TypeScript + Vite application, a substantial macroeconomic simulation engine, five crisis starting conditions, multiple policy families, policy previews, a rule-based advisor, learning/debrief flows, local save/continue, automated unit tests, and GitHub Pages deployment.

The main release risk is no longer a lack of economic indicators. It is whether the simulation, scenarios, and user experience work together reliably and make a compelling game. The current codebase also needs more reproducible builds and browser-level verification.

This is a code/repository audit, not a claim that every screen was manually play-tested in a browser or that the model is empirically validated.

## What is already present

- Web application built with React, TypeScript, and Vite.
- Economy engine with monetary, fiscal, structural and trade policies.
- Macro indicators plus household cohorts, firms, bank/credit channels, labor, public debt, expectations, and external-sector variables.
- Five crisis starting conditions: stagflation, recession, banking, sovereign debt, and energy.
- Active events, response windows, policy transmission lags, counterfactual previews, and post-decision learning reviews.
- Beginner/advanced policy experiences, a strategic brief, KPI dashboard, charts, and local save/continue.
- Automated tests in `tests/economy.test.ts`, `tests/microeconomy.test.ts`, and `tests/fiscal_accounting.test.ts`.
- GitHub Actions runs unit tests, builds the app, deploys GitHub Pages, and checks that the published page responds.

## Prioritized findings

### P1 — Scenario reset invariants need stronger protection

`applyCrisisScenario` resets many macro variables and clears history/events/impulses, but it does not reset every stateful component of the snapshot (for example, firm and household microstates, structural capital, and some political/administrative resources). The normal start flow creates a new engine first, which reduces immediate user-facing risk; however, the scenario function itself is not a complete reset contract if reused on a previously played state.

**Action:** define a single scenario-reset invariant, then add tests that apply scenarios to a deliberately mutated save and verify that scenario results do not inherit unrelated state. Avoid changing behavior until the intended reset semantics are explicit.

### P1 — Build reproducibility should be improved

The repository tree reviewed does not contain a `package-lock.json`, while CI uses `npm install`. Dependency resolution can therefore change over time without a code change.

**Action:** generate and commit a lockfile, switch CI to `npm ci`, and verify the full deployment workflow.

### P1 — Automated checks are strong on engine rules but weak on actual user journeys

The current CI covers unit tests, TypeScript/Vite production build, and a published-page HTTP smoke test. It does not appear to exercise real browser journeys such as choosing a scenario, enacting a policy, advancing a quarter, reloading a save, or using the interface at mobile widths.

**Action:** add a small, high-value browser smoke suite after choosing a supported browser-test tool and stabilizing the main user flow. At minimum cover start → policy → advance → review, save/continue, and each crisis start.

### P1 — Economic behavior is not yet the same as economic validation

Existing tests check many directional relationships and bounds. Those are valuable software invariants, but they do not demonstrate empirical calibration or guarantee that long-run strategies are balanced.

**Action:** build a deterministic scenario test matrix, long-horizon simulations, sensitivity checks for key coefficients, and a documented list of stylized assumptions. Do not describe the model as empirically calibrated unless that work is actually done.

### P2 — Main application and stylesheet are difficult to maintain

`src/App.tsx` is approximately 53 KB and `src/styles.css` approximately 68 KB. Several substantial components and render flows are defined in the main application file. This increases the cost of safely improving the interface and makes regressions harder to isolate.

**Action:** refactor only along meaningful boundaries (game shell, campaign flow, policy preview, learning review, landing screen) with tests retained. Do not perform a risky full rewrite.

### P2 — UX hierarchy and beginner comprehension need a dedicated pass

The product exposes many indicators, dashboard modes, policy categories, previews, events, and learning information. This is powerful for advanced players but can overload beginners. The key questions—“What is happening?”, “Why?”, and “What can I do next?”—must remain prominent.

**Action:** run a task-based UI audit and simplify the primary view first; keep advanced indicators available in secondary/expanded views. Review mobile layout and keyboard/accessibility behavior.

### P2 — Legacy/overlapping UI modules need a usage audit before cleanup

The repository contains several separate UI implementations and city-rendering modules in addition to the active `Landing` and main application flow. Some may be legacy or unused; this must be confirmed by import/reference analysis before deletion.

**Action:** map active imports and remove or archive only modules confirmed to be unused. Do not remove the Python implementation or visual modules merely based on filenames.

### P2 — Save data needs a formal compatibility check

The engine contains migrations for several older fields, but local storage is parsed as JSON before being passed into the engine. Valid JSON with an unexpected schema can still lead to invalid state or a confusing recovery path.

**Action:** validate loaded save data, handle incompatible/corrupt saves gracefully, and add tests for old, partial, and malformed saves.

## Release gates

The first public-release candidate should not be considered ready until these gates are met:

1. **Deterministic starts:** each supported scenario starts from a clean, documented baseline.
2. **Core invariants:** accounting identities, bounded values, policy constraints, and save migrations pass automated tests.
3. **Scenario behavior:** all five crisis starts produce distinct and interpretable constraints; no single trivial policy sequence dominates every case.
4. **Primary journey:** a new user can start, diagnose, choose a policy, advance time, understand the debrief, and resume a saved game.
5. **Responsive and accessible UI:** core tasks work on phone and desktop, with readable contrast, clear focus states, and usable controls.
6. **Reproducible CI:** locked dependencies, tests, production build, deployment, and published-site smoke check all pass.
7. **Honest model documentation:** stylized assumptions and unvalidated coefficients are disclosed; empirical claims are limited to actual evidence.
8. **External playtest:** beginners and economics learners can complete a short session and provide actionable feedback.

## Recommended execution order

1. Finish the audit baseline and record the current green deployment.
2. Lock dependencies and strengthen scenario/save invariants.
3. Add scenario-level and long-horizon regression tests.
4. Audit and simplify the primary user journey.
5. Add browser-level smoke tests.
6. Improve advisor diagnosis and the post-decision learning loop based on observed confusion.
7. Balance scenarios and test for dominant strategies.
8. Run a small external playtest, fix blockers, then prepare the first public-release candidate.

## Status at audit time

The latest workflow visible during the audit was successful on commit `157036de2e68f45e7b1681bfb2f6cc3e6322aa90` (build and deploy succeeded). This confirms that commit built and was deployed; it does not by itself verify all gameplay paths or the economic validity of the simulation.
