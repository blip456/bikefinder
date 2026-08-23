import { cn } from '@/lib/cn'

export type Shape = 'circle' | 'square' | 'triangle'

const SHAPE_CLASS: Record<Shape, string> = {
  circle: 'rounded-full',
  square: 'rounded-none',
  triangle: 'clip-triangle',
}

/** The three Bauhaus primitives, used for logo marks and card corner decoration. */
export function ShapeMark({
  shape,
  color,
  size = 12,
  rotated = false,
  className,
}: {
  shape: Shape
  color: string
  size?: number
  rotated?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0', SHAPE_CLASS[shape], rotated && 'rotate-45', className)}
      style={{ width: size, height: size, backgroundColor: color }}
    />
  )
}

/** Brand identity: circle + square + triangle in the three primaries. */
export function GeometricLogo({ size = 14 }: { size?: number }) {
  return (
    <span className="group flex items-center gap-1" aria-hidden>
      <ShapeMark shape="circle" color="var(--color-bh-red)" size={size} className="transition-transform duration-200 group-hover:scale-110" />
      <ShapeMark shape="square" color="var(--color-bh-blue)" size={size} className="transition-transform duration-200 group-hover:scale-110" />
      <ShapeMark shape="triangle" color="var(--color-bh-yellow)" size={size} className="transition-transform duration-200 group-hover:scale-110" />
    </span>
  )
}
