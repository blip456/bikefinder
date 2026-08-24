/**
 * Facebook Marketplace.
 *
 * Marketplace is a logged-in, client-rendered surface: an anonymous server-side
 * request gets a login wall, not results. We still try — logged-out category
 * pages sometimes ship a `marketplace_search` payload — and when we cannot get
 * anything we fail loudly with instructions rather than pretending the search
 * returned nothing.
 *
 * To make it work reliably, set the FACEBOOK_COOKIE environment variable in
 * Vercel to the `Cookie:` header of a logged-in browser session (or point
 * SCRAPE_PROXY_URL at a rendering proxy).
 */

import type { RawListing } from '@/lib/types'
import { ScrapeError } from './fetcher'
import {
  type Cheerio,
  absoluteUrl,
  cleanText,
  dedupe,
  findObjects,
  parsePrice,
  pickString,
} from './html'
import { harvestCards } from './generic'

const AUTH_HINT =
  'Marketplace needs a logged-in session. Add a FACEBOOK_COOKIE environment variable in Vercel (the Cookie header from a signed-in browser), or set SCRAPE_PROXY_URL to a rendering proxy.'

/** Facebook streams many separate JSON blobs; collect every one we can parse. */
function inlineBlobs(html: string): unknown[] {
  const blobs: unknown[] = []
  const re = /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null && blobs.length < 60) {
    const raw = match[1].trim()
    if (!raw.startsWith('{') && !raw.startsWith('[')) continue
    try {
      blobs.push(JSON.parse(raw))
    } catch {
      // Partial/streamed payloads are expected; skip them.
    }
  }
  return blobs
}

function fromBlobs(blobs: unknown[], baseUrl: string): RawListing[] {
  const listings: RawListing[] = []

  for (const blob of blobs) {
    const records = findObjects(
      blob,
      (record) => typeof record.marketplace_listing_title === 'string' || typeof record.custom_title === 'string',
    )

    for (const record of records) {
      const title = cleanText(String(record.marketplace_listing_title ?? record.custom_title ?? ''))
      if (!title) continue

      const id = pickString(record, ['id', 'story_key', 'listing_id'])
      const url = absoluteUrl(id ? `/marketplace/item/${id}/` : null, baseUrl)
      if (!url) continue

      const priceNode = (record.listing_price ?? record.formatted_price ?? record.price) as
        | Record<string, unknown>
        | string
        | undefined
      const price =
        typeof priceNode === 'string'
          ? parsePrice(priceNode)
          : priceNode
            ? parsePrice(
                pickString(priceNode, ['formatted_amount', 'amount', 'text', 'amount_with_offset']) ?? '',
              )
            : null

      const photo = record.primary_listing_photo ?? record.listing_photo
      let image: string | null = null
      if (photo && typeof photo === 'object') {
        const found = findObjects(photo, (node) => typeof node.uri === 'string')
        image = found.length ? String(found[0].uri) : null
      }

      const location = record.location as Record<string, unknown> | undefined
      listings.push({
        url,
        title,
        description: cleanText(
          String(
            (record.marketplace_listing_description as string | undefined) ??
              (record.redacted_description as Record<string, unknown> | undefined)?.text ??
              '',
          ),
        ),
        price,
        currency: 'EUR',
        location: location
          ? (pickString(location, ['text', 'name']) ??
            pickString((location.reverse_geocode ?? {}) as Record<string, unknown>, ['city', 'city_page_long_name']) ??
            undefined)
          : undefined,
        images: image ? dedupe([image]) : [],
      })
    }
  }
  return listings
}

export function scrapeFacebook(html: string, $: Cheerio, baseUrl: string): RawListing[] {
  const listings = fromBlobs(inlineBlobs(html), baseUrl)
  if (listings.length) return listings

  // Logged-out HTML very occasionally renders plain anchors to /marketplace/item/.
  const fallback = harvestCards($, baseUrl, {
    linkPattern: /\/marketplace\/item\//i,
    titleSelectors: ['span[dir="auto"]', 'h2', 'h3'],
  })
  if (fallback.length) return fallback

  const loggedIn = /"USER_ID":"(?!0")/.test(html)
  throw new ScrapeError(
    loggedIn
      ? 'Signed in to Facebook, but no Marketplace results were rendered server-side.'
      : 'Facebook returned a logged-out page with no Marketplace results.',
    loggedIn
      ? 'Marketplace renders results in the browser. Point SCRAPE_PROXY_URL at a rendering proxy to read them.'
      : AUTH_HINT,
  )
}
