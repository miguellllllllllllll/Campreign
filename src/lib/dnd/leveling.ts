import { totalSlots } from './slots.ts'
import type { Character, ClassId } from '../../types/character.ts'
import { CLASS_PRESETS } from './presets.ts'
import {
  channelDivinityFor,
  critThresholdFor,
  hasAmbushFor,
  hasFastHandsFor,
  hasReactionFor,
  subclassById,
  subclassFeatureActive,
  superiorityDiceFor,
} from '../../content/subclasses.ts'
import { abilityModifier, proficiencyBonus } from './stats.ts'
import { actionSurgesFor } from './actionSurge.ts'
import { hasDivineSmiteAt } from './divineSmite.ts'
import { hasCunningActionAt } from './cunningAction.ts'
import { getSpellcastingLimits } from './spellcasting.ts'
import { spellsFor } from '../../content/spells.ts'

/**
 * Taking a level.
 *
 * Milestone, not experience points. A tutorial that stopped to explain XP
 * budgets before the second fight would be teaching bookkeeping, and the thing
 * worth teaching is that your numbers grow.
 */

/**
 * The highest level this app can honestly build.
 *
 * Three, and every word of the old reason for two has been paid off rather
 * than waived. That comment said a 3rd-level caster would gain second-level
 * slots the engine could not represent and had nothing to spend them on. Both
 * were true. `Character.spellSlots` is now a table indexed by spell level, and
 * the registry holds second-level spells for both casting classes — Shatter for
 * the wizard, Blindness for either.
 *
 * `SPELL_SLOTS_BY_LEVEL` is still written past this cap, for the same reason as
 * before: the rules are correct further than the app can play them. Four stays
 * out of reach because 4th level is an ability score improvement, which is a
 * creation-flow question rather than a combat one.
 */
export const MAX_LEVEL = 3

/** How a class's magic grows. Full casters double a half caster's pace. */
export type CastingProgression = 'full' | 'half' | 'none'

export function castingProgressionFor(classId: ClassId): CastingProgression {
  switch (classId) {
    case 'wizard':
    case 'cleric':
      return 'full'
    case 'paladin':
      return 'half'
    case 'fighter':
    case 'rogue':
      return 'none'
  }
}

/**
 * First-level spell slots at each character level, indexed by level.
 *
 * Index 0 is unused so the level reads as itself. Half casters have nothing at
 * 1st level, which is the SRD's paladin and the reason `getSpellcastingLimits`
 * already carried an `unlocksAtLevel`.
 */
export const SPELL_SLOTS_BY_LEVEL: Readonly<Record<CastingProgression, readonly number[]>> = {
  full: [0, 2, 3, 4, 4, 4],
  half: [0, 0, 2, 3, 3, 3],
  none: [0, 0, 0, 0, 0, 0],
}

/**
 * Second-level slots at each character level, indexed the same way.
 *
 * A full caster opens these at 3rd level and a half caster at 5th, which is why
 * the paladin's row is still zeroes everywhere this app can reach. Kept as its
 * own table rather than nested inside the one above, so each row still reads as
 * "slots of this level, by character level" — the shape a reader already knows.
 */
export const SECOND_LEVEL_SLOTS_BY_LEVEL: Readonly<
  Record<CastingProgression, readonly number[]>
> = {
  full: [0, 0, 0, 2, 3, 3],
  half: [0, 0, 0, 0, 0, 2],
  none: [0, 0, 0, 0, 0, 0],
}

/**
 * A deliberate divergence, and the one place this file disagrees with the SRD:
 * a 1st-level full caster gets **one** slot here, not two.
 *
 * The tutorial teaches that a spell is a resource you spend, and that lesson
 * lands harder when spending it is a real decision. Two slots at 1st level made
 * the choice cost nothing. From 2nd level the table above is the SRD's.
 */
export const FIRST_LEVEL_SLOTS_AT_LEVEL_1 = 1

