import assert from 'node:assert/strict'
import { levelUp } from '../../src/lib/dnd/leveling.ts'
import type { Character } from '../../src/types/character.ts'

/**
 * A character who has grown into their specialisation.
 *
 * Subclass features switch on at level 2 rather than at creation, so a test
 * about what Warding Flare or a superiority die *does* has to be run on
 * somebody who actually has one. Tests about the gate itself build level-1
 * characters directly and assert the absence.
 */
export function grown(character: Character): Character {
  const result = levelUp(character)
  assert.equal(result.refusal, null, 'the fixture could not be levelled')
  return result.character
}
