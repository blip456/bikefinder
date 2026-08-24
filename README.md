# BikeFinder

A mobile-first web app that scans second-hand marketplaces for mountain bikes,
pulls the specs out of every ad, and scores each listing on **how good the deal
actually is** — most bike per euro.

Built with Next.js 15 (App Router), React 19, TypeScript and Tailwind CSS v4.
Deploys to Vercel with zero configuration.

---

## Deploy

```bash
npm install
npm run dev        # http://localhost:3000
```

To ship it: push this repo to GitHub and import it in Vercel. It is a stock
Next.js app — no build settings, no database, no account system. Everything you
configure lives in your own browser's `localStorage`.

Optional environment variables are documented in [`.env.example`](.env.example);
none of them are required.

---

## How it works

```
  Source URL ──▶ fetcher ──▶ adapter ──▶ extractor ──▶ filter ──▶ scorer ──▶ UI
                (headers,   (site-       (brand,       (hard      (weighted
                 walls,      specific     year, size,   criteria)  average)
                 timeouts)   parsing)     groupset…)
```

### 1. Sources

Three marketplaces are supported natively, each with its own parser:

| Source | Adapter | Notes |
| --- | --- | --- |
| **2dehands.be / tweedehands.be** | `tweedehands` | Reads the inline JSON the search page hydrates from, falls back to `hz-Listing-*` markup, then to the generic harvester. |
| **buycycle** | `buycycle` | Reads the inline state blob, whose records already carry clean brand / model / year / frame-size fields. |
| **Facebook Marketplace** | `facebook` | Marketplace is logged-in and client-rendered. See [Facebook Marketplace](#facebook-marketplace) below. |
| **Anything else** | `generic` | Paste any search-results URL. Tries JSON-LD, then reconstructs result cards from the DOM, then Open Graph for single-listing pages. |

Add your own URL in **Settings → Sources**; the right adapter is picked
automatically from the hostname.

### 2. Extraction

`lib/parse/extract.ts` turns a free-text title and description — in Dutch,
English, French or German — into a structured `BikeSpec`:

`brand · model · year · condition · frame size · groupset · frame material ·
frame type · discipline · wheel size · travel · electric`

Structured attributes exposed by a site always win over text parsing. When a
field is genuinely ambiguous the extractor returns `unknown` rather than
guessing — and **unknown never causes a listing to be rejected**.

### 3. Scoring

The score is a **weighted average of eight independent 0–100 sub-scores**
(`lib/score.ts`). Every weight is adjustable in Settings; set one to zero to
ignore it entirely.

| Sub-score | Default weight | What it measures |
| --- | --- | --- |
| **Price vs value** | ×4 | Asking price against an estimated market value. |
| **Groupset** | ×2 | XTR / XX1 Transmission down to Tourney. |
| **Condition** | ×2 | New, as-new, good, used, damaged. |
| **Frame material** | ×1.5 | Carbon ≻ titanium ≻ alloy ≻ steel. |
| **Brand tier** | ×1.5 | Boutique and premium marques above supermarket brands. |
| **Fit to your criteria** | ×1.5 | Material, frame type, discipline, wheels, brand preferences. |
| **Model year** | ×1 | Newer geometry and standards. |
| **Listing quality** | ×0.5 | Photos and detail — a proxy for how much risk you are taking. |

The estimated market value is built from a discipline-and-layout base price,
scaled by frame material, brand tier, groupset tier and travel, then depreciated
with a two-phase curve (a bike loses roughly a quarter of its value the moment it
stops being current-season, then decays slowly) and adjusted for condition. When
a source publishes the original retail price — buycycle does — that real number
replaces the whole derived calculation.

The multipliers are calibrated against known retail prices for a spread of real
bikes. Direct-to-consumer brands still come out somewhat high, because brand tier
tracks build quality rather than how a brand prices itself.

Every bike's detail panel shows all eight sub-scores with the reasoning behind
each one, so you can see exactly why something ranked where it did.

> The value model is deliberately coarse. It is good enough to rank listings
> against each other; it is not an appraisal. Always inspect a bike in person.

### 4. Criteria — hard filters vs preferences

This split is intentional:

- **Must match** (price range, earliest year, frame size, condition, keywords,
  e-bikes) are **hard filters**. A listing is dropped — but only when the field
  was actually readable.
- **Preferences** (frame material, frame type, discipline, wheel size, favourite
  brands) are **soft**. They feed the *fit* sub-score instead of filtering, so a
  near-miss can still surface if it is a genuine steal.

All settings are saved to `localStorage` under `bikefinder.settings.v1`, and the
last scan is cached under `bikefinder.results.v1`.

---

## Facebook Marketplace

Marketplace requires a logged-in session and renders results in the browser, so
an anonymous server-side request gets a login wall rather than listings. The
adapter still tries — logged-out category pages occasionally ship a usable
payload — and when it cannot get anything it **says so explicitly** in the
per-source report rather than silently returning zero results.

To make it work reliably, set one of:

- `FACEBOOK_COOKIE` — the `Cookie:` header from a signed-in browser session.
- `SCRAPE_PROXY_URL` — a rendering proxy that executes JavaScript.

The source ships **disabled by default** for this reason.

### Marketplaces can block you

Scraping is best-effort. Sites change their markup, rate-limit, and put up
Cloudflare and CAPTCHA walls. The fetcher classifies these cases and the UI
reports each source's outcome individually — `blocked`, `rate-limited`,
`timed out`, `login wall`, `no listings recognised` — with a hint on what to do
about it. Please respect each site's terms of service and do not hammer them.

If a source is blocked, turn on **Settings → Demo mode** to explore the app
against built-in sample listings. They run through the exact same extractor,
filter and scorer.

---

## Design

The interface follows a **Bauhaus** design system: pure primaries
(red `#D02020`, blue `#1040C0`, yellow `#F0C020`) on off-white with stark black,
thick borders, hard un-blurred offset shadows, geometric decoration built from
circles, squares and triangles, and massive uppercase display type in *Outfit*.

Tokens live in one place — the `@theme` block in `app/globals.css` — and every
component references them rather than raw hex values. UI primitives are in
`components/ui/`; feature components compose them.

---

## Project layout

```
app/
  page.tsx              shop shell: scan, filter, sort, view, detail
  layout.tsx            fonts + metadata
  globals.css           design tokens (@theme) and base layer
  api/scan/route.ts     runs every enabled source, returns scored bikes
  api/img/route.ts      image relay (marketplace CDNs block hot-linking)
components/
  ui/                   Bauhaus primitives: Button, Card, Chip, Field, Sheet…
  BikeCard · BikeDetail · FilterBar · ScanPanel · SettingsPanel · SiteHeader
lib/
  types.ts              shared domain types
  settings.ts           defaults, built-in sources, localStorage
  parse/taxonomy.ts     brand tiers, groupset tiers, model names, price anchors
  parse/extract.ts      free text ➜ BikeSpec
  score.ts              value estimate + weighted scoring
  pipeline.ts           raw listing ➜ filtered, scored bike
  scrape/               fetcher, HTML/JSON helpers, one file per adapter
  demo.ts               sample listings for demo mode
```

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```
