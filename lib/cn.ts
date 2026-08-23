import { twMerge } from 'tailwind-merge'

/**
 * Join class names, letting later utilities win over earlier conflicting ones.
 * Without the merge, a caller passing `w-40` cannot override a component's
 * built-in `w-full` — CSS order decides, not argument order.
 */
export function cn(...values: (string | false | null | undefined)[]): string {
  return twMerge(values.filter(Boolean).join(' '))
}
