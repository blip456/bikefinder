/**
 * Turns a listing title + description (NL / EN / FR / DE wording) into a BikeSpec.
 *
 * Everything here is deliberately conservative: when a field is ambiguous we
 * return null/'unknown' rather than guessing, because the scorer treats missing
 * data as a risk signal instead of silently inventing a good deal.
 */

import type {
  BikeSpec,
  Condition,
  Discipline,
  FrameMaterial,
  FrameType,
  SizeLabel,
} from '@/lib/types'
import { BRAND_TIERS, MODELS, GROUPSETS } from './taxonomy'

const CURRENT_YEAR = new Date().getFullYear()

/** Lowercase, strip accents, collapse whitespace and normalise separators. */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[|/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Match a dictionary key as a whole phrase, longest key first. */
function matchLongest(haystack: string, keys: string[]): string | null {
  const sorted = [...keys].sort((a, b) => b.length - a.length)
  for (const key of sorted) {
    const re = new RegExp(`(?<![a-z0-9])${escapeRegExp(key)}(?![a-z0-9])`, 'i')
    if (re.test(haystack)) return key
  }
  return null
}

/**
 * Match the dictionary key that appears *earliest* at or after `fromIndex`,
 * breaking ties on length. Model names live right after the brand, so nearest
 * beats longest here: "Nukeproof Mega ... alu enduro" is a Mega, not an Enduro.
 */
function matchNearest(haystack: string, keys: string[], fromIndex = 0): string | null {
  let best: { key: string; index: number } | null = null
  for (const key of keys) {
    const re = new RegExp(`(?<![a-z0-9])${escapeRegExp(key)}(?![a-z0-9])`, 'i')
    const index = haystack.slice(fromIndex).search(re)
    if (index === -1) continue
    const absolute = index + fromIndex
    if (!best || absolute < best.index || (absolute === best.index && key.length > best.key.length)) {
      best = { key, index: absolute }
    }
  }
  return best?.key ?? null
}

const BRAND_ALIASES: Record<string, string> = {
  santacruz: 'santa cruz',
  'yt industries': 'yt',
  "b'twin": 'btwin',
  'b twin': 'btwin',
  'rocky mtn': 'rocky mountain',
  speci: 'specialized',
  'spesh': 'specialized',
  cannondal: 'cannondale',
  'last bikes': 'last bikes',
  'production privee': 'production privee',
}

export function extractBrand(text: string): string | null {
  const keys = [...Object.keys(BRAND_TIERS), ...Object.keys(BRAND_ALIASES)]
  const hit = matchLongest(text, keys)
  if (!hit) return null
  const canonical = BRAND_ALIASES[hit] ?? hit
  return titleCase(canonical)
}

export function extractModel(text: string, brand: string | null): string | null {
  const needle = brand ? normalise(brand) : ''
  const brandAt = needle ? text.indexOf(needle) : -1
  const searchFrom = brandAt >= 0 ? brandAt + needle.length : 0

  const known = matchNearest(text, MODELS, searchFrom) ?? (brandAt >= 0 ? null : matchLongest(text, MODELS))
  if (known) return titleCase(known)
  if (!brand) return null

  // Fall back to "the words right after the brand", stopping at anything that is
  // clearly a spec token rather than part of the model name.
  const re = new RegExp(`${escapeRegExp(normalise(brand))}\\s+([a-z0-9][a-z0-9'.+-]*(?:\\s+[a-z0-9][a-z0-9'.+-]*){0,2})`, 'i')
  const match = text.match(re)
  if (!match) return null

  const stop = /^(mtb|mountainbike|mountain|bike|fiets|velo|fahrrad|maat|size|taille|jaar|year|carbon|alu|aluminium|aluminum|full|fully|hardtail|te|koop|zo|goed|als|nieuw|new|used|gebruikt|met|with|in|van|the|and|en|met|inch|cm|euro|eur|prijs|price)$/i
  const words = match[1].split(' ').filter((word) => {
    if (stop.test(word)) return false
    if (/^\d{4}$/.test(word)) return false // year
    if (/^\d{2}([.,]\d)?$/.test(word)) return false // wheel/frame size
    return word.length > 1
  })
  if (!words.length) return null
  return titleCase(words.slice(0, 2).join(' '))
}

export function extractYear(text: string): number | null {
  const candidates: number[] = []
  // Guard against digits glued on either side ("12021", "20215", "1.2022") without
  // rejecting ordinary punctuation after the year ("2022, size L").
  const re = /(?<!\d)(?<!\d[.,])(19[89]\d|20[0-4]\d)(?!\d)(?![.,]\d)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const year = Number(match[1])
    if (year < 1990 || year > CURRENT_YEAR + 1) continue

    const before = text.slice(Math.max(0, match.index - 14), match.index)
    const after = text.slice(match.index + 4, match.index + 12)
    // Skip prices ("2000 euro", "€ 2000") and part numbers ("M8100", "XT 2000mm").
    if (/(?:€|eur|euro|\$|£|prijs|price|prix|preis|vraagprijs|bod)\s*$/i.test(before)) continue
    if (/^\s*(?:€|eur|euro|,-|\$|km|mm|gram|g\b|w\b|wh)/i.test(after)) continue
    // Part numbers glue digits to letters ("M8100", "M9100"); a real year does not.
    if (/[a-z]$/i.test(before)) continue
    candidates.push(year)
  }
  if (!candidates.length) return null

  // "model year" style mentions win; otherwise take the most recent plausible one.
  const labelled = text.match(/(?:bouwjaar|modeljaar|model\s*year|year|jaar|bj\.?|annee|baujahr)\D{0,6}(19[89]\d|20[0-4]\d)/i)
  if (labelled) return Number(labelled[1])
  return Math.max(...candidates)
}

