import { hasSlot, spendSlot } from './slots.ts'
import type { Combatant } from '../../types/combat.ts'
import type { ClassId } from '../../types/character.ts'
import type { Rng } from '../../types/dice.ts'
import type { DiceRoll } from '../../types/dice.ts'
import { roll } from './dice.ts'

/**
 * Divine Smite — burning a spell slot to make a blow land like judgement.
 *
 * This exists because of a hole I put in the game. Paladins gain spellcasting
 * at 2nd level, so levelling one hands them two spell slots — and there are no
 * paladin spells in the registry at all. The slots arrived with nothing to
 * spend them on, which is the same inert-resource failure this codebase keeps
 * catching, and it shipped.
 *
 * Smite is the honest fix rather than a stopgap. It is what a paladin actually
 * spends slots on at a real table — they hoard them for this instead of
 * casting — so the mechanic makes the grant meaningful without needing a spell
 * list first.
 */

/** 2d8 for a 1st-level slot, which is the only tier this build has. */
export const SMITE_DICE = '2d8'

/** The SRD's extra die against the undead. There is a skeleton on the board. */
export const SMITE_UNDEAD_BONUS_DIE = '1d8'

export interface SmiteResult {
  /** The caster, one slot poorer. */
  attacker: Combatant
  damage: number
  damageRoll: DiceRoll
  /** True when the target's undead-ness added a die. */
  againstUndead: boolean
}

/**
 * Whether this class has learned to smite at this level.
 *
 * A flag rather than a class check at the call site, for the same reason
 * `actionSurges` is a number: the board should not have to ask what somebody is.
 */
export function hasDivineSmiteAt(classId: ClassId, level: number): boolean {
  return classId === 'paladin' && level >= 2
}

/**
 * Whether there is a slot left to burn, *and* something to burn it with.
 *
 * Both halves matter. Clerics and wizards have slots too, and gating on slots
 * alone put the button on their bar. Gating on the paladin's *oath* was worse
 * and is what this replaces: it is a subclass, so a paladin who skipped
 * advanced options got the slots and no way to spend them — the very hole this
 * module exists to fill, reopened for the players most likely to be beginners.
 */
/**
 * Smite burns a first-level slot, and only a first-level one.
 *
 * The SRD lets a paladin smite with any slot for more dice. That is a real
 * choice and a second prompt mid-attack, which is the shape this slice
 * deliberately avoided when reactions were built — so it spends the cheapest
 * slot and says so.
 */
export const SMITE_SLOT_LEVEL = 1

export function canSmite(combatant: Pick<Combatant, 'spellSlots' | 'hasDivineSmite'>): boolean {
  return combatant.hasDivineSmite === true && hasSlot(combatant.spellSlots, SMITE_SLOT_LEVEL)
}

/**
 * Rolls the radiant damage and spends the slot.
 *
 * Only ever called on a blow that has already landed — a smite on a miss costs
 * the slot for nothing in the SRD too, but this build follows the Trip Attack
 * precedent beside it: declared before the swing, spent only if it connects.
 * A second prompt in the middle of an attack is the reaction-shaped problem
 * that machinery exists to avoid.
 */
export function resolveSmite(args: {
  attacker: Combatant
  target: Pick<Combatant, 'undead'>
  rng?: Rng
}): SmiteResult {
  const againstUndead = args.target.undead === true
  const notation = againstUndead ? `${SMITE_DICE}+${SMITE_UNDEAD_BONUS_DIE}` : SMITE_DICE
  const damageRoll = roll(notation, { rng: args.rng ?? Math.random })

  return {
    attacker: {
      ...args.attacker,
      spellSlots: spendSlot(args.attacker.spellSlots, SMITE_SLOT_LEVEL),
    },
    damage: Math.max(0, damageRoll.total),
    damageRoll,
    againstUndead,
  }
}

/** How it reads in the combat log. */
export function narrateSmite(result: SmiteResult, targetName: string): string {
  return (
    `Divine Smite: ${result.damage} radiant damage on top`
    + (result.againstUndead ? `, and ${targetName} is undead — an extra die.` : '.')
  )
}