export function spellSlotsAt(classId: ClassId, level: number): readonly number[] {
  const progression = castingProgressionFor(classId)
  if (progression === 'none') return []

  const pick = (table: readonly number[]): number => table[Math.min(level, table.length - 1)] ?? 0
  // The 1st-level divergence below is deliberate and documented above.
  const first =
    level <= 1
      ? progression === 'full'
        ? FIRST_LEVEL_SLOTS_AT_LEVEL_1
        : 0
      : pick(SPELL_SLOTS_BY_LEVEL[progression])
  const second = pick(SECOND_LEVEL_SLOTS_BY_LEVEL[progression])

  // Index 0 is the cantrip slot nobody spends, kept so a level indexes itself.
  return second > 0 ? [0, first, second] : [0, first]
}

/**
 * Hit points gained on taking a level: the fixed average of the hit die, plus
 * Constitution.
 *
 * Fixed rather than rolled. The engine is pure and takes its randomness as a
 * parameter, so rolling here would mean threading an rng through advancement —
 * and a beginner who rolls a 1 on a d10 and is stuck with it for the rest of the
 * game has learned something true about D&D and nothing at all about this app.
 * The SRD offers exactly this option for the same reason.
 */
export function hitPointsGainedAt(hitDie: number, conMod: number): number {
  const average = Math.floor(hitDie / 2) + 1
  // Never less than one, so a terrible Constitution cannot make levelling up
  // actively hurt.
  return Math.max(1, average + conMod)
}

/** Something a character gains on reaching a level, in words a beginner reads. */
export interface LevelFeature {
  id: string
  name: string
  description: string
}

const FEATURES_AT_LEVEL_2: Readonly<Record<ClassId, readonly LevelFeature[]>> = {
  fighter: [
    {
      id: 'actionSurge',
      name: 'Action Surge',
      description:
        'Once between rests, take a second action on your turn — a second attack, right now, when it matters.',
    },
  ],
  rogue: [
    {
      id: 'cunningAction',
      name: 'Cunning Action',
      description:
        'Dash on a bonus action — a second move, so you can cross the room and still act. Disengage and Hide are the other two in the rules, and neither changes anything on a board this small.',
    },
  ],
  wizard: [
    {
      id: 'arcaneRecovery',
      name: 'Arcane Recovery',
      description:
        'Resting gives everyone their hit points back and nobody their spells. You are the exception: once a day you read your way to a spell slot the others do not get.',
    },
  ],
  cleric: [
    {
      id: 'channelDivinity',
      name: 'Channel Divinity',
      description:
        'Call on your god directly, once between rests. Turn Undead, or whatever your domain grants.',
    },
  ],
  paladin: [
    {
      id: 'paladinSpellcasting',
      name: 'Spell slots',
      description:
        'Your oath starts answering. You gain two spell slots and a short list of prepared spells, powered by Charisma — and Divine Smite, which is the other thing a slot is for.',
    },
    {
      id: 'divineSmite',
      name: 'Divine Smite',
      description:
        'Spend a spell slot as you land a blow for 2d8 radiant damage, and an extra die against the undead. The reason paladins hoard slots rather than casting them.',
    },
  ],
}

/**
 * Third level, where the only thing that changes for anyone is magic.
 *
 * The SRD hands out subclasses here — archetype, oath, tradition — but this
 * build already grants them at 2nd, so there is nothing left to give a fighter
 * or a rogue. They gain hit points and a wider crit range from what they
 * already chose, and this list says nothing rather than inventing something.
 *
 * A full caster gains a genuinely new kind of thing, and it is worth naming:
 * spells a first-level slot cannot pay for.
 */
const SECOND_TIER_SPELLS: LevelFeature = {
  id: 'secondLevelSpells',
  name: 'Second-level spells',
  description:
    'A new tier of magic, and slots that only it can spend. Bigger than anything a first-level slot buys — and there are only two of them, so they are worth saving.',
}

