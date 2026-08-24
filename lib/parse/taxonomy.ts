/**
 * Reference data for parsing and scoring.
 *
 * Tiers are expressed as 0-100 "quality" numbers so the scorer can average them
 * with everything else without extra mapping tables.
 */

import type { FrameMaterial } from '@/lib/types'

/** Brand -> tier score. Higher = the frame/parts spec you get per euro is better. */
export const BRAND_TIERS: Record<string, number> = {
  // Boutique / halo
  'santa cruz': 100, yeti: 100, pivot: 98, ibis: 96, evil: 95, unno: 100,
  nicolai: 96, intense: 92, forbidden: 94, knolly: 90, 'guerrilla gravity': 92,
  revel: 92, 'we are one': 94, atherton: 94, pole: 90, zerode: 92, antidote: 94,
  actofive: 94, raaw: 92, starling: 88, liteville: 92, alutech: 86, banshee: 88,
  'last bikes': 92, hope: 94, 'privateer': 86, 'production privee': 88,
  // Premium mainstream
  specialized: 92, trek: 90, scott: 88, canyon: 90, cannondale: 88, giant: 86,
  orbea: 88, mondraker: 88, commencal: 88, transition: 92, norco: 86,
  'rocky mountain': 88, nukeproof: 86, 'yt industries': 88, yt: 88, propain: 88,
  bmc: 88, lapierre: 84, devinci: 86, whyte: 84, cube: 82, merida: 82,
  bergamont: 80, focus: 80, ghost: 78, radon: 82, rose: 80, simplon: 86,
  rotwild: 86, stevens: 78, ktm: 78, haibike: 78, bulls: 76, conway: 76,
  bianchi: 82, 'cervelo': 88, marin: 78, kona: 82, gt: 78, 'salsa': 84,
  surly: 80, niner: 84, 'diamondback': 72, fuji: 72, 'polygon': 76,
  vitus: 78, ragley: 80, stanton: 86, cotic: 86, bird: 82, sonder: 80,
  orange: 82, saracen: 76, 'on one': 74, calibre: 72, voodoo: 70,
  'megamo': 74, bh: 78, 'wilier': 84, 'pinarello': 86, 'ridley': 82,
  'eddy merckx': 80, 'ns bikes': 80, dartmoor: 76, 'octane one': 74,
  'mde': 84, 'chromag': 90, 'santacruz': 100,
  // Value / entry
  rockrider: 62, btwin: 55, "b'twin": 55, decathlon: 58, carrera: 52,
  apollo: 42, muddyfox: 34, mongoose: 44, schwinn: 44, huffy: 26,
  hyper: 26, trinx: 40, bikestar: 32, nakamura: 48, vermont: 42,
  crossfire: 34, oxford: 34, altec: 32, umit: 28, peugeot: 46,
  gazelle: 52, batavus: 48, sparta: 48, 'genesis': 66, vertical: 34,
  'x-fact': 34, 'roadmaster': 24, 'kalkhoff': 62, 'winora': 56,
  'scapin': 66, 'atala': 56, 'sensa': 60, 'koga': 74, 'ridgeback': 58,
}

/** Fallback when the brand is unknown — deliberately mid so it neither helps nor hurts much. */
export const UNKNOWN_BRAND_SCORE = 48

