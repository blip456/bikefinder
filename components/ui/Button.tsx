'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'red' | 'blue' | 'yellow' | 'outline' | 'ink' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  red: 'bg-bh-red text-white border-2 border-ink shadow-hard hover:bg-bh-red/90',
  blue: 'bg-bh-blue text-white border-2 border-ink shadow-hard hover:bg-bh-blue/90',
  yellow: 'bg-bh-yellow text-ink border-2 border-ink shadow-hard hover:bg-bh-yellow/90',
  outline: 'bg-paper text-ink border-2 border-ink shadow-hard hover:bg-muted',
  ink: 'bg-ink text-white border-2 border-ink shadow-hard hover:bg-ink/90',
  ghost: 'bg-transparent text-ink border-2 border-transparent hover:bg-muted',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-14 px-6 text-base gap-3',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  shape?: 'square' | 'pill'
  children?: ReactNode
}

export function Button({
  variant = 'outline',
  size = 'md',
  shape = 'square',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center font-bold uppercase tracking-wider',
        'transition-all duration-200 ease-out',
        // The press effect: the button physically drops onto its own shadow.
        variant !== 'ghost' && 'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-x-0 disabled:active:translate-y-0',
        shape === 'pill' ? 'rounded-full' : 'rounded-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </button>
  )
}
