/**
 * Browser-side fetching, used when a source refuses our server.
 *
 * Why this helps: the request comes from the user's own residential IP and
 * locale rather than a datacenter, which is what most "blocked" responses are
 * actually reacting to.
 *
 * Why it is not a general bypass: the browser enforces CORS. A cross-origin
 * response can only be read if the site sends `Access-Control-Allow-Origin`,
 * which storefront JSON APIs commonly do and ordinary HTML pages almost never
 * do. So this path leans on API discovery first and treats raw HTML as a long
 * shot. Credentials are deliberately omitted, because a wildcard
 * `Access-Control-Allow-Origin: *` is rejected by the browser when a request
 * carries cookies — sending them would break the case that usually works.
 */

import { discoverApiEndpoints } from '@/lib/scrape/api-discovery'
import type { ApiKind } from '@/lib/scrape/api-discovery'
import type { ScoredBike, Settings, Source, SourceReport } from '@/lib/types'

const PAGE_LIMIT = 10
const FETCH_TIMEOUT_MS = 20000

async function fetchText(url: string, accept: string): Promise<string> {
  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    redirect: 'follow',
    headers: { Accept: accept },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

async function parseOnServer(
  source: Source,
  url: string,
  bodies: string[],
  settings: Settings,
  apiKind?: ApiKind,
): Promise<{ bikes: ScoredBike[]; found: number; dropped: Record<string, number> }> {
  const response = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      adapter: source.adapter,
      apiKind,
      bodies,
      settings,
      sourceId: source.id,
      sourceLabel: source.label,
    }),
  })
  if (!response.ok) throw new Error(`Parsing failed (HTTP ${response.status}).`)
  return response.json()
}

export interface ClientScanResult {
  report: SourceReport
  bikes: ScoredBike[]
}

/**
 * Retry one source from the browser. Returns null when nothing could be read,
 * so the caller can keep the server's original report.
 */
export async function scanSourceFromBrowser(
  source: Source,
  settings: Settings,
): Promise<ClientScanResult | null> {
  const maxPages = Math.min(PAGE_LIMIT, Math.max(1, settings.criteria.maxPages || 1))

  const attempts: { label: string; via: SourceReport['via']; apiKind?: ApiKind; pageUrl: (page: number) => string }[] = [
    ...discoverApiEndpoints(source.url).map((candidate) => ({
      label: candidate.label,
      via: 'browser-api' as const,
      apiKind: candidate.kind,
      pageUrl: candidate.pageUrl,
    })),
    // Long shot, but free to try once the APIs have missed.
    { label: 'page markup', via: 'browser' as const, pageUrl: () => source.url },
  ]

  const errors: string[] = []

  for (const attempt of attempts) {
    const bodies: string[] = []
    const isApi = attempt.via === 'browser-api'

    for (let page = 1; page <= (isApi ? maxPages : 1); page += 1) {
      try {
        const body = await fetchText(attempt.pageUrl(page), isApi ? 'application/json' : 'text/html,*/*')
        if (!body.trim()) break
        bodies.push(body)
        // An API page that comes back tiny is the end of the list.
        if (isApi && body.length < 200) break
      } catch (error) {
        if (page === 1) {
          errors.push(`${attempt.label}: ${error instanceof Error ? error.message : 'failed'}`)
        }
        break
      }
    }

    if (!bodies.length) continue

    try {
      const parsed = await parseOnServer(source, source.url, bodies, settings, attempt.apiKind)
      if (!parsed.bikes.length && !parsed.found) continue

      return {
        bikes: parsed.bikes,
        report: {
          id: source.id,
          label: source.label,
          adapter: source.adapter,
          ok: true,
          via: attempt.via,
          pages: bodies.length,
          found: parsed.found,
          kept: parsed.bikes.length,
          dropped: parsed.dropped,
          hint: `Fetched by your browser via ${attempt.label}.`,
        },
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'parsing failed')
    }
  }

  if (!errors.length) return null
  return {
    bikes: [],
    report: {
      id: source.id,
      label: source.label,
      adapter: source.adapter,
      ok: false,
      via: 'browser',
      pages: 0,
      found: 0,
      kept: 0,
      error: 'Your browser could not read this source either.',
      hint:
        'Cross-origin rules let the browser read a site only when that site allows it — which JSON APIs usually do and HTML pages usually do not. This source appears to allow neither.',
    },
  }
}