/** Known model names, used to pull a clean model out of a messy title. */
export const MODELS: string[] = [
  // Specialized
  'stumpjumper evo', 'stumpjumper', 'epic evo', 'epic', 'enduro', 'levo sl', 'levo',
  'kenevo', 'chisel', 'rockhopper', 'fuse', 'status', 'demo', 'diverge', 'roubaix', 'tarmac',
  // Trek
  'fuel exe', 'fuel ex', 'top fuel', 'slash', 'remedy', 'session', 'supercaliber',
  'procaliber', 'marlin', 'roscoe', 'x-caliber', 'stache', 'rail', 'powerfly', 'madone', 'domane',
  // Santa Cruz
  'hightower', 'megatower', 'nomad', 'bronson', 'tallboy', 'blur', 'chameleon', '5010',
  'heckler', 'bullit', 'hightower lt',
  // Yeti / Pivot / Ibis / Evil
  'sb130', 'sb140', 'sb150', 'sb160', 'sb165', 'sb120', 'sb100', 'arc',
  'mach 4 sl', 'mach 5.5', 'mach 6', 'switchblade', 'firebird', 'trail 429', 'shuttle',
  'ripley', 'ripmo af', 'ripmo', 'mojo', 'exie', 'oso',
  'offering', 'following', 'insurgent', 'wreckoning', 'calling', 'chamois hagar',
  // Canyon
  'spectral', 'neuron', 'strive', 'torque', 'lux trail', 'lux', 'exceed', 'grand canyon',
  'stoic', 'sender', 'grail', 'endurace', 'aeroad', 'ultimate',
  // Giant / Liv
  'trance x', 'trance', 'anthem', 'reign', 'fathom', 'talon', 'glory', 'stance', 'revolt', 'defy', 'tcr',
  // Scott
  'genius', 'ransom', 'spark rc', 'spark', 'scale', 'aspect', 'contessa', 'addict', 'foil',
  // Cube
  'stereo hybrid', 'stereo', 'reaction', 'ams 100', 'ams', 'attention', 'analog',
  'acid', 'aim', 'elite c:68', 'elite',
  // Orbea / Mondraker / Commencal / Transition / Norco / Rocky
  'occam', 'oiz', 'rallon', 'wild fs', 'wild', 'alma', 'laufey', 'rise', 'orca', 'terra',
  'foxy', 'superfoxy', 'raze', 'crafty', 'summum', 'podium', 'chrono', 'dune',
  'meta am', 'meta tr', 'meta sx', 'meta ht', 'meta', 'clash', 'supreme', 'furious', 'tempo',
  'sentinel', 'patrol', 'scout', 'spur', 'smuggler', 'repeater', 'tr11', 'ripcord',
  'sight', 'range', 'optic', 'fluid', 'shore', 'aurum', 'torrent',
  'altitude', 'instinct', 'slayer', 'element', 'growler', 'blizzard', 'reaper',
  // YT / Propain / Nukeproof / Vitus / Radon / Rose / Focus / Ghost
  'jeffsy', 'capra', 'izzo', 'decoy', 'tues', 'dirt love', 'szepter',
  'hugene', 'tyee', 'spindrift', 'rage', 'yuma', 'ekano',
  'mega', 'giga', 'reactor', 'scout 290', 'dissent', 'digger',
  'escarpe', 'sommet', 'mythique', 'sentier', 'nucleus', 'rapide', 'substance',
  'slide trail', 'slide', 'jealous', 'skeen', 'swoop', 'cragger', 'zr team',
  'root miller', 'ground control', 'thrill hill', 'bonero', 'the bruce', 'pdq',
  'jam', 'thron', 'sam', 'raven', 'whistler', 'izalco', 'paralane',
  'riot', 'kato', 'lector', 'nirvana', 'asket', 'square',
  // Kona / Marin / GT / Whyte / Saracen / Ragley / Cotic / Bird / Stanton
  'process 134', 'process 153', 'process x', 'process', 'honzo', 'hei hei', 'unit', 'explosif',
  'rift zone', 'hawk hill', 'alpine trail', 'san quentin', 'bobcat trail', 'wildcat trail',
  'force carbon', 'sensor', 'zaskar', 'avalanche', 'aggressor', 'fury', 'grade',
  'g-series', 't-130', 't-140', 's-150', 'e-160', '901', '629', '905',
  'ariel', 'kili flyer', 'zenith', 'myst', 'mantra', 'blue pig', 'marley', 'big al',
  'rocket max', 'rocket', 'flare max', 'flare', 'jeht', 'bfe', 'soul', 'soda',
  'aeris', 'zero am', 'switch9er', 'sherpa', 'slackline', 'switchback',
  // Others
  'jekyll', 'habit', 'scalpel', 'trigger', 'trail se', 'topstone', 'synapse', 'supersix',
  'big trail', 'catalyst', 'moterra',
  'one-forty', 'one-sixty', 'one-twenty', 'big trail', 'ninety-six', 'big nine', 'big seven',
  'fourstroke', 'trailfox', 'speedfox', 'agonist', 'teamelite', 'twostroke', 'roadmachine',
  'zesty', 'spicy', 'overvolt', 'prorace', 'edge', 'xelius',
  'troy', 'spartan', 'django', 'marshall', 'chainsaw', 'kicker',
  'rockrider 540', 'rockrider 900', 'rockrider 920', 'ame 100', 'race 900',
]

