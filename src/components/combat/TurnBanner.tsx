'use client'

import type { TutorialPhase } from '../../types/tutorial.ts'

const PHASE_LABEL: Record<TutorialPhase, string> = {
  exploration: 'Exploration',
  social: 'Talking',
  combat: 'Combat',
}

const PHASE_ORDER: TutorialPhase[] = ['exploration', 'social', 'combat']

export interface TurnBannerProps {
  phase: TutorialPhase
  title: string
  /** Printed word for word from the step — never rewritten here. */
  guidance: string
  /** Set when the player has been refused an action and needs telling why. */
  refusal?: string | null
}

export function TurnBanner({ phase, title, guidance, refusal }: TurnBannerProps) {
  return (
    <div className="sticky top-0 z-10 rounded-card border border-gold/40 bg-surface-raised/95 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {PHASE_ORDER.map((candidate) => (
          <span
            key={candidate}
            className={
              candidate === phase
                ? 'rounded-full border border-gold/60 bg-gold/15 px-2.5 py-0.5 font-semibold text-gold'
                : 'rounded-full border border-edge px-2.5 py-0.5 text-muted'
            }
          >
            {PHASE_LABEL[candidate]}
          </span>
        ))}
      </div>

      <h2 className="mt-3 text-lg font-semibold text-parchment">{title}</h2>

      <p aria-live="polite" className="mt-1 text-sm leading-relaxed text-gold">
        {guidance}
      </p>

      {refusal !== null && refusal !== undefined && (
        <p aria-live="polite" className="mt-2 text-sm leading-relaxed text-blood">
          {refusal}
        </p>
      )}
    </div>
  )
}