const SIZE_WORDS: Record<string, SizeLabel> = {
  xxs: 'XXS', xs: 'XS', s: 'S', small: 'S', klein: 'S',
  m: 'M', medium: 'M', l: 'L', large: 'L', groot: 'L',
  xl: 'XL', 'x-large': 'XL', xxl: 'XXL', 'xx-large': 'XXL',
}

const SIZE_CONTEXT = '(?:frame\\s*size|framesize|frame\\s*maat|framemaat|rahmen(?:groesse|hoehe)?|maat|size|taille|grosse|groesse|kader)'

export function extractSize(text: string): { size: SizeLabel | null; sizeCm: number | null } {
  let size: SizeLabel | null = null
  let sizeCm: number | null = null

  const labelled = text.match(new RegExp(`${SIZE_CONTEXT}\\s*[:=-]?\\s*(xxs|xs|xxl|xl|s|m|l|small|medium|large|klein|groot)(?![a-z])`, 'i'))
  if (labelled) size = SIZE_WORDS[labelled[1].toLowerCase()] ?? null

  if (!size) {
    // Standalone bracketed / slashed sizes: "(L)", "- XL -", "maat L".
    const loose = text.match(/(?:^|[\s([{])(xxs|xs|xxl|xl)(?![a-z])/i)
    if (loose) size = SIZE_WORDS[loose[1].toLowerCase()] ?? null
  }
  if (!size) {
    const bracketed = text.match(/[([]\s*(s|m|l)\s*[)\]]/i)
    if (bracketed) size = SIZE_WORDS[bracketed[1].toLowerCase()] ?? null
  }
  if (!size) {
    // Spelled-out sizes are unambiguous on their own.
    const word = text.match(/(?:^|[\s([{,\-])(small|medium|large)(?![a-z])/i)
    if (word) size = SIZE_WORDS[word[1].toLowerCase()] ?? null
  }
  if (!size) {
    // A lone S/M/L closed off by punctuation or the end of the string:
    // "2021, L, alu", "- L -", "29 Comp 2021 M — beschadigd".
    const fenced = text.match(/(?:^|[\s,\u2013\u2014\-])(s|m|l)\s*(?=[,\u2013\u2014\-]|$)/i)
    if (fenced) size = SIZE_WORDS[fenced[1].toLowerCase()] ?? null
  }

  const cm = text.match(new RegExp(`(?:${SIZE_CONTEXT}\\s*[:=-]?\\s*)?(3[5-9]|4\\d|5\\d|6[0-4])\\s*cm(?![a-z])`, 'i'))
  if (cm) sizeCm = Number(cm[1])

  if (!size && sizeCm) size = cmToSize(sizeCm)
  return { size, sizeCm }
}

/** MTB frame reach conventions, roughly: 38-42 S, 43-46 M, 47-50 L, 51+ XL. */
export function cmToSize(cm: number): SizeLabel | null {
  if (cm < 36) return null
  if (cm <= 38) return 'XS'
  if (cm <= 42) return 'S'
  if (cm <= 46) return 'M'
  if (cm <= 50) return 'L'
  if (cm <= 55) return 'XL'
  return 'XXL'
}

export function extractGroupset(text: string): string | null {
  const hit = matchLongest(text, Object.keys(GROUPSETS))
  if (!hit) return null
  return titleCase(hit)
}

export function extractFrameMaterial(text: string): FrameMaterial {
  if (/(?<![a-z])(carbon|carbone|karbon|kohlefaser|koolstof|hmf|c:6[248]|toray)(?![a-z])/i.test(text)) return 'carbon'
  if (/(?<![a-z])(titanium|titan|ti\s*frame)(?![a-z])/i.test(text)) return 'titanium'
  if (/(?<![a-z])(alu|aluminium|aluminum|alloy|alloy\s*frame|legering|6061|7005)(?![a-z])/i.test(text)) return 'aluminium'
  if (/(?<![a-z])(staal|steel|stahl|acier|cromo|chromoly|chromolybdeen|4130|reynolds|columbus)(?![a-z])/i.test(text)) return 'steel'
  return 'unknown'
}

export function extractFrameType(text: string): FrameType {
  if (/(?<![a-z])(full\s*suspension|fullsuspension|fully|full\s*susp|dual\s*suspension|double\s*suspension|volgeveerd|vollgefedert|tout\s*suspendu|demper|rear\s*shock|achterdemper)(?![a-z])/i.test(text)) {
    return 'full-suspension'
  }
  if (/(?<![a-z])(hardtail|hard\s*tail|semi\s*fully|semi-fully|front\s*suspension|voorvering)(?![a-z])/i.test(text)) return 'hardtail'
  if (/(?<![a-z])(rigid|starre|volledig\s*star|ongeveerd)(?![a-z])/i.test(text)) return 'rigid'
  return 'unknown'
}

export function extractDiscipline(text: string): Discipline {
  if (/(?<![a-z])(downhill|dh\s*bike|freeride)(?![a-z])/i.test(text)) return 'downhill'
  if (/(?<![a-z])(enduro|all\s*mountain|allmountain|am\s*bike)(?![a-z])/i.test(text)) return 'enduro'
  if (/(?<![a-z])(trail\s*bike|trailbike|down\s*country|downcountry)(?![a-z])/i.test(text)) return 'trail'
  if (/(?<![a-z])(cross\s*country|crosscountry|xc\s*(?:bike|race)?|marathon)(?![a-z])/i.test(text)) return 'xc'
  if (/(?<![a-z])(dirt\s*jump|dirtjump|dj\s*bike|slopestyle|street)(?![a-z])/i.test(text)) return 'dirt'
  if (/(?<![a-z])(gravel|cyclocross|cyclo\s*cross|cx\s*bike)(?![a-z])/i.test(text)) return 'gravel'
  if (/(?<![a-z])(racefiets|road\s*bike|wielrenfiets|rennrad|velo\s*de\s*route)(?![a-z])/i.test(text)) return 'road'
  if (/(?<![a-z])(stadsfiets|city\s*bike|hollandse\s*fiets|trekking|hybride|hybrid)(?![a-z])/i.test(text)) return 'city'
  // Weak signals, only consulted once every explicit label has missed.
  if (/(?<![a-z])(bikepark|bike\s*park)(?![a-z])/i.test(text)) return 'enduro'
  if (/(?<![a-z])(mtb|mountainbike|mountain\s*bike|vtt)(?![a-z])/i.test(text)) return 'trail'
  return 'unknown'
}

export function extractCondition(text: string): Condition {
  // Attribute-style fields ("condition: very good") are explicit and win outright.
  const labelled = text.match(/(?:condition|conditie|staat|zustand|etat)\s*[:=]\s*([a-z -]{2,20})/i)
  if (labelled) {
    const value = labelled[1].trim()
    if (/^(new|nieuw|neuf|brand new)/i.test(value)) return 'new'
    if (/^(as[ -]new|like[ -]new|mint|nieuwstaat)/i.test(value)) return 'as-new'
    if (/^(very good|excellent|good|zeer goed|goed|uitstekend)/i.test(value)) return 'good'
    if (/^(fair|used|gebruikt|acceptable|redelijk)/i.test(value)) return 'used'
    if (/^(poor|damaged|defect|broken|slecht)/i.test(value)) return 'damaged'
  }

  if (/(?<![a-z])(defect|kapot|beschadigd|damaged|broken|schade|for\s*parts|voor\s*onderdelen|niet\s*rijklaar|needs?\s*(?:repair|work)|scheur|crack|gebarsten|krom)(?![a-z])/i.test(text)) {
    return 'damaged'
  }
  if (/(?<![a-z])(nieuw\s*in\s*doos|brand\s*new|nieuwstaat\s*ongebruikt|ongebruikt|never\s*used|nooit\s*gebruikt|nagelneu|neuf)(?![a-z])/i.test(text)) {
    return 'new'
  }
  if (/(?<![a-z])(zo\s*goed\s*als\s*nieuw|as\s*new|like\s*new|near\s*mint|mint\s*condition|nieuwstaat|comme\s*neuf|neuwertig)(?![a-z])/i.test(text)) {
    return 'as-new'
  }
  if (/(?<![a-z])(nieuw|new)(?![a-z])/i.test(text) && !/(?:nieuwe\s+(?:banden|ketting|remmen|onderdelen|kabels|vork)|new\s+(?:tyres|tires|chain|brakes|parts|cables|fork))/i.test(text)) {
    return 'new'
  }
  if (/(?<![a-z])(uitstekende\s*staat|zeer\s*goede\s*staat|goede\s*staat|excellent\s*condition|very\s*good\s*condition|good\s*condition|bon\s*etat|guter\s*zustand|top\s*staat|perfecte\s*staat)(?![a-z])/i.test(text)) {
    return 'good'
  }
  if (/(?<![a-z])(gebruikssporen|gebruikt|used|occasion|tweedehands|second\s*hand|gebraucht|normale\s*slijtage|wear\s*and\s*tear)(?![a-z])/i.test(text)) {
    return 'used'
  }
  return 'unknown'
}

export function extractWheelSize(text: string): number | null {
  // Mullet setups are marketed by their front wheel, so they resolve to 29.
  if (/(?<![a-z0-9])(mullet|mx\s*wheels?)(?![a-z0-9])/i.test(text)) return 29
  // Trailing lookaheads reject a following digit only — "29 inch," and "29er,"
  // are perfectly ordinary, and a lookahead on punctuation would drop them.
  if (/(?<!\d)27[.,]5(?!\d)|(?<![a-z0-9])650b(?![a-z0-9])/i.test(text)) return 27.5
  if (/(?<!\d)29(?:er|\s*(?:inch|"|''))(?!\d)/i.test(text)) return 29
  if (/(?<!\d)26(?:er|\s*(?:inch|"|''))(?!\d)/i.test(text)) return 26
  if (/(?<!\d)28(?:er|\s*(?:inch|"|''))(?!\d)/i.test(text)) return 28
  // Last resort: a bare, space-delimited wheel token ("carbon hardtail 29 maat M").
  // Only 29 and 27.5 — a bare "26" collides with too much ordinary text.
  const bare = text.match(/(?:^|\s)(29|27[.,]5)(?=\s|$)/)
  if (bare) return bare[1].startsWith('29') ? 29 : 27.5
  return null
}

export function extractTravel(text: string): number | null {
  const match = text.match(/(?<![\d.,])(1[0-9]{2}|200|2[0-2]0)\s*mm(?:\s*(?:travel|veerweg|federweg))?/i)
  if (!match) return null
  const mm = Number(match[1])
  return mm >= 80 && mm <= 220 ? mm : null
}

export function isElectric(text: string): boolean {
  // Adjectival forms carry endings ("elektrische fiets", "vélo électrique",
  // normalised to "electrique"), so these match on prefix rather than as whole
  // words. A collection of e-MTBs was previously read as ordinary bikes.
  if (/(?<![a-z])(elektrisch|electrisch|electriq|elektrische|e-?bikes?|e-?mtbs?|pedelec|speed\s*pedelec)/i.test(text)) {
    return true
  }
  return /(?<![a-z])(electric|bosch\s*(?:performance|cx|active)|shimano\s*steps|brose|yamaha\s*pw|mid\s*drive|specialized\s*levo|kenevo|decoy|moterra|rise\s*h|powerfly|sduro|jarifa|cairon|macina|overvolt|e-?ride|turbo\s*tero|vae)(?![a-z])/i.test(text)
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .map((word) => {
      if (/^\d/.test(word)) return word.toUpperCase()
      if (word.length <= 3) return word.toUpperCase()
      return word[0].toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Attribute maps from the source site are more trustworthy than free text, so
 * they are folded into the same normalised blob but also checked directly.
 */
export function extractSpec(
  title: string,
  description = '',
  attributes: Record<string, string> = {},
): BikeSpec {
  const attrText = Object.entries(attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join('. ')
  const text = normalise([title, attrText, description].filter(Boolean).join('. '))
  const titleText = normalise(title)

  const brand = extractBrand(titleText) ?? extractBrand(text)
  const { size, sizeCm } = extractSize(text)

  return {
    brand,
    model: extractModel(titleText, brand) ?? extractModel(text, brand),
    year: extractYear(titleText) ?? extractYear(text),
    condition: extractCondition(text),
    size,
    sizeCm,
    groupset: extractGroupset(text),
    frameMaterial: extractFrameMaterial(text),
    frameType: extractFrameType(text),
    discipline: extractDiscipline(text),
    wheelSize: extractWheelSize(text),
    travelMm: extractTravel(text),
    electric: isElectric(text),
  }
}
