import { SUPERIORITY_DICE_AT_LEVEL_1 } from '../lib/dnd/maneuvers.ts'
import { CHANNEL_DIVINITY_CHARGES_AT_LEVEL_1 } from '../lib/dnd/channelDivinity.ts'
import type { ChannelDivinityType } from '../types/combat.ts'
import type { ClassId } from '../types/character.ts'

/**
 * Subclass specialisations, offered at level 1 behind the advanced toggle.
 *
 * This is a deliberate divergence from the SRD, which hands most classes their
 * subclass at level 3. A level 1 character here has nowhere else to express a
 * playstyle, and the alternative — showing the choice greyed out until a level
 * that does not exist in this build — teaches nothing.
 *
 * Every feature states plainly whether it is wired up. `active: false` means the
 * combat engine has no primitive for it yet (reactions, superiority dice, and
 * area-of-effect targeting are all absent), so the feature is printed on the
 * sheet as flavour and nothing reads it during a fight. Saying so in data keeps
 * the UI from having to guess, and keeps a half-built feature from quietly
 * looking finished.
 */
export interface SubclassFeature {
  name: string
  description: string
  /** True only when the rules engine genuinely applies this today. */
  active: boolean
  /** Why it is not wired yet — shown to the player rather than hidden. */
  pending?: string
}

/**
 * A subclass effect the rules engine genuinely applies. Present only where
 * `feature.active` is true; a union rather than a bag of optional numbers so
 * adding a second kind forces every reader to handle it.
 */
export type SubclassEffect =
  | { kind: 'castHook'; power: 'discipleOfLife' | 'arcaneWard' }
  | { kind: 'reaction'; power: 'wardingFlare' }
  | { kind: 'critOn'; value: number }
  | { kind: 'superiorityDice'; count: number }
  | { kind: 'channelDivinity'; charges: number; power: ChannelDivinityType }

export interface Subclass {
  id: string
  classId: ClassId
  label: string
  tagline: string
  /** The playstyle this points at, in the game's voice. */
  description: string
  feature: SubclassFeature
  effect?: SubclassEffect
}

