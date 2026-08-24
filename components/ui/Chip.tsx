'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Static spec pill used on cards. */
export function Chip({
  children,
  tone = 'plain',
  className,
}: {
  children: ReactNode
  tone?: 'plain' | 'red' | 'blue' | 'yellow' | 'ink'
  className?: string
}) {
  const tones = {
    plain: 'bg-paper text-ink',
    red: 'bg-bh-red text-white',
    blue: 'bg-bh-blue text-white',
    yellow: 'bg-bh-yellow text-ink',
    ink: 'bg-ink text-white',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider leading-none',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Selectable chip used for multi-select criteria and filters. */
export function ToggleChip({
  children,
  selected,
  onClick,
  tone = 'blue',
}: {
  children: ReactNode
  selected: boolean
  onClick: () => void
  tone?: 'red' | 'blue' | 'yellow'
}) {
  const active = {
    red: 'bg-bh-red text-white',
    blue: 'bg-bh-blue text-white',
    yellow: 'bg-bh-yellow text-ink',
  }[tone]

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'shrink-0 border-2 border-ink px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider',
        'transition-all duration-200 ease-out active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        selected ? `${active} shadow-none translate-x-[2px] translate-y-[2px]` : 'bg-paper text-ink shadow-hard-xs',
      )}
    >
      {children}
    </button>
  )
}
