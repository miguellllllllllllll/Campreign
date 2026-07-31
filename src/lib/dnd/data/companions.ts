import type { AttackAction } from '../../../types/action.ts'
import type { Combatant, GridPosition } from '../../../types/combat.ts'

/**
 * A second body on the player's side of the board.
 *
 * Exists so an area spell has somebody to spare. Sculpt Spells was written,
 * wired and tested weeks before this file, and could never fire because every
 * roster was one hero and one monster — the missing piece was never the engine.
 *
 * Deliberately plain: no subclass, no spells, no items, and it fights itself.
 * The tutorial is teaching one character's choices, and a companion the player
 * has to steer would double the decisions on a board built to teach the first
 * one. It acts on its own turn the way the goblin does.
 */

const SQUIRE_SPEAR: AttackAction = {
  id: 'squireSpear',
  name: 'Spear',
  kind: 'weapon',
  ability: 'str',
  proficient: true,
  damage: '1d6',
  damageType: 'piercing',
  addAbilityToDamage: true,
  ranged: false,
  rangeSquares: 1,
  description: 'A steady thrust from someone who has been taught to hold a line.',
}

export interface CompanionPreset {
  id: string
  name: string
  maxHp: number
  ac: number
  speedSquares: number
  scores: Combatant['scores']
  attacks: readonly AttackAction[]
}

/**
 * Tougher than the goblin and weaker than the hero, on purpose: sturdy enough
 * to survive the fight it is standing in, not strong enough to win it for you.
 */
export const LOYAL_SQUIRE: CompanionPreset = {
  id: 'squire',
  name: 'Loyal Squire',
  maxHp: 12,
  ac: 15,
  speedSquares: 3,
  scores: { str: 14, dex: 12, con: 13, int: 9, wis: 10, cha: 10 },
  attacks: [SQUIRE_SPEAR],
}

export function spawnCompanion(
  preset: CompanionPreset,
  args: { position: GridPosition; id?: string; initiative?: number },
): Combatant {
  return {
    id: args.id ?? preset.id,
    name: preset.name,
    team: 'party',
    level: 1,
    scores: preset.scores,
    maxHp: preset.maxHp,
    currentHp: preset.maxHp,
    ac: preset.ac,
    speedSquares: preset.speedSquares,
    position: args.position,
    attacks: preset.attacks.map((attack) => ({ ...attack })),
    conditions: [],
    initiative: args.initiative ?? 0,
  }
}
