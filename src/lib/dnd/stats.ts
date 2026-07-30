import type { AbilityName, AbilityScores, SkillName } from '../../types/character.ts'

export const ABILITY_NAMES: readonly AbilityName[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export const ABILITY_LABELS: Record<AbilityName, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

export const SKILL_ABILITY: Record<SkillName, AbilityName> = {
  acrobatics: 'dex',
  animalHandling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleightOfHand: 'dex',
  stealth: 'dex',
  survival: 'wis',
}

export const SKILL_LABELS: Record<SkillName, string> = {
  acrobatics: 'Acrobatics',
  animalHandling: 'Animal Handling',
  arcana: 'Arcana',
  athletics: 'Athletics',
  deception: 'Deception',
  history: 'History',
  insight: 'Insight',
  intimidation: 'Intimidation',
  investigation: 'Investigation',
  medicine: 'Medicine',
  nature: 'Nature',
  perception: 'Perception',
  performance: 'Performance',
  persuasion: 'Persuasion',
  religion: 'Religion',
  sleightOfHand: 'Sleight of Hand',
  stealth: 'Stealth',
  survival: 'Survival',
}

/** SRD: a score of 10-11 is average (+0); every 2 points above or below shifts the modifier by 1. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function abilityModifiers(scores: AbilityScores): Record<AbilityName, number> {
  return {
    str: abilityModifier(scores.str),
    dex: abilityModifier(scores.dex),
    con: abilityModifier(scores.con),
    int: abilityModifier(scores.int),
    wis: abilityModifier(scores.wis),
    cha: abilityModifier(scores.cha),
  }
}

/** SRD: +2 at levels 1-4, then +1 every 4 levels, reaching +6 at level 17-20. */
export function proficiencyBonus(level: number): number {
  const clamped = Math.min(20, Math.max(1, Math.floor(level)))
  return 2 + Math.floor((clamped - 1) / 4)
}

export function skillBonus(
  scores: AbilityScores,
  skill: SkillName,
  level: number,
  proficientSkills: readonly SkillName[],
): number {
  const base = abilityModifier(scores[SKILL_ABILITY[skill]])
  return proficientSkills.includes(skill) ? base + proficiencyBonus(level) : base
}

export function passiveScore(bonus: number): number {
  return 10 + bonus
}

/** Renders a bonus the way a character sheet does: "+3", "-1", "+0". */
export function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}
