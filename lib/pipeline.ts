/**
 * Raw listing -> filtered, parsed, scored bike.
 *
 * Criteria are split in two on purpose:
 *   - hard filters (price, year, size, condition, e-bike, keywords) drop listings
 *   - soft preferences (material, frame type, discipline, wheels, brands) feed
 *     the `fit` sub-score instead, so a near-miss still shows up if it is a steal
 *
 * Anything we could not parse is never used to reject a listing — a missing size
 * means "unknown", not "wrong size".
 */

import { extractSpec, normalise } from '@/lib/parse/extract'
import { scoreBike } from '@/lib/score'
import { parsePrice } from '@/lib/scrape/html'
import type { Criteria, RawListing, ScoredBike, Source, Weights } from '@/lib/types'

/** Attribute keys a source may use to publish the bike's original retail price. */
const MSRP_KEYS = ['retail price', 'msrp', 'original price', 'nieuwprijs', 'new price']

function msrpFrom(attributes: Record<string, string> = {}): number | null {
  for (const [key, value] of Object.entries(attributes)) {
    if (!MSRP_KEYS.includes(key.toLowerCase())) continue
    const parsed = parsePrice(value)
    if (parsed !== null) return parsed
  }
  return null
}

function stableId(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0
  }
  return `b${(hash >>> 0).toString(36)}`
}

export interface FilterOutcome {
  keep: boolean
  reason?: string
}

export function passesHardFilters(
  listing: RawListing,
  spec: ReturnType<typeof extractSpec>,
  criteria: Criteria,
): FilterOutcome {
  const price = listing.price ?? null
  const haystack = normalise(`${listing.title} ${listing.description ?? ''}`)

  if (criteria.requirePrice && price === null) return { keep: false, reason: 'no price' }
  if (price !== null) {
    if (criteria.minPrice !== null && price < criteria.minPrice) return { keep: false, reason: 'under min price' }
    if (criteria.maxPrice !== null && price > criteria.maxPrice) return { keep: false, reason: 'over max price' }
  }

  if (criteria.minYear !== null && spec.year !== null && spec.year < criteria.minYear) {
    return { keep: false, reason: 'too old' }
  }

  if (!criteria.allowElectric && spec.electric) return { keep: false, reason: 'e-bike' }

  if (criteria.sizes.length && spec.size && !criteria.sizes.includes(spec.size)) {
    return { keep: false, reason: 'wrong size' }
  }

  if (criteria.conditions.length && spec.condition !== 'unknown' && !criteria.conditions.includes(spec.condition)) {
    return { keep: false, reason: 'condition' }
  }

  if (spec.brand && criteria.excludeBrands.some((brand) => brand.toLowerCase() === spec.brand!.toLowerCase())) {
    return { keep: false, reason: 'excluded brand' }
  }

  for (const word of criteria.excludeKeywords) {
    const needle = normalise(word)
    if (needle && haystack.includes(needle)) return { keep: false, reason: `excluded: ${word}` }
  }

  if (criteria.keywords.length) {
    const hit = criteria.keywords.some((word) => {
      const needle = normalise(word)
      return needle ? haystack.includes(needle) : false
    })
    if (!hit) return { keep: false, reason: 'no keyword match' }
  }

  return { keep: true }
}

export function buildBikes(
  listings: RawListing[],
  source: Pick<Source, 'id' | 'label' | 'adapter'>,
  criteria: Criteria,
  weights: Weights,
  demo = false,
): ScoredBike[] {
  const bikes: ScoredBike[] = []
  const seen = new Set<string>()

  for (const listing of listings) {
    if (!listing.url || !listing.title) continue
    if (seen.has(listing.url)) continue
    seen.add(listing.url)

    const description = listing.description ?? ''
    const spec = extractSpec(listing.title, description, listing.attributes ?? {})

    const outcome = passesHardFilters(listing, spec, criteria)
    if (!outcome.keep) continue

    const images = (listing.images ?? []).filter(Boolean).slice(0, 8)
    const price = listing.price ?? null
    const { score, parts, estimatedValue, savings } = scoreBike(
      spec,
      price,
      images,
      description,
      criteria,
      weights,
      msrpFrom(listing.attributes),
    )

    if (score < criteria.minScore) continue

    bikes.push({
      id: stableId(listing.url),
      sourceId: source.id,
      sourceLabel: source.label,
      adapter: source.adapter,
      url: listing.url,
      title: listing.title,
      description,
      price,
      currency: listing.currency ?? 'EUR',
      location: listing.location ?? null,
      postedAt: listing.postedAt ?? null,
      images,
      spec,
      score,
      parts,
      estimatedValue,
      savings,
      demo: demo || undefined,
    })
  }

  bikes.sort((a, b) => b.score - a.score)
  return bikes.slice(0, Math.max(1, criteria.maxPerSource))
}
