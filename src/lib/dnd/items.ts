import type { Combatant } from '../../types/combat.ts'

/**
 * The one usable item in the game.
 *
 * A count on the sheet rather than an inventory: a Thief's Fast Hands needs
 * something worth doing with a bonus action, and one consumable is the least
 * that makes the feature real. An inventory system would be a lot of machinery
 * to justify a single potion.
 */

/** SRD Potion of Healing. Rolled rather than flat — this app teaches dice. */
export const POTION_OF_HEALING = '2d4+2'

export const POTION_LABEL = 'Potion of Healing'

/** Everyone walks in with one. */
export const STARTING_POTIONS = 1

export type ActionCost = 'action' | 'bonusAction'

/**
 * What drinking a potion costs this combatant.
 *
 * The whole of Fast Hands: for a Thief it is a bonus action, so they can drink
 * and still swing; for everybody else it is the turn's action, and drinking
 * means not attacking. Returning the cost rather than a boolean keeps the
 * decision in one place instead of spread across the caller.
 */
export function resolveItemUseCost(combatant: Pick<Combatant, 'hasFastHands'>): ActionCost {
  return combatant.hasFastHands === true ? 'bonusAction' : 'action'
}

/** Whether there is a potion left to drink. */
export function hasPotion(combatant: Pick<Combatant, 'potions'>): boolean {
  return (combatant.potions ?? 0) > 0
}
