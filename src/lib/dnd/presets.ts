import type { AttackAction } from '../../types/action.ts'
import type {
  AbilityName,
  AbilityScores,
  ClassId,
  MotivationId,
  RaceId,
  SkillName,
} from '../../types/character.ts'
import type { Armor } from '../../types/items.ts'

export const ARMORS: Record<string, Armor> = {
  none: { id: 'none', name: 'No Armor', category: 'none', baseAc: 10, dexCap: null },
  leather: { id: 'leather', name: 'Leather Armor', category: 'light', baseAc: 11, dexCap: null },
  scaleMail: { id: 'scaleMail', name: 'Scale Mail', category: 'medium', baseAc: 14, dexCap: 2 },
  chainMail: { id: 'chainMail', name: 'Chain Mail', category: 'heavy', baseAc: 16, dexCap: 0 },
}

export interface ClassPreset {
  id: ClassId
  /** The plain-English answer the player actually picks. */
  label: string
  tagline: string
  description: string
  hitDie: number
  scores: AbilityScores
  armorId: string
  hasShield: boolean
  savingThrows: AbilityName[]
  skillProficiencies: SkillName[]
  attacks: AttackAction[]
}

export const CLASS_PRESETS: Record<ClassId, ClassPreset> = {
  fighter: {
    id: 'fighter',
    label: 'Frontline Warrior',
    tagline: 'Stand in front. Hit things. Stay standing.',
    description:
      'You wade into danger in heavy armour and trust your sword arm. The easiest place to start — you are hard to hurt and your attacks are simple.',
    hitDie: 10,
    scores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    armorId: 'chainMail',
    hasShield: false,
    savingThrows: ['str', 'con'],
    skillProficiencies: ['athletics', 'perception'],
    attacks: [
      {
        id: 'longsword',
        name: 'Longsword',
        kind: 'weapon',
        ability: 'str',
        proficient: true,
        damage: '1d8',
        damageType: 'slashing',
        addAbilityToDamage: true,
        ranged: false,
        rangeSquares: 1,
        description: 'A heavy swing at someone standing right next to you.',
      },
      {
        id: 'handaxeThrow',
        name: 'Thrown Handaxe',
        kind: 'weapon',
        ability: 'str',
        proficient: true,
        damage: '1d6',
        damageType: 'slashing',
        addAbilityToDamage: true,
        ranged: true,
        rangeSquares: 4,
        description: 'Hurl an axe at an enemy across the room.',
      },
    ],
  },
  wizard: {
    id: 'wizard',
    label: 'Spellcaster',
    tagline: 'Fragile body, devastating mind.',
    description:
      'You solve problems with magic and knowledge. You hit hard from a distance, but you cannot take many hits yourself.',
    hitDie: 6,
    scores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    armorId: 'none',
    hasShield: false,
    savingThrows: ['int', 'wis'],
    skillProficiencies: ['arcana', 'investigation'],
    attacks: [
      {
        id: 'fireBolt',
        name: 'Fire Bolt',
        kind: 'spell',
        ability: 'int',
        proficient: true,
        damage: '1d10',
        damageType: 'fire',
        addAbilityToDamage: false,
        ranged: true,
        rangeSquares: 8,
        description: 'Fling a mote of fire at anything you can see.',
      },
      {
        id: 'quarterstaff',
        name: 'Quarterstaff',
        kind: 'weapon',
        ability: 'str',
        proficient: true,
        damage: '1d6',
        damageType: 'bludgeoning',
        addAbilityToDamage: true,
        ranged: false,
        rangeSquares: 1,
        description: 'A desperate whack when something gets too close.',
      },
    ],
  },
  rogue: {
    id: 'rogue',
    label: 'Stealthy Assassin',
    tagline: 'Strike from the shadows, vanish before they turn.',
    description:
      'You avoid fair fights. You are quick, quiet, and very good at hitting the one spot that matters.',
    hitDie: 8,
    scores: { str: 8, dex: 15, con: 14, int: 12, wis: 13, cha: 10 },
    armorId: 'leather',
    hasShield: false,
    savingThrows: ['dex', 'int'],
    skillProficiencies: ['stealth', 'sleightOfHand', 'perception'],
    attacks: [
      {
        id: 'shortsword',
        name: 'Shortsword',
        kind: 'weapon',
        ability: 'dex',
        proficient: true,
        damage: '1d6',
        damageType: 'piercing',
        addAbilityToDamage: true,
        ranged: false,
        rangeSquares: 1,
        description: 'A fast, precise stab at an adjacent enemy.',
      },
      {
        id: 'shortbow',
        name: 'Shortbow',
        kind: 'weapon',
        ability: 'dex',
        proficient: true,
        damage: '1d6',
        damageType: 'piercing',
        addAbilityToDamage: true,
        ranged: true,
        rangeSquares: 8,
        description: 'Put an arrow in something from a safe distance.',
      },
    ],
  },
  cleric: {
    id: 'cleric',
    label: 'Healing Protector',
    tagline: 'Keep everyone alive, including yourself.',
    description:
      'You channel divine power to shield your allies and burn your enemies. Sturdy armour and useful magic.',
    hitDie: 8,
    scores: { str: 13, dex: 8, con: 14, int: 10, wis: 15, cha: 12 },
    armorId: 'scaleMail',
    hasShield: true,
    savingThrows: ['wis', 'cha'],
    skillProficiencies: ['medicine', 'insight'],
    attacks: [
      {
        id: 'sacredFlame',
        name: 'Sacred Flame',
        kind: 'spell',
        ability: 'wis',
        proficient: true,
        damage: '1d8',
        damageType: 'radiant',
        addAbilityToDamage: false,
        ranged: true,
        rangeSquares: 8,
        description: 'Call down a column of holy fire on a foe.',
      },
      {
        id: 'mace',
        name: 'Mace',
        kind: 'weapon',
        ability: 'str',
        proficient: true,
        damage: '1d6',
        damageType: 'bludgeoning',
        addAbilityToDamage: true,
        ranged: false,
        rangeSquares: 1,
        description: 'A solid bludgeon for enemies within arm’s reach.',
      },
    ],
  },
}

