/**
 * Site-agnostic extraction, used both for user-added URLs and as the last-resort
 * fallback inside every dedicated adapter.
 *
 * Three strategies, tried in order of trustworthiness:
 *   1. JSON-LD (Product / ItemList) — structured and stable when present.
 *   2. Card harvesting — walk anchors, group by their nearest card container.
 *   3. Single-product page — Open Graph tags for a link to one bike.
 */

import type { RawListing } from '@/lib/types'
import {
  type Cheerio,
  absoluteUrl,
  cleanText,
  dedupe,
  jsonLdBlocks,
  parsePrice,
  pickFromSrcset,
  upgradeImage,
} from './html'

const PRICE_RE = /(?:€|eur|euro)\s*\d[\d.,\s]*|\d[\d.,\s]*\s*(?:€|eur\b|euro\b|,-)/i

const NOISE_RE =
  /(cookie|privacy|inloggen|log\s*in|sign\s*up|registreren|abonnement|newsletter|nieuwsbrief|sitemap|voorwaarden)/i

/** Grab the best image reference an element (or its subtree) offers. */
export function imageFrom($: Cheerio, element: unknown, baseUrl: string): string | null {
  const node = $(element as never)
  const img = node.is('img') ? node : node.find('img').first()

  if (img.length) {
    const srcset = pickFromSrcset(img.attr('srcset') ?? img.attr('data-srcset'))
    const raw =
      srcset ??
      img.attr('src') ??
      img.attr('data-src') ??
      img.attr('data-lazy-src') ??
      img.attr('data-original')
    const resolved = absoluteUrl(raw, baseUrl)
    if (resolved && !/^data:/.test(resolved)) return upgradeImage(resolved)
  }

  const source = node.find('source[srcset]').first()
  if (source.length) {
    const resolved = absoluteUrl(pickFromSrcset(source.attr('srcset')), baseUrl)
    if (resolved) return upgradeImage(resolved)
  }

  const styled = node.find('[style*="background-image"]').first().attr('style') ?? node.attr('style')
  const match = styled?.match(/url\((['"]?)(.*?)\1\)/i)
  if (match) {
    const resolved = absoluteUrl(match[2], baseUrl)
    if (resolved) return upgradeImage(resolved)
  }
  return null
}

function priceFrom(text: string): number | null {
  const match = text.match(PRICE_RE)
  return match ? parsePrice(match[0]) : null
}

/** Directory part of a URL path: "/products/trek-powerfly-5" -> "/products". */
function pathPrefix(url: string): string {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    return '/' + segments.slice(0, -1).join('/')
  } catch {
    return ''
  }
}

/**
 * Identify which links on the page are the actual results.
 *
 * Result links share a directory prefix and each point at a distinct path, so
 * grouping every link by its prefix and taking the largest group by distinct
 * *paths* isolates the product grid. Navigation, vendor and filter links form
 * small groups, or (like Shopify's "/collections/vendors?q=Trek") many links
 * that collapse onto a single path.
 */
function resultLinks($: Cheerio, baseUrl: string, linkPattern?: RegExp): Set<string> {
  const byPrefix = new Map<string, { urls: Set<string>; paths: Set<string> }>()

  $('a[href]').each((_, element) => {
    const href = absoluteUrl($(element).attr('href'), baseUrl)
    if (!href) return
    if (linkPattern && !linkPattern.test(href)) return

    let path: string
    try {
      const parsed = new URL(href)
      if (parsed.origin !== new URL(baseUrl).origin) return
      path = parsed.pathname
    } catch {
      return
    }
    if (path === '/' || path.length < 2) return

    const prefix = pathPrefix(href)
    const bucket = byPrefix.get(prefix) ?? { urls: new Set<string>(), paths: new Set<string>() }
    bucket.urls.add(href)
    bucket.paths.add(path)
    byPrefix.set(prefix, bucket)
  })

  if (!byPrefix.size) return new Set()

  // A link pattern is an explicit statement of intent — trust it wholesale.
  if (linkPattern) {
    const all = new Set<string>()
    for (const bucket of byPrefix.values()) for (const url of bucket.urls) all.add(url)
    return all
  }

  let best: { urls: Set<string>; paths: Set<string> } | null = null
  for (const bucket of byPrefix.values()) {
    if (!best || bucket.paths.size > best.paths.size) best = bucket
  }
  // One distinct path is a repeated link (paginated vendor filters and the like).
  if (!best || best.paths.size < 2) return new Set()

  // Keep one URL per distinct path so query-string variants do not duplicate.
  const chosen = new Map<string, string>()
  for (const url of best.urls) {
    try {
      const path = new URL(url).pathname
      if (!chosen.has(path)) chosen.set(path, url)
    } catch {
      /* ignore */
    }
  }
  return new Set(chosen.values())
}

/**
 * From a result link, climb to the outermost ancestor that still describes only
 * this result. That element is the card, and it is where the price and image
 * live — the anchor itself usually wraps just the title or the thumbnail.
 */
function cardElementFor(
  $: Cheerio,
  anchor: ReturnType<Cheerio>,
  href: string,
  results: Set<string>,
  baseUrl: string,
): ReturnType<Cheerio> {
  let card = anchor
  let node = anchor

  for (let depth = 0; depth < 10; depth += 1) {
    const parent = node.parent()
    if (!parent.length || parent.is('body, html, head, main')) break

    const reachesAnotherResult = parent
      .find('a[href]')
      .toArray()
      .some((link) => {
        const other = absoluteUrl($(link).attr('href'), baseUrl)
        return Boolean(other) && other !== href && results.has(other as string)
      })
    if (reachesAnotherResult) break

    card = parent
    node = parent
  }
  return card
}

export interface HarvestOptions {
  /** Only treat links matching this as results (e.g. /v/ detail pages). */
  linkPattern?: RegExp
  titleSelectors?: string[]
  priceSelectors?: string[]
}

/**
 * Strategy 2 — reconstruct result cards from the DOM.
 *
 * Anchor-first rather than container-first: we decide what the results *are*
 * from the link structure, then find each one's card by climbing. Scanning
 * containers instead meant guessing which `div` was a card, which either merged
 * a whole grid into one result or split one card into title-only fragments.
 */
export function harvestCards($: Cheerio, baseUrl: string, options: HarvestOptions = {}): RawListing[] {
  const { linkPattern, titleSelectors = [], priceSelectors = [] } = options
  const results = resultLinks($, baseUrl, linkPattern)
  if (!results.size) return []

  const listings: RawListing[] = []
  const seen = new Set<string>()

  $('a[href]').each((_, element) => {
    const anchor = $(element)
    const href = absoluteUrl(anchor.attr('href'), baseUrl)
    if (!href || !results.has(href) || seen.has(href)) return
    seen.add(href)

    const card = cardElementFor($, anchor, href, results, baseUrl)
    const cardText = cleanText(card.text())
    if (cardText.length > 2000) return
    if (NOISE_RE.test(cardText) && cardText.length < 80) return

    let title = ''
    for (const titleSelector of titleSelectors) {
      title = cleanText(card.find(titleSelector).first().text())
      if (title) break
    }
    if (!title) title = cleanText(card.find('h1,h2,h3,h4,h5').first().text())
    if (!title) title = cleanText(anchor.text())
    if (!title) title = cleanText(anchor.attr('title') ?? anchor.attr('aria-label') ?? '')
    if (!title) title = cleanText(card.find('img[alt]').first().attr('alt') ?? '')
    title = title.slice(0, 180)
    if (title.length < 6) return

    let price: number | null = null
    for (const priceSelector of priceSelectors) {
      price = parsePrice(cleanText(card.find(priceSelector).first().text()))
      if (price !== null) break
    }
    if (price === null) price = priceFrom(cardText)

    const image = imageFrom($, card[0], baseUrl)
    const description = cleanText(cardText.replace(title, ' ')).slice(0, 600)

    listings.push({ url: href, title, description, price, currency: 'EUR', images: image ? [image] : [] })
  })

  return listings
}

/** Strategy 1 — schema.org data embedded as JSON-LD. */
export function fromJsonLd($: Cheerio, baseUrl: string): RawListing[] {
  const listings: RawListing[] = []

  const consume = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    const type = String(record['@type'] ?? '')

    if (/ItemList/i.test(type) && Array.isArray(record.itemListElement)) {
      for (const entry of record.itemListElement) {
        const item = entry && typeof entry === 'object' ? ((entry as Record<string, unknown>).item ?? entry) : entry
        consume(item)
      }
      return
    }
    if (!/Product|Offer|Vehicle|IndividualProduct/i.test(type)) return

    const name = cleanText(String(record.name ?? ''))
    const url = absoluteUrl(String(record.url ?? ''), baseUrl)
    if (!name || !url) return

    const offers = (Array.isArray(record.offers) ? record.offers[0] : record.offers) as
      | Record<string, unknown>
      | undefined
    const price = parsePrice((offers?.price ?? offers?.lowPrice ?? record.price) as string | number | undefined)

    const rawImages = record.image
    const images = (Array.isArray(rawImages) ? rawImages : [rawImages])
      .map((image) => {
        if (typeof image === 'string') return absoluteUrl(image, baseUrl)
        if (image && typeof image === 'object') {
          return absoluteUrl(String((image as Record<string, unknown>).url ?? ''), baseUrl)
        }
        return null
      })
      .filter((image): image is string => Boolean(image))

    listings.push({
      url,
      title: name,
      description: cleanText(String(record.description ?? '')),
      price,
      currency: String(offers?.priceCurrency ?? 'EUR'),
      images: dedupe(images).map(upgradeImage),
    })
  }

  for (const block of jsonLdBlocks($)) consume(block)
  return listings
}

/** Combine listings from several strategies, filling gaps rather than overwriting. */
export function mergeByUrl(listings: RawListing[]): RawListing[] {
  const map = new Map<string, RawListing>()
  for (const listing of listings) {
    const existing = map.get(listing.url)
    if (!existing) {
      map.set(listing.url, listing)
      continue
    }
    map.set(listing.url, {
      ...existing,
      ...listing,
      price: listing.price ?? existing.price ?? null,
      images: dedupe([...(existing.images ?? []), ...(listing.images ?? [])]),
      description: listing.description || existing.description || '',
      attributes: { ...(existing.attributes ?? {}), ...(listing.attributes ?? {}) },
    })
  }
  return [...map.values()]
}

/** Strategy 3 — the URL points at one bike rather than a result list. */
export function fromOpenGraph($: Cheerio, baseUrl: string): RawListing[] {
  const meta = (property: string) =>
    cleanText($(`meta[property="${property}"]`).attr('content') ?? $(`meta[name="${property}"]`).attr('content') ?? '')

  const title = meta('og:title') || cleanText($('h1').first().text()) || cleanText($('title').text())
  if (!title) return []

  const images = dedupe(
    $('meta[property="og:image"], meta[property="og:image:secure_url"]')
      .map((_, element) => absoluteUrl($(element).attr('content'), baseUrl))
      .get()
      .filter((image): image is string => Boolean(image)),
  )

  const description = meta('og:description') || cleanText($('meta[name="description"]').attr('content') ?? '')
  const priceMeta =
    meta('product:price:amount') || meta('og:price:amount') || cleanText($('[itemprop="price"]').attr('content') ?? '')
  const price = parsePrice(priceMeta) ?? priceFrom(cleanText($('body').text()).slice(0, 4000))

  return [{ url: baseUrl, title, description, price, currency: 'EUR', images: images.map(upgradeImage) }]
}

export function scrapeGeneric($: Cheerio, baseUrl: string, options: HarvestOptions = {}): RawListing[] {
  const structured = fromJsonLd($, baseUrl)
  const cards = harvestCards($, baseUrl, options)

  // Merge: JSON-LD wins on fields it has, cards fill in images/prices it lacks.
  const merged = new Map<string, RawListing>()
  for (const listing of cards) merged.set(listing.url, listing)
  for (const listing of structured) {
    const existing = merged.get(listing.url)
    merged.set(listing.url, {
      ...existing,
      ...listing,
      price: listing.price ?? existing?.price ?? null,
      images: dedupe([...(listing.images ?? []), ...(existing?.images ?? [])]),
      description: listing.description || existing?.description || '',
    })
  }

  const results = [...merged.values()]
  return results.length ? results : fromOpenGraph($, baseUrl)
}
