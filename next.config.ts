import type { NextConfig } from 'next'

// Listing photos come from arbitrary marketplace CDNs and are served through
// /api/img (see app/api/img/route.ts), so next/image's remote config is not used.
const config: NextConfig = {}

export default config
