import type { AdapterId, Criteria, Settings, Source } from '@/lib/types'
import { DEFAULT_WEIGHTS } from '@/lib/score'

export const SETTINGS_KEY = 'bikefinder.settings.v1'
export const RESULTS_KEY = 'bikefinder.results.v1'
export const SETTINGS_VERSION = 1

/** Host fragments that map onto a dedicated adapter. */
const ADAPTER_HOSTS: { match: RegExp; adapter: AdapterId }[] = [
  { match: /(^|\.)(2dehands|tweedehands|marktplaats)\./i, adapter: 'tweedehands' },
  { match: /(^|\.)buycycle\./i, adapter: 'buycycle' },
  { match: /(^|\.)(facebook|fb)\./i, adapter: 'facebook' },
]

export function detectAdapter(url: string): AdapterId {
  try {
    const host = new URL(url).hostname
    return ADAPTER_HOSTS.find((entry) => entry.match.test(host))?.adapter ?? 'generic'
  } catch {
    return 'generic'
  }
}

export const BUILTIN_SOURCES: Source[] = [
  {
    id: 'builtin-tweedehands',
    label: '2dehands.be',
    url: 'https://www.2dehands.be/l/fietsen-en-brommers/fietsen-mountainbikes/',
    adapter: 'tweedehands',
    enabled: true,
    builtin: true,
  },
  {
    id: 'builtin-buycycle',
    label: 'buycycle',
    url: 'https://buycycle.com/en-be/shop?category=mountain-bike',
    adapter: 'buycycle',
    enabled: true,
    builtin: true,
  },
  {
    id: 'builtin-facebook',
    label: 'Facebook Marketplace',
    url: 'https://www.facebook.com/marketplace/category/bikes?query=mountainbike',
    adapter: 'facebook',
    enabled: false,
    builtin: true,
  },
]

export const DEFAULT_CRITERIA: Criteria = {
  minPrice: 300,
  maxPrice: 3000,
  minYear: 2017,
  sizes: ['M', 'L'],
  frameMaterials: [],
  frameTypes: [],
  disciplines: [],
  conditions: [],
  wheelSizes: [],
  brands: [],
  excludeBrands: [],
  keywords: [],
  excludeKeywords: ['kinderfiets', 'gestolen', 'onderdelen', 'frame only', 'gezocht'],
  allowElectric: false,
  requirePrice: true,
  minScore: 0,
  // Raised alongside pagination — one page of a big marketplace is ~24 results.
  maxPerSource: 150,
  maxPages: 3,
}

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  sources: BUILTIN_SOURCES,
  criteria: DEFAULT_CRITERIA,
  weights: DEFAULT_WEIGHTS,
  demoMode: false,
  clientFallback: true,
}

/** Merge stored settings over the defaults so new fields appear for old users. */
export function hydrateSettings(stored: unknown): Settings {
  if (!stored || typeof stored !== 'object') return DEFAULT_SETTINGS
  const raw = stored as Partial<Settings>

  const sources = Array.isArray(raw.sources) && raw.sources.length ? raw.sources : BUILTIN_SOURCES
  // Re-add any built-in the user's stored copy predates.
  const merged = [...sources]
  for (const builtin of BUILTIN_SOURCES) {
    if (!merged.some((source) => source.id === builtin.id)) merged.push(builtin)
  }

  return {
    version: SETTINGS_VERSION,
    sources: merged,
    criteria: { ...DEFAULT_CRITERIA, ...(raw.criteria ?? {}) },
    weights: { ...DEFAULT_WEIGHTS, ...(raw.weights ?? {}) },
    demoMode: Boolean(raw.demoMode),
    clientFallback: raw.clientFallback ?? true,
  }
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    return hydrateSettings(raw ? JSON.parse(raw) : null)
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Quota or private-mode failures are not worth interrupting the user over.
  }
}

export function newSourceId(): string {
  return `src-${Math.random().toString(36).slice(2, 9)}`
}

export function labelFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'New source'
  }
}
