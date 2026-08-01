import type { AttackAction } from '../../../types/action.ts'
import type { AbilityScores } from '../../../types/character.ts'
import type { Combatant, GridPosition, TokenId } from '../../../types/combat.ts'

export interface MonsterPreset {
  id: string
  name: string
  /** One sentence the tutorial can read aloud when the creature appears. */
  blurb: string
  /** Which silhouette stands in the square when this one is spawned. */
  tokenId: TokenId
  level: number
  scores: AbilityScores
  maxHp: number
  ac: number
  speedSquares: number
  attacks: AttackAction[]
}

/**
 * The tutorial goblin. AC is 12 rather than the SRD's 15 so a first-level
 * hero lands most swings — the lesson here is the turn structure, not the
 * difficulty curve.
 */
export const GOBLIN: MonsterPreset = {
  id: 'goblin',
  name: 'Goblin',
  blurb: 'A wiry goblin in scavenged leather, gripping a notched scimitar.',
  tokenId: 'goblin',
  level: 1,
  scores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  maxHp: 7,
  ac: 12,
  speedSquares: 3,
  attacks: [
    {
      id: 'scimitar',
      name: 'Scimitar',
      kind: 'weapon',
      ability: 'dex',
      proficient: true,
      damage: '1d6',
      damageType: 'slashing',
      addAbilityToDamage: true,
      ranged: false,
      rangeSquares: 1,
      description: 'A quick curved slash at anyone standing next to it.',
    },
  ],
}

/**
 * A sparring target for the character sheet. Armour Class 12 matches the
 * goblin, so practising a swing teaches the same numbers the tutorial will,
 * and the hit points are high enough that it never falls over mid-lesson.
 */
export const TRAINING_DUMMY: MonsterPreset = {
  id: 'trainingDummy',
  name: 'Practice Dummy',
  blurb: 'A straw-stuffed dummy on a post, patient and unkillable.',
  tokenId: 'dummy',
  level: 1,
  scores: { str: 10, dex: 10, con: 10, int: 1, wis: 1, cha: 1 },
  maxHp: 999,
  ac: 12,
  speedSquares: 0,
  attacks: [],
}

/*
 * Everything below is met after the goblin, by a character who has already
 * learned to hit things. So these carry their SRD numbers rather than the
 * goblin's softened ones — the goblin is AC 12 instead of 15 because it is the
 * first fight anybody has, and that reason does not generalise.
 *
 * Two shared divergences, both forced by the board rather than chosen:
 *
 * - **Speed is squares, not feet, and the board is five across.** A giant bat
 *   flies 60 feet, which is twelve squares and further than the whole map. Speeds
 *   here are relative to the goblin's three rather than converted.
 * - **No riders on attacks.** `AttackAction` carries damage and reach and
 *   nothing else, so the giant spider's poison save is simply absent. Noted
 *   because it is a real omission, not an oversight — the spider hits for its
 *   SRD damage and that is all it does.
 */

/**
 * The weakest thing that could have come down the drain. Quick, fragile, and
 * dangerous mostly in the sense that it is hard to corner.
 */
export const GIANT_BAT: MonsterPreset = {
  id: 'giantBat',
  name: 'Giant Bat',
  blurb: 'A dog-sized bat, wings clattering off the low cellar ceiling.',
  tokenId: 'bat',
  level: 1,
  scores: { str: 15, dex: 16, con: 11, int: 2, wis: 12, cha: 6 },
  /*
   * The SRD gives this 22, which would make it the toughest thing on the board
   * — tougher than the skeleton beside it and three times the goblin. Two
   * things break at that number. The tutorial's own narration calls the bat
   * fragile, and the second encounter has to be winnable by somebody who has
   * had exactly one fight; at 22 it was a coin toss that killed a level-2
   * cleric and their squire outright.
   *
   * Halved, so "fast and fragile" is what the numbers say as well as the prose.
   */
  maxHp: 11,
  ac: 13,
  // Four rather than the goblin's three: the one thing a bat is, is faster
  // than you. Twelve squares would be the honest conversion and would let it
  // cross the map twice in a turn.
  speedSquares: 4,
  attacks: [
    {
      id: 'batBite',
      name: 'Bite',
      kind: 'weapon',
      ability: 'str',
      proficient: true,
      damage: '1d6',
      damageType: 'piercing',
      addAbilityToDamage: true,
      ranged: false,
      rangeSquares: 1,
      description: 'It drops onto you out of the dark and bites before you can look up.',
    },
  ],
}

