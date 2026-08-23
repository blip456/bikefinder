import * as cheerio from 'cheerio'

export type Cheerio = cheerio.CheerioAPI

export function load(html: string): Cheerio {
  return cheerio.load(html)
}

export function cleanText(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Parse prices written in either European ("1.250,00 €") or Anglo ("€1,250.00")
 * notation. Returns null for "bieden", "op aanvraag", "free" and friends.
 */
export function parsePrice(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? Math.round(input) : null

  const text = input.trim()
  if (!text) return null
  if (/(bieden|bod|op\s*aanvraag|on\s*request|make\s*an?\s*offer|gratis|free|zie\s*beschrijving|n\.?v\.?t)/i.test(text)) {
    return null
  }

  const match = text.match(/\d[\d.,\s ]*/)
  if (!match) return null

  let digits = match[0].replace(/[\s ]/g, '')
  const hasDot = digits.includes('.')
  const hasComma = digits.includes(',')

  if (hasDot && hasComma) {
    // Whichever separator comes last is the decimal one.
    const decimalSep = digits.lastIndexOf(',') > digits.lastIndexOf('.') ? ',' : '.'
    const thousandSep = decimalSep === ',' ? '.' : ','
    digits = digits.split(thousandSep).join('')
    digits = digits.replace(decimalSep, '.')
  } else if (hasComma) {
    digits = /,\d{1,2}$/.test(digits) ? digits.replace(',', '.') : digits.split(',').join('')
  } else if (hasDot) {
    // A single dot followed by exactly three digits is a thousands separator.
    digits = /\.\d{3}(?:\D|$)/.test(digits) && !/\.\d{1,2}$/.test(digits) ? digits.split('.').join('') : digits
  }

  const value = Number.parseFloat(digits)
  if (!Number.isFinite(value) || value <= 0) return null
  // Marketplaces sometimes publish prices in cents.
  if (value > 200000 && Number.isInteger(value)) return Math.round(value / 100)
  return Math.round(value)
}

export function absoluteUrl(href: string | undefined | null, base: string): string | null {
  if (!href) return null
  const trimmed = href.trim()
  if (!trimmed || trimmed.startsWith('javascript:') || trimmed.startsWith('#')) return null
  try {
    return new URL(trimmed, base).toString()
  } catch {
    return null
  }
}

/** Strip srcset/query-based thumbnail sizing so we get the largest available image. */
export function upgradeImage(url: string): string {
  return url
    .replace(/\$_\d+\.(jpg|jpeg|png|webp)/i, '$$_86.$1')
    .replace(/([?&])(?:w|width)=\d+/gi, '$1width=1200')
    .replace(/\/(?:thumb|small|s\d{2,3}x\d{2,3})\//i, '/large/')
}

export function pickFromSrcset(srcset: string | undefined): string | null {
  if (!srcset) return null
  const candidates = srcset
    .split(',')
    .map((entry) => entry.trim().split(/\s+/))
    .filter((parts) => parts[0])
    .map((parts) => ({ url: parts[0], width: Number.parseInt(parts[1] ?? '0', 10) || 0 }))
  if (!candidates.length) return null
  candidates.sort((a, b) => b.width - a.width)
  return candidates[0].url
}

export function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

/** All JSON-LD payloads on the page, with @graph flattened out. */
export function jsonLdBlocks($: Cheerio): unknown[] {
  const blocks: unknown[] = []
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text()
    if (!raw.trim()) return
    try {
      const parsed = JSON.parse(raw)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        const record = item as Record<string, unknown>
        if (record && Array.isArray(record['@graph'])) blocks.push(...(record['@graph'] as unknown[]))
        else blocks.push(item)
      }
    } catch {
      // Malformed LD blocks are common; ignore and fall through to other strategies.
    }
  })
  return blocks
}

/**
 * Pull a JSON object out of an inline script. Handles both `id="__NEXT_DATA__"`
 * style blobs and `window.__X__ = {...}` assignments by brace-matching.
 */
export function extractInlineJson(html: string, marker: string): unknown | null {
  const markerIndex = html.indexOf(marker)
  if (markerIndex === -1) return null

  const start = html.indexOf('{', markerIndex)
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < html.length; i += 1) {
    const char = html[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/** Depth-first search for every nested object satisfying `predicate`. */
export function findObjects(
  root: unknown,
  predicate: (value: Record<string, unknown>) => boolean,
  limit = 500,
): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = []
  const seen = new Set<unknown>()
  const stack: unknown[] = [root]

  while (stack.length && found.length < limit) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue
    if (seen.has(current)) continue
    seen.add(current)

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item)
      continue
    }

    const record = current as Record<string, unknown>
    if (predicate(record)) found.push(record)
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') stack.push(value)
    }
  }
  return found
}

/** First non-empty string found at any of the given key paths. */
export function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

export function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = parsePrice(value)
      if (parsed !== null) return parsed
    }
    if (value && typeof value === 'object') {
      const nested = pickNumber(value as Record<string, unknown>, ['amount', 'value', 'price', 'cents'])
      if (nested !== null) return nested
    }
  }
  return null
}
