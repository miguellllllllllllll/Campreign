import test from 'node:test'
import assert from 'node:assert/strict'
import { activeCombatant, encounterWinner } from '../src/lib/dnd/encounter.ts'
import { faceValue, seededRng, sequenceRng } from './helpers/rng.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { GOBLIN, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import { useCombatStore } from '../src/stores/combatStore.ts'
import type { CreationAnswers } from '../src/types/character.ts'

const answers: CreationAnswers = {
  classId: 'fighter',
  raceId: 'dwarf',
  backgroundId: 'guildArtisan',
  flawId: 'haggler',
  equipmentChoice: 'defensive',
  auraId: 'amber',
}

function roster() {
  const hero = buildCharacter(answers, 'Test Hero', { id: 'hero-1', now: 1 })
  return [
    characterToCombatant(hero, { position: { x: 2, y: 4 }, speedSquares: 3 }),
    spawnMonster(GOBLIN, { id: 'goblin', position: { x: 2, y: 0 } }),
  ]
}

/*
 * The goblin's Dex beats a dwarf's often enough that this must never deadlock.
 * These pin the rng rather than rolling for real: with Math.random, a natural 20
 * on the goblin's opening swing kills a 13 hit-point fighter outright, which made
 * the old single assertion fail for about one run in ten.
 */

/** Hero rolls 1 for initiative, goblin rolls 20, then the goblin fumbles. */
const FOE_FIRST_THEN_MISSES = sequenceRng([
  faceValue(1, 20),
  faceValue(20, 20),
  faceValue(1, 20),
])

/** Same order of initiative, but the goblin crits and both damage dice max out. */
const FOE_FIRST_THEN_KILLS = sequenceRng([
  faceValue(1, 20),
  faceValue(20, 20),
  faceValue(20, 20),
  faceValue(6, 6),
  faceValue(6, 6),
])

test('a foe winning initiative still hands control back to the player', () => {
  useCombatStore.getState().reset()
  useCombatStore.getState().start(roster(), FOE_FIRST_THEN_MISSES)
  const encounter = useCombatStore.getState().encounter
  assert.ok(encounter)

  assert.equal(encounter.order[0], 'goblin', 'the goblin really did go first')
  assert.equal(
    activeCombatant(encounter)?.team,
    'party',
    'a foe winning initiative must not leave the player with nothing to press',
  )
  assert.equal(encounterWinner(encounter), null)
})

test('a foe that drops the hero outright ends the fight instead of passing the turn', () => {
  useCombatStore.getState().reset()
  useCombatStore.getState().start(roster(), FOE_FIRST_THEN_KILLS)
  const encounter = useCombatStore.getState().encounter
  assert.ok(encounter)

  // There is no turn to hand back here, so the goblin staying active is correct.
  assert.equal(encounterWinner(encounter), 'foes')
  assert.equal(activeCombatant(encounter)?.team, 'foes')
})

/**
 * The invariant that actually matters, over many deterministic seeds: the player
 * is never shown a board that is still live but offers them nothing to do.
 */
test('the player is never left on an undecided board they cannot act on', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    useCombatStore.getState().reset()
    useCombatStore.getState().start(roster(), seededRng(seed))
    const encounter = useCombatStore.getState().encounter
    assert.ok(encounter)

    const decided = encounterWinner(encounter) !== null
    const playersTurn = activeCombatant(encounter)?.team === 'party'
    assert.ok(
      playersTurn || decided,
      `seed ${seed}: the fight is undecided but it is not the player's turn`,
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
