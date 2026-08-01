import type { Combatant } from '../../types/combat.ts'
import type { ClassId } from '../../types/character.ts'

/**
 * Cunning Action — the rogue's 2nd-level feature, as much of it as this board
 * can hold.
 *
 * The SRD gives Dash, Disengage and Hide on a bonus action. Only Dash means
 * anything here: nothing on a five-square board threatens an opportunity attack,
 * so Disengage would be a button that changes no number, and there is nothing to
 * hide behind and no stealth contest to win. Shipping three options where two do
 * nothing would teach a beginner that two thirds of their class feature is
 * decoration.
 *
 * So it is Dash, named Dash, and the other two are written down as absent rather
 * than faked.
 */

/** Whether this class has learned it at this level. */
export function hasCunningActionAt(classId: ClassId, level: number): boolean {
  return classId === 'rogue' && level >= 2
}

/**
 * Whether dashing would buy anything right now.
 *
 * Needs the bonus action unspent, and needs the feature. Deliberately allowed
 * even at full movement: a rogue who has not moved yet may still want the whole
 * board open before they decide, and second-guessing that is not this
 * function's job.
 */
export function canDash(
  combatant: Pick<Combatant, 'hasCunningAction'>,
  bonusActionSpent: boolean,
): boolean {
  return combatant.hasCunningAction === true && !bonusActionSpent
}

/** How it reads in the combat log. */
export function narrateDash(name: string, squares: number): string {
  return `${name} dashes — ${squares} more ${squares === 1 ? 'square' : 'squares'} this turn.`
}