const FEATURES_AT_LEVEL_3: Readonly<Record<ClassId, readonly LevelFeature[]>> = {
  fighter: [],
  rogue: [],
  wizard: [SECOND_TIER_SPELLS],
  cleric: [SECOND_TIER_SPELLS],
  // A half caster waits until 5th for a second tier, so a paladin's third level
  // is hit points and nothing else. Saying so beats saying something invented.
  paladin: [],
}

/** What this class gains on reaching `level`, which is nothing for most levels. */
export function featuresGainedAt(classId: ClassId, level: number): readonly LevelFeature[] {
  if (level === 2) return FEATURES_AT_LEVEL_2[classId] ?? []
  if (level === 3) return FEATURES_AT_LEVEL_3[classId] ?? []
  return []
}

/** Everything that changed, for a screen that has to explain it. */
export interface LevelUpGains {
  level: number
  hitPointsGained: number
  maxHp: number
  /** Present only when the number actually moved, which is rare. */
  proficiencyBonus?: number
  /** Present only when the count changed. */
  spellSlots?: readonly number[]
  features: readonly LevelFeature[]
}

export interface LevelUpResult {
  character: Character
  gains: LevelUpGains | null
  /** Why nothing happened, when nothing did. */
  refusal: string | null
}

/**
 * The spells a class is handed the moment its magic switches on.
 *
 * Only the paladin needs this, and only once. Wizards and clerics choose their
 * list during creation, but a paladin has no magic at all at 1st level — so
 * there is no creation step to choose in, and levelling has to hand them
 * something or the slots arrive empty. That was the shape of the last bug here:
 * two slots and nothing to spend them on.
 *
 * Given rather than chosen, which matches the fast-track ethos the creation
 * flow already uses. Trimmed to what they can prepare, and ordered so the
 * signature spell survives the trim.
 */
function preparedSpellsOnUnlock(
  character: Character,
  level: number,
): string[] | undefined {
  if (character.classId !== 'paladin') return undefined
  if (character.preparedSpells !== undefined) return undefined

  const limits = getSpellcastingLimits(
    character.classId,
    abilityModifier(character.scores.wis),
    abilityModifier(character.scores.int),
    level,
    abilityModifier(character.scores.cha),
  )
  if (limits.preparedSpellsCount <= 0) return undefined

  const list = spellsFor('paladin', 1).map((spell) => spell.id)
  return list.length === 0 ? undefined : list.slice(0, limits.preparedSpellsCount)
}

/**
 * The spells a caster gains when a whole new tier of slots opens up.
 *
 * Found by playing it. A cleric reaching third level was handed two
 * second-level slots and no second-level spell — `preparedSpellsOnUnlock`
 * above only ever fires for a paladin gaining magic from nothing, so anybody
 * who already had a prepared list from creation never gained another spell
 * again. The slots existed, the spells existed, and the two never met: content
 * that cannot be reached, which is the failure this codebase keeps catching.
 *
 * Given rather than chosen, for the same reason the paladin's list is: the
 * tutorial is not the place to stop and read six spell descriptions. Appended
 * rather than replacing, so nothing a player picked at creation is taken away.
 */
function spellsForNewTier(
  character: Character,
  slots: readonly number[],
): string[] | undefined {
  const existing = character.preparedSpells
  if (existing === undefined) return undefined
  if (character.classId !== 'wizard' && character.classId !== 'cleric') return undefined

  const known = new Set(existing)
  const gained: string[] = []
  // Index 2 upward: any tier the new slot table can pay for.
  for (let tier = 2; tier < slots.length; tier += 1) {
    if ((slots[tier] ?? 0) <= 0) continue
    for (const spell of spellsFor(character.classId, tier as 1 | 2)) {
      if (!known.has(spell.id)) gained.push(spell.id)
    }
  }
  return gained.length === 0 ? undefined : [...existing, ...gained]
}

/**
 * Takes one level, returning a new character rather than touching the old.
 *
 * Refuses at the cap rather than clamping silently: a caller that thinks it
 * levelled somebody and did not should hear about it.
 */
