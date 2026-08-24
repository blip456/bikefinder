/**
 * Sample listings, written the way real marketplace ads are written (mixed
 * NL/EN, inconsistent spec wording, some missing fields). They run through the
 * exact same extractor, filter and scorer as scraped data — the only difference
 * is where the HTML came from — so they double as a smoke test for parsing.
 */

import type { RawListing } from '@/lib/types'

const poster = (index: number) => `/demo/poster-${String((index % 12) + 1).padStart(2, '0')}.svg`

export const DEMO_LISTINGS: RawListing[] = [
  {
    url: 'https://example.com/demo/santa-cruz-hightower-1',
    title: 'Santa Cruz Hightower C 2021 - maat L - GX Eagle',
    description:
      'Carbon full suspension trail bike, 29 inch wielen, 140mm travel voor. Zeer goede staat, altijd binnen gestald. GX Eagle 12 speed, Fox 36 vork, RockShox demper. Nieuwe ketting en remblokken. Frame maat L.',
    price: 2450,
    currency: 'EUR',
    location: 'Gent',
    images: [poster(0), poster(4)],
  },
  {
    url: 'https://example.com/demo/canyon-spectral-2',
    title: 'Canyon Spectral AL 6.0 (2020) maat M — hardtail? nee, fully',
    description:
      'Aluminium full suspension enduro, 27.5 inch, 150mm veerweg. Shimano SLX 12 speed. Gebruikssporen op frame maar mechanisch top. Goede staat.',
    price: 1350,
    currency: 'EUR',
    location: 'Antwerpen',
    images: [poster(1)],
  },
  {
    url: 'https://example.com/demo/specialized-stumpjumper-3',
    title: 'Specialized Stumpjumper EVO Comp Carbon 2022, size L, XT drivetrain',
    description:
      'Full suspension carbon frame, 29er, 150mm. Deore XT M8100 groupset, Fox Factory suspension. As new condition, ridden two seasons. Frame size L.',
    price: 3200,
    currency: 'EUR',
    location: 'Leuven',
    images: [poster(2), poster(7), poster(9)],
  },
  {
    url: 'https://example.com/demo/rockrider-race-900-4',
    title: 'Rockrider Race 900 hardtail carbon, maat M, 2019',
    description:
      'Decathlon carbon hardtail 29 inch. Shimano SLX / XT mix. Goede staat, weinig gebruikt. Maat M.',
    price: 720,
    currency: 'EUR',
    location: 'Brugge',
    images: [poster(3)],
  },
  {
    url: 'https://example.com/demo/trek-fuel-ex-5',
    title: 'Trek Fuel EX 8 2023 - Large - NX Eagle - full suspension',
    description:
      'Alpha Platinum aluminium frame, 29 inch, 140mm rear travel. SRAM NX Eagle. Zo goed als nieuw, 300 km gereden. Bon voor onderhoud inbegrepen.',
    price: 2350,
    currency: 'EUR',
    location: 'Hasselt',
    images: [poster(4), poster(1)],
  },
  {
    url: 'https://example.com/demo/cube-stereo-6',
    title: 'Cube Stereo 150 C:62 Race 2020 maat L carbon fully',
    description:
      'Carbon full suspension all mountain. 27.5 inch, 150mm. SRAM GX Eagle. Goede staat, nieuwe banden. Vraagprijs 1900 euro.',
    price: 1900,
    currency: 'EUR',
    location: 'Kortrijk',
    images: [poster(5), poster(11)],
  },
  {
    url: 'https://example.com/demo/yt-jeffsy-7',
    title: 'YT Jeffsy 29 Comp 2021 M — beschadigd frame, voor onderdelen',
    description:
      'Aluminium fully, 29 inch. Frame heeft een scheur bij de onderbuis, dus verkocht als defect / voor onderdelen. Groupset GX Eagle nog prima.',
    price: 550,
    currency: 'EUR',
    location: 'Mechelen',
    images: [poster(6)],
  },
  {
    url: 'https://example.com/demo/orbea-oiz-8',
    title: 'Orbea Oiz M30 2022 carbon XC fully, size M, Deore XT',
    description:
      'Cross country race bike, carbon frame, 29 inch, 120mm travel. Shimano Deore XT M8100 2x. Excellent condition, race prepped. Frame size M.',
    price: 2900,
    currency: 'EUR',
    location: 'Namur',
    images: [poster(7), poster(2)],
  },
  {
    url: 'https://example.com/demo/kona-process-9',
    title: 'Kona Process 134 AL/DL 2019 maat L',
    description:
      'Aluminium full suspension trail/enduro, 29 inch. SRAM GX Eagle 12v. Gebruikt maar goede staat, normale slijtage. Nieuwe RockShox Pike service gehad.',
    price: 1250,
    currency: 'EUR',
    location: 'Aalst',
    images: [poster(8)],
  },
  {
    url: 'https://example.com/demo/btwin-rockrider-10',
    title: 'B’Twin Rockrider 520 mountainbike 27.5 hardtail maat M',
    description: 'Instapmodel MTB, aluminium hardtail, Shimano Altus. Gebruikt, werkt prima voor bospaden.',
    price: 210,
    currency: 'EUR',
    location: 'Turnhout',
    images: [poster(9)],
  },
  {
    url: 'https://example.com/demo/nukeproof-mega-11',
    title: 'Nukeproof Mega 290 Pro 2021, L, alu enduro, XT',
    description:
      'Aluminium enduro fully, 29 inch, 160mm veerweg. Shimano Deore XT M8100, Hope naven. Zeer goede staat. Bikepark gereden maar goed onderhouden.',
    price: 1750,
    currency: 'EUR',
    location: 'Liege',
    images: [poster(10), poster(3)],
  },
  {
    url: 'https://example.com/demo/pivot-switchblade-12',
    title: 'Pivot Switchblade Pro XT/XTR 2023 - Medium - carbon - as new',
    description:
      'Carbon full suspension, 29 inch mullet option, 142mm rear. XT/XTR mix, Fox Factory 36. Like new, under 500km. Size M.',
    price: 4600,
    currency: 'EUR',
    location: 'Brussel',
    images: [poster(11), poster(6)],
  },
  {
    url: 'https://example.com/demo/giant-trance-13',
    title: 'Giant Trance X 29 2 (2021) maat L - fully - Deore',
    description:
      'ALUXX SL aluminium frame, 29 inch, 135mm achter / 150mm voor. Shimano Deore M6100 12 speed. Goede staat, weinig gebruikt.',
    price: 1490,
    currency: 'EUR',
    location: 'Sint-Niklaas',
    images: [poster(1), poster(8)],
  },
  {
    url: 'https://example.com/demo/scott-spark-14',
    title: 'Scott Spark RC 900 Team 2020 carbon XC, size M, XX1 Eagle AXS',
    description:
      'Top-spec carbon cross country bike, 29 inch, 120mm. SRAM XX1 Eagle AXS draadloos. Nieuwstaat, altijd binnen bewaard, race gebruik.',
    price: 3400,
    currency: 'EUR',
    location: 'Genk',
    images: [poster(2), poster(10), poster(5)],
  },
  {
    url: 'https://example.com/demo/commencal-meta-15',
    title: 'Commencal Meta AM 29 Ride 2022 - L - aluminium - 160mm',
    description:
      'Aluminium enduro fully. SRAM NX Eagle. Goede staat, wat lakschade op de onderbuis. 29 inch wielen.',
    price: 1600,
    currency: 'EUR',
    location: 'Oostende',
    images: [poster(3), poster(9)],
  },
  {
    url: 'https://example.com/demo/ghost-lector-16',
    title: 'Ghost Lector SF LC 2021 carbon hardtail 29 maat M SLX',
    description: 'Carbon XC hardtail, Shimano SLX M7100, RockShox SID. Zeer goede staat.',
    price: 1150,
    currency: 'EUR',
    location: 'Roeselare',
    images: [poster(4)],
  },
]
