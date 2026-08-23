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

const CARD_SELECTOR = [
  'li', 'article',
  '[class*="card" i]', '[class*="listing" i]', '[class*="item" i]',
  '[class*="product" i]', '[class*="result" i]', '[class*="tile" i]',
  '[data-testid]',
].join(',')

const NOISE_RE = /(cookie|privacy|inloggen|log\s*in|sign\s*up|registreren|abonnement|newsletter|nieuwsbrief|sitemap|voorwaarden|advertentie plaatsen|plaats\s*je\s*advertentie)/i

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

export interface HarvestOptions {
  /** Adapter-specific card selectors, tried before the generic ones. */
  cardSelectors?: string[]
  /** Only keep links whose href matches this (e.g. /v/ detail pages). */
  linkPattern?: RegExp
  titleSelectors?: string[]
  priceSelectors?: string[]
}

/** Strategy 2 — walk the DOM and reconstruct result cards. */
export function harvestCards($: Cheerio, baseUrl: string, options: HarvestOptions = {}): RawListing[] {
  const { cardSelectors = [], linkPattern, titleSelectors = [], priceSelectors = [] } = options
  const byUrl = new Map<string, RawListing>()

  const scan = (selector: string) => {
    $(selector).each((_, element) => {
      const card = $(element)

      // Reject result *lists* masquerading as cards. A wrapper holding several
      // candidate containers AND several distinct links is a list, not a card —
      // taking it would merge every listing's text into one bogus result.
      const innerCards = card.find(selector).length
      const innerHrefs = new Set(
        card
          .find('a[href]')
          .map((_, link) => absoluteUrl($(link).attr('href'), baseUrl))
          .get()
          .filter(Boolean),
      )
      if (innerCards >= 2 && innerHrefs.size >= 2) return

      const anchor = card.is('a[href]') ? card : card.find('a[href]').first()
      const href = absoluteUrl(anchor.attr('href'), baseUrl)
      if (!href) return
      if (linkPattern && !linkPattern.test(href)) return
      if (byUrl.has(href)) return

      const cardText = cleanText(card.text())
      if (!cardText || cardText.length > 1200) return
      if (NOISE_RE.test(cardText) && cardText.length < 80) return

      let title = ''
      for (const titleSelector of titleSelectors) {
        title = cleanText(card.find(titleSelector).first().text())
        if (title) break
      }
      if (!title) title = cleanText(card.find('h1,h2,h3,h4,h5').first().text())
      if (!title) title = cleanText(anchor.attr('title') ?? anchor.attr('aria-label') ?? '')
      if (!title) title = cleanText(card.find('img[alt]').first().attr('alt') ?? '')
      if (!title) title = cleanText(anchor.text()).slice(0, 140)
      if (title.length < 6) return

      let price: number | null = null
      for (const priceSelector of priceSelectors) {
        price = parsePrice(cleanText(card.find(priceSelector).first().text()))
        if (price !== null) break
      }
      if (price === null) price = priceFrom(cardText)

      const image = imageFrom($, element, baseUrl)

      // Everything after the title is usually the teaser/description.
      const description = cleanText(cardText.replace(title, ' ')).slice(0, 600)

      byUrl.set(href, {
        url: href,
        title,
        description,
        price,
        currency: 'EUR',
        images: image ? [image] : [],
      })
    })
  }

  for (const selector of cardSelectors) scan(selector)
  if (byUrl.size < 3) scan(CARD_SELECTOR)

  return [...byUrl.values()]
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
