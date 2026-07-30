'use client'

import { Explain } from '../Explain.tsx'
import { DieFace } from './DieFace.tsx'
import { cn } from '../../lib/utils.ts'
import { formatModifier } from '../../lib/dnd/stats.ts'
import type { DiceRoll } from '../../types/dice.ts'
import type { RollPart } from '../../types/combat.ts'
import type { ExplainKey } from '../../lib/dnd/explanations.ts'

export type Verdict = 'great' | 'good' | 'bad' | 'awful'

const VERDICT_CLASS: Record<Verdict, string> = {
  great: 'border-gold bg-gold/15 text-gold',
  good: 'border-moss bg-moss/15 text-moss',
  bad: 'border-edge-bright bg-surface-raised text-muted',
  awful: 'border-blood bg-blood/15 text-blood',
}

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
    <div className="rounded-lg border border-edge bg-ink/60 p-4">
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
            <span className="rounded bg-surface-raised px-2 py-1 text-parchment">{natural}</span>
            {parts.map((part) => (
              <span key={part.label} className="rounded bg-surface-raised px-2 py-1 text-muted">
                {formatModifier(part.value)} {part.label}
              </span>
            ))}
            <span className="px-1 text-muted">=</span>
            <span className="rounded bg-gold/15 px-2 py-1 font-bold text-gold">{total}</span>
            <span className="px-1 text-muted">vs</span>
            <span className="rounded bg-surface-raised px-2 py-1 text-parchment">
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
