# Torn Training Optimizer — Phase 1

Vladar gym-gain engine, multi-train session simulator and gym comparator for
[Torn](https://www.torn.com). Reads your data from the official API and shows,
for your current stats and happy, the best gym per stat and the expected gain of
a training session. Built against the project spec (`spec_torn_training_optimizer_v1.md`).

**No automation.** This tool only reads the API and computes. It never performs a
train or any in-game action — that is a hard limit per Torn's scripting rules and
the spec (§1.3 / §1.4).

## Scope of this phase

Phase 4 (per spec §10) adds the anti-waste alerts as a separate MV3 browser
extension (`extension/`) — a web app can't push notifications when closed. It
polls the API every minute and notifies on energy overflow, a jumped happy bar,
and a cleared drug cooldown (low-happy and education rules are opt-in). The
extension reuses the same alert rules engine (`src/engine/alerts.ts`). All four
phases are now complete.

## Requirements

- Node.js 20+
- A Torn API key with **battle stats access** (Limited or Full). Battle stats are
  private; the `gyms` selection is public. Create a key at
  Settings → API. The key stays in your browser (localStorage) and is sent only
  to `api.torn.com`.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

Paste your API key, set the modifier `M` (1.00 if unknown), and click **Load data**.

## Tests

The engine is decoupled from the UI and unit-tested with Vitest.

```bash
npm test         # runs the 16 engine tests
npm run typecheck
```

The Vladar implementation is pinned to a hand-computed reference value
(M=1, dots=2.0, E=10, H=5000, S=10000 → +7.7808) so any regression is caught.

## Validate against the game (Phase 1 exit criterion, spec §12)

1. In Torn, note the predicted gain for a single train in a known gym, with known
   happy and stat.
2. Enter the same stat, happy and gym in the **Session simulator**.
3. Compare the **Single train** readout to Torn's prediction.
4. If they differ, the parsed gym dots or `M` are off — fix the normalization
   (`src/api/normalize.ts`) or the modifier, not the formula.

## Deploy to GitHub Pages

This is a static SPA, so GitHub Pages is the natural host.

1. Push the project to a GitHub repo with the default branch `main`.
2. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) runs tests, builds, and
   deploys on every push to `main`.
4. `vite.config.ts` uses `base: './'`, so it works at `user.github.io/<repo>`
   without hardcoding the repo name.

The API key is never committed and never leaves the user's browser, so a public
Pages site is safe.

## Project structure (maps to the spec)

```
src/
  engine/                 # spec §4 — no UI dependencies, unit-tested
    constants.ts          #   Vladar constants + happy-loss factors [VALIDAR]
    vladar.ts             #   gainPerTrain (§4.1)
    session.ts            #   simulateSession / simulateBand (§4.3)
    gym-comparator.ts     #   compareGyms (§9)
    types.ts              #   PlayerState, Gym, StatKey (§5)
    *.test.ts             #   §12 unit tests
  api/                    # spec §6
    client.ts             #   fetchPlayer / fetchGyms (v1 selections)
    normalize.ts          #   raw API -> domain; dots = value/10 [VALIDAR]
  components/             #   UI
  format.ts
  App.tsx

extension/                # Phase 4 — MV3 alerts (reuses src/engine/alerts.ts)
  src/                    #   background.ts (poll + notify), api.ts, popup.ts
  public/                 #   manifest.json, popup.html, icon128.png
  build.mjs               #   esbuild bundler -> extension/dist
```

## Notes on data sources (spec §11)

- **Bulk vs single train**: confirmed identical. Torn processes a bulk train
  sequentially train-by-train (recomputing happy and stats each step), which is
  exactly what `simulateSession` does. No hidden advantage to clicking one at a time.
- **Gym dots scaling**: the API stores gains ×10 (`"strength": 20` = 2.0 dots),
  handled in `normalize.ts`. Confirmed.
- **Energy-per-train field**: confirmed `energy` in the `gyms` response (`cost` =
  money to join, `energy` = exact energy cost per train, not scaled).
- **Modifier `M`**: auto-detected per stat from your perks (`src/engine/modifiers.ts`)
  — a heuristic parser sums the gym-gain bonuses (`M = 1 + Σ%`) and shows the
  breakdown. Editable per stat; "Detect from perks" re-applies. `M` affects
  absolute gains, not the gym ranking.
