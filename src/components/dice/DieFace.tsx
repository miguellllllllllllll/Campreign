'use client'

import { motion } from 'motion/react'
import { cn } from '../../lib/utils.ts'

export interface DieFaceProps {
  value: number
  /** Dice that were rolled but discarded by advantage are dimmed, not hidden. */
  discarded?: boolean
  rolling?: boolean
  size?: 'sm' | 'lg'
  label?: string
}

const HEX = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)'

/** A d20 drawn as a hexagon, because that is what a twenty-sided die looks like face-on. */
export function DieFace({ value, discarded = false, rolling = false, size = 'lg', label }: DieFaceProps) {
  const dimensions = size === 'lg' ? 'size-14 text-xl' : 'size-9 text-sm'

  return (
    <motion.div
      aria-label={label ?? `d20 showing ${value}`}
      className={cn('relative grid place-items-center', dimensions)}
      // Spinning while airborne, then a single overshoot as it settles — the
      // bounce is the signal that a new number has landed.
      animate={rolling ? { rotate: [0, 180, 360], scale: 0.9 } : { rotate: 0, scale: [1.3, 0.94, 1] }}
      transition={
        rolling
          ? { rotate: { duration: 0.5, repeat: Infinity, ease: 'linear' }, scale: { duration: 0.2 } }
          : { duration: 0.42, ease: [0.34, 1.4, 0.64, 1] }
      }
      style={{ filter: 'drop-shadow(0 6px 8px rgb(0 0 0 / 0.55))' }}
    >
      {/* The metal edge. A slightly larger clipped layer behind the face reads
          as a bevel without needing an SVG per die size. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 bg-gradient-to-br',
          discarded ? 'from-edge-bright to-edge' : 'from-[#f0dca4] via-gold-border to-[#6b5527]',
        )}
        style={{ clipPath: HEX }}
      />
      <span
        aria-hidden
        className={cn(
          'absolute inset-[2px] bg-gradient-to-b',
          discarded ? 'from-surface to-ink' : 'from-surface-raised via-surface to-ink',
        )}
        style={{ clipPath: HEX }}
      />
      {/* A lit top facet, so the face is not flat. */}
      <span
        aria-hidden
        className="absolute inset-[2px] bg-gradient-to-b from-white/12 to-transparent to-45%"
        style={{ clipPath: HEX }}
      />
      <span
        className={cn(
          'relative font-mono font-bold tabular-nums',
          discarded ? 'text-muted line-through' : 'text-amber-torch drop-shadow-[0_0_6px_rgb(212_175_55/0.45)]',
        )}
      >
        {rolling ? '?' : value}
      </span>
    </motion.div>
  )
}
