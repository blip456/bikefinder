/**
 * Deal scoring.
 *
 * A bike's score is a weighted average of independent 0-100 sub-scores. The
 * heaviest one is `value`: asking price measured against an estimated market
 * value we build up from brand tier, frame material, groupset, discipline and
 * age. The rest capture "is this actually a good bike" and "how much do we
 * really know about it", so a cheap unknown-brand listing with one blurry photo
 * cannot out-rank a fairly priced carbon enduro.
 */

import type { BikeSpec, Criteria, ScorePart, WeightKey, Weights } from '@/lib/types'
import {
  BASE_MSRP,
  BRAND_TIERS,
  CONDITION_SCORES,
  CONDITION_VALUE_FACTOR,
  DISCIPLINE_MSRP_FACTOR,
  FRAME_MATERIAL_SCORES,
  GROUPSETS,
  MATERIAL_MSRP_FACTOR,
  UNKNOWN_BRAND_SCORE,
} from '@/lib/parse/taxonomy'

const CURRENT_YEAR = new Date().getFullYear()

export const WEIGHT_META: { key: WeightKey; label: string; help: string }[] = [
  { key: 'value', label: 'Price vs value', help: 'Asking price against estimated market value.' },
  { key: 'frame', label: 'Frame material', help: 'Carbon and titanium out-rank alloy and steel.' },
  { key: 'brand', label: 'Brand tier', help: 'A-tier marques hold spec and resale value.' },
  { key: 'groupset', label: 'Groupset', help: 'XTR / XX1 down to Tourney.' },
  { key: 'condition', label: 'Condition', help: 'New, as-new, good, used or damaged.' },
  { key: 'age', label: 'Model year', help: 'Newer geometry and standards score higher.' },
  { key: 'fit', label: 'Fit to your criteria', help: 'Size, wheels, frame type, discipline.' },
  { key: 'completeness', label: 'Listing quality', help: 'Photos and detail — a proxy for risk.' },
]

export const DEFAULT_WEIGHTS: Weights = {
  // Value carries the most weight: the whole point is most bike per euro.
  value: 4,
  frame: 1.5,
  brand: 1.5,
  groupset: 2,
  condition: 2,
  age: 1,
  fit: 1.5,
  completeness: 0.5,
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

export function brandScore(brand: string | null): number {
  if (!brand) return UNKNOWN_BRAND_SCORE
  return BRAND_TIERS[brand.toLowerCase()] ?? UNKNOWN_BRAND_SCORE
}

export function groupsetScore(groupset: string | null): number | null {
  if (!groupset) return null
  return GROUPSETS[groupset.toLowerCase()] ?? null
}

/**
 * Fraction of original value a bike of this age still commands.
 *
 * Two-phase on purpose: a bike loses roughly a quarter of its value the moment
 * it stops being current-season, then decays far more slowly. A single
 * exponential either overstates year-one value or guts anything five years old.
 */
export function residualValue(age: number): number {
  if (age <= 0) return 1
  return Math.max(0.16, 0.74 * Math.pow(0.885, age - 1))
}

/**
 * Rough EUR market value. Deliberately coarse — it only has to be consistent
 * enough to rank listings against each other.
 */
/**
 * @param msrpHint Retail price published by the source (buycycle exposes one).
 *   When present it replaces the whole derived-MSRP calculation, because a real
 *   number beats anything we can infer from brand and groupset tiers.
 */
export function estimateValue(spec: BikeSpec, msrpHint: number | null = null): number | null {
  const base = BASE_MSRP[spec.frameType] ?? BASE_MSRP.unknown
  const material = MATERIAL_MSRP_FACTOR[spec.frameMaterial]
  const discipline = DISCIPLINE_MSRP_FACTOR[spec.discipline] ?? 1

  // Factors are calibrated so the derived MSRP lands near real retail prices for
  // a spread of known bikes (Ghost Lector, Trek Fuel EX 8, Orbea Oiz M30,
  // Santa Cruz Hightower C). Direct-to-consumer brands still come out high —
  // brand tier tracks quality, not how a brand prices itself.
  const brand = brandScore(spec.brand)
  const brandFactor = 0.6 + (brand / 100) * 0.65

  const groupset = groupsetScore(spec.groupset)
  const groupsetFactor = groupset === null ? 1 : 0.65 + (groupset / 100) * 0.55

  // Centred on 140mm — a trail bike — so more travel adds value and less removes it.
  const travelFactor = spec.travelMm ? clamp(1 + (spec.travelMm - 140) / 600, 0.85, 1.2) : 1
  const electricFactor = spec.electric ? 1.9 : 1

  const derived = base * material * discipline * brandFactor * groupsetFactor * travelFactor * electricFactor
  const msrp = msrpHint && msrpHint > 0 ? msrpHint : derived

  const age = spec.year ? CURRENT_YEAR - spec.year : 4
  const residual = residualValue(age)

  // CONDITION_VALUE_FACTOR is absolute; 'good' is what age alone already implies,
  // so express condition as a relative modifier around it.
  // The lower bound has to reach below 0.3 or 'damaged' gets clamped back up to
  // roughly the value of a working bike.
  const condFactor = clamp(
    (CONDITION_VALUE_FACTOR[spec.condition] ?? 0.78) / CONDITION_VALUE_FACTOR.good,
    0.25,
    1.3,
  )

  const value = msrp * residual * condFactor
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value / 10) * 10
}

