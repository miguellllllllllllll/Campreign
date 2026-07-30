'use client'

import { motion } from 'motion/react'
import { cn } from '../../lib/utils.ts'

export type ResourceTone = 'health' | 'foe' | 'arcane'

const FILL: Record<ResourceTone, string> = {
  health: 'from-moss/70 to-moss',
  foe: 'from-blood/70 to-blood',
  arcane: 'from-arcane/70 to-arcane',
}

const GLOW: Record<ResourceTone, string> = {
  health: 'shadow-[0_0_10px_rgb(122_163_95/0.5)]',
  foe: 'shadow-[0_0_10px_rgb(192_70_59/0.5)]',
  arcane: 'shadow-[0_0_10px_rgb(138_154_224/0.5)]',
}

export interface ResourceBarProps {
  current: number
  max: number
  tone?: ResourceTone
  /** Announced to screen readers, e.g. "Goblin hit points". */
  label: string
  className?: string
}

/**
 * A bar that animates to its new width rather than snapping. Damage should be
 * legible as a movement — a number that simply changes is easy to miss.
 *
 * Spring rather than a CSS transition so a second hit landing mid-animation
 * retargets smoothly instead of restarting.
 */
export function ResourceBar({
  current,
  max,
  tone = 'health',
  label,
  className,
}: ResourceBarProps) {
  const safe = Math.max(0, Math.min(current, max))
  const fraction = max <= 0 ? 0 : safe / max
  // Below a quarter, health reads as danger regardless of whose it is.
  const critical = tone === 'health' && fraction > 0 && fraction <= 0.25

  return (
    <div
      className={cn(
        'relative h-2 overflow-hidden rounded-full border border-edge/80 bg-ink/70',
        className,
      )}
      role="progressbar"
      aria-label={label}
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <motion.div
        className={cn(
          'h-full rounded-full bg-gradient-to-r',
          critical ? 'from-blood/70 to-blood' : FILL[tone],
          critical ? GLOW.foe : GLOW[tone],
        )}
        initial={false}
        animate={{ width: `${fraction * 100}%` }}
        transition={{ type: 'spring', stiffness: 170, damping: 22 }}
      />
      {/* A moving sheen along the fill, so a full bar still looks alive. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
    </div>
  )
}
