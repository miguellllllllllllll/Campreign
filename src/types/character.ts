import type { AttackAction } from './action.ts'

export type AbilityName = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export type AbilityScores = Record<AbilityName, number>

export type ClassId = 'fighter' | 'wizard' | 'rogue' | 'cleric' | 'paladin'

export type RaceId = 'dwarf' | 'elf' | 'human' | 'halfling' | 'tiefling'

export type BackgroundId = 'guildArtisan' | 'streetUrchin' | 'noble'

/** Fight harder or survive longer — the fork every class loadout offers. */
export type EquipmentChoice = 'offensive' | 'defensive'

export type AuraId = 'amber' | 'violet' | 'crimson' | 'azure'

export interface CreationAnswers {
  classId: ClassId
  raceId: RaceId
  backgroundId: BackgroundId
  /** Which of the background's flaws the player owned up to. */
  flawId: string
  equipmentChoice: EquipmentChoice
  auraId: AuraId
  /**
   * The high-level magic style a caster picked. Only casters are asked, so it
   * stays optional; it seeds the two lists below rather than replacing them.
   */
  magicStyleId?: string
  /**
   * The spells actually taken. Written when a style is chosen and rewritten if
   * the player customises, so these — not the style — are the truth.
   */
  cantripIds?: readonly string[]
  preparedSpellIds?: readonly string[]
  /**
   * Whether the player opted into the advanced layer. The two questions below
   * are only asked when this is true, and both stay optional even then — an
   * advanced player is allowed to want a subclass and no feat.
   */
  advanced?: boolean
  subclassId?: string
  featId?: string
  /** Only asked when the chosen feat grants a cantrip. */
  magicInitiateSpellId?: string
}

/** Everything gathered so far, before the wizard is finished. */
export type CreationDraft = Partial<CreationAnswers>

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

/** A small keepsake from the character's old life. Flavour, not mechanics. */
export interface Trinket {
  name: string
  description: string
}

export interface Personality {
  ideal: string
  flaw: string
  bond: string
}

/** Raw CSS colours, so a token can be painted without importing the palette. */
export interface Cosmetics {
  auraColor: string
  tokenBorder: string
}

export interface Spellcasting {
  ability: AbilityName
  /** 8 + proficiency + the casting ability modifier. */
  saveDc: number
  attackBonus: number
  /** Set when the class has the numbers but not yet the spells. */
  note?: string
}

export interface Character {
  id: string
  name: string
  createdAt: number
  level: number
  classId: ClassId
  raceId: RaceId
  backgroundId: BackgroundId
  scores: AbilityScores
  maxHp: number
  currentHp: number
  speedFeet: number
  ac: number
  armorName: string
  hasShield: boolean
  equipmentChoice: EquipmentChoice
  /** The loadout's own name, e.g. "Longsword & Shield". */
  loadoutName: string
  proficiencyBonus: number
  skillProficiencies: SkillName[]
  savingThrows: AbilityName[]
  attacks: AttackAction[]
  trinket: Trinket
  personality: Personality
  cosmetics: Cosmetics
  spellcasting?: Spellcasting
  /** Cantrips never run out; prepared spells cost a slot. Absent for non-casters. */
  cantrips?: string[]
  preparedSpells?: string[]
  /** Which magic style produced the lists, kept so the sheet can name it. */
  magicStyleId?: string
  /**
   * Advanced-mode picks. Absent on every fast-track character, which is what
   * lets the whole feature stay opt-in: nothing downstream has to special-case
   * a beginner's sheet.
   */
  subclassId?: string
  featId?: string
  /** The cantrip Magic Initiate granted, kept so the sheet can name its source. */
  magicInitiateSpellId?: string
  /**
   * A flat bonus on top of Dexterity when initiative is rolled. Stored rather
   * than recomputed so combat never has to know what a feat is.
   */
  initiativeBonus?: number
  /**
   * The natural roll this character crits on. Absent means the ordinary 20, so
   * only a Champion carries it — and combat never has to know what a subclass is.
   */
  critOn?: number
  /** The full superiority-dice pool, restored on a long rest. Battle Master only. */
  superiorityDice?: number
  /** Channel Divinity charges, restored on a rest. Paladin oaths only. */
  channelDivinityCharges?: number
  /** One-sentence story summary built from the creation answers. */
  blurb: string
}
