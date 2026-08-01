import type { AttackAction } from '../../types/action.ts'
import type {
  AbilityName,
  AbilityScores,
  AuraId,
  BackgroundId,
  ClassId,
  Cosmetics,
  EquipmentChoice,
  Personality,
  RaceId,
  SkillName,
  Trinket,
} from '../../types/character.ts'
import type { Armor } from '../../types/items.ts'

export const ARMORS: Record<string, Armor> = {
  none: { id: 'none', name: 'No Armor', category: 'none', baseAc: 10, dexCap: null },
  leather: { id: 'leather', name: 'Leather Armor', category: 'light', baseAc: 11, dexCap: null },
  studdedLeather: {
    id: 'studdedLeather',
    name: 'Studded Leather',
    category: 'light',
    baseAc: 12,
    dexCap: null,
  },
  scaleMail: { id: 'scaleMail', name: 'Scale Mail', category: 'medium', baseAc: 14, dexCap: 2 },
  chainMail: { id: 'chainMail', name: 'Chain Mail', category: 'heavy', baseAc: 16, dexCap: 0 },
  // Not worn but cast: a wizard has no armour proficiency, so their only way to
  // an armour class is the spell, which lasts eight hours and covers a fight.
  mageArmor: { id: 'mageArmor', name: 'Mage Armour', category: 'none', baseAc: 13, dexCap: null },
}

/**
 * One half of a class's equipment fork. It owns the armour and the weapons that
 * come with the choice, so armour class is derived from the pick rather than
 * patched on afterwards.
 */
export interface LoadoutOption {
  id: EquipmentChoice
  label: string
  description: string
  armorId: string
  hasShield: boolean
  /** Weapons this choice hands you, on top of the class's base attacks. */
  attacks: AttackAction[]
}

export interface ClassSpellcasting {
  ability: AbilityName
  /** Shown when the class has the numbers before it has the spells. */
  note?: string
}

