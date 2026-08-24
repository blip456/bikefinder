'use client'

import { useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import type {
  Condition,
  Criteria,
  Discipline,
  FrameMaterial,
  FrameType,
  Settings,
  SizeLabel,
  Source,
  WeightKey,
} from '@/lib/types'
import { DEFAULT_CRITERIA, DEFAULT_SETTINGS, detectAdapter, labelFromUrl, newSourceId } from '@/lib/settings'
import { WEIGHT_META } from '@/lib/score'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Chip, ToggleChip } from '@/components/ui/Chip'
import { Input, Label, ListInput, NumberInput, Toggle } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'

const SIZES: SizeLabel[] = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']
const CONDITIONS: Condition[] = ['new', 'as-new', 'good', 'used', 'damaged']
const MATERIALS: FrameMaterial[] = ['carbon', 'aluminium', 'titanium', 'steel']
const FRAME_TYPES: FrameType[] = ['full-suspension', 'hardtail', 'rigid']
const DISCIPLINES: Discipline[] = ['xc', 'trail', 'enduro', 'downhill', 'dirt', 'gravel']
const WHEELS = [26, 27.5, 29]

type SectionTone = 'red' | 'blue' | 'yellow' | 'ink'

const SECTION_TONES: Record<SectionTone, { surface: string; title: string; blurb: string }> = {
  red: { surface: 'bg-bh-red', title: 'text-white', blurb: 'text-white/80' },
  blue: { surface: 'bg-bh-blue', title: 'text-white', blurb: 'text-white/80' },
  yellow: { surface: 'bg-bh-yellow', title: 'text-ink', blurb: 'text-ink/70' },
  ink: { surface: 'bg-ink', title: 'text-white', blurb: 'text-white/80' },
}

/** Colour-blocked section header — the strong horizontal rhythm of the system. */
function Section({
  title,
  blurb,
  tone,
  children,
}: {
  title: string
  blurb?: string
  tone: SectionTone
  children: React.ReactNode
}) {
  const palette = SECTION_TONES[tone]
  return (
    <section className="mb-6 border-2 border-ink bg-paper shadow-hard">
      <header className={cn('border-b-2 border-ink px-3 py-2.5', palette.surface)}>
        <h3 className={cn('text-lg', palette.title)}>{title}</h3>
        {blurb && <p className={cn('mt-1 text-[11px] font-medium leading-snug', palette.blurb)}>{blurb}</p>}
      </header>
      <div className="space-y-4 p-3">{children}</div>
    </section>
  )
}

function ChipRow<T extends string | number>({
  label,
  options,
  selected,
  onToggle,
  tone = 'blue',
  hint,
}: {
  label: string
  options: readonly T[]
  selected: T[]
  onToggle: (value: T) => void
  tone?: 'red' | 'blue' | 'yellow'
  hint?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <ToggleChip key={String(option)} selected={selected.includes(option)} onClick={() => onToggle(option)} tone={tone}>
            {String(option)}
          </ToggleChip>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-xs font-medium leading-snug text-ink/60">{hint}</p>}
    </div>
  )
}

