/**
 * Normalise the JSON shapes returned by discovered APIs into RawListing[].
 *
 * Each of these platforms already publishes the fields we would otherwise have
 * to guess at from prose — vendor, variant/size, price, images — so they are
 * passed through as `attributes`, which the extractor trusts over free text.
 */

import type { RawListing } from '@/lib/types'
import type { ApiKind } from './api-discovery'
import { absoluteUrl, cleanText, dedupe, findObjects, parsePrice, pickNumber, pickString } from './html'

function stripHtml(value: string): string {
  return cleanText(value.replace(/<[^>]*>/g, ' '))
}

interface ShopifyVariant {
  title?: string
  price?: string | number
  available?: boolean
}

function fromShopify(payload: unknown, baseUrl: string): RawListing[] {
  const products = (payload as { products?: unknown[] })?.products
  if (!Array.isArray(products)) return []

  const listings: RawListing[] = []
  for (const entry of products as Record<string, unknown>[]) {
    const title = pickString(entry, ['title'])
    const handle = pickString(entry, ['handle'])
    if (!title || !handle) continue

    const url = absoluteUrl(`/products/${handle}`, baseUrl)
    if (!url) continue

    const variants = (Array.isArray(entry.variants) ? entry.variants : []) as ShopifyVariant[]
    const prices = variants
      .map((variant) => parsePrice(variant.price ?? null))
      .filter((price): price is number => price !== null)
    const price = prices.length ? Math.min(...prices) : null

    const images = dedupe(
      (Array.isArray(entry.images) ? entry.images : [])
        .map((image) => absoluteUrl(pickString(image as Record<string, unknown>, ['src']), baseUrl))
        .filter((image): image is string => Boolean(image)),
    )

    const attributes: Record<string, string> = {}
    const vendor = pickString(entry, ['vendor'])
    if (vendor) attributes.brand = vendor
    const productType = pickString(entry, ['product_type'])
    if (productType) attributes.category = productType
    // Shopify sizes live in the variant title on almost every bike store.
    const sizes = variants.map((variant) => variant.title).filter((value): value is string => Boolean(value))
    if (sizes.length) attributes.size = sizes.join(', ')
    if (Array.isArray(entry.tags) && entry.tags.length) attributes.tags = (entry.tags as string[]).join(', ')

    listings.push({
      url,
      title,
      description: stripHtml(String(entry.body_html ?? '')).slice(0, 1500),
      price,
      currency: 'EUR',
      images,
      attributes,
    })
  }
  return listings
}

function fromWooCommerce(payload: unknown, baseUrl: string): RawListing[] {
  const products = Array.isArray(payload) ? payload : (payload as { products?: unknown[] })?.products
  if (!Array.isArray(products)) return []

  const listings: RawListing[] = []
  for (const entry of products as Record<string, unknown>[]) {
    const title = pickString(entry, ['name', 'title'])
    const url = absoluteUrl(pickString(entry, ['permalink', 'link']), baseUrl)
    if (!title || !url) continue

    // Store API publishes prices in minor units.
    const priceNode = entry.prices as Record<string, unknown> | undefined
    let price: number | null = null
    if (priceNode) {
      const minor = Number(priceNode.currency_minor_unit ?? 2)
      const raw = Number(priceNode.price ?? NaN)
      if (Number.isFinite(raw)) price = Math.round(raw / 10 ** (Number.isFinite(minor) ? minor : 2))
    }
    if (price === null) price = pickNumber(entry, ['price', 'regular_price'])

    const images = dedupe(
      (Array.isArray(entry.images) ? entry.images : [])
        .map((image) => absoluteUrl(pickString(image as Record<string, unknown>, ['src', 'thumbnail']), baseUrl))
        .filter((image): image is string => Boolean(image)),
    )

    listings.push({
      url,
      title,
      description: stripHtml(String(entry.description ?? entry.short_description ?? '')).slice(0, 1500),
      price,
      currency: 'EUR',
      images,
    })
  }
  return listings
}

/** Last resort: walk an arbitrary payload for objects that look like products. */
export function fromUnknownJson(payload: unknown, baseUrl: string): RawListing[] {
  const records = findObjects(payload, (record) => {
    const hasTitle =
      typeof record.title === 'string' || typeof record.name === 'string' || typeof record.product_title === 'string'
    const hasPrice = 'price' in record || 'prices' in record || 'sales_price' in record || 'amount' in record
    return hasTitle && hasPrice
  })

  const listings: RawListing[] = []
  for (const record of records) {
    const title = pickString(record, ['title', 'name', 'product_title'])
    if (!title || title.length < 6) continue

    const href = pickString(record, ['url', 'permalink', 'link', 'href', 'slug', 'handle'])
    const url = absoluteUrl(href?.startsWith('http') || href?.startsWith('/') ? href : href ? `/${href}` : null, baseUrl)
    if (!url) continue

    const images = dedupe(
      [
        pickString(record, ['image', 'image_url', 'main_image_url', 'thumbnail']),
        ...(Array.isArray(record.images)
          ? (record.images as unknown[]).map((image) =>
              typeof image === 'string' ? image : pickString((image ?? {}) as Record<string, unknown>, ['src', 'url']),
            )
          : []),
      ]
        .filter((image): image is string => Boolean(image))
        .map((image) => absoluteUrl(image, baseUrl))
        .filter((image): image is string => Boolean(image)),
    )

    listings.push({
      url,
      title,
      description: stripHtml(String(record.description ?? '')).slice(0, 1500),
      price: pickNumber(record, ['price', 'sales_price', 'amount']),
      currency: 'EUR',
      images,
    })
  }
  return listings
}

export function listingsFromJson(kind: ApiKind, payload: unknown, baseUrl: string): RawListing[] {
  switch (kind) {
    case 'shopify':
      return fromShopify(payload, baseUrl)
    case 'woocommerce':
      return fromWooCommerce(payload, baseUrl)
    default:
      return fromUnknownJson(payload, baseUrl)
  }
}
