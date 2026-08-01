import type { Combatant } from '../../types/combat.ts'
import type { ClassId } from '../../types/character.ts'

/**
 * Action Surge — a second action, once between rests.
 *
 * The fighter's 2nd-level feature, and the first level-up gift in this build
 * that is a *verb* rather than a bigger number. Hit points and spell slots make
 * you last longer; this changes what a turn can contain, which is the thing a
 * player actually feels.
 *
 * Deliberately not a bonus action. The SRD's Action Surge gives you a whole
 * extra action, and the distinction matters here: a bonus action could not be
 * spent on an attack, so folding it into that budget would quietly turn the
 * feature into something else.
 */

/** One surge at 2nd level. A second arrives at 17th, which is far past the cap. */
export const ACTION_SURGES_AT_LEVEL_2 = 1

/** How many surges this class has at this level, or none. */
export function actionSurgesFor(classId: ClassId, level: number): number | undefined {
  if (classId !== 'fighter' || level < 2) return undefined
  return ACTION_SURGES_AT_LEVEL_2
}

/**
 * Whether surging would actually buy anything right now.
 *
 * Requires the action to be spent already. Offering it beforehand would let a
 * player burn their once-per-rest resource to get back an action they still
 * had — a button whose best use is never pressing it is a trap, not a choice.
 */
export function canActionSurge(
  combatant: Pick<Combatant, 'actionSurges'>,
  hasActed: boolean,
): boolean {
  return hasActed && (combatant.actionSurges ?? 0) > 0
}

/** Spends one, leaving the combatant otherwise untouched. */
export function spendActionSurge(combatant: Combatant): Combatant {
  const left = combatant.actionSurges ?? 0
  if (left <= 0) return combatant
  return { ...combatant, actionSurges: left - 1 }
}

/** How it reads in the combat log. */
export function narrateActionSurge(name: string, surgesLeft: number): string {
  return (
    `${name} surges — a second action, right now. `
    + (surgesLeft > 0
      ? `${surgesLeft} left before a rest.`
      : 'That was the one, until they rest.')
  )
}