function valuePart(price: number | null, estimated: number | null): ScorePart {
  const base = { key: 'value', label: 'Price vs value', weight: 0 }
  if (price === null || price <= 0) {
    return { ...base, score: 35, note: 'No asking price published — treat as unknown.' }
  }
  if (estimated === null) {
    return { ...base, score: 45, note: 'Not enough spec detail to estimate a market value.' }
  }
  const ratio = estimated / price
  const score = clamp(50 + (ratio - 1) * 62.5)
  const pct = Math.round((ratio - 1) * 100)
  const note =
    pct >= 0
      ? `Asking EUR ${price.toLocaleString('en-GB')} against ~EUR ${estimated.toLocaleString('en-GB')} — about ${pct}% under value.`
      : `Asking EUR ${price.toLocaleString('en-GB')} against ~EUR ${estimated.toLocaleString('en-GB')} — about ${Math.abs(pct)}% over value.`
  return { ...base, score, note }
}

function agePart(year: number | null): ScorePart {
  const base = { key: 'age', label: 'Model year', weight: 0 }
  if (!year) return { ...base, score: 45, note: 'No model year found in the listing.' }
  const age = CURRENT_YEAR - year
  const score = clamp(100 - age * 8)
  return { ...base, score, note: `${year} model, ${age <= 0 ? 'current season' : `${age} year${age === 1 ? '' : 's'} old`}.` }
}

function fitPart(spec: BikeSpec, criteria: Criteria): ScorePart {
  const checks: { pass: boolean; label: string }[] = []

  // Size and condition are hard filters upstream, so everything that reaches
  // here already matches them — only the soft preferences are scored.
  if (criteria.frameMaterials.length && spec.frameMaterial !== 'unknown') {
    checks.push({ pass: criteria.frameMaterials.includes(spec.frameMaterial), label: spec.frameMaterial })
  }
  if (criteria.frameTypes.length && spec.frameType !== 'unknown') {
    checks.push({ pass: criteria.frameTypes.includes(spec.frameType), label: spec.frameType })
  }
  if (criteria.disciplines.length && spec.discipline !== 'unknown') {
    checks.push({ pass: criteria.disciplines.includes(spec.discipline), label: spec.discipline })
  }
  if (criteria.wheelSizes.length && spec.wheelSize) {
    checks.push({ pass: criteria.wheelSizes.includes(spec.wheelSize), label: `${spec.wheelSize}"` })
  }
  if (criteria.brands.length && spec.brand) {
    checks.push({ pass: criteria.brands.some((b) => b.toLowerCase() === spec.brand!.toLowerCase()), label: spec.brand })
  }

  const base = { key: 'fit', label: 'Fit to your criteria', weight: 0 }
  if (!checks.length) return { ...base, score: 70, note: 'Nothing in your criteria applies to this listing.' }

  const passed = checks.filter((check) => check.pass)
  const score = (passed.length / checks.length) * 100
  const missed = checks.filter((check) => !check.pass).map((check) => check.label)
  return {
    ...base,
    score,
    note: missed.length ? `Matches ${passed.length}/${checks.length} — off on ${missed.join(', ')}.` : `Matches all ${checks.length} criteria you set.`,
  }
}