export interface ClassPreset {
  id: ClassId
  /** The plain-English answer the player actually picks. */
  label: string
  tagline: string
  description: string
  hitDie: number
  scores: AbilityScores
  savingThrows: AbilityName[]
  skillProficiencies: SkillName[]
  /** Attacks you keep whichever loadout you choose. */
  attacks: AttackAction[]
  loadouts: Record<EquipmentChoice, LoadoutOption>
  spellcasting?: ClassSpellcasting
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
    savingThrows: ['str', 'con'],
    skillProficiencies: ['athletics', 'perception'],
    attacks: [
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
    loadouts: {
      defensive: {
        id: 'defensive',
        label: 'Longsword & Shield',
        description:
          'The shield is worth two points of Armour Class, which means roughly one attack in ten stops landing on you.',
        armorId: 'chainMail',
        hasShield: true,
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
        ],
      },
      offensive: {
        id: 'offensive',
        label: 'Greatsword',
        description:
          'Two hands on the hilt and no shield. You roll two dice for damage instead of one, and you take more hits doing it.',
        armorId: 'chainMail',
        hasShield: false,
        attacks: [
          {
            id: 'greatsword',
            name: 'Greatsword',
            kind: 'weapon',
            ability: 'str',
            proficient: true,
            damage: '2d6',
            damageType: 'slashing',
            addAbilityToDamage: true,
            ranged: false,
            rangeSquares: 1,
            description: 'A two-handed cleave that hits far harder than a one-handed blade.',
          },
        ],
      },
    },
  },
  wizard: {
    id: 'wizard',
    label: 'Spellcaster',
    tagline: 'Fragile body, devastating mind.',
    description:
      'You solve problems with magic and knowledge. You hit hard from a distance, but you cannot take many hits yourself.',
    hitDie: 6,
    scores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    savingThrows: ['int', 'wis'],
    skillProficiencies: ['arcana', 'investigation'],
    // Fire Bolt is no longer granted here: cantrips are chosen in creation, so
    // handing one over for free would put a spell on the sheet nobody picked.
    attacks: [
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
    loadouts: {
      defensive: {
        id: 'defensive',
        label: 'Mage Armour',
        description:
          'You have no armour training at all, so you conjure your own: an invisible shell that lasts eight hours and covers the whole fight.',
        armorId: 'mageArmor',
        hasShield: false,
        attacks: [],
      },
      offensive: {
        id: 'offensive',
        label: 'Light Crossbow',
        description:
          'No shell, but a real weapon in your hands for the turns you would rather not spend a spell.',
        armorId: 'none',
        hasShield: false,
        attacks: [
          {
            id: 'lightCrossbow',
            name: 'Light Crossbow',
            kind: 'weapon',
            ability: 'dex',
            proficient: true,
            damage: '1d8',
            damageType: 'piercing',
            addAbilityToDamage: true,
            ranged: true,
            rangeSquares: 8,
            description: 'A cranked bolt that does not care how weak your arms are.',
          },
        ],
      },
    },
    spellcasting: {
      ability: 'int',
    },
  },
  rogue: {
    id: 'rogue',
    label: 'Stealthy Assassin',
    tagline: 'Strike from the shadows, vanish before they turn.',
    description:
      'You avoid fair fights. You are quick, quiet, and very good at hitting the one spot that matters.',
    hitDie: 8,
    scores: { str: 8, dex: 15, con: 14, int: 12, wis: 13, cha: 10 },
    savingThrows: ['dex', 'int'],
    skillProficiencies: ['stealth', 'sleightOfHand', 'perception'],
    attacks: [
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
    loadouts: {
      defensive: {
        id: 'defensive',
        label: 'Studded Leather & Shortsword',
        description:
          'Rivets sewn through the hide. One more point of Armour Class than plain leather, and nothing slows you down.',
        armorId: 'studdedLeather',
        hasShield: false,
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
        ],
      },
      offensive: {
        id: 'offensive',
        label: 'Rapier & Leather',
        description:
          'A duelling blade with a bigger damage die, worn over lighter hide. You hit harder and get hit more.',
        armorId: 'leather',
        hasShield: false,
        attacks: [
          {
            id: 'rapier',
            name: 'Rapier',
            kind: 'weapon',
            ability: 'dex',
            proficient: true,
            damage: '1d8',
            damageType: 'piercing',
            addAbilityToDamage: true,
            ranged: false,
            rangeSquares: 1,
            description: 'A needle-pointed thrust that rewards precision over muscle.',
          },
        ],
      },
    },
  },
  cleric: {
    id: 'cleric',
    label: 'Healing Protector',
    tagline: 'Keep everyone alive, including yourself.',
    description:
      'You channel divine power to shield your allies and burn your enemies. Sturdy armour and useful magic.',
    hitDie: 8,
    scores: { str: 13, dex: 8, con: 14, int: 10, wis: 15, cha: 12 },
    savingThrows: ['wis', 'cha'],
    skillProficiencies: ['medicine', 'insight'],
    // No class attack: a cleric's offensive magic is whichever cantrip they
    // chose, and their weapon comes from the loadout.
    attacks: [],
    loadouts: {
      defensive: {
        id: 'defensive',
        label: 'Mace & Shield',
        description:
          'A shield bearing your holy symbol. Two points of Armour Class, and a free hand is not something you need.',
        armorId: 'scaleMail',
        hasShield: true,
        attacks: [
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
      offensive: {
        id: 'offensive',
        label: 'Spear, Two-Handed',
        description:
          'Both hands on the shaft trades the shield for a bigger damage die and a little more reach.',
        armorId: 'scaleMail',
        hasShield: false,
        attacks: [
          {
            id: 'spear',
            name: 'Spear',
            kind: 'weapon',
            ability: 'str',
            proficient: true,
            damage: '1d8',
            damageType: 'piercing',
            addAbilityToDamage: true,
            ranged: false,
            rangeSquares: 1,
            description: 'A braced thrust that keeps enemies at the end of the shaft.',
          },
        ],
      },
    },
    spellcasting: {
      ability: 'wis',
    },
  },
  paladin: {
    id: 'paladin',
    label: 'Oathsworn Champion',
    tagline: 'A sworn word, heavy armour, and no step backward.',
    description:
      'You made a promise out loud and the world holds you to it. You fight like a warrior and carry the beginnings of divine power.',
    hitDie: 10,
    scores: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 },
    savingThrows: ['wis', 'cha'],
    skillProficiencies: ['athletics', 'religion'],
    attacks: [
      {
        id: 'javelin',
        name: 'Javelin',
        kind: 'weapon',
        ability: 'str',
        proficient: true,
        damage: '1d6',
        damageType: 'piercing',
        addAbilityToDamage: true,
        ranged: true,
        rangeSquares: 6,
        description: 'A thrown shaft for the enemy you cannot reach yet.',
      },
    ],
    loadouts: {
      defensive: {
        id: 'defensive',
        label: 'Longsword & Shield',
        description:
          'The classic oath-keeper: a blade in one hand, your emblem strapped to the other, and two more points of Armour Class.',
        armorId: 'chainMail',
        hasShield: true,
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
        ],
      },
      offensive: {
        id: 'offensive',
        label: 'Greatsword',
        description:
          'The oath does not say anything about hiding behind a shield. Two damage dice instead of one.',
        armorId: 'chainMail',
        hasShield: false,
        attacks: [
          {
            id: 'greatsword',
            name: 'Greatsword',
            kind: 'weapon',
            ability: 'str',
            proficient: true,
            damage: '2d6',
            damageType: 'slashing',
            addAbilityToDamage: true,
            ranged: false,
            rangeSquares: 1,
            description: 'A two-handed cleave that hits far harder than a one-handed blade.',
          },
        ],
      },
    },
    spellcasting: {
      ability: 'cha',
      // SRD paladins gain spellcasting at 2nd level. The numbers are already
      // fixed by Charisma, so they are shown now and the spell list is not.
      note: 'Your oath already sets these numbers. Paladins learn their first spells at level 2.',
    },
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
  tiefling: {
    id: 'tiefling',
    label: 'Infernal Tiefling',
    tagline: 'Horns, a tail, and an inheritance nobody asked for.',
    bonuses: { cha: 2, int: 1 },
    speedFeet: 30,
    trait: 'Infernal blood — fire hurts you less, and nobody forgets your face.',
  },
}

export interface BackgroundFlaw {
  id: string
  /** Written in the first person, because the player is admitting to it. */
  text: string
}

/**
 * Weaknesses anyone can own, whatever they did before this.
 *
 * Each background keeps its own three, because "I owe money to people who hurt
 * debtors" is a noble's problem and reads as one. But a flaw is pure
 * personality — nothing mechanical hangs off it — so there is no reason a
 * street urchin cannot also be a coward, or a soldier vain.
 *
 * The point is the arithmetic. Three backgrounds with three flaws apiece gave
 * nine possible people. Six backgrounds with three of their own plus these
 * eight gives sixty-six, and none of them needed a new mechanic.
 */
export const UNIVERSAL_FLAWS: readonly BackgroundFlaw[] = [
  { id: 'coward', text: 'I talk a great deal about courage and have never once tested mine.' },
  { id: 'liar', text: 'I lie when the truth would do, out of habit rather than need.' },
  { id: 'grudge', text: 'I have never forgiven anything, and I remember all of it.' },
  { id: 'reckless', text: 'I would rather do something stupid than stand still and think.' },
  { id: 'greedy', text: 'I have turned down help because there was no coin in it.' },
  { id: 'lonely', text: 'I push people away first, so that I am the one who left.' },
  { id: 'stubborn', text: 'Once I have said a thing out loud I will not take it back, ever.' },
  { id: 'haunted', text: 'Somebody died because I was slow, and I have told nobody.' },
]

export interface BackgroundPreset {
  id: BackgroundId
  label: string
  tagline: string
  description: string
  /** The two skills the SRD background trains. */
  skills: SkillName[]
  trinket: Trinket
  ideal: string
  bond: string
  flaws: readonly BackgroundFlaw[]
  /** Tail of the character's one-line summary. */
  blurb: string
}

export const BACKGROUND_PRESETS: Record<BackgroundId, BackgroundPreset> = {
  guildArtisan: {
    id: 'guildArtisan',
    label: 'Guild Artisan',
    tagline: 'You made things for a living before you started breaking them.',
    description:
      'A trade, a workshop, and a guild that expects its dues. You read people across a counter and talk prices without blinking.',
    skills: ['insight', 'persuasion'],
    trinket: {
      name: 'Tarnished guild seal',
      description:
        'A brass stamp with your maker’s mark. Pressed into wax, it still opens doors in three cities.',
    },
    ideal: 'Work honestly done outlasts the person who did it.',
    bond: 'The guild took you in when nobody else would. That debt is not settled.',
    flaws: [
      { id: 'haggler', text: 'I cannot let a price stand without arguing it down first.' },
      { id: 'perfectionist', text: 'Shoddy work offends me more than cruelty does.' },
      { id: 'proud', text: 'I talk about my craft long past the point anyone is listening.' },
    ],
    blurb: 'trading a workshop for a road',
  },
  streetUrchin: {
    id: 'streetUrchin',
    label: 'Street Urchin',
    tagline: 'You grew up small, hungry, and faster than everyone chasing you.',
    description:
      'No family, no coin, and a map of the city in your head. You know which windows are unlatched and which alleys have two exits.',
    skills: ['sleightOfHand', 'stealth'],
    trinket: {
      name: 'Rat-chewed rooftop map',
      description:
        'Charcoal on scraped hide, marking every gutter you ever slept in. Half of it is out of date.',
    },
    ideal: 'Nobody gets left in the gutter while I have anything to share.',
    bond: 'The other children of your alley are your only family. You still send them coin.',
    flaws: [
      { id: 'hoarder', text: 'I pocket anything small and shiny, whether or not I need it.' },
      { id: 'suspicious', text: 'I assume kindness is a trick and wait for the price.' },
      { id: 'runner', text: 'When things go wrong my first instinct is to run, not to help.' },
    ],
    blurb: 'climbing up out of the gutters',
  },
  noble: {
    id: 'noble',
    label: 'Noble',
    tagline: 'You were somebody once, and you have the ring to prove it.',
    description:
      'A name with weight, a family with enemies, and an education most people never get. You know how power is arranged and who owes whom.',
    skills: ['history', 'persuasion'],
    trinket: {
      name: 'Signet ring of a fallen house',
      description:
        'Gold worn thin at the crest. Some people bow when they see it; others reach for a knife.',
    },
    ideal: 'Rank is a duty owed downward, not a privilege claimed upward.',
    bond: 'Your family’s name was ruined. You intend to make it mean something again.',
    flaws: [
      { id: 'entitled', text: 'I expect to be obeyed, and I am rude when I am not.' },
      { id: 'appearances', text: 'I would rather be admired than be right.' },
      { id: 'debtor', text: 'I owe money to people who hurt debtors, and I have not told anyone.' },
    ],
    blurb: 'carrying a ruined name back into the light',
  },

  acolyte: {
    id: 'acolyte',
    label: 'Acolyte',
    tagline: 'You kept a temple, and it kept you.',
    description:
      'You swept the floors and learned the words, and somewhere in the repetition you started meaning them. You are used to people bringing you their worst news.',
    skills: ['insight', 'religion'],
    trinket: {
      name: 'A prayer book with a broken spine',
      description: 'Held together with thread. You know which pages fall out.',
    },
    ideal: 'What is broken can be mended, including people.',
    bond: 'The temple that raised you is still standing, and you owe it more than you have paid.',
    flaws: [
      { id: 'judging', text: 'I decide what people are worth within a minute of meeting them.' },
      { id: 'literal', text: 'I quote scripture at people who wanted comfort, not a citation.' },
      { id: 'doubting', text: 'I have stopped believing and cannot admit it to anyone.' },
    ],
    blurb: 'raised in a temple and still counting the hours by its bells',
  },

  soldier: {
    id: 'soldier',
    label: 'Soldier',
    tagline: 'You have done this before, for worse reasons.',
    description:
      'Somebody paid you to stand in a line and hold it. You are calm about things that frighten other people and strange about things that do not.',
    skills: ['athletics', 'intimidation'],
    trinket: {
      name: 'A rank insignia you no longer have the right to wear',
      description: 'You keep it in a pocket rather than on your chest.',
    },
    ideal: 'The line holds because somebody decides to hold it.',
    bond: 'The people you served with are scattered, and you would still go for any of them.',
    flaws: [
      { id: 'orders', text: 'I follow an order before I have worked out whether it was a good one.' },
      { id: 'flinching', text: 'Loud noises put me somewhere else for a second, and I cannot stop it.' },
      { id: 'hardened', text: 'I am comfortable with violence in a way that unsettles people.' },
    ],
    blurb: 'a soldier who is still deciding what to be instead',
  },

  outlander: {
    id: 'outlander',
    label: 'Outlander',
    tagline: 'Towns are the strange place, not the wild.',
    description:
      'You grew up where the weather was the only authority. You read ground and sky the way other people read faces, and you find rooms exhausting.',
    skills: ['athletics', 'survival'],
    trinket: {
      name: 'A stone from the last river you crossed going the other way',
      description: 'Smooth, dull, and the only thing you took with you.',
    },
    ideal: 'The land does not lie to you, which is more than most people manage.',
    bond: 'There is a valley you have not gone back to, and you will have to eventually.',
    flaws: [
      { id: 'blunt', text: 'I say the true thing at the moment it will do the most damage.' },
      { id: 'restless', text: 'I cannot stay under a roof for long without needing to be outside.' },
      { id: 'distrustful', text: 'I assume anyone comfortable in a town is soft, and I show it.' },
    ],
    blurb: 'more at home in weather than in company',
  }
}

export interface AuraPreset {
  id: AuraId
  label: string
  tagline: string
  cosmetics: Cosmetics
}

/**
 * Token colours as raw hex, not theme variables, so the values can be dropped
 * straight into an inline style on a map token or a preview sigil.
 */
export const AURA_PRESETS: Record<AuraId, AuraPreset> = {
  amber: {
    id: 'amber',
    label: 'Amber Torchlight',
    tagline: 'The colour of the room you are standing in.',
    cosmetics: { auraColor: '#d4af37', tokenBorder: '#c5a059' },
  },
  violet: {
    id: 'violet',
    label: 'Violet Arcana',
    tagline: 'Spell-light, the shade that makes people step back.',
    cosmetics: { auraColor: '#9b6bd6', tokenBorder: '#6d45a6' },
  },
  crimson: {
    id: 'crimson',
    label: 'Crimson Oath',
    tagline: 'Blood and banners. Subtlety is not the point.',
    cosmetics: { auraColor: '#c0463b', tokenBorder: '#8e2f27' },
  },
  azure: {
    id: 'azure',
    label: 'Azure Frost',
    tagline: 'Cold, clear, and quiet as deep water.',
    cosmetics: { auraColor: '#4a9bd4', tokenBorder: '#2c6f9e' },
  },
}

/** The full personality, with the one flaw the player owned up to. */
/** Every weakness this background can be paired with: its own, then anyone's. */
export function flawsFor(background: BackgroundPreset): readonly BackgroundFlaw[] {
  return [...background.flaws, ...UNIVERSAL_FLAWS]
}

/**
 * The longest weakness the sheet will accept.
 *
 * Matches the ceiling on the creation field rather than trusting it: the field
 * is content and could be edited, a saved draft could predate a change to it,
 * and the printed sheet has a fixed amount of room either way.
 */
export const MAX_WRITTEN_FLAW = 140

export function personalityOf(
  background: BackgroundPreset,
  flawId: string,
  /** What the player typed instead, if they typed anything. */
  written?: string,
): Personality {
  /*
   * A written weakness wins over a picked one, because typing it is the more
   * deliberate act — and clearing the box is how you take it back, which only
   * works if empty means "fall through" rather than "empty flaw".
   */
  const typed = written?.trim() ?? ''
  if (typed.length > 0) {
    return {
      ideal: background.ideal,
      flaw: typed.slice(0, MAX_WRITTEN_FLAW),
      bond: background.bond,
    }
  }

  // Looked up across both pools, because a flaw is no longer necessarily one
  // this background brought with it.
  const flaw = flawsFor(background).find((candidate) => candidate.id === flawId)
  return {
    ideal: background.ideal,
    flaw: flaw?.text ?? background.flaws[0]?.text ?? '',
    bond: background.bond,
  }
}