/** Whether two slot tables say the same thing, so a no-op is not reported. */
function sameSlots(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((count, index) => count === b[index])
}

export function levelUp(character: Character): LevelUpResult {
  if (character.level >= MAX_LEVEL) {
    return {
      character,
      gains: null,
      refusal: `Level ${MAX_LEVEL} is as far as this build goes.`,
    }
  }

  const klass = CLASS_PRESETS[character.classId]
  const level = character.level + 1
  const conMod = abilityModifier(character.scores.con)
  const hitPointsGained = hitPointsGainedAt(klass.hitDie, conMod)
  const maxHp = character.maxHp + hitPointsGained

  const wasProficiency = proficiencyBonus(character.level)
  const nowProficiency = proficiencyBonus(level)
  const wasSlots = character.spellSlots ?? []
  const nowSlots = spellSlotsAt(character.classId, level)
  const features = featuresGainedAt(character.classId, level)

  /*
   * The specialisation switches on here rather than at creation, so this is
   * where its numbers actually reach the sheet. Recomputed at the new level
   * rather than toggled, so the grant and the gate can never disagree.
   */
  const surges = actionSurgesFor(character.classId, level)
  const smites = hasDivineSmiteAt(character.classId, level)
  const dashes = hasCunningActionAt(character.classId, level)
  const prepared = preparedSpellsOnUnlock(character, level)
  const newTier = spellsForNewTier(character, nowSlots)
  const subclassId = character.subclassId
  const critOn = critThresholdFor(subclassId, level)
  const superiorityDice = superiorityDiceFor(subclassId, level)
  const channelDivinityCharges = channelDivinityFor(subclassId, level)
  const unlocked =
    subclassFeatureActive(level) && !subclassFeatureActive(character.level)
      ? subclassById(subclassId)
      : undefined

  const levelled: Character = {
    ...character,
    level,
    maxHp,
    ...(surges === undefined ? {} : { actionSurges: surges }),
    ...(smites ? { hasDivineSmite: true } : {}),
    ...(dashes ? { hasCunningAction: true } : {}),
    ...(prepared === undefined ? {} : { preparedSpells: prepared }),
    ...(newTier === undefined ? {} : { preparedSpells: newTier }),
    ...(critOn === undefined ? {} : { critOn }),
    ...(superiorityDice === undefined ? {} : { superiorityDice }),
    ...(channelDivinityCharges === undefined ? {} : { channelDivinityCharges }),
    ...(hasReactionFor(subclassId, level) ? { hasReaction: true } : {}),
    ...(hasAmbushFor(subclassId, level) ? { hasAmbush: true } : {}),
    ...(hasFastHandsFor(subclassId, level) ? { hasFastHands: true } : {}),
    /*
     * Current hit points rise by the same amount rather than refilling. Levelling
     * up is not a heal in the SRD, and a character who levels mid-adventure at
     * 3 of 10 should be at 9 of 16, not topped up for free.
     */
    currentHp: character.currentHp + hitPointsGained,
    ...(totalSlots(nowSlots) === 0 ? {} : { spellSlots: nowSlots }),
  }

  return {
    character: levelled,
    gains: {
      level,
      hitPointsGained,
      maxHp,
      ...(nowProficiency === wasProficiency ? {} : { proficiencyBonus: nowProficiency }),
      ...(sameSlots(nowSlots, wasSlots) ? {} : { spellSlots: nowSlots }),
      /*
       * The specialisation is listed first when it unlocks. It is the thing the
       * player actually chose, and burying it under a generic class feature
       * would bury the answer to "what did I just get".
       */
      features: [
        ...(unlocked === undefined
          ? []
          : [
              {
                id: unlocked.id,
                name: `${unlocked.label} — ${unlocked.feature.name}`,
                description: unlocked.feature.description,
              },
            ]),
        ...features,
      ],
    },
    refusal: null,
  }
}
