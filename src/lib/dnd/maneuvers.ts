import { roll } from './dice.ts'
import { abilityModifier, formatModifier, proficiencyBonus } from './stats.ts'
import type { Rng, DiceRoll } from '../../types/dice.ts'
import type { Combatant, RollPart } from '../../types/combat.ts'
import type { AttackAction } from '../../types/action.ts'

/**
 * Battle Master manoeuvres.
 *
 * Everything here happens inside the player's own action — the die is spent on
 * an attack you are already making — which is the entire reason this could be
 * built before reactions exist. Riposte, which triggers on somebody else's
 * turn, cannot.
 *
 * Pure like the rest of `lib/dnd`: the pool comes in as a number and the new
 * pool goes out as one, so nothing here has to know where it is stored.
 */

/** The die a manoeuvre spends. One size at 3rd level in the SRD, and here. */
export const SUPERIORITY_DIE = 6

/** A 1st-level Battle Master's pool. Two dice, restored on a long rest. */
export const SUPERIORITY_DICE_AT_LEVEL_1 = 2

export interface ManeuverSave {
  natural: number
  total: number
  dc: number
  parts: RollPart[]
  success: boolean
}

export interface TripAttackResult {
  /** The extra damage die, already rolled. */
  bonusDamage: DiceRoll
  save: ManeuverSave
  /** True when the target failed and is knocked down. */
  knockedProne: boolean
  /** The pool after paying for this manoeuvre. */
  diceRemaining: number
}

/**
 * The DC a manoeuvre imposes: 8 + proficiency + the ability the attack itself
 * uses. A trip driven by a rapier is a Dexterity trip, which is what makes the
 * same manoeuvre read differently on a fighter and on a rogue.
 */
export function maneuverSaveDc(
  attacker: Pick<Combatant, 'scores' | 'level'>,
  attack: AttackAction,
): number {
  return 8 + proficiencyBonus(attacker.level) + abilityModifier(attacker.scores[attack.ability])
}

/** Whether a manoeuvre can be paid for at all. */
export function canSpendSuperiorityDie(combatant: Pick<Combatant, 'superiorityDice'>): boolean {
  return (combatant.superiorityDice ?? 0) > 0
}

/**
 * Trip Attack, resolved after a hit has already landed.
 *
 * Deliberately takes the hit as given rather than rolling the attack itself:
 * the SRD spends the die *after* you know you connected, and folding the two
 * together would spend a die on a miss.
 */
export function resolveTripAttack(args: {
  attacker: Combatant
  target: Combatant
  attack: AttackAction
  rng?: Rng
}): TripAttackResult {
  const { attacker, target, attack } = args
  const rng = args.rng ?? Math.random

  const bonusDamage = roll(`1d${SUPERIORITY_DIE}`, { rng })

  const dexMod = abilityModifier(target.scores.dex)
  const dc = maneuverSaveDc(attacker, attack)
  const saveRoll = roll(`1d20${formatModifier(dexMod)}`, { rng })
  const natural = saveRoll.groups[0]?.kept[0] ?? 0

  const parts: RollPart[] = []
  if (dexMod !== 0) parts.push({ label: 'DEX', value: dexMod })

  const success = saveRoll.total >= dc

  return {
    bonusDamage,
    save: { natural, total: saveRoll.total, dc, parts, success },
    knockedProne: !success,
    // Math.max guards the pool against ever going negative if a caller spends
    // without checking; the refusal path in the encounter is the real gate.
    diceRemaining: Math.max(0, (attacker.superiorityDice ?? 0) - 1),
  }
}
