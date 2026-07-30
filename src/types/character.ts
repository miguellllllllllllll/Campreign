import type { AttackAction } from './action.ts'

export type AbilityName = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export type AbilityScores = Record<AbilityName, number>

export type ClassId = 'fighter' | 'wizard' | 'rogue' | 'cleric'

export type RaceId = 'dwarf' | 'elf' | 'human' | 'halfling'

export type MotivationId = 'glory' | 'secrets' | 'protect' | 'fortune'

export interface CreationAnswers {
  classId: ClassId
  raceId: RaceId
  motivationId: MotivationId
}

export type SkillName =
  | 'acrobatics'
  | 'animalHandling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleightOfHand'
  | 'stealth'
  | 'survival'

export interface Character {
  id: string
  name: string
  createdAt: number
  level: number
  classId: ClassId
  raceId: RaceId
  motivationId: MotivationId
  scores: AbilityScores
  maxHp: number
  currentHp: number
  speedFeet: number
  ac: number
  armorName: string
  hasShield: boolean
  proficiencyBonus: number
  skillProficiencies: SkillName[]
  savingThrows: AbilityName[]
  attacks: AttackAction[]
  /** One-sentence story summary built from the three creation answers. */
  blurb: string
}
