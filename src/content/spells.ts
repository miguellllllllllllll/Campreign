import type { AttackAction } from '../types/action.ts'

/**
 * The 5e SRD spell registry for 1st-level casters.
 *
 * Schools include Enchantment because Bless is an Enchantment spell. Naming it
 * anything else would teach a beginner the wrong school, and this file is the
 * only place the app states what school a spell belongs to.
 */
export type SpellSchool =
  | 'Abjuration'
  | 'Conjuration'
  | 'Divination'
  | 'Enchantment'
  | 'Evocation'
  | 'Necromancy'
  | 'Transmutation'

export interface Spell {
  id: string
  name: string
  /** 0 is a cantrip, which never runs out; 1 costs a spell slot. */
  level: 0 | 1
  school: SpellSchool
  classes: readonly ('wizard' | 'cleric')[]
  /** Range in feet with the grid equivalent, since the game is played on squares. */
  range: string
  damageOrEffect: string
  /** One or two sentences, written for someone who has never cast a spell. */
  description: string
  isConcentration: boolean
  /**
   * Present only when the spell is aimed with an attack roll, so it can become a
   * real button in combat. Save-based spells (Burning Hands) and auto-hit spells
   * (Magic Missile) deliberately have none.
   */
  attack?: AttackAction
}

export const SPELLS: readonly Spell[] = [
  // --- Wizard cantrips ----------------------------------------------------
  {
    id: 'fireBolt',
    name: 'Fire Bolt',
    level: 0,
    school: 'Evocation',
    classes: ['wizard'],
    range: '120 ft (24 squares)',
    damageOrEffect: '1d10 Fire',
    description:
      'You hurl a mote of fire at something you can see. It is your reliable attack — it costs nothing and you can use it every turn, forever.',
    isConcentration: false,
    attack: {
      id: 'fireBolt',
      name: 'Fire Bolt',
      kind: 'spell',
      ability: 'int',
      proficient: true,
      damage: '1d10',
      damageType: 'fire',
      addAbilityToDamage: false,
      ranged: true,
      rangeSquares: 24,
      description: 'A dart of flame. Roll to hit, then roll 1d10 fire damage.',
    },
  },
  {
    id: 'rayOfFrost',
    name: 'Ray of Frost',
    level: 0,
    school: 'Evocation',
    classes: ['wizard'],
    range: '60 ft (12 squares)',
    damageOrEffect: '1d8 Cold, slows target',
    description:
      'A freezing beam that hurts and slows. Slightly less damage than Fire Bolt, but the target moves 10 feet slower until your next turn.',
    isConcentration: false,
    attack: {
      id: 'rayOfFrost',
      name: 'Ray of Frost',
      kind: 'spell',
      ability: 'int',
      proficient: true,
      damage: '1d8',
      damageType: 'cold',
      addAbilityToDamage: false,
      ranged: true,
      rangeSquares: 12,
      description: 'A freezing beam. Roll to hit, then roll 1d8 cold damage.',
    },
  },
  {
    id: 'mageHand',
    name: 'Mage Hand',
    level: 0,
    school: 'Conjuration',
    classes: ['wizard'],
    range: '30 ft (6 squares)',
    damageOrEffect: 'Utility — a floating hand',
    description:
      'A spectral hand appears and does simple jobs for you: pull a lever, fetch a key, open an unlocked door from across the room. It cannot attack.',
    isConcentration: false,
  },
  {
    id: 'light',
    name: 'Light',
    level: 0,
    school: 'Evocation',
    // On both the wizard and cleric SRD lists, so either class may take it.
    classes: ['wizard', 'cleric'],
    range: 'Touch',
    damageOrEffect: 'Utility — 20 ft of bright light',
    description:
      'You touch an object and it glows like a torch for an hour. Unglamorous and constantly useful, because dungeons are dark.',
    isConcentration: false,
  },

  // --- Wizard 1st-level ---------------------------------------------------
  {
    id: 'magicMissile',
    name: 'Magic Missile',
    level: 1,
    school: 'Evocation',
    classes: ['wizard'],
    range: '120 ft (24 squares)',
    damageOrEffect: '3 darts, 1d4+1 Force each',
    description:
      'Three darts of light streak out and hit automatically — there is no attack roll to miss with. The safest way to finish something off.',
    isConcentration: false,
  },
  {
    id: 'mageArmor',
    name: 'Mage Armor',
    level: 1,
    school: 'Abjuration',
    classes: ['wizard'],
    range: 'Touch',
    damageOrEffect: 'AC becomes 13 + Dex',
    description:
      'Invisible force sheathes you for eight hours. Wizards cannot wear real armour, so this is how you stop being so easy to hit.',
    isConcentration: false,
  },
  {
    id: 'shield',
    name: 'Shield',
    level: 1,
    school: 'Abjuration',
    classes: ['wizard'],
    range: 'Self',
    damageOrEffect: '+5 AC until your next turn',
    description:
      'Cast the instant an enemy swings at you, and their attack may suddenly miss. It is a reaction, so it does not use up your turn.',
    isConcentration: false,
  },
  {
    id: 'burningHands',
    name: 'Burning Hands',
    level: 1,
    school: 'Evocation',
    classes: ['wizard'],
    range: 'Self (15 ft cone)',
    damageOrEffect: '3d6 Fire, Dex save',
    description:
      'Flame sheets from your fingertips across everything in front of you. There is no attack roll — enemies roll to dodge instead, and take half damage if they do.',
    isConcentration: false,
  },

  // --- Cleric cantrips ----------------------------------------------------
  {
    id: 'sacredFlame',
    name: 'Sacred Flame',
    level: 0,
    school: 'Evocation',
    classes: ['cleric'],
    range: '60 ft (12 squares)',
    damageOrEffect: '1d8 Radiant',
    description:
      'Light lances down onto an enemy. Cover does not help them hide from it, which makes it dependable in an awkward fight.',
    isConcentration: false,
    attack: {
      id: 'sacredFlame',
      name: 'Sacred Flame',
      kind: 'spell',
      ability: 'wis',
      proficient: true,
      damage: '1d8',
      damageType: 'radiant',
      addAbilityToDamage: false,
      ranged: true,
      rangeSquares: 12,
      description: 'Divine light from above. Roll to hit, then roll 1d8 radiant damage.',
    },
  },
  {
    id: 'guidance',
    name: 'Guidance',
    level: 0,
    school: 'Divination',
    classes: ['cleric'],
    range: 'Touch',
    damageOrEffect: '+1d4 to one ability check',
    description:
      'You bless an ally about to attempt something difficult, and they add 1d4 to the roll. Small, but it turns near-misses into successes.',
    isConcentration: true,
  },
  {
    id: 'thaumaturgy',
    name: 'Thaumaturgy',
    level: 0,
    school: 'Transmutation',
    classes: ['cleric'],
    range: '30 ft (6 squares)',
    damageOrEffect: 'Utility — a minor wonder',
    description:
      'Your voice booms, flames flicker, or the ground trembles slightly. No damage at all — this is for frightening people into listening to you.',
    isConcentration: false,
  },
  {
    id: 'spareTheDying',
    name: 'Spare the Dying',
    level: 0,
    school: 'Necromancy',
    classes: ['cleric'],
    range: 'Touch',
    damageOrEffect: 'Stabilises a dying creature',
    description:
      'Touch someone who has dropped to 0 hit points and they stop slipping away. It restores no hit points, but it stops them dying.',
    isConcentration: false,
  },

  // --- Cleric 1st-level ---------------------------------------------------
  {
    id: 'cureWounds',
    name: 'Cure Wounds',
    level: 1,
    school: 'Evocation',
    classes: ['cleric'],
    range: 'Touch',
    damageOrEffect: '1d8 + Wis Healing',
    description:
      'Lay a hand on a wounded ally and knit them back together. The single most valuable thing a level 1 party can have.',
    isConcentration: false,
  },
  {
    id: 'bless',
    name: 'Bless',
    level: 1,
    school: 'Enchantment',
    classes: ['cleric'],
    range: '30 ft (6 squares)',
    damageOrEffect: '+1d4 to attacks and saves, 3 allies',
    description:
      'Three allies add 1d4 to every attack roll and saving throw for a minute. You must keep concentrating, so do not get hit hard.',
    isConcentration: true,
  },
  {
    id: 'guidingBolt',
    name: 'Guiding Bolt',
    level: 1,
    school: 'Evocation',
    classes: ['cleric'],
    range: '120 ft (24 squares)',
    damageOrEffect: '4d6 Radiant, then advantage',
    description:
      'A searing beam that hurts badly and leaves the target glowing, so the next attack against them has advantage. Excellent for setting up an ally.',
    isConcentration: false,
    attack: {
      id: 'guidingBolt',
      name: 'Guiding Bolt',
      kind: 'spell',
      ability: 'wis',
      proficient: true,
      damage: '4d6',
      damageType: 'radiant',
      addAbilityToDamage: false,
      ranged: true,
      rangeSquares: 24,
      description: 'A brilliant beam. Roll to hit, then roll 4d6 radiant damage.',
    },
  },
  {
    id: 'shieldOfFaith',
    name: 'Shield of Faith',
    level: 1,
    school: 'Abjuration',
    classes: ['cleric'],
    range: '60 ft (12 squares)',
    damageOrEffect: '+2 AC to one ally',
    description:
      'A shimmering field follows an ally, making them harder to hit for ten minutes. Put it on whoever is standing at the front.',
    isConcentration: true,
  },
]

/** Lookup by id. Built once, because the picker resolves ids on every render. */
export const SPELLS_BY_ID: Readonly<Record<string, Spell>> = Object.fromEntries(
  SPELLS.map((spell) => [spell.id, spell]),
)

export function spellsFor(classId: 'wizard' | 'cleric', level: 0 | 1): readonly Spell[] {
  return SPELLS.filter((spell) => spell.classes.includes(classId) && spell.level === level)
}

/** Resolves ids to spells, dropping any id the registry does not know. */
export function spellsByIds(ids: readonly string[]): readonly Spell[] {
  return ids.map((id) => SPELLS_BY_ID[id]).filter((spell): spell is Spell => spell !== undefined)
}
