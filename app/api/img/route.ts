/**
 * Image relay.
 *
 * Marketplace CDNs commonly reject hot-linked requests (missing/foreign Referer),
 * which would leave every card blank. Proxying through the app fixes that and
 * keeps third-party hosts out of the browser's request log.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 8 * 1024 * 1024

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get('u')
  if (!target) return new Response('Missing ?u', { status: 400 })

  let url: URL
  try {
    url = new URL(target)
  } catch {
    return new Response('Bad URL', { status: 400 })
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return new Response('Unsupported protocol', { status: 400 })
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: url.origin + '/',
      },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    })

    if (!upstream.ok || !upstream.body) {
      return new Response('Upstream error', { status: 502 })
    }

    const type = upstream.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return new Response('Not an image', { status: 415 })

    const length = Number(upstream.headers.get('content-length') ?? 0)
    if (length > MAX_BYTES) return new Response('Image too large', { status: 413 })

    return new Response(upstream.body, {
      headers: {
        'Content-Type': type,
        // Listing photos are immutable once published; cache them hard at the edge.
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Fetch failed', { status: 502 })
  }
}
