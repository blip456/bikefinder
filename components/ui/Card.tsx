import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ShapeMark, type Shape } from './ShapeMark'

const CORNER_ROTATION: { shape: Shape; color: string }[] = [
  { shape: 'circle', color: 'var(--color-bh-red)' },
  { shape: 'square', color: 'var(--color-bh-blue)' },
  { shape: 'triangle', color: 'var(--color-bh-yellow)' },
]

/**
 * The workhorse surface: white, thick black border, hard shadow, and a small
 * geometric mark in the top-right that rotates through the primaries by index.
 */
export function Card({
  children,
  className,
  index = 0,
  decorated = true,
}: {
  children: ReactNode
  className?: string
  index?: number
  decorated?: boolean
}) {
  const corner = CORNER_ROTATION[index % CORNER_ROTATION.length]
  return (
    <div
      className={cn(
        'relative bg-paper border-2 sm:border-4 border-ink shadow-hard sm:shadow-hard-lg',
        className,
      )}
    >
      {decorated && (
        <ShapeMark shape={corner.shape} color={corner.color} size={12} className="absolute top-2 right-2 z-10" />
      )}
      {children}
    </div>
  )
}
