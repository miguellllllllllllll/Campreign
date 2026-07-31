import type { AttackAction } from './action.ts'
import type { AbilityName, AbilityScores } from './character.ts'
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
  /**
   * First-level spell slots left. Absent for anyone who never had any, so a
   * fighter is not carrying a zero around.
   */
  spellSlots?: number
  /** Prepared spell ids this combatant may still cast from. */
  preparedSpells?: string[]
  /** The ability that powers this combatant's magic, for healing maths. */
  castingAbility?: AbilityName
  /** Arcane Ward buffer. Absent means the ward has never been raised. */
  arcaneWardHp?: number
  /**
   * True once this combatant has finished a turn in this encounter. Distinct
   * from the encounter's `hasActed`, which resets every turn — this one never
   * goes back to false.
   */
  hasActedThisCombat?: boolean
  /** Whether this combatant strikes with advantage on their opening turn. */
  hasAmbush?: boolean
  /** Potions still unopened. */
  potions?: number
  /** Whether using an item costs this combatant a bonus action instead. */
  hasFastHands?: boolean
  /**
   * Whether this combatant's one reaction is still unspent this round. Absent
   * means they have nothing to react with, which is everyone without a feature
   * that uses one — so no caller has to ask what subclass somebody is.
   */
  reactionAvailable?: boolean
  initiative: number
}

/**
 * An attack that has been rolled but not yet committed, held while the target
 * decides whether to spend a reaction on it.
 *
 * Lives on the Encounter rather than in the store so the pause is part of the
 * pure value everything else is tested against. There is deliberately no `id`:
 * the engine never invents identity, and at most one attack is ever pending.
 */
export interface PendingReaction {
  kind: 'wardingFlare'
  attackerId: string
  targetId: string
  attackId: string
  /** What happens if the reaction is passed — already rolled, not yet applied. */
  outcome: AttackOutcome
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
