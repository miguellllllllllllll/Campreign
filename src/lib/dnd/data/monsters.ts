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

export const MONSTERS: Record<string, MonsterPreset> = {
  goblin: GOBLIN,
  trainingDummy: TRAINING_DUMMY,
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
