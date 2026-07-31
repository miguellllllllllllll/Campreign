import { critFor, roll, toCriticalNotation } from './dice.ts'
import { damageNotation } from './characterBuilder.ts'
import type { AttackAction } from '../../types/action.ts'
import type { AttackOutcome, Combatant } from '../../types/combat.ts'
import type { Rng } from '../../types/dice.ts'

/**
 * Reactions — the first thing in this engine that happens on somebody else's
 * turn.
 *
 * Everything before this was own-turn: a superiority die spent on your own
 * swing, an oath called before you move. A reaction has to interrupt an attack
 * that is already in flight, which is why it needed a seam rather than another
 * effect kind.
 *
 * Two SRD divergences, both deliberate:
 *
 *  - The prompt appears only when the attack *would land*. In the SRD you
 *    declare Warding Flare on the roll, before knowing the outcome. Offering it
 *    only on a hit removes the gamble — a beginner cannot burn their one
 *    reaction on a blow that was going to miss anyway. It makes the feature
 *    teachable at the cost of making it easier.
 *  - Uses are limited by the reaction itself (one per round) rather than the
 *    SRD's separate 1 + Wisdom modifier per long rest. There is one fight and
 *    no rests in this build, so a second pool would only ever read as a number
 *    that never moved.
 */

/** Whether this combatant has Warding Flare and a reaction left to spend. */
export function canWardingFlare(target: Combatant): boolean {
  return target.reactionAvailable === true
}

export interface FlareResult {
  /** The attack as it stands after the flare, ready to be applied. */
  outcome: AttackOutcome
  /** The second d20, so the log can show what the flare actually bought. */
  flareRoll: number
  /** The natural that ends up counting. */
  keptNatural: number
}

/**
 * Imposes disadvantage on an attack that has already been rolled.
 *
 * Rolls one more d20 and keeps the lower rather than re-rolling the whole
 * attack. Statistically identical to 2d20-keep-lowest, but the die the player
 * was just shown stays on screen — a flare that silently replaced a 15 with a
 * different number would read as the interface lying.
 *
 * Damage is re-rolled only when the verdict changes, because a hit that stays
 * a hit should not quietly become a different amount of damage.
 */
export function resolveWardingFlare(args: {
  attacker: Combatant
  target: Combatant
  attack: AttackAction
  outcome: AttackOutcome
  rng?: Rng
}): FlareResult {
  const { attacker, target, attack, outcome } = args
  const rng = args.rng ?? Math.random

  const original = outcome.breakdown.natural
  const second = roll('1d20', { rng })
  const flareRoll = second.groups[0]?.kept[0] ?? original
  const keptNatural = Math.min(original, flareRoll)

  // One implementation of what a natural means, shared with the roller.
  const crit = critFor(keptNatural, attacker.critOn)
  const bonus = outcome.breakdown.total - original
  const total = keptNatural + bonus

  const breakdown = { ...outcome.breakdown, natural: keptNatural, total }

  if (crit === 'fumble') {
    return { outcome: { kind: 'fumble', breakdown, attackRoll: outcome.attackRoll }, flareRoll, keptNatural }
  }

  const landed = crit === 'hit' || total >= target.ac
  if (!landed) {
    return { outcome: { kind: 'miss', breakdown, attackRoll: outcome.attackRoll }, flareRoll, keptNatural }
  }

  // Still landing. Keep the damage already rolled unless the flare turned an
  // ordinary hit into a critical, which cannot happen by lowering a die — so in
  // practice this branch only ever reuses what was rolled.
  const base = damageNotation(attack, attacker.scores)
  const damageRoll =
    crit === 'hit' && outcome.kind !== 'crit'
      ? roll(toCriticalNotation(base), { rng })
      : outcome.kind === 'hit' || outcome.kind === 'crit'
        ? outcome.damageRoll
        : roll(base, { rng })

  return {
    outcome: {
      kind: crit === 'hit' ? 'crit' : 'hit',
      breakdown,
      attackRoll: outcome.attackRoll,
      damageRoll,
      damage: Math.max(0, damageRoll.total),
    },
    flareRoll,
    keptNatural,
  }
}
