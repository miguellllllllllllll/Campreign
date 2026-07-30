import type { AttackAction } from './action.ts'
import type { AbilityScores } from './character.ts'
import type { DiceRoll } from './dice.ts'

export type ConditionId =
  | 'poisoned'
  | 'prone'
  | 'frightened'
  | 'restrained'
  | 'blinded'
  | 'unconscious'

export interface ActiveCondition {
  id: ConditionId
  /** Rounds left before it wears off. null means it lasts until removed. */
  roundsRemaining: number | null
}

export type Team = 'party' | 'foes'

export interface GridPosition {
  x: number
  y: number
}

export interface Combatant {
  id: string
  name: string
  team: Team
  level: number
  scores: AbilityScores
  maxHp: number
  currentHp: number
  ac: number
  speedSquares: number
  position: GridPosition
  attacks: AttackAction[]
  conditions: ActiveCondition[]
  initiative: number
}

export interface RollPart {
  label: string
  value: number
}

export interface AttackBreakdown {
  /** The face shown on the d20 before any bonuses. */
  natural: number
  parts: RollPart[]
  total: number
  targetAc: number
}

export type AttackOutcome =
  | { kind: 'hit'; breakdown: AttackBreakdown; attackRoll: DiceRoll; damageRoll: DiceRoll; damage: number }
  | { kind: 'crit'; breakdown: AttackBreakdown; attackRoll: DiceRoll; damageRoll: DiceRoll; damage: number }
  | { kind: 'miss'; breakdown: AttackBreakdown; attackRoll: DiceRoll }
  | { kind: 'fumble'; breakdown: AttackBreakdown; attackRoll: DiceRoll }

export type TurnPhase = 'moving' | 'acted' | 'ended'