/**
 * Drivetrain groupsets -> tier score. Ordered longest-name-first at match time so
 * "GX Eagle AXS" wins over a bare "GX".
 */
export const GROUPSETS: Record<string, number> = {
  // SRAM MTB
  'xx sl transmission': 100, 'xx sl': 100, 'xx transmission': 99, 'xx eagle axs': 98,
  'xx1 eagle axs': 97, 'xx1 eagle': 94, 'xx1': 94,
  'x0 transmission': 95, 'x0 eagle axs': 93, 'x01 eagle axs': 93, 'x01 eagle': 90, 'x01': 90,
  'gx eagle transmission': 88, 'gx eagle axs': 86, 'gx eagle': 79, 'gx': 78,
  'nx eagle': 60, nx: 59, 'sx eagle': 44, sx: 43,
  'x9': 66, 'x7': 56, 'x5': 46, 'x4': 38,
  // SRAM road / gravel
  'red axs': 98, red: 95, 'force axs': 90, force: 86, 'rival axs': 80, rival: 76,
  'apex axs': 66, apex: 62,
  // Shimano MTB
  'xtr di2': 100, 'xtr m9100': 99, 'xtr m9000': 90, xtr: 96,
  'deore xt m8100': 88, 'xt m8100': 88, 'deore xt': 84, xt: 84,
  'slx m7100': 76, slx: 74, 'deore m6100': 63, 'deore m5100': 58, deore: 60,
  cues: 55, alivio: 45, acera: 37, altus: 31, tourney: 20,
  'zee': 68, saint: 88,
  // Shimano road
  'dura-ace di2': 100, 'dura ace': 96, 'dura-ace': 96, 'ultegra di2': 92, ultegra: 88,
  '105 di2': 76, '105': 72, tiagra: 58, sora: 44, claris: 34,
  // Others
  'grx di2': 84, grx: 78, 'campagnolo super record': 98, 'campagnolo record': 92,
  'campagnolo chorus': 84, ekar: 84, 'microshift advent x': 50, microshift: 42,
  'box three': 52, 'box': 50, 'lg1': 70,
}

export const FRAME_MATERIAL_SCORES: Record<FrameMaterial, number> = {
  carbon: 100,
  titanium: 94,
  aluminium: 70,
  steel: 62,
  unknown: 50,
}

/**
 * Rough new-price anchors (EUR) per suspension layout. Used to build an estimated
 * market value so the "value" score has something to push against.
 */
export const BASE_MSRP: Record<string, number> = {
  'full-suspension': 2600,
  hardtail: 1200,
  rigid: 850,
  unknown: 1800,
}

/** Multipliers applied to BASE_MSRP when building an estimated value. */
export const MATERIAL_MSRP_FACTOR: Record<FrameMaterial, number> = {
  carbon: 1.55,
  titanium: 1.7,
  aluminium: 1.0,
  steel: 0.95,
  unknown: 1.0,
}

export const CONDITION_SCORES: Record<string, number> = {
  new: 100,
  'as-new': 92,
  good: 78,
  used: 60,
  damaged: 15,
  unknown: 55,
}

/** How much of the original value a bike still holds, by condition. */
export const CONDITION_VALUE_FACTOR: Record<string, number> = {
  new: 1.0,
  'as-new': 0.92,
  good: 0.82,
  used: 0.7,
  // A cracked/broken frame is worth its parts, not a discounted bike.
  damaged: 0.22,
  unknown: 0.78,
}

export const DISCIPLINE_MSRP_FACTOR: Record<string, number> = {
  downhill: 1.15,
  enduro: 1.1,
  trail: 1.0,
  xc: 1.0,
  dirt: 0.6,
  gravel: 0.9,
  road: 0.9,
  city: 0.5,
  unknown: 1.0,
}

export const SIZE_ORDER: string[] = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']
