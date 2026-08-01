import type { AttackAction } from '../types/action.ts'
import type { AbilityName } from '../types/character.ts'
import type { DamageType } from '../types/items.ts'
import type { ConditionId } from '../types/combat.ts'

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

/**
 * What a spell does, in terms the engine can act on.
 *
 * `damageOrEffect` beside it is prose for the player and always has been —
 * "1d8 + Wis Healing" is a label, not something to parse. A spell without an
 * effect here simply cannot be cast yet, which is how Bless and Burning Hands
 * stay honestly out of reach rather than half-working.
 */
export type SpellEffect =
  | { kind: 'heal'; dice: string; addsAbility: boolean }
  /**
   * Aimed with an attack roll, using the `attack` on the spell beside this.
   * The rider is a condition rather than a bespoke flag, because conditions
   * already feed the roll mode and already expire on the round tick.
   */
  | { kind: 'spellAttack'; conditionOnHit?: ConditionId; conditionRounds?: number }
  /** Cast in reaction to something, never on your own turn. */
  | { kind: 'reactionSpell' }
  /**
   * Hits without an attack roll. Each dart is rolled separately, because the
   * SRD rolls them separately and three 1d4+1 is a different distribution from
   * one 3d4+3 — narrower, and a beginner watching the numbers should see the
   * shape the rules actually produce.
   */
  | { kind: 'autoHit'; darts: number; dice: string; damageType: DamageType }
  /** Lands on your own side and holds until concentration breaks. */
  | { kind: 'blessAllies'; maxTargets: number }
  /**
   * Everything within `radiusSquares` of the caster rolls a save.
   *
   * A burst rather than the SRD's cone: aiming one would need a facing step,
   * and on a 5x5 board with a single enemy the two select the same squares.
   * Documented here because it is a real simplification, not an oversight.
   */
  | {
      kind: 'aoeSave'
      dice: string
      saveAbility: AbilityName
      damageType: DamageType
      radiusSquares: number
      /** SRD: a successful save still takes half. */
      halfOnSuccess: boolean
    }
  /** Replaces the AC formula outright, as Mage Armor does. */
  | { kind: 'setAc'; base: number; addsDex: boolean }
  /**
   * Stops a dying creature slipping away, restoring nothing. The only spell
   * here whose whole worth is a number that stops changing.
   */
  | { kind: 'stabilise' }
  /**
   * Lends a die to the next ability check, and is spent by it.
   *
   * The only effect here that happens entirely outside a fight. Ability checks
   * live in exploration and conversation, so this one has no meaning on a board
   * and no Combatant to hang off — which is why casting it needed a route that
   * did not go through `castSpell`.
   */
  | { kind: 'guideCheck'; die: string }
  /**
   * Lays a condition on one target and concentrates to keep it there.
   * The condition carries the effect, so losing the spell takes it back.
   */
  | { kind: 'wardTarget'; condition: ConditionId }

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
   * What casting it costs on your turn. Absent means an action, which is almost
   * every spell — declared only by the handful the SRD makes faster.
   *
   * This is the whole point of Healing Word existing beside Cure Wounds: one
   * costs your turn and heals more, the other is a bonus action at range so you
   * can pick somebody up *and* still swing. Without a cost to spend, the two
   * would just be a bigger die and a smaller one.
   */
  castingCost?: 'action' | 'bonusAction'
  /** Present when the engine can resolve this spell; absent means not yet. */
  effect?: SpellEffect
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
    effect: { kind: 'autoHit', darts: 3, dice: '1d4+1', damageType: 'force' },
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
    effect: { kind: 'setAc', base: 13, addsDex: true },
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
    effect: { kind: 'reactionSpell' },
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
    effect: {
      kind: 'aoeSave',
      dice: '3d6',
      saveAbility: 'dex',
      damageType: 'fire',
      radiusSquares: 3,
      halfOnSuccess: true,
    },
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
    effect: { kind: 'guideCheck', die: '1d4' },
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
    effect: { kind: 'stabilise' },
  },

  // --- Cleric 1st-level ---------------------------------------------------
  {
    id: 'healingWord',
    name: 'Healing Word',
    level: 1,
    school: 'Evocation',
    classes: ['cleric'],
    range: '60 ft (12 squares)',
    damageOrEffect: '1d4 + Wis Healing, as a bonus action',
    description:
      'A shouted word of power that closes a wound from across the room. It mends less than Cure Wounds, and it costs you only a moment — so you can heal a friend and still swing this turn.',
    isConcentration: false,
    castingCost: 'bonusAction',
    effect: { kind: 'heal', dice: '1d4', addsAbility: true },
  },
  {
    id: 'inflictWounds',
    name: 'Inflict Wounds',
    level: 1,
    school: 'Necromancy',
    classes: ['cleric'],
    range: 'Touch',
    damageOrEffect: '3d10 Necrotic',
    description:
      'You put a hand on something and pull the life out of it. The biggest hit a first-level caster can land, and you have to be close enough to touch to do it.',
    isConcentration: false,
    attack: {
      id: 'inflictWounds',
      name: 'Inflict Wounds',
      kind: 'spell',
      ability: 'wis',
      proficient: true,
      damage: '3d10',
      damageType: 'necrotic',
      addAbilityToDamage: false,
      ranged: false,
      rangeSquares: 1,
      description: 'A touch that withers. Enormous damage, at arm\u2019s length.',
    },
    effect: { kind: 'spellAttack' },
  },
  {
    id: 'cureWounds',
    name: 'Cure Wounds',
    level: 1,
    school: 'Evocation',
    classes: ['cleric'],
    range: 'Touch',
    damageOrEffect: '1d8 + Wis Healing',
    effect: { kind: 'heal', dice: '1d8', addsAbility: true },
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
    effect: { kind: 'blessAllies', maxTargets: 3 },
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
    // The glow lasts a round, so the attack it helps is the next one made.
    effect: { kind: 'spellAttack', conditionOnHit: 'dazzled', conditionRounds: 1 },
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
    effect: { kind: 'wardTarget', condition: 'warded' },
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
