'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

/**
 * Mobile-first overlay: a bottom sheet under `sm`, a right-hand panel above it.
 * Handles Escape, background scroll-lock and initial focus.
 */
export type SheetTone = 'red' | 'blue' | 'yellow' | 'ink' | 'muted'

/** Background + readable foreground for each accent. */
const TONES: Record<SheetTone, { surface: string; title: string; eyebrow: string }> = {
  red: { surface: 'bg-bh-red', title: 'text-white', eyebrow: 'text-white/75' },
  blue: { surface: 'bg-bh-blue', title: 'text-white', eyebrow: 'text-white/75' },
  yellow: { surface: 'bg-bh-yellow', title: 'text-ink', eyebrow: 'text-ink/70' },
  ink: { surface: 'bg-ink', title: 'text-white', eyebrow: 'text-white/75' },
  muted: { surface: 'bg-muted', title: 'text-ink', eyebrow: 'text-ink/70' },
}

export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  tone = 'yellow',
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  tone?: SheetTone
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/60 backdrop-blur-[1px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col bg-canvas outline-none',
          'max-h-[92vh] border-t-4 border-ink',
          'sm:max-h-none sm:h-full sm:max-w-lg sm:border-t-0 sm:border-l-4',
        )}
      >
        <header className={cn('shrink-0 border-b-4 border-ink', TONES[tone].surface)}>
          <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              {eyebrow && <p className={cn('label-mono mb-1', TONES[tone].eyebrow)}>{eyebrow}</p>}
              <h2 className={cn('text-2xl sm:text-3xl', TONES[tone].title)}>{title}</h2>
            </div>
            <Button variant="outline" size="sm" onClick={onClose} aria-label="Close panel" className="shrink-0 w-9 px-0">
              <X className="h-4 w-4" strokeWidth={3} />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>

        {footer && <div className="shrink-0 border-t-4 border-ink bg-paper px-4 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  )
}
