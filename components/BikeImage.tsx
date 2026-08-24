'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { proxied } from '@/lib/img'

/**
 * Listing photo with the house treatment: grayscale at rest, full colour on
 * hover. Falls back to a geometric composition when a source blocks its images.
 */
export function BikeImage({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string | undefined
  alt: string
  className?: string
  eager?: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className={cn('relative flex items-center justify-center overflow-hidden bg-muted', className)} aria-hidden>
        <span className="absolute -left-4 top-2 h-16 w-16 rounded-full bg-bh-red/70" />
        <span className="absolute right-3 bottom-2 h-14 w-14 rotate-45 bg-bh-blue/70" />
        <span className="clip-triangle h-10 w-10 bg-bh-yellow" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- photos come from arbitrary marketplace CDNs via our relay
    <img
      src={proxied(src)}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn(
        // Grayscale-until-hover is the house treatment, but a touch device never
        // hovers — there it would just hide the bike, so it only applies where
        // hover actually exists.
        'h-full w-full object-cover transition-[filter,transform] duration-300 ease-out',
        '[@media(hover:hover)]:grayscale [@media(hover:hover)]:group-hover:grayscale-0',
        className,
      )}
    />
  )
}
