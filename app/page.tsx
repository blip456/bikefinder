'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Circle, Square, Triangle } from 'lucide-react'

import { BikeCard, type ViewMode } from '@/components/BikeCard'
import { BikeDetail } from '@/components/BikeDetail'
import { EMPTY_FILTERS, FilterBar, type Filters, applyFilters } from '@/components/FilterBar'
import { ScanPanel, SourceReports } from '@/components/ScanPanel'
import { SettingsPanel } from '@/components/SettingsPanel'
import { SiteHeader } from '@/components/SiteHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DEFAULT_SETTINGS, RESULTS_KEY, loadSettings, saveSettings } from '@/lib/settings'
import type { ScanResponse, ScoredBike, Settings, SourceReport } from '@/lib/types'

export default function Home() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  // Settings live in localStorage, which only exists after mount — rendering the
  // defaults first keeps server and client markup identical.
  const [hydrated, setHydrated] = useState(false)

  const [bikes, setBikes] = useState<ScoredBike[]>([])
  const [reports, setReports] = useState<SourceReport[]>([])
  const [scannedAt, setScannedAt] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [view, setView] = useState<ViewMode>('gallery')
  const [selected, setSelected] = useState<ScoredBike | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
    try {
      const stored = window.localStorage.getItem(RESULTS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ScanResponse
        setBikes(parsed.bikes ?? [])
        setReports(parsed.sources ?? [])
        setScannedAt(parsed.scannedAt ?? null)
      }
    } catch {
      // A corrupt cache should never block the app.
    }
    setHydrated(true)
  }, [])

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }, [])

  const scan = useCallback(async () => {
    setScanning(true)
    setError(null)
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!response.ok) throw new Error(`Scan failed with HTTP ${response.status}.`)

      const data = (await response.json()) as ScanResponse
      setBikes(data.bikes)
      setReports(data.sources)
      setScannedAt(data.scannedAt)
      setFilters((current) => ({ ...EMPTY_FILTERS, sort: current.sort }))
      try {
        window.localStorage.setItem(RESULTS_KEY, JSON.stringify(data))
      } catch {
        // Over quota — results just will not survive a reload.
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong during the scan.')
    } finally {
      setScanning(false)
    }
  }, [settings])

  const visible = useMemo(() => applyFilters(bikes, filters), [bikes, filters])

  const enabledSources = settings.sources.filter((source) => source.enabled).length

  return (
    <div className="min-h-dvh">
      <SiteHeader onOpenSettings={() => setSettingsOpen(true)} />

      <ScanPanel
        onScan={scan}
        scanning={scanning}
        scannedAt={scannedAt}
        resultCount={bikes.length}
        demoMode={settings.demoMode}
      />

      {error && (
        <div className="border-b-4 border-ink bg-bh-red px-4 py-3 sm:px-6">
          <p className="mx-auto max-w-7xl text-sm font-bold text-white">{error}</p>
        </div>
      )}

      {reports.length > 0 && <SourceReports reports={reports} />}

      {bikes.length > 0 && (
        <FilterBar bikes={bikes} filters={filters} onChange={setFilters} view={view} onViewChange={setView} />
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {scanning && bikes.length === 0 && <ScanSkeleton />}

        {!scanning && bikes.length === 0 && hydrated && (
          <EmptyState
            enabledSources={enabledSources}
            demoMode={settings.demoMode}
            onOpenSettings={() => setSettingsOpen(true)}
            onTryDemo={() => {
              const next = { ...settings, demoMode: true }
              updateSettings(next)
              setSettingsOpen(false)
            }}
          />
        )}

        {bikes.length > 0 && (
          <>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-2xl sm:text-3xl">
                {visible.length} result{visible.length === 1 ? '' : 's'}
              </h2>
              {visible.length !== bikes.length && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}
                  className="label-mono text-bh-blue underline underline-offset-4"
                >
                  Show all {bikes.length}
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <Card className="p-8 text-center" index={1}>
                <p className="text-lg font-bold">Nothing matches those filters.</p>
              </Card>
            ) : (
              <div
                className={
                  view === 'gallery'
                    ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6'
                    : 'flex flex-col gap-3 sm:gap-4'
                }
              >
                {visible.map((bike, index) => (
                  <BikeCard key={bike.id} bike={bike} index={index} view={view} onOpen={setSelected} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <SiteFooter />

      <BikeDetail bike={selected} onClose={() => setSelected(null)} />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
      />
    </div>
  )
}

function ScanSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6" aria-live="polite" aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="border-2 border-ink bg-paper shadow-hard-md">
          <div className="aspect-4/3 animate-pulse border-b-2 border-ink bg-muted" />
          <div className="space-y-2 p-4">
            <div className="h-5 w-2/3 animate-pulse bg-muted" />
            <div className="h-3 w-full animate-pulse bg-muted" />
            <div className="h-7 w-1/3 animate-pulse bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  enabledSources,
  demoMode,
  onOpenSettings,
  onTryDemo,
}: {
  enabledSources: number
  demoMode: boolean
  onOpenSettings: () => void
  onTryDemo: () => void
}) {
  return (
    <Card className="relative overflow-hidden" decorated={false}>
      <div className="bg-dots absolute inset-0 opacity-[0.06]" />
      <div className="relative px-6 py-12 text-center sm:py-16">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Circle className="h-8 w-8 text-bh-red" strokeWidth={3} />
          <Square className="h-8 w-8 text-bh-blue" strokeWidth={3} />
          <Triangle className="h-8 w-8 text-bh-yellow" strokeWidth={3} />
        </div>

        <h2 className="text-3xl sm:text-4xl">No results yet</h2>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-ink/70 sm:text-base">
          {enabledSources === 0
            ? 'Every source is switched off. Enable one — or add your own search URL — and hit Scan now.'
            : `${enabledSources} source${enabledSources === 1 ? '' : 's'} armed. Hit Scan now to pull in listings and score them.`}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button variant="blue" size="md" onClick={onOpenSettings}>
            Edit sources &amp; criteria
          </Button>
          {!demoMode && (
            <Button variant="outline" size="md" onClick={onTryDemo}>
              Try it with sample data
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t-4 border-ink bg-ink px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-bh-red" />
          <span className="h-3 w-3 bg-bh-blue" />
          <span className="clip-triangle h-3 w-3 bg-bh-yellow" />
          <span className="ml-1 text-sm font-black uppercase tracking-tighter">Bike/Finder</span>
        </div>
        <p className="text-xs font-medium leading-relaxed text-white/60">
          Settings stay in your browser. Scores are estimates — always inspect a bike before buying.
        </p>
      </div>
    </footer>
  )
}
