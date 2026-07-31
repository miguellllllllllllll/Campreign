import { roll } from './dice.ts'
import { abilityModifier, formatModifier } from './stats.ts'
import { removeConditionsFrom } from './conditions.ts'
import type { Combatant } from '../../types/combat.ts'
import type { Rng } from '../../types/dice.ts'

/**
 * Concentration — holding a spell together while somebody hits you.
 *
 * The rule that makes Bless a decision rather than a free bonus: you get one,
 * taking damage can cost you it, and casting a second drops the first.
 *
 * Deliberately partial, and the boundary is worth stating. Only Bless
 * participates. Shield of Faith and Mage Armor are concentration and duration
 * spells in the SRD, and here they set an Armour Class and leave it set for the
 * fight — they were written that way before concentration existed and undoing a
 * changed AC is a different piece of work from removing a condition. Wiring
 * them in without that would mean a broken concentration silently failing to
 * take back the armour it granted, which is worse than not claiming it.
 */

/** The floor on a concentration save, whatever the damage. */
export const CONCENTRATION_BASE_DC = 10

/** SRD: DC 10, or half the damage taken, whichever is higher. */
export function concentrationDc(damage: number): number {
  return Math.max(CONCENTRATION_BASE_DC, Math.floor(Math.max(0, damage) / 2))
}

export interface ConcentrationCheck {
  dc: number
  total: number
  held: boolean
}

/**
 * A Constitution save to keep hold of a spell after taking a hit.
 *
 * Returns the roll as well as the verdict so the log can show the player why
 * they lost it, which is the only way the rule teaches anything.
 */
export function checkConcentration(args: {
  caster: Combatant
  damage: number
  rng?: Rng
}): ConcentrationCheck {
  const { caster, damage } = args
  const rng = args.rng ?? Math.random

  const dc = concentrationDc(damage)
  const save = roll(`1d20${formatModifier(abilityModifier(caster.scores.con))}`, { rng })

  return { dc, total: save.total, held: save.total >= dc }
}

/**
 * Ends a caster's concentration and strips what it was holding up.
 *
 * Conditions carry the id of whoever applied them, so a second cleric's
 * blessing survives the first one's concentration breaking.
 */
export function dropConcentration(
  casterId: string,
  combatants: Record<string, Combatant>,
): Record<string, Combatant> {
  return Object.fromEntries(
    Object.entries(combatants).map(([id, combatant]) => [
      id,
      {
        ...combatant,
        conditions: removeConditionsFrom(combatant.conditions, 'blessed', casterId),
        ...(id === casterId ? { concentratingOn: undefined } : {}),
      },
    ]),
  )
}
