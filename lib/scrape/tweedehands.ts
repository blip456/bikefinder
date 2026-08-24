/**
 * 2dehands.be / tweedehands.be (and its Marktplaats sibling).
 *
 * The search page ships its results as JSON inside an inline script before it
 * hydrates, which is far more reliable than the class names. We try that first,
 * then the `hz-Listing-*` markup, then the generic harvester.
 */

import type { RawListing } from '@/lib/types'
import {
  type Cheerio,
  absoluteUrl,
  cleanText,
  dedupe,
  extractInlineJson,
  findObjects,
  parsePrice,
  pickString,
  upgradeImage,
} from './html'
import { harvestCards, mergeByUrl, scrapeGeneric } from './generic'

const INLINE_MARKERS = ['__NEXT_DATA__', 'window.__INITIAL_STATE__', 'window.__CONFIG__', 'window.__PRELOADED_STATE__']

interface MpPrice {
  priceCents?: number
  priceType?: string
}

function fromInlineJson(html: string, baseUrl: string): RawListing[] {
  const roots: unknown[] = []
  for (const marker of INLINE_MARKERS) {
    const parsed = extractInlineJson(html, marker)
    if (parsed) roots.push(parsed)
  }
  // Some responses embed a bare `{"listings":[…]}` with no assignment marker.
  const bare = extractInlineJson(html, '"listings":')
  if (bare) roots.push(bare)
  if (!roots.length) return []

  const listings: RawListing[] = []
  for (const root of roots) {
    const candidates = findObjects(
      root,
      (record) => typeof record.title === 'string' && (typeof record.itemId === 'string' || typeof record.vipUrl === 'string'),
    )

    for (const record of candidates) {
      const path = pickString(record, ['vipUrl', 'url', 'itemUrl'])
      const url = absoluteUrl(path ?? `/v/a/${record.itemId}`, baseUrl)
      if (!url) continue

      const priceInfo = record.priceInfo as MpPrice | undefined
      const cents = typeof priceInfo?.priceCents === 'number' ? priceInfo.priceCents : null
      const price = cents !== null && cents > 0 ? Math.round(cents / 100) : parsePrice(pickString(record, ['price', 'displayPrice']))

      const rawImages = [
        ...(Array.isArray(record.imageUrls) ? (record.imageUrls as unknown[]) : []),
        ...(Array.isArray(record.pictures)
          ? (record.pictures as Record<string, unknown>[]).map((picture) => picture.largeUrl ?? picture.extraExtraLargeUrl ?? picture.mediumUrl)
          : []),
        record.imageUrl,
        record.thumbnailUrl,
      ]
      const images = dedupe(
        rawImages
          .filter((image): image is string => typeof image === 'string' && image.length > 4)
          .map((image) => absoluteUrl(image.startsWith('//') ? `https:${image}` : image, baseUrl))
          .filter((image): image is string => Boolean(image))
          .map(upgradeImage),
      )

      const attributes: Record<string, string> = {}
      const attrList = record.attributes ?? record.categorySpecificAttributes
      if (Array.isArray(attrList)) {
        for (const entry of attrList as Record<string, unknown>[]) {
          const key = pickString(entry, ['key', 'name', 'label'])
          const value = pickString(entry, ['value', 'values', 'displayValue'])
          if (key && value) attributes[key] = value
        }
      }

      const location = record.location as Record<string, unknown> | undefined
      listings.push({
        url,
        title: cleanText(String(record.title)),
        description: cleanText(
          String(record.description ?? record.categorySpecificDescription ?? record.subtitle ?? ''),
        ),
        price,
        currency: 'EUR',
        location: location ? (pickString(location, ['cityName', 'city', 'name']) ?? undefined) : undefined,
        postedAt: pickString(record, ['date', 'publishDate', 'sortDate']) ?? undefined,
        images,
        attributes,
      })
    }
    if (listings.length) break
  }
  return listings
}

function fromMarkup($: Cheerio, baseUrl: string): RawListing[] {
  return harvestCards($, baseUrl, {
    linkPattern: /\/v\//i,
    titleSelectors: ['.hz-Listing-title', 'h3', 'h2', '[class*="title" i]'],
    priceSelectors: ['.hz-Listing-price', '[class*="price" i]'],
  })
}

export function scrapeTweedehands(html: string, $: Cheerio, baseUrl: string): RawListing[] {
  // Union rather than first-strategy-wins: the inline blob and the rendered
  // markup each miss listings the other catches, and stopping at the first
  // non-empty one silently capped the result set.
  const merged = mergeByUrl([...fromInlineJson(html, baseUrl), ...fromMarkup($, baseUrl)])
  if (merged.length) return merged
  return scrapeGeneric($, baseUrl, { linkPattern: /\/v\//i })
}

