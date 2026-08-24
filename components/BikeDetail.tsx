'use client'

import { ArrowUpRight, MapPin } from 'lucide-react'
import type { ScoredBike } from '@/lib/types'
import { formatPrice } from '@/lib/img'
import { scoreBand } from '@/lib/score'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Meter, ScoreBlock } from '@/components/ui/ScoreBlock'
import { Sheet } from '@/components/ui/Sheet'
import { BikeImage } from './BikeImage'

function SpecRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink/10 py-2 last:border-b-0">
      <dt className="label-mono shrink-0 text-ink/60">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-bold">{value ?? '—'}</dd>
    </div>
  )
}

export function BikeDetail({ bike, onClose }: { bike: ScoredBike | null; onClose: () => void }) {
  if (!bike) return null

  const heading = [bike.spec.brand, bike.spec.model].filter(Boolean).join(' ') || bike.title
  const band = scoreBand(bike.score)

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={`${bike.sourceLabel} · ${band.label} deal`}
      title={heading}
      tone={band.tone === 'ink' ? 'muted' : band.tone}
      footer={
        <a href={bike.url} target="_blank" rel="noopener noreferrer" className="block">
          <Button variant="ink" size="lg" className="w-full">
            View original listing
            <ArrowUpRight className="h-5 w-5" strokeWidth={3} />
          </Button>
        </a>
      }
    >
      {/* Photo rail — swipeable on mobile, snapping to each shot. */}
      <div className="group -mx-4 mb-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:-mx-6 sm:px-6">
        {(bike.images.length ? bike.images : [undefined]).map((image, index) => (
          <div
            key={image ?? index}
            className="aspect-4/3 w-[85%] shrink-0 snap-start overflow-hidden border-2 border-ink bg-muted shadow-hard sm:w-[70%]"
          >
            <BikeImage src={image} alt={`${heading} — photo ${index + 1}`} eager={index === 0} />
          </div>
        ))}
      </div>

      <section className="mb-5 flex items-center gap-4 border-2 border-ink bg-paper p-4 shadow-hard">
        <ScoreBlock score={bike.score} size="lg" />
        <div className="min-w-0">
          <p className="text-3xl font-black leading-none tabular-nums">{formatPrice(bike.price, bike.currency)}</p>
          {bike.estimatedValue !== null && (
            <p className="mt-1.5 text-sm font-bold text-ink/70">
              Est. value {formatPrice(bike.estimatedValue, bike.currency)}
              {bike.savings !== null && (
                <span className={bike.savings > 0 ? 'text-bh-red' : 'text-ink/50'}>
                  {' — '}
                  {formatPrice(Math.abs(bike.savings), bike.currency)}{' '}
                  {bike.savings > 0 ? 'under' : 'over'} value
                </span>
              )}
            </p>
          )}
          {bike.location && (
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-ink/50">
              <MapPin className="h-3.5 w-3.5" strokeWidth={3} />
              {bike.location}
            </p>
          )}
        </div>
      </section>

      <section className="mb-5">
        <h3 className="mb-3 text-xl">Extracted specs</h3>
        <dl className="border-2 border-ink bg-paper px-3 py-1 shadow-hard">
          <SpecRow label="Brand" value={bike.spec.brand} />
          <SpecRow label="Model" value={bike.spec.model} />
          <SpecRow label="Year" value={bike.spec.year} />
          <SpecRow label="Condition" value={bike.spec.condition === 'unknown' ? null : bike.spec.condition} />
          <SpecRow label="Size" value={bike.spec.size ?? (bike.spec.sizeCm ? `${bike.spec.sizeCm} cm` : null)} />
          <SpecRow label="Groupset" value={bike.spec.groupset} />
          <SpecRow label="Frame material" value={bike.spec.frameMaterial === 'unknown' ? null : bike.spec.frameMaterial} />
          <SpecRow label="Frame type" value={bike.spec.frameType === 'unknown' ? null : bike.spec.frameType} />
          <SpecRow label="Discipline" value={bike.spec.discipline === 'unknown' ? null : bike.spec.discipline} />
          <SpecRow label="Wheel size" value={bike.spec.wheelSize ? `${bike.spec.wheelSize}"` : null} />
          <SpecRow label="Travel" value={bike.spec.travelMm ? `${bike.spec.travelMm} mm` : null} />
          <SpecRow label="Electric" value={bike.spec.electric ? 'Yes' : 'No'} />
        </dl>
      </section>

      <section className="mb-5">
        <h3 className="mb-1 text-xl">Why this score</h3>
        <p className="mb-3 text-xs font-medium leading-relaxed text-ink/60">
          A weighted average of eight sub-scores. Weights are yours to change in Settings.
        </p>
        <ul className="space-y-3">
          {bike.parts.map((part) => (
            <li key={part.key} className="border-2 border-ink bg-paper p-3 shadow-hard-xs">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="label-mono">{part.label}</span>
                <span className="shrink-0 text-sm font-black tabular-nums">
                  {Math.round(part.score)}
                  <span className="ml-1 text-[10px] font-bold text-ink/40">×{part.weight}</span>
                </span>
              </div>
              <Meter value={part.score} color={scoreBand(part.score).color} />
              <p className="mt-2 text-xs font-medium leading-snug text-ink/60">{part.note}</p>
            </li>
          ))}
        </ul>
      </section>

      {bike.description && (
        <section className="mb-4">
          <h3 className="mb-3 text-xl">Listing text</h3>
          <div className="border-2 border-ink bg-bh-cream p-3 shadow-hard-xs">
            <p className="mb-2 text-sm font-bold">{bike.title}</p>
            <p className="text-xs font-medium leading-relaxed text-ink/75">{bike.description}</p>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Chip tone="ink">{bike.sourceLabel}</Chip>
        <Chip>{bike.adapter}</Chip>
        {bike.demo && <Chip tone="yellow">Sample data</Chip>}
      </div>
    </Sheet>
  )
}
