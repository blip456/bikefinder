import type { Criteria, RawListing, ScoredBike, Source, SourceReport, Weights } from '@/lib/types'
import { buildBikes } from '@/lib/pipeline'
import { ScrapeError, fetchHtml } from './fetcher'
import { load, nextPageUrl } from './html'
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

function parsePage(adapter: Source['adapter'], html: string, finalUrl: string) {
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

  let target: string | null = source.url
  let pages = 0

  try {
    while (target && pages < maxPages) {
      if (visited.has(target)) break
      visited.add(target)

      const { html, finalUrl } = await fetchHtml(target, {
        mobile: source.adapter === 'facebook',
        cookieEnv: source.adapter === 'facebook' ? 'FACEBOOK_COOKIE' : undefined,
        timeoutMs: 20000,
        referer: pages > 0 ? source.url : undefined,
      })
      pages += 1

      const { $, listings } = parsePage(source.adapter, html, finalUrl)

      // Stop as soon as a page adds nothing new — this is what makes following
      // a guessed `?page=N` safe, and it also catches sites that clamp an
      // out-of-range page back to the first one.
      const fresh = listings.filter((listing) => !seenUrls.has(listing.url))
      for (const listing of fresh) seenUrls.add(listing.url)
      collected.push(...fresh)
      if (!fresh.length) break

      // Enough for the cap already; no reason to keep asking for pages.
      if (collected.length >= criteria.maxPerSource) break

      target = pages < maxPages ? nextPageUrl($, finalUrl) : null
      if (target) await sleep(PAGE_DELAY_MS)
    }

    const listings = mergeByUrl(collected)
    const { bikes, dropped } = buildBikes(listings, source, criteria, weights)

    return {
      report: {
        ...base,
        ok: true,
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
    // A later page failing should not throw away the pages that worked.
    const listings = mergeByUrl(collected)
    const { bikes, dropped } = listings.length
      ? buildBikes(listings, source, criteria, weights)
      : { bikes: [] as ScoredBike[], dropped: {} as Record<string, number> }

    const message =
      error instanceof ScrapeError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error while scanning.'

    return {
      report: {
        ...base,
        ok: bikes.length > 0,
        pages,
        found: listings.length,
        kept: bikes.length,
        dropped,
        error: message,
        hint: error instanceof ScrapeError ? error.hint : undefined,
      },
      bikes,
    }
  }
}

export { ScrapeError } from './fetcher'
