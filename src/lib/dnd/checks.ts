import type { AbilityScores, SkillName } from '../../types/character.ts'
import type { RollPart } from '../../types/combat.ts'
import type { DiceRoll, Rng, RollMode } from '../../types/dice.ts'
import { roll } from './dice.ts'
import {
  abilityModifier,
  formatModifier,
  proficiencyBonus,
  SKILL_ABILITY,
  SKILL_LABELS,
} from './stats.ts'

export interface CheckBreakdown {
  natural: number
  parts: RollPart[]
  total: number
  dc: number
}

export interface CheckResult {
  skill: SkillName
  label: string
  breakdown: CheckBreakdown
  diceRoll: DiceRoll
  success: boolean
}

/** The die Guidance lends to a check. */
export const GUIDANCE_DIE = '1d4'

/**
 * A skill check: roll a d20, add the governing ability modifier, add
 * proficiency if trained, and compare against a Difficulty Class.
 */
export function resolveCheck(args: {
  scores: AbilityScores
  skill: SkillName
  level: number
  proficientSkills: readonly SkillName[]
  dc: number
  rng?: Rng
  mode?: RollMode
  /** Whether Guidance is being held on this character as the check is rolled. */
  guided?: boolean
}): CheckResult {
  const { scores, skill, level, proficientSkills, dc } = args
  const rng = args.rng ?? Math.random
  const ability = SKILL_ABILITY[skill]
  const abilityMod = abilityModifier(scores[ability])
  const proficient = proficientSkills.includes(skill)
  const bonus = abilityMod + (proficient ? proficiencyBonus(level) : 0)

  const diceRoll = roll(`1d20${formatModifier(bonus)}`, { rng, mode: args.mode ?? 'normal' })
  const natural = diceRoll.groups[0]?.kept[0] ?? 0

  /*
   * Rolled on its own die rather than appended to the notation, for the same
   * reason Bless is: "1d20+3+1d4" gives roll() two dice terms, isSingleD20 stops
   * recognising it, and advantage would quietly stop applying. A blessing that
   * cancelled your advantage would be a strange sort of blessing.
   */
  const guidance = args.guided === true ? roll(GUIDANCE_DIE, { rng }).total : 0

  const parts: RollPart[] = []
  if (abilityMod !== 0) parts.push({ label: ability.toUpperCase(), value: abilityMod })
  if (proficient) parts.push({ label: 'Prof', value: proficiencyBonus(level) })
  if (guidance !== 0) parts.push({ label: 'Guidance', value: guidance })

  const total = diceRoll.total + guidance

  return {
    skill,
    label: SKILL_LABELS[skill],
    breakdown: { natural, parts, total, dc },
    diceRoll,
    success: total >= dc,
  }
}
