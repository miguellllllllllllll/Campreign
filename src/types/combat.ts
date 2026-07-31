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
  /**
   * Added to the initiative roll on top of Dexterity. Optional so every existing
   * combatant — monsters, the practice dummy, a fast-track hero — keeps rolling
   * exactly as it did before feats existed.
   */
  initiativeBonus?: number
  /**
   * The natural roll this combatant crits on. Absent means 20, which is
   * everyone except a Champion.
   */
  critOn?: number
  /**
   * Superiority dice still unspent this fight. Absent for everyone who is not a
   * Battle Master, which is how a manoeuvre stays unavailable without any
   * caller having to ask what subclass someone is.
   */
  superiorityDice?: number
  /** Channel Divinity charges left, and the pool they came from. Paladins only. */
  channelDivinityCharges?: number
  channelDivinityMax?: number
  /** The oath power currently running, for the rest of this encounter. */
  activeChannelDivinity?: ActiveChannelDivinity
  initiative: number
}

/** The paladin oath powers, named here so combat types stay self-contained. */
export type ChannelDivinityType = 'sacredWeapon' | 'vowOfEnmity'

export interface ActiveChannelDivinity {
  type: ChannelDivinityType
  /** Only Vow of Enmity names a victim; Sacred Weapon buffs every swing. */
  targetId?: string
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