export const SUBCLASSES: readonly Subclass[] = [
  // --- Fighter --------------------------------------------------------------
  {
    id: 'champion',
    classId: 'fighter',
    label: 'Champion',
    tagline: 'Simple, relentless, and very hard to discourage.',
    description:
      'You do not have tricks. You have a weapon and the willingness to keep swinging until the other side stops.',
    feature: {
      name: 'Improved Critical',
      description: 'Your critical hits land on a roll of 19 or 20, not just 20.',
      active: true,
    },
    effect: { kind: 'critOn', value: 19 },
  },
  {
    id: 'battlemaster',
    classId: 'fighter',
    label: 'Battle Master',
    tagline: 'A fighter who reads the fight and spends dice on it.',
    description:
      'You treat combat as a problem with moving parts. Trip a foe, punish an opening, control where everyone stands.',
    feature: {
      name: 'Superiority Dice',
      description:
        'Two d6 you spend on Trip Attack: extra damage, and the target falls over unless it saves.',
      active: true,
    },
    effect: { kind: 'superiorityDice', count: SUPERIORITY_DICE_AT_LEVEL_1 },
  },

  // --- Wizard ---------------------------------------------------------------
  {
    id: 'evocation',
    classId: 'wizard',
    label: 'School of Evocation',
    tagline: 'Damage, aimed carefully.',
    description:
      'You throw the loudest spells in the book and have learned to do it without hitting your own party.',
    feature: {
      name: 'Sculpt Spells',
      description: 'Your allies automatically pass their saves against your area spells.',
      active: false,
      pending: 'No spell in this build targets an area yet.',
    },
  },
  {
    id: 'abjuration',
    classId: 'wizard',
    label: 'School of Abjuration',
    tagline: 'The wizard who is hard to kill.',
    description:
      'You spend your magic on wards and shields, and outlast the people trying to interrupt you.',
    feature: {
      name: 'Arcane Ward',
      description:
        'Casting an abjuration spell raises a ward that soaks damage before your hit points do.',
      active: true,
    },
    effect: { kind: 'castHook', power: 'arcaneWard' },
  },

  // --- Cleric ---------------------------------------------------------------
  {
    id: 'life',
    classId: 'cleric',
    label: 'Life Domain',
    tagline: 'The reason anyone is still standing.',
    description:
      'Your healing goes further than it should. Where you are, people get back up.',
    feature: {
      name: 'Disciple of Life',
      description:
        'Every spell you cast to heal restores 2 extra hit points, plus the spell\'s level.',
      active: true,
    },
    effect: { kind: 'castHook', power: 'discipleOfLife' },
  },
  {
    id: 'light',
    classId: 'cleric',
    label: 'Light Domain',
    tagline: 'Radiance, used offensively.',
    description:
      'Your faith burns rather than soothes. You blind, you scorch, and you make yourself hard to hit back.',
    feature: {
      name: 'Warding Flare',
      description:
        'When a blow is about to land, flare light at the attacker and make them roll again with disadvantage.',
      active: true,
    },
    effect: { kind: 'reaction', power: 'wardingFlare' },
  },

  // --- Rogue ----------------------------------------------------------------
  {
    id: 'thief',
    classId: 'rogue',
    label: 'Thief',
    tagline: 'Faster hands than anyone expects.',
    description:
      'You are quick with objects as well as knives — a potion drunk mid-fight, a lever pulled at the right moment.',
    feature: {
      name: 'Fast Hands',
      description: 'Use an object as a bonus action instead of your whole turn.',
      active: false,
      pending: 'Bonus actions are not tracked separately yet.',
    },
  },
  {
    id: 'assassin',
    classId: 'rogue',
    label: 'Assassin',
    tagline: 'The fight is decided before it starts.',
    description:
      'You open fights, you do not join them. Anyone who has not moved yet is a target, not an opponent.',
    feature: {
      name: 'Ambush',
      description: 'Advantage against any enemy that has not taken its turn yet.',
      active: false,
      pending: 'Turn-order awareness is not exposed to attack rolls yet.',
    },
  },

  // --- Paladin --------------------------------------------------------------
  {
    id: 'devotion',
    classId: 'paladin',
    label: 'Oath of Devotion',
    tagline: 'The straight road, walked stubbornly.',
    description:
      'You keep your word in front of people who would rather you did not. Your weapon answers to that.',
    feature: {
      name: 'Sacred Weapon',
      description:
        'Spend your Channel Divinity to add your Charisma to every attack roll for the fight.',
      active: true,
    },
    effect: {
      kind: 'channelDivinity',
      charges: CHANNEL_DIVINITY_CHARGES_AT_LEVEL_1,
      power: 'sacredWeapon',
    },
  },
  {
    id: 'vengeance',
    classId: 'paladin',
    label: 'Oath of Vengeance',
    tagline: 'Someone has this coming.',
    description:
      'Your oath is not abstract. It is aimed at a specific enemy, and you will not be talked out of it.',
    feature: {
      name: 'Vow of Enmity',
      description: 'Spend your Channel Divinity to swear at one foe and strike it with advantage.',
      active: true,
    },
    effect: {
      kind: 'channelDivinity',
      charges: CHANNEL_DIVINITY_CHARGES_AT_LEVEL_1,
      power: 'vowOfEnmity',
    },
  },
]

const BY_ID = new Map(SUBCLASSES.map((subclass) => [subclass.id, subclass]))

/** The specialisations a given class may pick from. */
export function subclassesFor(classId: ClassId): readonly Subclass[] {
  return SUBCLASSES.filter((subclass) => subclass.classId === classId)
}

/** Undefined rather than a throw, so a stale saved id degrades to "no subclass". */
export function subclassById(id: string | undefined): Subclass | undefined {
  return id === undefined ? undefined : BY_ID.get(id)
}

/**
 * The natural roll this subclass crits on, or undefined for the ordinary 20.
 * Undefined rather than 20 so the field stays absent on every character who has
 * not widened it, and nothing downstream has to store a default.
 */
export function critThresholdFor(id: string | undefined): number | undefined {
  const effect = subclassById(id)?.effect
  return effect?.kind === 'critOn' ? effect.value : undefined
}

/** The superiority-dice pool this subclass grants, or undefined for none. */
export function superiorityDiceFor(id: string | undefined): number | undefined {
  const effect = subclassById(id)?.effect
  return effect?.kind === 'superiorityDice' ? effect.count : undefined
}

/** Whether this subclass fights on somebody else's turn. */
export function hasReactionFor(id: string | undefined): boolean {
  return subclassById(id)?.effect?.kind === 'reaction'
}

/** The Channel Divinity charges this subclass grants, or undefined for none. */
export function channelDivinityFor(id: string | undefined): number | undefined {
  const effect = subclassById(id)?.effect
  return effect?.kind === 'channelDivinity' ? effect.charges : undefined
}

/** Which oath power the subclass spends its charge on, if any. */
export function channelDivinityPowerFor(
  id: string | undefined,
): ChannelDivinityType | undefined {
  const effect = subclassById(id)?.effect
  return effect?.kind === 'channelDivinity' ? effect.power : undefined
}