- **Daily energy capacity** (`src/engine/energy-capacity.ts`): drugs share one
  cooldown (~6-8h ≈ 3 doses/day), so the per-unit $/energy ranking is only half
  the story. The Economics panel shows natural regen (5/10 min donator = 720/day)
  + drug energy (Xanax 3×250 vs LSD 3×50) + refill, making explicit that per
  cooldown slot Xanax gives 5× the energy of LSD. The Unlock planner uses this
  capacity as its energy/day default. Because of the shared cooldown the plan
  and Budget optimizer recommend **Xanax** (the biggest drug per slot), not
  whatever shows the lowest $/energy (which can be LSD) — `primaryDrugSource`.
- **Unlock planner** (`src/components/Planner.tsx`, `src/engine/planner.ts`):
  inverts the gain model — pick a goal (unlock a specific gym, or reach a stat
  value) and it simulates the trains (gain compounds as the stat grows) and
  reports the gap, trains, energy, money cost (energy × your cheapest source)
  and days. For gym goals it derives the target stat and value from the unlock
  requirement (e.g. a 50E single-stat gym needs that stat ≥ 1.25× your highest
  other stat).
- **Gym unlocking**: the 24 standard gyms (through George's) unlock by **gym EXP
  = total energy spent training over your whole career**, not days or stats. The
  API doesn't expose gym EXP, so the tool reads your active gym as a default and
  offers a "Highest unlocked gym" selector; standard gyms above it (and the
  specialists that require George's) are marked locked. Specialist gyms gate on
  stat ratios + drug count, which `src/engine/gym-eligibility.ts` computes.
- **Optimal training plan** (`src/components/TrainingPlan.tsx`): per stat, the
  recommended **method by stat level** (`src/engine/training-method.ts`) — happy
  jumps win at low stats but lose to energy training as stats grow (you waste
  32–35h of regen stacking for a jump, and the stat-growth term flattens near
  50M). Shows the best usable gym, the per-train gain at your sustainable max
  happy (realistic) with the 99k ceiling for reference, a toggle for the
  "Ignorance Is Bliss" book (sustained 99k), a 50M growth-cap warning, and the
  next gym upgrade with its numeric requirement. Use the **Budget optimizer**
  panel for the cost-optimal buy-list of a single session.
- **Consumable effects** (`src/data/consumables.ts`): confirmed against the Torn
  wiki / training guides — Xanax 250 E, LSD 50 E, refill 150 E for 25 points,
  Erotic DVD +2500 happy, Ecstasy ×2 happy. Happy cap confirmed 99,999. Prices
  are fetched live (`torn/items` market value + `pointsmarket`); unresolved names
  show "price n/a".
- **Gym eligibility** (`src/engine/gym-eligibility.ts`): specialist-gym unlock
  requirements are computed from the player's stats (the ratio rules) and, for
  the Sports Science Lab, from the Xanax+Ecstasy count (`personalstats`). The
  "best gym" recommendation (comparator, projector, defaults) only picks gyms the
  player can actually use; locked specialists are shown with their requirement.
  `torn/gyms` lists every gym in the game, so this filtering matters. Standard-gym
  unlock by cost/progression isn't exposed by the API and is assumed.

## Alerts extension (Phase 4)

A separate MV3 extension under `extension/`. It reuses `src/engine/alerts.ts`.

```bash
npm run build:ext        # bundles to extension/dist/
```

Then in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked**
→ select `extension/dist`. Open the toolbar popup, paste an API key with bars
access, toggle the rules you want, Save. It polls once a minute and notifies only
when a condition first turns on (deduped). Rules: energy overflow, happy jumped,
drug cooldown clear (on by default); low-happy/high-energy and education idle
(opt-in). A Discord bot is an alternative for cross-device alerts (not built).

## Roadmap

| Phase | Adds | Status |
|-------|------|--------|
| 1 | Engine, session simulator, gym comparator | done — validated in-game (~0.1%) |
| 2 | Economic layer: live prices, $/energy, marginal $/point | done |
| 2.1 | Budget optimizer: max-gain buy-list, stacked happy jump | done |
| 3 | Multi-day projector: compounding, scenarios, chart, days-to-goal | done |
| 4 | Anti-waste alerts (MV3 extension) | done |
