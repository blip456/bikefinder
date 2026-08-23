'use client'

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/cn'

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="label-mono block mb-1.5 text-ink">
      {children}
    </label>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-xs font-medium text-ink/60 leading-snug">{hint}</p>}
    </div>
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

export function Textarea({ className, ...props }: InputHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...(props as object)}
      className={cn(CONTROL_CLASS, 'h-auto min-h-[72px] py-2 font-medium leading-relaxed', className)}
    />
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
