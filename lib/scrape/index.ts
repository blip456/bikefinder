import type { Criteria, RawListing, ScoredBike, Source, SourceReport, Weights } from '@/lib/types'
import { buildBikes } from '@/lib/pipeline'
import { ScrapeError, fetchHtml } from './fetcher'
import { load } from './html'
import { scrapeBuycycle } from './buycycle'
import { scrapeFacebook } from './facebook'
import { scrapeGeneric } from './generic'
import { scrapeTweedehands } from './tweedehands'

export interface SourceResult {
  report: SourceReport
  bikes: ScoredBike[]
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
  }

  try {
    const { html, finalUrl } = await fetchHtml(source.url, {
      mobile: source.adapter === 'facebook',
      cookieEnv: source.adapter === 'facebook' ? 'FACEBOOK_COOKIE' : undefined,
      timeoutMs: 20000,
    })
    const $ = load(html)

    let listings: RawListing[]
    switch (source.adapter) {
      case 'tweedehands':
        listings = scrapeTweedehands(html, $, finalUrl)
        break
      case 'buycycle':
        listings = scrapeBuycycle(html, $, finalUrl)
        break
      case 'facebook':
        listings = scrapeFacebook(html, $, finalUrl)
        break
      default:
        listings = scrapeGeneric($, finalUrl)
    }

    const bikes = buildBikes(listings, source, criteria, weights)

    return {
      report: {
        ...base,
        ok: true,
        found: listings.length,
        kept: bikes.length,
        hint:
          listings.length === 0
            ? 'The page loaded but no listings could be recognised. Check that the URL is a search-results page.'
            : undefined,
      },
      bikes,
    }
  } catch (error) {
    if (error instanceof ScrapeError) {
      return { report: { ...base, error: error.message, hint: error.hint }, bikes: [] }
    }
    return {
      report: { ...base, error: error instanceof Error ? error.message : 'Unknown error while scanning.' },
      bikes: [],
    }
  }
}

export { ScrapeError } from './fetcher'
