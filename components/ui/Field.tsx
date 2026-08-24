'use client'

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="label-mono block mb-1.5 text-ink">
      {children}
    </label>
  )
}

const CONTROL_CLASS =
  'w-full h-11 px-3 bg-paper border-2 border-ink rounded-none text-sm font-bold text-ink placeholder:font-medium placeholder:text-ink/40 focus:outline-none focus-visible:outline-3 focus-visible:outline-bh-blue focus-visible:outline-offset-2'

export function Input({ className, label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  const id = useId()
  const control = <input id={id} {...props} className={cn(CONTROL_CLASS, className)} />
  if (!label) return control
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {control}
      {hint && <p className="mt-1.5 text-xs font-medium text-ink/60 leading-snug">{hint}</p>}
    </div>
  )
}

export function Select({
  className,
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const id = useId()
  const control = (
    <select id={id} {...props} className={cn(CONTROL_CLASS, 'appearance-none pr-8 cursor-pointer', className)}>
      {children}
    </select>
  )
  if (!label) return control
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {control}
    </div>
  )
}

/** Hard-edged switch — a square knob sliding inside a bordered track. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="label-mono block text-ink">{label}</span>
        {hint && <span className="mt-1 block text-xs font-medium text-ink/60 leading-snug">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'flex h-8 w-14 shrink-0 items-center border-2 border-ink p-0.5 transition-colors duration-200 ease-out',
          checked ? 'justify-end bg-bh-red' : 'justify-start bg-muted',
        )}
      >
        <span className="block h-full w-6 border-2 border-ink bg-paper" />
      </button>
    </div>
  )
}

/**
 * Keeps a local draft string while the field has focus, and only re-syncs from
 * the parent once focus leaves.
 *
 * Both inputs below publish a *parsed* value upward (an array, a number) while
 * displaying text. Without a draft the parent would immediately serialise that
 * parsed value back into `value` on every keystroke — so a half-typed entry
 * gets rewritten under the caret. Typing "huffy, apollo" used to collapse to
 * "huffyapollo" because the trailing comma parsed away the instant it appeared.
 */
function useDraft(canonical: string) {
  const [draft, setDraft] = useState(canonical)
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(canonical)
  }, [canonical])

  return {
    draft,
    setDraft,
    onFocus: () => {
      focused.current = true
    },
    onBlur: () => {
      focused.current = false
      // Normalise to the parsed form once the user is done.
      setDraft(canonical)
    },
  }
}

/** Comma-separated free text backed by a string[]. */
export function ListInput({
  value,
  onChange,
  label,
  hint,
  placeholder,
}: {
  value: string[]
  onChange: (next: string[]) => void
  label?: string
  hint?: string
  placeholder?: string
}) {
  const canonical = value.join(', ')
  const { draft, setDraft, onFocus, onBlur } = useDraft(canonical)

  return (
    <Input
      label={label}
      hint={hint}
      placeholder={placeholder}
      value={draft}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(event) => {
        const raw = event.target.value
        setDraft(raw)
        onChange(
          raw
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean),
        )
      }}
    />
  )
}

/**
 * Numeric field that tolerates being emptied mid-edit.
 *
 * @param emptyValue What to publish when the box is blank — null for optional
 *   bounds, a concrete number for settings that must always have one.
 */
export function NumberInput({
  value,
  onChange,
  emptyValue = null,
  label,
  hint,
  min,
  max,
}: {
  value: number | null
  onChange: (next: number | null) => void
  emptyValue?: number | null
  label?: string
  hint?: string
  min?: number
  max?: number
}) {
  const canonical = value === null || Number.isNaN(value) ? '' : String(value)
  const { draft, setDraft, onFocus, onBlur } = useDraft(canonical)

  return (
    <Input
      label={label}
      hint={hint}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(event) => {
        const raw = event.target.value
        setDraft(raw)
        if (raw.trim() === '') {
          onChange(emptyValue)
          return
        }
        const parsed = Number(raw)
        // "-" and "1e" are transient states while typing; keep the draft and
        // leave the published value alone rather than writing NaN.
        if (Number.isFinite(parsed)) onChange(parsed)
      }}
    />
  )
}
