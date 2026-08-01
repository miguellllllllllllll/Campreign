'use client'

import { motion } from 'motion/react'
import { cn } from '../../lib/utils.ts'

export type ResourceTone = 'health' | 'foe' | 'arcane'

const FILL: Record<ResourceTone, string> = {
  health: 'from-moss/70 to-moss',
  foe: 'from-blood/70 to-blood',
  arcane: 'from-arcane/70 to-arcane',
}

/**
 * Named off the tokens rather than spelled as channels. These were three
 * literals — rgb(122 163 95), rgb(192 70 59), rgb(138 154 224) — and every one
 * had gone stale: the palette moved twice underneath them and each bar kept
 * glowing in a previous scheme's colour, the red two schemes behind.
 */
const GLOW: Record<ResourceTone, string> = {
  health: 'glow-health',
  foe: 'glow-foe',
  arcane: 'glow-arcane',
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
        'bar-well relative h-3 overflow-hidden rounded-full border-2 border-edge bg-ink/80',
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
