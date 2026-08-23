import { NextResponse } from 'next/server'

import { DEMO_LISTINGS } from '@/lib/demo'
import { buildBikes } from '@/lib/pipeline'
import { DEFAULT_CRITERIA, hydrateSettings } from '@/lib/settings'
import { scanSource } from '@/lib/scrape'
import type { ScanResponse, ScoredBike, Settings, SourceReport } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_SOURCES = 12

function demoResult(settings: Settings): { report: SourceReport; bikes: ScoredBike[] } {
  const source = { id: 'demo', label: 'Sample data', adapter: 'generic' as const }
  const bikes = buildBikes(
    DEMO_LISTINGS,
    source,
    { ...settings.criteria, maxPerSource: Math.max(settings.criteria.maxPerSource, DEMO_LISTINGS.length) },
    settings.weights,
    true,
  )
  return {
    report: {
      id: 'demo',
      label: 'Sample data',
      adapter: 'generic',
      ok: true,
      found: DEMO_LISTINGS.length,
      kept: bikes.length,
      hint: 'Demo mode is on — these are built-in sample listings, not live results.',
    },
    bikes,
  }
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  // Reuse the client-side hydrator so the API and the browser agree on defaults.
  const settings = hydrateSettings(payload)
  const criteria = { ...DEFAULT_CRITERIA, ...settings.criteria }

  const enabled = settings.sources.filter((source) => source.enabled && source.url).slice(0, MAX_SOURCES)

  const results = settings.demoMode
    ? [demoResult(settings)]
    : await Promise.all(enabled.map((source) => scanSource(source, criteria, settings.weights)))

  const bikes: ScoredBike[] = []
  const seen = new Set<string>()
  for (const result of results) {
    for (const bike of result.bikes) {
      // The same ad can surface on more than one source; keep the first (best-scored) copy.
      if (seen.has(bike.url)) continue
      seen.add(bike.url)
      bikes.push(bike)
    }
  }
  bikes.sort((a, b) => b.score - a.score)

  const body: ScanResponse = {
    scannedAt: new Date().toISOString(),
    bikes,
    sources: results.map((result) => result.report),
  }

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
