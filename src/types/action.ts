import type { AbilityName } from './character.ts'
import type { DamageType } from './items.ts'

export type ActionKind = 'weapon' | 'spell'

/**
 * A second roll the *target* makes once a blow has already landed.
 *
 * The venom in a spider's bite, and the first thing in this engine that asks a
 * player to roll defensively on somebody else's turn. Every save until now was
 * rolled by an enemy against a spell the player cast; this one points the other
 * way, which is what makes it worth teaching.
 *
 * Optional on `AttackAction`, so every weapon, cantrip and monster attack that
 * existed before carries on with no rider and no change.
 */
export interface OnHitSave {
  ability: AbilityName
  dc: number
  /** Rolled separately from the weapon damage, because the SRD rolls it separately. */
  damage: string
  damageType: DamageType
  /** SRD: venom already in the wound still does half to somebody who resists it. */
  halfOnSuccess: boolean
}

export interface AttackAction {
  id: string
  name: string
  kind: ActionKind
  /** Which ability score powers the attack roll. */
  ability: AbilityName
  proficient: boolean
  damage: string
  damageType: DamageType
  /** Cantrips add no ability modifier to damage at 1st level; weapons do. */
  addAbilityToDamage: boolean
  ranged: boolean
  /** Reach in grid squares — 1 is adjacent. */
  rangeSquares: number
  /** Plain-English description for a player who has never attacked before. */
  description: string
  /** A save the target rolls after this lands. Absent for almost everything. */
  onHitSave?: OnHitSave
}
