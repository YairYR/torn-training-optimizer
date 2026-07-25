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

## Accuracy: what this build fixes

Two corrections that separate this from every other Torn gym calculator.

**1. The 50M stat cap is gone, and the curve that replaced it is modelled.**
Torn removed the hard 50,000,000 cap on 02/08/2022; above it, gains keep growing
at a steadily decreasing rate. The effective stat the formula sees is now

```
S_eff = 50,000,000 + (S - 50,000,000) / (8.77635 * log10(S))      [src/engine/vladar.ts]
```

This was **derived, not guessed**. The cap-removal announcement published monthly
growth figures before and after the change for a fixed regime (1500E/day,
George's, PI happy, no Steadfast). The "before" figures scale exactly as 1/S,
which proves gain-per-train was flat above the cap and pins the formula's S
coefficient; inverting the "after" figures yields S_eff at each published point.
The expression above reproduces all of them from 1b to 1t within 0.5%, and
`src/engine/vladar.test.ts` asserts each one. A calculator that still clamps at
50M under-predicts a 200M player by ~5% and an end-game player by far more.

**2. Gym-gain perks compound, they do not add.**
`M = Π(1 + perk)`, not `1 + Σperk` — +2%, +15% and +1% give +19.65%, not +18%
(Vladar, "Training Formula V2.0"). `src/engine/modifiers.ts` was summing them.

> If you previously validated a single train in-game against this tool and it
> matched, re-run that check: the modifier change shifts M by roughly +0.8% on a
> typical perk set. The Progress tracker panel does exactly this comparison.

## Distribution features

- **Shareable URLs** (`src/url-state.ts`). Every input lives in the query
  string, so a result can be pasted into a forum thread or Discord and
  reproduces exactly. Never includes the API key. Also how the generated SEO
  pages deep-link into a pre-filled calculator.
- **BBCode export** (`src/bbcode.ts`). One click turns the per-stat plan into a
  Torn-forum-ready block with a link back. Players already post these numbers by
  hand.
- **Portable history** (`exportHistory` / `parseHistoryExport` in
  `src/engine/history.ts`). Export the stat timeline as JSON and re-import or
  merge it on another device — the "account" of an app with no accounts, and the
  end of depending on a competitor's export format.
- **Build comparator** (`src/components/BuildCompare.tsx`). Two setups side by
  side off the same engine.
- **Offline PWA** (`public/sw.js`). The maths is client-side, so the tool works
  with no connection once cached.
- **In-game overlay** (`extension/src/content.ts`). The extension now injects
  the best-train recommendation directly into `torn.com/gym.php`, reusing the
  same engine. Read-only — it never performs a train.

## SEO &amp; GEO (discoverability)

Because this is a client-rendered SPA, crawlers and AI/answer engines (which
usually don't run JS) would otherwise see an empty page. The build ships:

- **`index.html` head**: descriptive `<title>` + meta description, canonical,
  Open Graph + Twitter Card (with `public/og-image.png`), theme-color, icons,
  and two JSON-LD blocks (`WebApplication` + `FAQPage`).
- **Static shell in `index.html`**: the home page ships real HTML inside
  `#root` (headings, feature list, how-to, FAQ, and a link block to every
  generated page). React replaces it on mount, so users never see it twice,
  but a crawler that does not run JavaScript — Bing, and most AI answer engines
  — sees a full page instead of an empty div. The in-app `AboutSection` still
  renders for humans who arrive without a key.
- **`public/robots.txt`**: allows everything and explicitly welcomes AI crawlers
  (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, …) for GEO;
  links the sitemap.
- **Programmatic pages** (`scripts/gen-seo.mjs`, run automatically by
  `npm run build`). Generates ~42 static pages from `src/data/gyms.ts` — one per
  gym (`/gyms/<slug>/`), the dots chart (`/gym-dots/`), a ranked page per battle
  stat (`/best-gym-for-<stat>/`), plus `/stat-cap/`, `/gym-unlock-order/`,
  `/training-ratios/` and `/xanax-vs-lsd/`. Each carries its own title, meta
  description, canonical, breadcrumb + FAQ structured data, internal links, and
  a CTA that deep-links into the calculator with the relevant stat and gym
  pre-selected. Gym data is parsed from the TypeScript source, never retyped, so
  the pages cannot drift from the app.
- **`public/sitemap.xml`** — regenerated on every build with a live `lastmod`,
  so it can no longer rot. **`public/llms.txt`** summarises the tool for LLMs.
- **`public/CNAME`** pins the custom domain into the build.

After deploying: submit the site in Google Search Console, request indexing for
`https://torntraining.com/`, and validate the structured data with Google's Rich
Results Test. Update `lastmod` in `sitemap.xml` on meaningful changes.

## Custom domain + analytics (optional)

`base: './'` is relative, so the same build works at the github.io subpath **and**
at the root of a custom domain — no code change needed for the domain itself.

**Custom domain (e.g. `torntrainer.example`):**
1. Add a file `public/CNAME` containing only your domain (one line, no protocol):
   `torntrainer.example`. Vite copies `public/` into the build, so the artifact
   serves the custom domain.
2. At your registrar, point DNS at GitHub Pages:
   - Apex domain → four `A` records: `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153` (optionally the matching `AAAA` IPv6).
   - `www`/sub-domain → a `CNAME` record to `<user>.github.io`.
3. Repo → **Settings → Pages → Custom domain**: enter the domain, then enable
   **Enforce HTTPS** once the cert provisions (a few minutes to a few hours).

**Analytics (GA4):** the snippet is in `index.html`, commented out. Uncomment it
and replace `G-XXXXXXXXXX` with your Measurement ID. It sends only anonymous
page/usage events — never pass Torn data (key, stats) to gtag. Disclose analytics
in the footer (already notes the tool is unofficial and the key stays local) and
add a consent prompt if you expect EU traffic.

> Monetization note: Torn has a default no-advertising policy for API tools and
> asks you to contact them before advertising, taking donations, or charging.
> This build ships ad-free and disinterested; add nothing of that kind without
> Torn's prior OK.

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
- **Progress tracking** (`src/components/ProgressTracker.tsx`,
  `src/engine/progress.ts`): save stat snapshots over time (stored in your
  browser via localStorage), see per-stat deltas, gain/day and a line chart, and
  validate the engine — pick an interval + stat + energy trained and it compares
  your real gain to the engine's prediction. Above 50M it helps test the
  community-reported growth cap.
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
| 5 | Post-cap formula, multiplicative perks | done — derived from Torn's published figures |
| 6 | Shareable URLs, BBCode, portable history, build comparator, PWA | done |
| 7 | Programmatic SEO (~42 pages) + in-game gym overlay | done |
