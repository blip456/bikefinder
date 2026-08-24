/**
 * Find a JSON endpoint behind a results page.
 *
 * Raw JSON beats scraped HTML on every axis: the fields are already
 * standardised, page sizes are far larger (Shopify serves 250 products per
 * request against ~24 in the grid), and the markup can change without breaking
 * us. It is also the only route that works from the browser, because storefront
 * APIs commonly send `Access-Control-Allow-Origin: *` while HTML pages do not.
 */

import { extractInlineJson } from './html'

export type ApiKind = 'shopify' | 'woocommerce' | 'next-data'

export interface ApiCandidate {
  kind: ApiKind
  /** Builds the URL for a given 1-based page. */
  pageUrl: (page: number) => string
  /** Results per request, so the caller knows when a page was the last one. */
  pageSize: number
  label: string
}

function origin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** "/collections/vtt-electrique/products" -> "vtt-electrique" */
function shopifyCollectionHandle(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    const index = segments.indexOf('collections')
    if (index === -1) return null
    const handle = segments[index + 1]
    return handle && handle !== 'all' ? handle : null
  } catch {
    return null
  }
}

/**
 * @param html Optional page source. Without it we can still guess from the URL
 *   shape; with it we can confirm the platform and read a Next.js build id.
 */
export function discoverApiEndpoints(pageUrl: string, html?: string): ApiCandidate[] {
  const root = origin(pageUrl)
  if (!root) return []

  const candidates: ApiCandidate[] = []
  const looksShopify = html ? /cdn\.shopify\.com|Shopify\.shop|shopify-features/i.test(html) : false
  const looksWoo = html ? /wp-content|woocommerce/i.test(html) : false

  // Shopify exposes every collection as JSON at a predictable path. The URL
  // shape alone is a good enough reason to try it — one cheap request.
  const handle = shopifyCollectionHandle(pageUrl)
  if (handle) {
    candidates.push({
      kind: 'shopify',
      label: `Shopify collection JSON (${handle})`,
      pageSize: 250,
      pageUrl: (page) => `${root}/collections/${handle}/products.json?limit=250&page=${page}`,
    })
  }
  if (looksShopify || handle) {
    candidates.push({
      kind: 'shopify',
      label: 'Shopify catalogue JSON',
      pageSize: 250,
      pageUrl: (page) => `${root}/products.json?limit=250&page=${page}`,
    })
  }

  if (looksWoo) {
    candidates.push({
      kind: 'woocommerce',
      label: 'WooCommerce Store API',
      pageSize: 100,
      pageUrl: (page) => `${root}/wp-json/wc/store/v1/products?per_page=100&page=${page}`,
    })
  }

  // Next.js ships the page's own props as JSON under its build id.
  if (html) {
    const nextData = extractInlineJson(html, '__NEXT_DATA__') as { buildId?: string } | null
    if (nextData?.buildId) {
      try {
        const { pathname, search } = new URL(pageUrl)
        const clean = pathname.replace(/\/$/, '') || '/index'
        candidates.push({
          kind: 'next-data',
          label: 'Next.js page data',
          pageSize: 0,
          pageUrl: (page) => {
            const params = new URLSearchParams(search)
            params.set('page', String(page))
            return `${root}/_next/data/${nextData.buildId}${clean}.json?${params.toString()}`
          },
        })
      } catch {
        /* pageUrl was already validated above */
      }
    }
  }

  return candidates
}
