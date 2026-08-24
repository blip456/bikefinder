import { NextResponse } from 'next/server'

import { buildBikes } from '@/lib/pipeline'
import { DEFAULT_CRITERIA, hydrateSettings } from '@/lib/settings'
import { listingsFromBody } from '@/lib/scrape'
import type { AdapterId, ScoredBike, Settings } from '@/lib/types'
import type { ApiKind } from '@/lib/scrape/api-discovery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Bodies larger than this are almost certainly not a results page. */
const MAX_BODY_CHARS = 6_000_000

interface ParseRequest {
  url?: string
  adapter?: AdapterId
  apiKind?: ApiKind
  /** Page bodies fetched by the browser, in page order. */
  bodies?: string[]
  settings?: Partial<Settings>
  sourceId?: string
  sourceLabel?: string
}

/**
 * Parse page bodies the *browser* fetched.
 *
 * The split matters: the browser is only ever the network client (its IP and
 * locale are what the site sees), while parsing, filtering and scoring stay
 * here so there is exactly one implementation of each.
 */
export async function POST(request: Request) {
  let payload: ParseRequest
  try {
    payload = (await request.json()) as ParseRequest
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const { url, adapter = 'generic', apiKind, bodies = [], sourceId = 'client', sourceLabel = 'Browser' } = payload
  if (!url || !Array.isArray(bodies) || bodies.length === 0) {
    return NextResponse.json({ error: 'url and a non-empty bodies array are required.' }, { status: 400 })
  }

  const total = bodies.reduce((sum, body) => sum + (typeof body === 'string' ? body.length : 0), 0)
  if (total > MAX_BODY_CHARS) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  }

  const settings = hydrateSettings(payload.settings ?? {})
  const criteria = { ...DEFAULT_CRITERIA, ...settings.criteria }

  const listings = bodies
    .filter((body): body is string => typeof body === 'string' && body.length > 0)
    .flatMap((body) => {
      try {
        return listingsFromBody(adapter, body, url, apiKind)
      } catch {
        return []
      }
    })

  const deduped = new Map(listings.map((listing) => [listing.url, listing]))
  const source = { id: sourceId, label: sourceLabel, adapter }
  const { bikes, dropped } = buildBikes([...deduped.values()], source, criteria, settings.weights)

  return NextResponse.json(
    { bikes: bikes as ScoredBike[], found: deduped.size, dropped },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
