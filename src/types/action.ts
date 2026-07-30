import type { AbilityName } from './character.ts'
import type { DamageType } from './items.ts'

export type ActionKind = 'weapon' | 'spell'

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
}
