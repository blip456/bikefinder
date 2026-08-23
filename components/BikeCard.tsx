'use client'

import { MapPin } from 'lucide-react'
import type { ScoredBike } from '@/lib/types'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/img'
import { Chip } from '@/components/ui/Chip'
import { ScoreBlock } from '@/components/ui/ScoreBlock'
import { BikeImage } from './BikeImage'

export type ViewMode = 'gallery' | 'list'

function specChips(bike: ScoredBike) {
  const { spec } = bike
  const chips: { label: string; tone: 'plain' | 'red' | 'blue' | 'yellow' | 'ink' }[] = []
  if (spec.year) chips.push({ label: String(spec.year), tone: 'ink' })
  if (spec.size) chips.push({ label: spec.size, tone: 'blue' })
  if (spec.frameMaterial !== 'unknown') chips.push({ label: spec.frameMaterial, tone: spec.frameMaterial === 'carbon' ? 'red' : 'plain' })
  if (spec.frameType !== 'unknown') chips.push({ label: spec.frameType === 'full-suspension' ? 'fully' : spec.frameType, tone: 'plain' })
  if (spec.groupset) chips.push({ label: spec.groupset, tone: 'yellow' })
  if (spec.wheelSize) chips.push({ label: `${spec.wheelSize}"`, tone: 'plain' })
  if (spec.condition !== 'unknown') chips.push({ label: spec.condition, tone: spec.condition === 'damaged' ? 'red' : 'plain' })
  return chips
}

export function BikeCard({
  bike,
  index,
  view,
  onOpen,
}: {
  bike: ScoredBike
  index: number
  view: ViewMode
  onOpen: (bike: ScoredBike) => void
}) {
  const chips = specChips(bike)
  const heading = [bike.spec.brand, bike.spec.model].filter(Boolean).join(' ') || bike.title
  const gallery = view === 'gallery'

  return (
    <article
      className={cn(
        'group relative bg-paper border-2 border-ink shadow-hard sm:shadow-hard-md',
        'transition-transform duration-200 ease-out hover:-translate-y-1',
        gallery ? 'flex flex-col' : 'flex flex-row',
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(bike)}
        aria-label={`Open details for ${heading}, score ${bike.score}`}
        className="absolute inset-0 z-20 cursor-pointer"
      />

      <div
        className={cn(
          'relative shrink-0 overflow-hidden border-ink bg-muted',
          gallery ? 'aspect-4/3 w-full border-b-2' : 'aspect-square w-28 border-r-2 sm:w-40',
        )}
      >
        <BikeImage src={bike.images[0]} alt={heading} eager={index < 4} />

        <span className="absolute left-0 top-0 z-10">
          <ScoreBlock score={bike.score} size={gallery ? 'md' : 'sm'} className="border-t-0 border-l-0" />
        </span>

        {bike.demo && (
          <span className="absolute right-0 bottom-0 z-10 border-t-2 border-l-2 border-ink bg-bh-yellow px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest">
            Demo
          </span>
        )}
      </div>

      <div className={cn('flex min-w-0 flex-1 flex-col gap-2', gallery ? 'p-3 sm:p-4' : 'p-3')}>
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn('min-w-0 break-words', gallery ? 'text-lg sm:text-xl' : 'text-base')}>{heading}</h3>
        </div>

        <p className="line-clamp-2 text-xs font-medium leading-snug text-ink/60">{bike.title}</p>

        <div className="flex flex-wrap gap-1">
          {chips.slice(0, gallery ? 6 : 4).map((chip) => (
            <Chip key={chip.label} tone={chip.tone}>
              {chip.label}
            </Chip>
          ))}
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-1 pt-1">
          <div className="min-w-0 shrink-0">
            <p className="text-xl font-black tabular-nums leading-none sm:text-2xl">
              {formatPrice(bike.price, bike.currency)}
            </p>
            {bike.savings !== null && bike.savings > 0 && (
              <p className="label-mono mt-1 whitespace-nowrap text-bh-red">
                {formatPrice(bike.savings, bike.currency)} under value
              </p>
            )}
            {bike.savings !== null && bike.savings <= 0 && (
              <p className="label-mono mt-1 whitespace-nowrap text-ink/50">
                ~{formatPrice(bike.estimatedValue, bike.currency)} value
              </p>
            )}
          </div>

          <div className="ml-auto shrink-0 text-right">
            <p className="label-mono text-ink/60">{bike.sourceLabel}</p>
            {bike.location && (
              <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-bold text-ink/50">
                <MapPin className="h-3 w-3" strokeWidth={3} />
                {bike.location}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
