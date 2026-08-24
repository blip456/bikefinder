'use client'

import { AlertTriangle, CheckCircle2, RefreshCw, Zap } from 'lucide-react'
import { useState } from 'react'
import type { SourceReport } from '@/lib/types'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'

/**
 * The hero: a two-panel Bauhaus composition. Headline and the scan trigger on
 * the left, an abstract geometric construction on the right (desktop only —
 * on mobile the screen belongs to the results).
 */
export function ScanPanel({
  onScan,
  scanning,
  scannedAt,
  resultCount,
  demoMode,
}: {
  onScan: () => void
  scanning: boolean
  scannedAt: string | null
  resultCount: number
  demoMode: boolean
}) {
  return (
    <section className="border-b-4 border-ink">
      <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-5">
        <div className="col-span-1 px-4 py-8 sm:px-6 sm:py-12 lg:col-span-3 lg:py-20 lg:pr-12">
          <p className="label-mono mb-3 text-bh-red">Second-hand MTB deal scanner</p>

          <h1 className="text-4xl leading-[0.9] sm:text-6xl lg:text-7xl">
            Most bike
            <br />
            per <span className="bg-bh-yellow px-1.5 [box-decoration-break:clone]">euro</span>
          </h1>

          <p className="mt-4 max-w-md text-base font-medium leading-relaxed text-ink/70 sm:mt-6 sm:text-lg">
            Scan your marketplaces, pull the specs out of every ad, and rank each bike on how good
            the deal actually is.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
            <Button variant="red" size="lg" onClick={onScan} disabled={scanning} className="min-w-[180px]">
              {scanning ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" strokeWidth={3} />
                  Scanning…
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" strokeWidth={3} />
                  Scan now
                </>
              )}
            </Button>

            {demoMode && (
              <span className="border-2 border-ink bg-bh-yellow px-2 py-1 text-[11px] font-black uppercase tracking-widest">
                Demo mode
              </span>
            )}
          </div>

          {scannedAt && (
            <p className="label-mono mt-4 text-ink/50">
              {resultCount} bike{resultCount === 1 ? '' : 's'} · scanned{' '}
              {new Date(scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Geometric construction — the poster half of the composition. */}
        <div className="relative hidden overflow-hidden border-l-4 border-ink bg-bh-blue lg:col-span-2 lg:block">
          <div className="bg-dots-light absolute inset-0 opacity-20" />
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-bh-yellow border-4 border-ink" />
          <div className="absolute bottom-8 left-8 h-40 w-40 rotate-45 border-4 border-ink bg-bh-red" />
          <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 border-4 border-ink bg-white" />
          <div className="clip-triangle absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 bg-ink" />
        </div>
      </div>
    </section>
  )
}

/** Per-source outcome strip. Failures are loud on purpose. */
export function SourceReports({ reports }: { reports: SourceReport[] }) {
  const [open, setOpen] = useState(false)
  if (!reports.length) return null

  const failed = reports.filter((report) => !report.ok || report.error)
  const empty = reports.filter((report) => report.ok && report.kept === 0)
  const shouldOpen = open || failed.length > 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={shouldOpen}
        className="label-mono flex items-center gap-2 text-ink/60 transition-colors hover:text-ink"
      >
        {failed.length ? (
          <AlertTriangle className="h-4 w-4 text-bh-red" strokeWidth={3} />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-bh-blue" strokeWidth={3} />
        )}
        {reports.length - failed.length}/{reports.length} sources ok
        {empty.length > 0 && ` · ${empty.length} empty`}
      </button>

      {shouldOpen && (
        <ul className="mt-3 space-y-2">
          {reports.map((report) => {
            const bad = !report.ok || Boolean(report.error)
            const dropReasons = Object.entries(report.dropped ?? {})
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
            return (
              <li
                key={report.id}
                className={cn(
                  'border-2 border-ink p-3 shadow-hard-xs',
                  bad ? 'bg-bh-red text-white' : 'bg-paper text-ink',
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-black uppercase tracking-wide">{report.label}</span>
                  <span className={cn('label-mono shrink-0', bad ? 'text-white/80' : 'text-ink/50')}>
                    {bad && report.kept === 0
                      ? 'failed'
                      : `${report.kept} kept / ${report.found} found · ${report.pages} page${report.pages === 1 ? '' : 's'}`}
                  </span>
                </div>
                {report.error && <p className="mt-1.5 text-xs font-bold leading-snug">{report.error}</p>}

                {/* Where the missing listings went — the first thing you want when
                    a source returns fewer results than the site shows. */}
                {dropReasons.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {dropReasons.map(([reason, count]) => (
                      <li
                        key={reason}
                        className={cn(
                          'border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                          bad ? 'bg-white/15 text-white' : 'bg-muted text-ink',
                        )}
                      >
                        {count} {reason}
                      </li>
                    ))}
                  </ul>
                )}
                {report.hint && (
                  <p className={cn('mt-1 text-xs font-medium leading-snug', bad ? 'text-white/80' : 'text-ink/60')}>
                    {report.hint}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
