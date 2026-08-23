/**
 * buycycle.com — a Nuxt/Next storefront for used bikes.
 *
 * Their shop pages hydrate from an inline state blob whose bike records already
 * carry clean, standardised fields (brand, family, year, frame size, condition),
 * so when we can read it we skip text parsing almost entirely.
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
  pickNumber,
  pickString,
  upgradeImage,
} from './html'
import { harvestCards, scrapeGeneric } from './generic'

const INLINE_MARKERS = ['__NEXT_DATA__', 'window.__NUXT__', 'window.__INITIAL_STATE__', '"bikes":']

function isBikeRecord(record: Record<string, unknown>): boolean {
  const hasName =
    typeof record.family_name === 'string' ||
    typeof record.template_name === 'string' ||
    typeof record.bike_name === 'string' ||
    typeof record.brand_name === 'string'
  const hasPrice = 'price' in record || 'sales_price' in record || 'price_converted' in record
  return hasName && hasPrice
}

function fromInlineJson(html: string, baseUrl: string): RawListing[] {
  const listings: RawListing[] = []

  for (const marker of INLINE_MARKERS) {
    const root = extractInlineJson(html, marker)
    if (!root) continue

    for (const record of findObjects(root, isBikeRecord)) {
      const brand = pickString(record, ['brand_name', 'brand'])
      const family = pickString(record, ['family_name', 'template_name', 'bike_name', 'name', 'title'])
      const title = cleanText([brand, family].filter(Boolean).join(' ')) || cleanText(family ?? '')
      if (!title) continue

      const slug = pickString(record, ['slug', 'url', 'path', 'permalink'])
      const id = pickString(record, ['id', 'bike_id'])
      const href = slug
        ? slug.startsWith('http') || slug.startsWith('/')
          ? slug
          : `/bike/${slug}`
        : id
          ? `/bike/${id}`
          : null
      const url = absoluteUrl(href, baseUrl)
      if (!url) continue

      const price = pickNumber(record, ['sales_price', 'price', 'price_converted', 'display_price'])
      const msrp = pickNumber(record, ['msrp', 'original_price', 'recommended_retail_price'])

      const rawImages = [
        record.main_image_url,
        record.image,
        record.image_url,
        record.thumbnail,
        ...(Array.isArray(record.images) ? (record.images as unknown[]) : []),
        ...(Array.isArray(record.bike_images)
          ? (record.bike_images as Record<string, unknown>[]).map((image) => image.url ?? image.file ?? image.path)
          : []),
      ]
      const images = dedupe(
        rawImages
          .map((image) => {
            if (typeof image === 'string') return image
            if (image && typeof image === 'object') {
              return String((image as Record<string, unknown>).url ?? (image as Record<string, unknown>).src ?? '')
            }
            return ''
          })
          .filter((image) => image.length > 4)
          .map((image) => absoluteUrl(image.startsWith('//') ? `https:${image}` : image, baseUrl))
          .filter((image): image is string => Boolean(image))
          .map(upgradeImage),
      )

      // These map straight onto our spec fields, so hand them over as attributes.
      const attributes: Record<string, string> = {}
      const attribute = (key: string, ...sources: string[]) => {
        const value = pickString(record, sources)
        if (value) attributes[key] = value
      }
      attribute('brand', 'brand_name', 'brand')
      attribute('model', 'family_name', 'template_name')
      attribute('year', 'model_year', 'year')
      attribute('size', 'frame_size', 'size', 'size_name')
      attribute('condition', 'condition', 'condition_name', 'bike_condition')
      attribute('frame material', 'frame_material', 'material')
      attribute('groupset', 'shifting_name', 'group_set', 'groupset', 'shifting')
      attribute('category', 'category_name', 'bike_category', 'category')
      attribute('wheel size', 'wheel_size', 'wheelsize')
      attribute('suspension', 'suspension', 'frame_type')
      if (msrp) attributes['retail price'] = `EUR ${msrp}`

      listings.push({
        url,
        title,
        description: cleanText(
          [pickString(record, ['description', 'seller_description']), Object.entries(attributes).map(([key, value]) => `${key}: ${value}`).join(', ')]
            .filter(Boolean)
            .join('. '),
        ),
        price,
        currency: pickString(record, ['currency', 'currency_code']) ?? 'EUR',
        location: pickString(record, ['city', 'location', 'country_name']) ?? undefined,
        images,
        attributes,
      })
    }
    if (listings.length) break
  }
  return listings
}

export function scrapeBuycycle(html: string, $: Cheerio, baseUrl: string): RawListing[] {
  const fromJson = fromInlineJson(html, baseUrl)
  if (fromJson.length >= 3) return fromJson

  const fromDom = harvestCards($, baseUrl, {
    cardSelectors: [
      '[data-testid*="bike" i]',
      '[class*="bike-card" i]',
      '[class*="BikeCard" i]',
      '[class*="product-card" i]',
      'a[href*="/bike/"]',
    ],
    linkPattern: /\/bikes?\//i,
    titleSelectors: ['[class*="title" i]', '[class*="name" i]', 'h2', 'h3'],
    priceSelectors: ['[class*="price" i]', '[data-testid*="price" i]'],
  })

  const merged = [...fromJson, ...fromDom]
  if (merged.length) return merged
  return scrapeGeneric($, baseUrl, { linkPattern: /\/bikes?\//i })
}
