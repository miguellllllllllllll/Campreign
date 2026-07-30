import test from 'node:test'
import assert from 'node:assert/strict'
import { activeCombatant } from '../src/lib/dnd/encounter.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { GOBLIN, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import { useCombatStore } from '../src/stores/combatStore.ts'
import type { CreationAnswers } from '../src/types/character.ts'

const answers: CreationAnswers = { classId: 'fighter', raceId: 'dwarf', motivationId: 'glory' }

function roster() {
  const hero = buildCharacter(answers, 'Test Hero', { id: 'hero-1', now: 1 })
  return [
    characterToCombatant(hero, { position: { x: 2, y: 4 }, speedSquares: 3 }),
    spawnMonster(GOBLIN, { id: 'goblin', position: { x: 2, y: 0 } }),
  ]
}

/** The goblin's Dex beats a dwarf's often enough that this must never deadlock. */
test('the player is always the one to act once combat starts', () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    useCombatStore.getState().reset()
    useCombatStore.getState().start(roster())
    const encounter = useCombatStore.getState().encounter
    assert.ok(encounter)
    assert.equal(
      activeCombatant(encounter)?.team,
      'party',
      'a foe winning initiative must not leave the player with nothing to press',
    )
  }
})

test('ending a turn hands control straight back, never mid-enemy-round', () => {
  useCombatStore.getState().reset()
  useCombatStore.getState().start(roster())
  useCombatStore.getState().finishTurn()

  const encounter = useCombatStore.getState().encounter
  assert.ok(encounter)
  assert.equal(activeCombatant(encounter)?.team, 'party')
  assert.ok(encounter.round >= 2, 'a full pass through the order advanced the round')
})

test('an illegal move is refused in plain English', () => {
  useCombatStore.getState().reset()
  useCombatStore.getState().start(roster())

  const before = useCombatStore.getState().encounter
  assert.equal(useCombatStore.getState().move({ x: 0, y: 0 }), false)
  assert.equal(useCombatStore.getState().encounter, before, 'the board did not change')
  assert.ok(useCombatStore.getState().refusal)
})
