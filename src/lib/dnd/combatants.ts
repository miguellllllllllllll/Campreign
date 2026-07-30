import type { Character } from '../../types/character.ts'
import type { Combatant, GridPosition, Team } from '../../types/combat.ts'

/** Five feet of movement is one square on the map. */
export function feetToSquares(feet: number): number {
  return Math.floor(feet / 5)
}

/**
 * Puts a character on the battle map. `speedSquares` can be overridden because
 * the tutorial's 5x5 board is smaller than a real 30 ft stride.
 */
export function characterToCombatant(
  character: Character,
  args: {
    position: GridPosition
    team?: Team
    initiative?: number
    speedSquares?: number
  },
): Combatant {
  return {
    id: character.id,
    name: character.name,
    team: args.team ?? 'party',
    level: character.level,
    scores: character.scores,
    maxHp: character.maxHp,
    currentHp: character.currentHp,
    ac: character.ac,
    speedSquares: args.speedSquares ?? feetToSquares(character.speedFeet),
    position: args.position,
    attacks: character.attacks.map((attack) => ({ ...attack })),
    conditions: [],
    initiative: args.initiative ?? 0,
    ...(character.initiativeBonus === undefined
      ? {}
      : { initiativeBonus: character.initiativeBonus }),
    ...(character.critOn === undefined ? {} : { critOn: character.critOn }),
    ...(character.superiorityDice === undefined
      ? {}
      : { superiorityDice: character.superiorityDice }),
  }
}
