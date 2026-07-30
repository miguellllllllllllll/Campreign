'use client'

import { motion } from 'motion/react'
import { Explain } from '../Explain.tsx'
import { DieFace } from './DieFace.tsx'
import { cn } from '../../lib/utils.ts'
import { formatModifier } from '../../lib/dnd/stats.ts'
import type { DiceRoll } from '../../types/dice.ts'
import type { RollPart } from '../../types/combat.ts'
import type { ExplainKey } from '../../lib/dnd/explanations.ts'

export type Verdict = 'great' | 'good' | 'bad' | 'awful'

const VERDICT_CLASS: Record<Verdict, string> = {
  great: 'border-amber-torch bg-amber-torch/15 text-amber-torch shadow-torch',
  good: 'border-moss bg-moss/15 text-moss',
  bad: 'border-edge-bright bg-surface-raised text-muted',
  // A solid crimson ribbon rather than a tint: a critical miss is the one
  // verdict worth shouting, and filled crimson under parchment is the only way
  // this red clears contrast — as text on the dark ground it reads at 2:1.
  awful: 'banner-dnd-red border-dnd-red',
}

const CHIP = 'rounded-md border border-edge/80 bg-surface-raised/90 px-2 py-1 shadow-[inset_0_1px_0_rgb(244_232_193/0.06)]'

export interface RollBreakdownProps {
  diceRoll: DiceRoll
  natural: number
  parts: readonly RollPart[]
  total: number
  /** "Goblin AC" / "DC" — whatever the total is being compared against. */
  targetLabel: string
  targetValue: number
  targetExplainKey: ExplainKey
  verdict: Verdict
  verdictText: string
  /** The full narrated sentences, announced to screen readers. */
  narration: string
  rolling?: boolean
}

export function RollBreakdown({
  diceRoll,
  natural,
  parts,
  total,
  targetLabel,
  targetValue,
  targetExplainKey,
  verdict,
  verdictText,
  narration,
  rolling = false,
}: RollBreakdownProps) {
  const d20 = diceRoll.groups.find((group) => group.size === 20)
  const faces = d20?.results ?? [natural]

  return (
    <div className="rounded-card border border-edge bg-ink/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {faces.map((face, index) => (
          <DieFace
            key={`${face}-${index}`}
            value={face}
            rolling={rolling}
            discarded={!rolling && face !== natural && faces.length > 1}
            label={face === natural ? `d20 kept: ${face}` : `d20 discarded: ${face}`}
          />
        ))}

        {!rolling && (
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-sm">
            <span className={cn(CHIP, 'text-parchment')}>{natural}</span>
            {parts.map((part) => (
              <span key={part.label} className={cn(CHIP, 'text-muted')}>
                {formatModifier(part.value)} {part.label}
              </span>
            ))}
            <span className="px-1 text-muted">=</span>
            <motion.span
              className={cn(
                CHIP,
                'border-gold-border/70 bg-amber-torch/15 font-bold text-amber-torch shadow-torch',
              )}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 14 }}
            >
              {total}
            </motion.span>
            <span className="px-1 text-muted">vs</span>
            <span className={cn(CHIP, 'text-parchment')}>
              <Explain k={targetExplainKey}>{targetLabel}</Explain> {targetValue}
            </span>
          </div>
        )}
      </div>

      {!rolling && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'rounded-md border px-2.5 py-1 text-sm font-bold tracking-wide',
              VERDICT_CLASS[verdict],
            )}
          >
            {verdictText}
          </span>
        </div>
      )}

      <p aria-live="polite" className="mt-3 text-sm leading-relaxed text-muted">
        {rolling ? 'Rolling…' : narration}
      </p>
    </div>
  )
}
