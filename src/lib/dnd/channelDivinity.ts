import { abilityModifier } from './stats.ts'
import type {
  ActiveChannelDivinity,
  ChannelDivinityType,
  Combatant,
} from '../../types/combat.ts'

/**
 * Channel Divinity — the paladin's once-per-rest oath power.
 *
 * Own-turn activations, like a superiority die and unlike a reaction: you
 * spend the charge on your own turn and it changes your later rolls. That is
 * the entire reason this could be built before the turn loop learns to pause.
 *
 * Two SRD divergences, both deliberate and both in service of a level 1 board:
 *
 *  - Channel Divinity is a 3rd-level feature. So is the subclass that grants
 *    it, and this build already offers subclasses at 1 for the same reason:
 *    level 1 is the only level there is here.
 *  - Both effects last "1 minute" in the SRD, which is ten rounds. The tutorial
 *    fight is shorter than that, so they last the encounter. A duration that
 *    can never expire in practice is better modelled as one that does not.
 */

/** Charges a 1st-level paladin has. One, restored on a rest. */
export const CHANNEL_DIVINITY_CHARGES_AT_LEVEL_1 = 1

/** Whether there is a charge left to spend. */
export function canChannelDivinity(
  combatant: Pick<Combatant, 'channelDivinityCharges'>,
): boolean {
  return (combatant.channelDivinityCharges ?? 0) > 0
}

/**
 * Sacred Weapon's attack bonus: Charisma, floored at +1.
 *
 * The floor is the SRD's, and it matters here — a paladin built off Strength
 * can have a Charisma modifier of 0, and a Channel Divinity charge that bought
 * nothing at all would read as a bug rather than a build choice.
 */
export function sacredWeaponBonus(scores: Combatant['scores']): number {
  return Math.max(1, abilityModifier(scores.cha))
}

/**
 * The attack bonus an active Channel Divinity is worth against this target.
 * Vow of Enmity is worth no bonus — it buys advantage instead.
 */
export function channelDivinityAttackBonus(attacker: Combatant): number {
  return attacker.activeChannelDivinity?.type === 'sacredWeapon'
    ? sacredWeaponBonus(attacker.scores)
    : 0
}

/** Whether the sworn foe is the one being swung at. */
export function hasVowAgainst(attacker: Combatant, targetId: string): boolean {
  const active = attacker.activeChannelDivinity
  return active?.type === 'vowOfEnmity' && active.targetId === targetId
}

export type { ActiveChannelDivinity, ChannelDivinityType }

export interface ChannelResult {
  chargesRemaining: number
  active: ActiveChannelDivinity
}

/**
 * Spends a charge. Pure: takes the current count and hands back the new one,
 * so nothing here needs to know where the combatant is stored.
 *
 * The caller is responsible for refusing when `canChannelDivinity` is false;
 * the floor at zero only stops a miscount becoming a negative pool.
 */
export function spendChannelDivinity(
  combatant: Pick<Combatant, 'channelDivinityCharges'>,
  type: ChannelDivinityType,
  targetId?: string,
): ChannelResult {
  return {
    chargesRemaining: Math.max(0, (combatant.channelDivinityCharges ?? 0) - 1),
    active: { type, ...(targetId === undefined ? {} : { targetId }) },
  }
}
