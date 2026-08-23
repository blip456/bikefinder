import { cn } from '@/lib/cn'
import { scoreBand } from '@/lib/score'

/** The score, rendered as a bordered geometric block in the band colour. */
export function ScoreBlock({
  score,
  size = 'md',
  className,
}: {
  score: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const band = scoreBand(score)

  const sizes = {
    sm: 'h-10 w-10 text-base',
    md: 'h-14 w-14 text-xl',
    lg: 'h-20 w-20 text-3xl',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center border-2 sm:border-4 border-ink font-black tabular-nums',
        band.tone === 'yellow' ? 'text-ink' : 'text-white',
        sizes[size],
        className,
      )}
      style={{ backgroundColor: band.color }}
      aria-label={`Deal score ${score} out of 100 — ${band.label}`}
    >
      {score}
    </span>
  )
}

/** Hard-edged progress bar for score breakdowns. */
export function Meter({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-3 w-full border-2 border-ink bg-paper">
      <div
        className="h-full transition-[width] duration-300 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }}
      />
    </div>
  )
}
