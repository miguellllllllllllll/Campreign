'use client'

import { Explain } from '../Explain.tsx'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { WardingShieldIcon } from '../ui/custom-icons.tsx'
import type { Combatant, PendingReaction, ReactionKind } from '../../types/combat.ts'

export interface ReactionBannerProps {
  pending: PendingReaction
  attacker: Combatant | undefined
  target: Combatant | undefined
  onReact: (choice: ReactionKind) => void
  onPass: () => void
}

/**
 * The prompt that appears while an attack hangs unresolved.
 *
 * States the numbers rather than asking a vague question: a beginner cannot
 * judge whether to spend their one reaction unless they can see that the blow
 * lands and by how much. This is also the only moment in the game where the
 * board is waiting on the player during somebody else's turn, so it says so
 * plainly instead of relying on the buttons to imply it.
 */
export function ReactionBanner({
  pending,
  attacker,
  target,
  onReact,
  onPass,
}: ReactionBannerProps) {
  const total = pending.outcome.breakdown.total
  const ac = pending.outcome.breakdown.targetAc

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="An attack is about to land"
      className="rounded-card border border-gold-border/70 bg-amber-torch/10 p-4 shadow-torch"
    >
      <p className="flex items-center gap-2 font-serif text-sm font-semibold text-parchment">
        <WardingShieldIcon size={18} className="text-amber-torch" />
        {attacker?.name ?? 'The attacker'} is about to hit {target?.name ?? 'you'}
      </p>

      <p className="mt-1 text-sm leading-relaxed text-muted">
        Their attack totals <span className="font-mono text-parchment">{total}</span> against your{' '}
        <Explain k="ac">AC</Explain> <span className="font-mono text-parchment">{ac}</span>.
        {pending.options.includes('wardingFlare') && (
          <>
            {' '}Flare light at them and they must roll again with{' '}
            <Explain k="disadvantage">disadvantage</Explain> — the lower roll counts.
          </>
        )}
        {pending.options.includes('shield') && (
          <>
            {' '}Shield raises your <Explain k="ac">AC</Explain> by 5 against this blow, and
            costs a spell slot.
          </>
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {pending.options.map((option) => (
          <FantasyButton key={option} variant="brass" onClick={() => onReact(option)}>
            <WardingShieldIcon size={16} />
            {option === 'wardingFlare' ? 'Use Warding Flare' : 'Cast Shield'}
          </FantasyButton>
        ))}
        <FantasyButton variant="iron" onClick={onPass}>
          Take the hit
        </FantasyButton>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-muted/80">
        You get one reaction each round, and it comes back at the start of the next one.
      </p>
    </div>
  )
}