function completenessPart(spec: BikeSpec, images: number, description: string): ScorePart {
  const photoScore = clamp(images * 12, 0, 40)
  const textScore = clamp(description.length / 12, 0, 25)
  const fields = [spec.brand, spec.model, spec.year, spec.size, spec.groupset, spec.frameMaterial !== 'unknown' ? 'x' : null, spec.frameType !== 'unknown' ? 'x' : null]
  const known = fields.filter(Boolean).length
  const fieldScore = (known / fields.length) * 35

  return {
    key: 'completeness',
    label: 'Listing quality',
    weight: 0,
    score: clamp(photoScore + textScore + fieldScore),
    note: `${images} photo${images === 1 ? '' : 's'}, ${known}/${fields.length} specs identified.`,
  }
}

export interface ScoreResult {
  score: number
  parts: ScorePart[]
  estimatedValue: number | null
  savings: number | null
}

export function scoreBike(
  spec: BikeSpec,
  price: number | null,
  images: string[],
  description: string,
  criteria: Criteria,
  weights: Weights,
  msrpHint: number | null = null,
): ScoreResult {
  const estimatedValue = estimateValue(spec, msrpHint)
  const gs = groupsetScore(spec.groupset)

  const parts: ScorePart[] = [
    valuePart(price, estimatedValue),
    {
      key: 'frame',
      label: 'Frame material',
      weight: 0,
      score: FRAME_MATERIAL_SCORES[spec.frameMaterial],
      note: spec.frameMaterial === 'unknown' ? 'Frame material not stated.' : `${spec.frameMaterial} frame.`,
    },
    {
      key: 'brand',
      label: 'Brand tier',
      weight: 0,
      score: brandScore(spec.brand),
      note: spec.brand ? `${spec.brand} sits at tier ${brandScore(spec.brand)}/100.` : 'Brand not recognised.',
    },
    {
      key: 'groupset',
      label: 'Groupset',
      weight: 0,
      score: gs ?? 45,
      note: gs ? `${spec.groupset} — tier ${gs}/100.` : 'Groupset not stated.',
    },
    {
      key: 'condition',
      label: 'Condition',
      weight: 0,
      score: CONDITION_SCORES[spec.condition] ?? 55,
      note: spec.condition === 'unknown' ? 'Condition not stated.' : `Described as ${spec.condition}.`,
    },
    agePart(spec.year),
    fitPart(spec, criteria),
    completenessPart(spec, images.length, description),
  ]

  let total = 0
  let totalWeight = 0
  for (const part of parts) {
    const weight = weights[part.key as WeightKey] ?? 0
    part.weight = weight
    if (weight <= 0) continue
    total += part.score * weight
    totalWeight += weight
  }

  const score = totalWeight > 0 ? Math.round(total / totalWeight) : 0
  const savings = estimatedValue !== null && price !== null && price > 0 ? Math.round(estimatedValue - price) : null

  return { score, parts, estimatedValue, savings }
}

export type BandTone = 'red' | 'blue' | 'yellow' | 'ink'

/** Score band: a label, the fill colour, and the tone name surfaces use for contrast. */
export function scoreBand(score: number): { label: string; color: string; tone: BandTone } {
  if (score >= 80) return { label: 'Steal', color: '#D02020', tone: 'red' }
  if (score >= 65) return { label: 'Strong', color: '#1040C0', tone: 'blue' }
  if (score >= 50) return { label: 'Fair', color: '#F0C020', tone: 'yellow' }
  return { label: 'Weak', color: '#121212', tone: 'ink' }
}
