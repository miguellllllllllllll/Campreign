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

/** A d20 drawn as a hexagon, because that is what a twenty-sided die looks like face-on. */
export function DieFace({ value, discarded = false, rolling = false, size = 'lg', label }: DieFaceProps) {
  const dimensions = size === 'lg' ? 'size-14 text-xl' : 'size-9 text-sm'

  return (
    <motion.div
      aria-label={label ?? `d20 showing ${value}`}
      className={cn(
        'grid place-items-center border-2 font-mono font-bold tabular-nums',
        dimensions,
        discarded
          ? 'border-edge bg-surface text-muted line-through'
          : 'border-gold bg-surface-raised text-gold',
      )}
      style={{
        clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
      }}
      animate={rolling ? { rotate: [0, 180, 360], scale: [1, 0.85, 1] } : { rotate: 0, scale: 1 }}
      transition={rolling ? { duration: 0.5, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
    >
      {rolling ? '?' : value}
    </motion.div>
  )
}
