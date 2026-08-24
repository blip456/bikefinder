import type { Criteria, RawListing, ScoredBike, Source, SourceReport, Weights } from '@/lib/types'
import { buildBikes } from '@/lib/pipeline'
import { ScrapeError, fetchHtml } from './fetcher'
import { load, nextPageUrl } from './html'
import { type ApiKind, discoverApiEndpoints } from './api-discovery'
import { listingsFromJson } from './json-listings'
import { scrapeBuycycle } from './buycycle'
import { scrapeFacebook } from './facebook'
import { mergeByUrl, scrapeGeneric } from './generic'
import { scrapeTweedehands } from './tweedehands'

export interface SourceResult {
  report: SourceReport
  bikes: ScoredBike[]
}

/** Hard ceiling regardless of settings, so a runaway paginator cannot hammer a site. */
const PAGE_LIMIT = 10

/** Courtesy gap between page requests. */
const PAGE_DELAY_MS = 400

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function parseMarkup(adapter: Source['adapter'], html: string, finalUrl: string) {
  const $ = load(html)
  switch (adapter) {
    case 'tweedehands':
      return { $, listings: scrapeTweedehands(html, $, finalUrl) }
    case 'buycycle':
      return { $, listings: scrapeBuycycle(html, $, finalUrl) }
    case 'facebook':
      return { $, listings: scrapeFacebook(html, $, finalUrl) }
    default:
      return { $, listings: scrapeGeneric($, finalUrl) }
  }
}

/**
 * Turn a fetched body into listings, whatever shape it arrived in.
 *
 * Shared by the server scan and /api/parse, so a page fetched by the user's
 * browser is parsed by exactly the same code as one we fetched ourselves.
 */
export function listingsFromBody(
  adapter: Source['adapter'],
  body: string,
  url: string,
  apiKind?: ApiKind,
): RawListing[] {
  const trimmed = body.trimStart()
  if (apiKind || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return listingsFromJson(apiKind ?? 'next-data', JSON.parse(body), url)
    } catch {
      // Not JSON after all — treat it as markup.
    }
  }
  return parseMarkup(adapter, body, url).listings
}

/** Follow a JSON endpoint across pages until it stops yielding anything new. */
async function collectFromApi(
  pageUrl: (page: number) => string,
  kind: ApiKind,
  baseUrl: string,
  maxPages: number,
  maxListings: number,
): Promise<{ listings: RawListing[]; pages: number }> {
  const listings: RawListing[] = []
  const seen = new Set<string>()
  let pages = 0

  for (let page = 1; page <= maxPages; page += 1) {
    let body: string
    try {
      const response = await fetchHtml(pageUrl(page), { timeoutMs: 15000, accept: 'application/json' })
      body = response.html
    } catch {
      break
    }
    pages += 1

    let parsed: RawListing[]
    try {
      parsed = listingsFromJson(kind, JSON.parse(body), baseUrl)
    } catch {
      break
    }

    const fresh = parsed.filter((listing) => !seen.has(listing.url))
    for (const listing of fresh) seen.add(listing.url)
    listings.push(...fresh)

    if (!fresh.length) break
    if (listings.length >= maxListings) break
    await sleep(PAGE_DELAY_MS)
  }

  return { listings, pages }
}

export async function scanSource(
  source: Source,
  criteria: Criteria,
  weights: Weights,
): Promise<SourceResult> {
  const base: SourceReport = {
    id: source.id,
    label: source.label,
    adapter: source.adapter,
    ok: false,
    found: 0,
    kept: 0,
    pages: 0,
  }

  const maxPages = Math.min(PAGE_LIMIT, Math.max(1, criteria.maxPages || 1))
  const collected: RawListing[] = []
  const seenUrls = new Set<string>()
  const visited = new Set<string>()

  let pages = 0
  let via: SourceReport['via'] = 'server'
  let firstError: ScrapeError | null = null

  const absorb = (listings: RawListing[]) => {
    for (const listing of listings) {
      if (seenUrls.has(listing.url)) continue
      seenUrls.add(listing.url)
      collected.push(listing)
    }
  }

  try {
    // --- Page 1 of the markup. Also the source of platform hints for API discovery.
    let html: string | undefined
    let target: string | null = source.url

    try {
      visited.add(source.url)
      const first = await fetchHtml(source.url, {
        mobile: source.adapter === 'facebook',
        cookieEnv: source.adapter === 'facebook' ? 'FACEBOOK_COOKIE' : undefined,
        timeoutMs: 20000,
      })
      html = first.html
      pages = 1

      const parsed = parseMarkup(source.adapter, first.html, first.finalUrl)
      absorb(parsed.listings)
      target = maxPages > 1 ? nextPageUrl(parsed.$, first.finalUrl) : null
    } catch (error) {
      // A blocked HTML page does not rule out an open JSON endpoint, so record
      // the failure and let discovery run from the URL shape alone.
      if (error instanceof ScrapeError) firstError = error
      else throw error
      target = null
    }

    // --- A JSON endpoint, if one exists, usually beats the markup outright.
    for (const candidate of discoverApiEndpoints(source.url, html)) {
      const api = await collectFromApi(
        candidate.pageUrl,
        candidate.kind,
        source.url,
        maxPages,
        criteria.maxPerSource,
      )
      if (!api.listings.length) continue

      if (api.listings.length > collected.length) {
        collected.length = 0
        seenUrls.clear()
        via = 'server-api'
        pages = api.pages
        firstError = null
      }
      absorb(api.listings)
      break
    }

    // --- Otherwise keep paging through the markup.
    while (via === 'server' && target && pages < maxPages && collected.length < criteria.maxPerSource) {
      if (visited.has(target)) break
      visited.add(target)

      const response = await fetchHtml(target, {
        mobile: source.adapter === 'facebook',
        cookieEnv: source.adapter === 'facebook' ? 'FACEBOOK_COOKIE' : undefined,
        timeoutMs: 20000,
        referer: source.url,
      })
      pages += 1

      const parsed = parseMarkup(source.adapter, response.html, response.finalUrl)
      const before = collected.length
      absorb(parsed.listings)
      // Nothing new means we have reached the end, or the site clamped an
      // out-of-range page back to the first one.
      if (collected.length === before) break

      target = nextPageUrl(parsed.$, response.finalUrl)
      if (target) await sleep(PAGE_DELAY_MS)
    }

    if (!collected.length && firstError) throw firstError

    const listings = mergeByUrl(collected)
    const { bikes, dropped } = buildBikes(listings, source, criteria, weights)

    return {
      report: {
        ...base,
        ok: true,
        via,
        pages,
        found: listings.length,
        kept: bikes.length,
        dropped,
        hint:
          listings.length === 0
            ? 'The page loaded but no listings could be recognised. Check that the URL is a search-results page.'
            : undefined,
      },
      bikes,
    }
  } catch (error) {
    // A later failure should not discard the pages that did work.
    const listings = mergeByUrl(collected)
    const { bikes, dropped } = listings.length
      ? buildBikes(listings, source, criteria, weights)
      : { bikes: [] as ScoredBike[], dropped: {} as Record<string, number> }

    return {
      report: {
        ...base,
        ok: bikes.length > 0,
        via,
        pages,
        found: listings.length,
        kept: bikes.length,
        dropped,
        error: error instanceof Error ? error.message : 'Unknown error while scanning.',
        hint: error instanceof ScrapeError ? error.hint : undefined,
      },
      bikes,
    }
  }
}

export { ScrapeError } from './fetcher'
export { discoverApiEndpoints } from './api-discovery'
