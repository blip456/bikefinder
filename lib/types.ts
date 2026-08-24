/** Shared domain types for BikeFinder. */

export type AdapterId = 'tweedehands' | 'buycycle' | 'facebook' | 'generic'

export type FrameMaterial = 'carbon' | 'titanium' | 'aluminium' | 'steel' | 'unknown'

/** Suspension layout — what most listings mean by "frame type". */
export type FrameType = 'full-suspension' | 'hardtail' | 'rigid' | 'unknown'

export type Discipline =
  | 'downhill'
  | 'enduro'
  | 'trail'
  | 'xc'
  | 'dirt'
  | 'gravel'
  | 'road'
  | 'city'
  | 'unknown'

export type Condition = 'new' | 'as-new' | 'good' | 'used' | 'damaged' | 'unknown'

export type SizeLabel = 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'

/** A source the user wants scanned. */
export interface Source {
  id: string
  label: string
  url: string
  adapter: AdapterId
  enabled: boolean
  /** Built-in sources ship with the app and cannot be deleted, only edited. */
  builtin?: boolean
}

/** What an adapter hands back before parsing/scoring. */
export interface RawListing {
  url: string
  title: string
  description?: string
  price?: number | null
  currency?: string
  location?: string
  postedAt?: string
  images?: string[]
  /** Extra key/value specs the site exposed explicitly (trumps text parsing). */
  attributes?: Record<string, string>
}

export interface BikeSpec {
  brand: string | null
  model: string | null
  year: number | null
  condition: Condition
  size: SizeLabel | null
  sizeCm: number | null
  groupset: string | null
  frameMaterial: FrameMaterial
  frameType: FrameType
  discipline: Discipline
  wheelSize: number | null
  travelMm: number | null
  electric: boolean
}

export interface ScorePart {
  key: string
  label: string
  /** 0-100 */
  score: number
  weight: number
  note: string
}

export interface ScoredBike {
  id: string
  sourceId: string
  sourceLabel: string
  adapter: AdapterId
  url: string
  title: string
  description: string
  price: number | null
  currency: string
  location: string | null
  postedAt: string | null
  images: string[]
  spec: BikeSpec
  /** 0-100, higher = better deal. */
  score: number
  parts: ScorePart[]
  /** Rough market value we benchmark the asking price against. */
  estimatedValue: number | null
  /** estimatedValue - price, when both are known. */
  savings: number | null
  demo?: boolean
}

export interface Criteria {
  minPrice: number | null
  maxPrice: number | null
  minYear: number | null
  sizes: SizeLabel[]
  frameMaterials: FrameMaterial[]
  frameTypes: FrameType[]
  disciplines: Discipline[]
  conditions: Condition[]
  wheelSizes: number[]
  brands: string[]
  excludeBrands: string[]
  keywords: string[]
  excludeKeywords: string[]
  allowElectric: boolean
  /** Listings we could not price are usually "make an offer" ads. */
  requirePrice: boolean
  minScore: number
  maxPerSource: number
  /** How many result pages to follow per source. 1 = just the landing page. */
  maxPages: number
}

export type WeightKey =
  | 'value'
  | 'frame'
  | 'brand'
  | 'groupset'
  | 'condition'
  | 'age'
  | 'fit'
  | 'completeness'

export type Weights = Record<WeightKey, number>

export interface Settings {
  version: number
  sources: Source[]
  criteria: Criteria
  weights: Weights
  demoMode: boolean
  /** Retry sources from the browser when the server is refused. */
  clientFallback: boolean
}

export interface SourceReport {
  id: string
  label: string
  adapter: AdapterId
  ok: boolean
  /** Listings the adapter recognised across every page fetched. */
  found: number
  kept: number
  /** Pages actually fetched, so a truncated scan is visible rather than implied. */
  pages: number
  /** Which route produced these results. */
  via?: 'server' | 'server-api' | 'browser' | 'browser-api'
  /** Why listings were discarded, keyed by reason. */
  dropped?: Record<string, number>
  error?: string
  hint?: string
}

export interface ScanResponse {
  scannedAt: string
  bikes: ScoredBike[]
  sources: SourceReport[]
}
