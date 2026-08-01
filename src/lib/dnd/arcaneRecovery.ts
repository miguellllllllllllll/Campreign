import type { ClassId } from '../../types/character.ts'
import type { SpellSlots } from './slots.ts'

/**
 * Arcane Recovery — the wizard's 2nd-level feature, and the reason a rest is
 * no longer a free refill.
 *
 * It could not exist as written. The rest between the two fights restored every
 * spell slot to everybody, so "take a short rest and get a slot back" described
 * something the game already did for free, for every class. A feature is not a
 * feature if not having it costs nothing.
 *
 * So the rest is a real short rest now: hit points come back, spells do not.
 * That is the SRD's rule, it is a lesson worth teaching — the thing you spend
 * in the first fight is gone in the second — and it is what gives this feature
 * something to be.
 *
 * Safe to do because the second encounter was already measured without any
 * spells at all: three thousand runs of a cleric casting nothing won 90% of
 * them. Nobody is being pushed off a cliff; they are being given a decision.
 */

/**
 * Slot levels a wizard can recover on a rest: half their level, rounded up.
 *
 * The SRD's formula, and at the levels this build reaches it means one slot at
 * 2nd and 3rd. Returns 0 for everyone else, which is every other class.
 */
export function arcaneRecoveryBudget(classId: ClassId, level: number): number {
  if (classId !== 'wizard' || level < 2) return 0
  return Math.ceil(level / 2)
}

/**
 * Puts slots back, cheapest first, until the budget runs out.
 *
 * Lowest level first is deliberate: recovering a 1st-level slot for one point
 * of budget beats saving up for a 2nd, and a beginner should not have to work
 * that out to get the good outcome. The SRD lets you choose; here the choice
 * has one sensible answer and no interface worth spending on it.
 */
export function recoverSlots(
  current: SpellSlots | undefined,
  full: SpellSlots | undefined,
  budget: number,
): SpellSlots | undefined {
  if (current === undefined || full === undefined || budget <= 0) return current

  const next = [...current]
  let left = budget
  for (let level = 1; level < full.length && left > 0; level += 1) {
    const missing = (full[level] ?? 0) - (next[level] ?? 0)
    // Each slot costs its own level out of the budget, per the SRD.
    const affordable = Math.min(missing, Math.floor(left / level))
    if (affordable > 0) {
      next[level] = (next[level] ?? 0) + affordable
      left -= affordable * level
    }
  }
  return next
}

/** How the rest reads when a wizard gets something back and nobody else does. */
export function narrateRecovery(recovered: number): string {
  return recovered === 1
    ? 'Arcane Recovery: one spell slot back, from reading rather than resting.'
    : `Arcane Recovery: ${recovered} spell slots back, from reading rather than resting.`
}