/**
 * The first thing here that was once a person, and the first that a cleric's
 * Channel Divinity is actually for.
 */
export const SKELETON: MonsterPreset = {
  id: 'skeleton',
  name: 'Skeleton',
  blurb: 'Bones held together by something that is not muscle, gripping a rusted shortsword.',
  tokenId: 'skeleton',
  level: 1,
  scores: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
  maxHp: 13,
  ac: 13,
  speedSquares: 3,
  attacks: [
    {
      id: 'skeletonShortsword',
      name: 'Shortsword',
      kind: 'weapon',
      ability: 'dex',
      proficient: true,
      damage: '1d6',
      damageType: 'piercing',
      addAbilityToDamage: true,
      ranged: false,
      rangeSquares: 1,
      description: 'A flat, economical thrust. It does not feint and it does not tire.',
    },
  ],
}

/**
 * The hardest thing in the bestiary, and deliberately a step up rather than a
 * variation: twice the goblin's armour class to get through and nearly four
 * times its hit points behind it.
 */
export const GIANT_SPIDER: MonsterPreset = {
  id: 'giantSpider',
  name: 'Giant Spider',
  blurb: 'It comes down from the rafters on a line of silk, unhurried.',
  tokenId: 'spider',
  level: 1,
  scores: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
  maxHp: 26,
  ac: 14,
  speedSquares: 3,
  attacks: [
    {
      id: 'spiderBite',
      name: 'Bite',
      kind: 'weapon',
      ability: 'dex',
      proficient: true,
      damage: '1d8',
      damageType: 'piercing',
      addAbilityToDamage: true,
      ranged: false,
      rangeSquares: 1,
      description:
        'Fangs that go in further than you expect, and the venom comes after — a '
        + 'Constitution save against DC 11, for half of it if you hold on.',
      /*
       * The first attack in the game that makes the *player* roll. Every save
       * before this was an enemy resisting something the hero cast; this one
       * points the other way, which is the lesson the spider exists to teach.
       *
       * SRD numbers, including the half on a success: the venom is already in
       * the wound, and resisting it is not the same as never having been bitten.
       * No poisoned condition — the SRD giant spider does damage, and adding a
       * rider it does not have would teach the wrong monster.
       */
      onHitSave: {
        ability: 'con',
        dc: 11,
        damage: '2d8',
        damageType: 'poison',
        halfOnSuccess: true,
      },
    },
  ],
}

export const MONSTERS: Record<string, MonsterPreset> = {
  goblin: GOBLIN,
  trainingDummy: TRAINING_DUMMY,
  giantBat: GIANT_BAT,
  skeleton: SKELETON,
  giantSpider: GIANT_SPIDER,
}

export function spawnMonster(
  preset: MonsterPreset,
  args: { id: string; position: GridPosition; initiative?: number; name?: string },
): Combatant {
  return {
    id: args.id,
    name: args.name ?? preset.name,
    team: 'foes',
    level: preset.level,
    scores: preset.scores,
    maxHp: preset.maxHp,
    currentHp: preset.maxHp,
    ac: preset.ac,
    speedSquares: preset.speedSquares,
    position: args.position,
    attacks: preset.attacks.map((attack) => ({ ...attack })),
    conditions: [],
    tokenId: preset.tokenId,
    initiative: args.initiative ?? 0,
  }
}
