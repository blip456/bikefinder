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

Card extraction is **anchor-first**: the scraper works out which links are the
results (they share a directory prefix and each point at a distinct path, unlike
navigation, vendor or filter links), then climbs from each link to the outermost
element that still describes only that result. That element is the card, and it
is where the price and image live. Guessing which `div` was a card instead — the
obvious approach — either merged a whole grid into one result or split one card
into title-only fragments.

### JSON APIs are preferred over scraping

Before parsing markup, each scan looks for a JSON endpoint behind the page:

| Platform | Endpoint | Page size |
| --- | --- | --- |
| Shopify | `/collections/<handle>/products.json` | 250 |
| WooCommerce | `/wp-json/wc/store/v1/products` | 100 |
| Next.js | `/_next/data/<buildId>/<path>.json` | page's own |

Raw JSON wins on every axis: the fields are already standardised (vendor, variant
size, price, images are passed straight through as attributes the extractor
trusts over prose), page sizes are an order of magnitude larger than the rendered
grid, and markup changes cannot break it. If an endpoint responds with more
listings than the HTML did, the scan uses it and the source is badged **json api**.

### When a site blocks the server

Sources that refuse our server — or return nothing — are retried **from your own
browser**, so the request carries your IP and locale instead of a datacenter's.
The browser is only the network client; the bodies it fetches are posted to
`/api/parse` and run through exactly the same parsing, filtering and scoring code,
so there is one implementation of each. Results arrive badged **your browser**.

This is not a general bypass, and the app does not pretend otherwise. Browsers
enforce CORS: a cross-origin response can only be read when the site sends
`Access-Control-Allow-Origin`, which storefront JSON APIs commonly do and
ordinary HTML pages almost never do. So the browser path tries discovered APIs
first and treats raw HTML as a long shot. Cookies are deliberately *not* sent,
because a wildcard `Access-Control-Allow-Origin: *` is rejected by the browser
for credentialed requests — sending them would break the case that usually works.
When neither route can read a source, the report says so explicitly.

Turn it off with **Settings → Results → Retry blocked sources in your browser**.

### Pagination

Most marketplaces show ~24 results per page, so a single fetch sees a small
fraction of what the site displays. Each source follows **Pages to follow per
source** (Settings → Results, default 3, hard-capped at 10) using `rel="next"`
or a numbered pagination link, falling back to incrementing a `page` parameter
only when the page looks paginated. A scan stops early as soon as a page adds no
new listings, which keeps that fallback from running away, and pages already
fetched are kept even if a later one fails.

### Why a source returned fewer results than you expected

Every source reports the pages it fetched, the listings it recognised, and a
breakdown of **why listings were discarded** — `88 e-bike`, `8 over max price`,
`3 wrong size`. If a scan comes back thin, that breakdown says whether the
scraper missed them or your criteria removed them.

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

## buycycle renders its grid in the browser

buycycle's server HTML carries only whatever the page hydrates with — often a
handful of "recently viewed" bikes — while the actual result grid is fetched
client-side. A server-side scan therefore sees a fraction of the catalogue no
matter how many pages it follows, and the per-source report will show a small
`found` count with `0` drops. Reading the full grid needs either their JSON API
or `SCRAPE_PROXY_URL` pointed at a rendering proxy.

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
  api/parse/route.ts    parses page bodies the browser fetched (no fetching here)
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
  scrape/api-discovery.ts   finds JSON endpoints behind a results page
  scrape/json-listings.ts   normalises Shopify / Woo / unknown JSON shapes
  client-scrape.ts      browser-side fetching for server-blocked sources
  demo.ts               sample listings for demo mode
```

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```