export interface RacePreset {
  id: RaceId
  label: string
  tagline: string
  bonuses: Partial<AbilityScores>
  speedFeet: number
  trait: string
}

export const RACE_PRESETS: Record<RaceId, RacePreset> = {
  dwarf: {
    id: 'dwarf',
    label: 'Sturdy Dwarf',
    tagline: 'Short, stubborn, and very hard to knock over.',
    bonuses: { con: 2 },
    speedFeet: 25,
    trait: 'Tougher than you look — extra Constitution means more hit points.',
  },
  elf: {
    id: 'elf',
    label: 'Agile Elf',
    tagline: 'Graceful, sharp-eyed, and quick on your feet.',
    bonuses: { dex: 2 },
    speedFeet: 30,
    trait: 'Keen senses — extra Dexterity helps you dodge and shoot.',
  },
  human: {
    id: 'human',
    label: 'Adaptable Human',
    tagline: 'Good at a bit of everything.',
    bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speedFeet: 30,
    trait: 'Well-rounded — a small bonus to every single ability.',
  },
  halfling: {
    id: 'halfling',
    label: 'Lucky Halfling',
    tagline: 'Small, cheerful, and improbably fortunate.',
    bonuses: { dex: 2, cha: 1 },
    speedFeet: 25,
    trait: 'Nimble and charming — hard to catch and easy to like.',
  },
}

export interface MotivationPreset {
  id: MotivationId
  label: string
  tagline: string
  /** The narrative choice buys one extra trained skill. */
  skill: SkillName
  blurb: string
}

export const MOTIVATION_PRESETS: Record<MotivationId, MotivationPreset> = {
  glory: {
    id: 'glory',
    label: 'Seeking Glory',
    tagline: 'You want your name in every song.',
    skill: 'intimidation',
    blurb: 'chasing a name worth singing about',
  },
  secrets: {
    id: 'secrets',
    label: 'Uncovering Secrets',
    tagline: 'Somebody is hiding something, and you intend to find it.',
    skill: 'investigation',
    blurb: 'hunting a truth someone buried',
  },
  protect: {
    id: 'protect',
    label: 'Protecting the Weak',
    tagline: 'You stand between danger and the people who cannot fight.',
    skill: 'insight',
    blurb: 'standing between danger and the defenceless',
  },
  fortune: {
    id: 'fortune',
    label: 'Chasing Fortune',
    tagline: 'There is gold down there, and it is not going to carry itself.',
    skill: 'persuasion',
    blurb: 'following the smell of gold',
  },
}