export function SettingsPanel({
  open,
  onClose,
  settings,
  onChange,
}: {
  open: boolean
  onClose: () => void
  settings: Settings
  onChange: (next: Settings) => void
}) {
  const [draftUrl, setDraftUrl] = useState('')
  const [draftLabel, setDraftLabel] = useState('')

  const patchCriteria = (patch: Partial<Criteria>) =>
    onChange({ ...settings, criteria: { ...settings.criteria, ...patch } })

  const patchSources = (sources: Source[]) => onChange({ ...settings, sources })

  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]

  const addSource = () => {
    const url = draftUrl.trim()
    if (!url) return
    const adapter = detectAdapter(url)
    patchSources([
      ...settings.sources,
      {
        id: newSourceId(),
        label: draftLabel.trim() || labelFromUrl(url),
        url,
        adapter,
        enabled: true,
      },
    ])
    setDraftUrl('')
    setDraftLabel('')
  }

  const { criteria } = settings

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Saved in this browser"
      title="Settings"
      tone="blue"
      footer={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="md"
            className="flex-1"
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={3} />
            Reset
          </Button>
          <Button variant="red" size="md" className="flex-1" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <Section
        title="Sources"
        blurb="Any search-results URL works. 2dehands, buycycle and Facebook Marketplace get dedicated parsers; everything else uses the generic one."
        tone="red"
      >
        <ul className="space-y-2">
          {settings.sources.map((source) => (
            <li key={source.id} className="border-2 border-ink bg-canvas p-2.5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-black uppercase">{source.label}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Chip tone={source.adapter === 'generic' ? 'plain' : 'ink'}>{source.adapter}</Chip>
                  {!source.builtin && (
                    <button
                      type="button"
                      aria-label={`Remove ${source.label}`}
                      onClick={() => patchSources(settings.sources.filter((entry) => entry.id !== source.id))}
                      className="border-2 border-ink bg-paper p-1 transition-colors hover:bg-bh-red hover:text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>

              <Input
                aria-label={`${source.label} URL`}
                value={source.url}
                onChange={(event) =>
                  patchSources(
                    settings.sources.map((entry) =>
                      entry.id === source.id
                        ? { ...entry, url: event.target.value, adapter: detectAdapter(event.target.value) }
                        : entry,
                    ),
                  )
                }
                className="mb-2 h-9 text-xs"
              />

              <Toggle
                label={source.enabled ? 'Scanned' : 'Skipped'}
                checked={source.enabled}
                onChange={(next) =>
                  patchSources(
                    settings.sources.map((entry) => (entry.id === source.id ? { ...entry, enabled: next } : entry)),
                  )
                }
              />
            </li>
          ))}
        </ul>

        <div className="border-2 border-dashed border-ink p-2.5">
          <Label>Add a source</Label>
          <Input
            placeholder="https://…  search results URL"
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            className="mb-2"
            inputMode="url"
          />
          <Input
            placeholder="Label (optional)"
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            className="mb-2"
          />
          <Button variant="blue" size="sm" className="w-full" onClick={addSource} disabled={!draftUrl.trim()}>
            <Plus className="h-4 w-4" strokeWidth={3} />
            Add source
            {draftUrl.trim() && <Chip tone="yellow">{detectAdapter(draftUrl)}</Chip>}
          </Button>
        </div>
      </Section>

      <Section
        title="Must match"
        blurb="Hard filters. A listing is dropped only when we could actually read the field — unknown never means rejected."
        tone="blue"
      >
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Min price (€)"
            value={criteria.minPrice}
            onChange={(minPrice) => patchCriteria({ minPrice })}
          />
          <NumberInput
            label="Max price (€)"
            value={criteria.maxPrice}
            onChange={(maxPrice) => patchCriteria({ maxPrice })}
          />
        </div>

        <NumberInput
          label="Earliest model year"
          value={criteria.minYear}
          onChange={(minYear) => patchCriteria({ minYear })}
        />

        <ChipRow
          label="Frame sizes"
          options={SIZES}
          selected={criteria.sizes}
          onToggle={(value) => patchCriteria({ sizes: toggleIn(criteria.sizes, value) })}
        />

        <ChipRow
          label="Acceptable condition"
          options={CONDITIONS}
          selected={criteria.conditions}
          onToggle={(value) => patchCriteria({ conditions: toggleIn(criteria.conditions, value) })}
          tone="red"
          hint="Leave empty to accept any condition."
        />

        <ListInput
          label="Required keywords"
          hint="Comma separated. A listing must contain at least one. Leave empty to skip."
          value={criteria.keywords}
          onChange={(keywords) => patchCriteria({ keywords })}
          placeholder="e.g. carbon, fully"
        />

        <ListInput
          label="Excluded keywords"
          hint="Comma separated. Any match drops the listing."
          value={criteria.excludeKeywords}
          onChange={(excludeKeywords) => patchCriteria({ excludeKeywords })}
        />

        <ListInput
          label="Excluded brands"
          hint="Comma separated."
          value={criteria.excludeBrands}
          onChange={(excludeBrands) => patchCriteria({ excludeBrands })}
          placeholder="e.g. huffy, muddyfox"
        />

        <Toggle
          label="Allow e-bikes"
          hint="Off by default — e-MTBs distort the value model."
          checked={criteria.allowElectric}
          onChange={(next) => patchCriteria({ allowElectric: next })}
        />

        <Toggle
          label="Require a price"
          hint="Drops 'make an offer' ads, which cannot be scored on value."
          checked={criteria.requirePrice}
          onChange={(next) => patchCriteria({ requirePrice: next })}
        />
      </Section>

      <Section
        title="Preferences"
        blurb="Soft signals. These do not drop listings — they feed the 'fit' sub-score, so a near-miss can still surface if it is a steal."
        tone="yellow"
      >
        <ChipRow
          label="Frame material"
          options={MATERIALS}
          selected={criteria.frameMaterials}
          onToggle={(value) => patchCriteria({ frameMaterials: toggleIn(criteria.frameMaterials, value) })}
          tone="yellow"
        />
        <ChipRow
          label="Frame type"
          options={FRAME_TYPES}
          selected={criteria.frameTypes}
          onToggle={(value) => patchCriteria({ frameTypes: toggleIn(criteria.frameTypes, value) })}
          tone="yellow"
        />
        <ChipRow
          label="Discipline"
          options={DISCIPLINES}
          selected={criteria.disciplines}
          onToggle={(value) => patchCriteria({ disciplines: toggleIn(criteria.disciplines, value) })}
          tone="yellow"
        />
        <ChipRow
          label="Wheel size"
          options={WHEELS}
          selected={criteria.wheelSizes}
          onToggle={(value) => patchCriteria({ wheelSizes: toggleIn(criteria.wheelSizes, value) })}
          tone="yellow"
        />
        <ListInput
          label="Preferred brands"
          hint="Comma separated. Matching brands score higher on fit."
          value={criteria.brands}
          onChange={(brands) => patchCriteria({ brands })}
          placeholder="e.g. santa cruz, canyon"
        />
      </Section>

      <Section
        title="Scoring weights"
        blurb="The final score is the weighted average of these. Set one to zero to ignore it entirely."
        tone="ink"
      >
        {WEIGHT_META.map((meta) => (
          <div key={meta.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <Label>{meta.label}</Label>
              <span className="text-sm font-black tabular-nums">
                ×{settings.weights[meta.key as WeightKey].toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              step={0.5}
              value={settings.weights[meta.key as WeightKey]}
              aria-label={`${meta.label} weight`}
              onChange={(event) =>
                onChange({
                  ...settings,
                  weights: { ...settings.weights, [meta.key]: Number(event.target.value) },
                })
              }
              className="h-2 w-full cursor-pointer appearance-none border-2 border-ink bg-muted accent-bh-red"
            />
            <p className="mt-1 text-xs font-medium leading-snug text-ink/60">{meta.help}</p>
          </div>
        ))}
      </Section>

      <Section title="Results" tone="red">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Min score"
            min={0}
            max={100}
            value={criteria.minScore}
            emptyValue={0}
            onChange={(minScore) => patchCriteria({ minScore: minScore ?? 0 })}
          />
          <NumberInput
            label="Max per source"
            min={1}
            max={500}
            value={criteria.maxPerSource}
            emptyValue={DEFAULT_CRITERIA.maxPerSource}
            onChange={(maxPerSource) => patchCriteria({ maxPerSource: maxPerSource ?? DEFAULT_CRITERIA.maxPerSource })}
          />
        </div>

        <NumberInput
          label="Pages to follow per source"
          hint="Most marketplaces show ~24 results per page. Following more pages finds more bikes but makes each scan slower."
          min={1}
          max={10}
          value={criteria.maxPages}
          emptyValue={DEFAULT_CRITERIA.maxPages}
          onChange={(maxPages) => patchCriteria({ maxPages: maxPages ?? DEFAULT_CRITERIA.maxPages })}
        />

        <Toggle
          label="Retry blocked sources in your browser"
          hint="When a site refuses our server, fetch it from your own connection instead. Works for sites that expose a JSON API; ordinary pages usually block cross-origin reads."
          checked={settings.clientFallback}
          onChange={(next) => onChange({ ...settings, clientFallback: next })}
        />

        <Toggle
          label="Demo mode"
          hint="Score built-in sample listings instead of scraping. Useful to explore the app when a marketplace blocks server-side requests."
          checked={settings.demoMode}
          onChange={(next) => onChange({ ...settings, demoMode: next })}
        />
      </Section>
    </Sheet>
  )
}
