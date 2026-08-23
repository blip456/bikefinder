/**
 * A single, defensive HTTP entry point for every adapter.
 *
 * Marketplaces actively discourage scraping, so this layer: sends a realistic
 * browser fingerprint, honours optional per-site cookies from env, supports an
 * optional upstream proxy, and — most importantly — classifies failures so the
 * UI can tell the user *why* a source came back empty instead of silently
 * showing zero results.
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
]

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'

export class ScrapeError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message)
    this.name = 'ScrapeError'
  }
}

export interface FetchOptions {
  mobile?: boolean
  timeoutMs?: number
  /** Env var holding a cookie header for this site, e.g. FACEBOOK_COOKIE. */
  cookieEnv?: string
  referer?: string
}

export interface FetchResult {
  html: string
  finalUrl: string
  status: number
}

function cookieFor(cookieEnv?: string): string | null {
  if (!cookieEnv) return null
  const value = process.env[cookieEnv]
  return value && value.trim() ? value.trim() : null
}

/**
 * Some deployments route scraping through a rendering proxy. Set SCRAPE_PROXY_URL
 * to a template containing {url} (URL-encoded target) to enable it.
 */
function applyProxy(url: string): string {
  const template = process.env.SCRAPE_PROXY_URL
  if (!template) return url
  return template.includes('{url}')
    ? template.replace('{url}', encodeURIComponent(url))
    : `${template}${encodeURIComponent(url)}`
}

export async function fetchHtml(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  const { mobile = false, timeoutMs = 20000, cookieEnv, referer } = options

  let target: URL
  try {
    target = new URL(url)
  } catch {
    throw new ScrapeError('That is not a valid URL.', 'Include the scheme, e.g. https://…')
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    throw new ScrapeError('Only http(s) URLs can be scanned.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const userAgent = mobile ? MOBILE_USER_AGENT : USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'nl-BE,nl;q=0.9,en-GB;q=0.8,en;q=0.7,fr;q=0.6',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
  }
  if (referer) headers.Referer = referer
  const cookie = cookieFor(cookieEnv)
  if (cookie) headers.Cookie = cookie

  try {
    const response = await fetch(applyProxy(url), {
      headers,
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store',
    })

    const html = await response.text()

    if (response.status === 403 || response.status === 401) {
      throw new ScrapeError(
        `${target.hostname} returned ${response.status} (blocked).`,
        cookieEnv
          ? `Set the ${cookieEnv} environment variable in Vercel with a logged-in cookie header.`
          : 'The site is refusing server-side requests. Try a different search URL or set SCRAPE_PROXY_URL.',
      )
    }
    if (response.status === 429) {
      throw new ScrapeError(`${target.hostname} rate-limited this scan (429).`, 'Wait a minute and scan again.')
    }
    if (!response.ok) {
      throw new ScrapeError(`${target.hostname} returned HTTP ${response.status}.`)
    }

    const wall = detectWall(html)
    if (wall) throw new ScrapeError(`${target.hostname}: ${wall.message}`, wall.hint)

    return { html, finalUrl: response.url || url, status: response.status }
  } catch (error) {
    if (error instanceof ScrapeError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ScrapeError(`${target.hostname} timed out after ${Math.round(timeoutMs / 1000)}s.`)
    }
    throw new ScrapeError(
      `Could not reach ${target.hostname}.`,
      error instanceof Error ? error.message : undefined,
    )
  } finally {
    clearTimeout(timer)
  }
}

/** Recognise bot-walls and login-walls that still return HTTP 200. */
function detectWall(html: string): { message: string; hint: string } | null {
  const head = html.slice(0, 6000)
  if (/just a moment|cf-browser-verification|checking your browser|__cf_chl/i.test(head)) {
    return {
      message: 'a Cloudflare bot check blocked the request.',
      hint: 'Set SCRAPE_PROXY_URL to a rendering proxy, or scan a different source.',
    }
  }
  if (/captcha|recaptcha|are you a robot|geblokkeerd|access denied/i.test(head)) {
    return { message: 'a CAPTCHA / access wall blocked the request.', hint: 'Try again later or use a proxy.' }
  }
  if (/<title>[^<]*(log in|inloggen|sign in|aanmelden)[^<]*<\/title>/i.test(head)) {
    return {
      message: 'a login wall was returned instead of results.',
      hint: 'This source needs an authenticated cookie to be scraped server-side.',
    }
  }
  return null
}
