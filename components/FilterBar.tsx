'use client'

import { LayoutGrid, Rows3, Search, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import type { ScoredBike } from '@/lib/types'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { ToggleChip } from '@/components/ui/Chip'
import { Select } from '@/components/ui/Field'
import type { ViewMode } from './BikeCard'

export type SortKey = 'score' | 'price-asc' | 'price-desc' | 'savings' | 'year' | 'newest'

export interface Filters {
  query: string
  sources: string[]
  sizes: string[]
  materials: string[]
  frameTypes: string[]
  sort: SortKey
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  sources: [],
  sizes: [],
  materials: [],
  frameTypes: [],
  sort: 'score',
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'score', label: 'Best deal' },
  { value: 'savings', label: 'Biggest saving' },
  { value: 'price-asc', label: 'Cheapest' },
  { value: 'price-desc', label: 'Most expensive' },
  { value: 'year', label: 'Newest model' },
]

/** Facet values that actually occur in the current result set. */
export function facetsOf(bikes: ScoredBike[]) {
  const collect = <T,>(pick: (bike: ScoredBike) => T | null | undefined) =>
    [...new Set(bikes.map(pick).filter((value): value is T => value !== null && value !== undefined))]

  return {
    sources: collect((bike) => bike.sourceLabel).sort(),
    sizes: collect((bike) => bike.spec.size).sort(),
    materials: collect((bike) => (bike.spec.frameMaterial === 'unknown' ? null : bike.spec.frameMaterial)).sort(),
    frameTypes: collect((bike) => (bike.spec.frameType === 'unknown' ? null : bike.spec.frameType)).sort(),
  }
}

export function applyFilters(bikes: ScoredBike[], filters: Filters): ScoredBike[] {
  const query = filters.query.trim().toLowerCase()

  const filtered = bikes.filter((bike) => {
    if (query) {
      const haystack = `${bike.title} ${bike.description} ${bike.spec.brand ?? ''} ${bike.spec.model ?? ''}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    if (filters.sources.length && !filters.sources.includes(bike.sourceLabel)) return false
    if (filters.sizes.length && (!bike.spec.size || !filters.sizes.includes(bike.spec.size))) return false
    if (filters.materials.length && !filters.materials.includes(bike.spec.frameMaterial)) return false
    if (filters.frameTypes.length && !filters.frameTypes.includes(bike.spec.frameType)) return false
    return true
  })

  const sorted = [...filtered]
  switch (filters.sort) {
    case 'price-asc':
      sorted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
      break
    case 'price-desc':
      sorted.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity))
      break
    case 'savings':
      sorted.sort((a, b) => (b.savings ?? -Infinity) - (a.savings ?? -Infinity))
      break
    case 'year':
      sorted.sort((a, b) => (b.spec.year ?? 0) - (a.spec.year ?? 0))
      break
    default:
      sorted.sort((a, b) => b.score - a.score)
  }
  return sorted
}

export function countActive(filters: Filters): number {
  return (
    filters.sources.length +
    filters.sizes.length +
    filters.materials.length +
    filters.frameTypes.length +
    (filters.query ? 1 : 0)
  )
}

export function FilterBar({
  bikes,
  filters,
  onChange,
  view,
  onViewChange,
}: {
  bikes: ScoredBike[]
  filters: Filters
  onChange: (next: Filters) => void
  view: ViewMode
  onViewChange: (next: ViewMode) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const facets = facetsOf(bikes)
  const active = countActive(filters)

  const toggle = (key: 'sources' | 'sizes' | 'materials' | 'frameTypes', value: string) => {
    const list = filters[key]
    onChange({ ...filters, [key]: list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value] })
  }

  const hasFacets = facets.sizes.length + facets.materials.length + facets.frameTypes.length + facets.sources.length > 0

  return (
    <div className="sticky top-0 z-30 border-b-4 border-ink bg-canvas">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:px-6">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" strokeWidth={3} />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            placeholder="Search results…"
            aria-label="Search results"
            className="h-10 w-full border-2 border-ink bg-paper pl-8 pr-2 text-sm font-bold placeholder:font-medium placeholder:text-ink/40 focus:outline-none focus-visible:outline-3 focus-visible:outline-bh-blue focus-visible:outline-offset-2"
          />
        </div>

        <Select
          value={filters.sort}
          aria-label="Sort results"
          onChange={(event) => onChange({ ...filters, sort: event.target.value as SortKey })}
          className="hidden h-10 w-40 sm:block"
        >
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </Select>

        {hasFacets && (
          <Button
            variant={expanded || active ? 'blue' : 'outline'}
            size="sm"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label="Toggle filters"
            className="h-10 shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={3} />
            {active > 0 && <span className="tabular-nums">{active}</span>}
          </Button>
        )}

        <div className="flex h-10 shrink-0 border-2 border-ink">
          <button
            type="button"
            aria-label="Gallery view"
            aria-pressed={view === 'gallery'}
            onClick={() => onViewChange('gallery')}
            className={cn('flex w-10 items-center justify-center transition-colors', view === 'gallery' ? 'bg-ink text-white' : 'bg-paper')}
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={3} />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => onViewChange('list')}
            className={cn('flex w-10 items-center justify-center border-l-2 border-ink transition-colors', view === 'list' ? 'bg-ink text-white' : 'bg-paper')}
          >
            <Rows3 className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      </div>

      {expanded && hasFacets && (
        <div className="border-t-2 border-ink bg-muted">
          <div className="mx-auto max-w-7xl space-y-2.5 px-4 py-3 sm:px-6">
            <div className="sm:hidden">
              <Select
                value={filters.sort}
                aria-label="Sort results"
                onChange={(event) => onChange({ ...filters, sort: event.target.value as SortKey })}
                className="h-10"
              >
                {SORTS.map((sort) => (
                  <option key={sort.value} value={sort.value}>
                    {sort.label}
                  </option>
                ))}
              </Select>
            </div>

            {[
              { key: 'sources' as const, label: 'Source', values: facets.sources, tone: 'red' as const },
              { key: 'sizes' as const, label: 'Size', values: facets.sizes, tone: 'blue' as const },
              { key: 'materials' as const, label: 'Material', values: facets.materials, tone: 'yellow' as const },
              { key: 'frameTypes' as const, label: 'Frame', values: facets.frameTypes, tone: 'blue' as const },
            ]
              .filter((group) => group.values.length > 1)
              .map((group) => (
                <div key={group.key} className="flex items-center gap-2">
                  <span className="label-mono w-20 shrink-0 text-ink/60">{group.label}</span>
                  <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {group.values.map((value) => (
                      <ToggleChip
                        key={value}
                        selected={filters[group.key].includes(value)}
                        onClick={() => toggle(group.key, value)}
                        tone={group.tone}
                      >
                        {value}
                      </ToggleChip>
                    ))}
                  </div>
                </div>
              ))}

            {active > 0 && (
              <Button variant="outline" size="sm" onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort })}>
                <X className="h-3.5 w-3.5" strokeWidth={3} />
                Clear filters
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
