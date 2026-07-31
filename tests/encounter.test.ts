import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GRID_SIZE,
  activeCombatant,
  attackWith,
  createEncounter,
  encounterWinner,
  endTurn,
  hasLegalAction,
  moveActive,
  reachableSquares,
  takeEnemyTurn,
} from '../src/lib/dnd/encounter.ts'
import { GOBLIN, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import type { AttackAction } from '../src/types/action.ts'
import type { Combatant } from '../src/types/combat.ts'
import type { Encounter as EncounterShape } from '../src/lib/dnd/encounter.ts'
import { constantRng, faceValue, sequenceRng } from './helpers/rng.ts'

const LONGSWORD: AttackAction = {
  id: 'longsword',
  name: 'Longsword',
  kind: 'weapon',
  ability: 'str',
  proficient: true,
  damage: '1d8',
  damageType: 'slashing',
  addAbilityToDamage: true,
  ranged: false,
  rangeSquares: 1,
  description: 'A broad swing with a steel blade.',
}

function hero(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'hero',
    name: 'Bruenna',
    team: 'party',
    level: 1,
    scores: { str: 16, dex: 12, con: 16, int: 8, wis: 12, cha: 10 },
    maxHp: 13,
    currentHp: 13,
    ac: 16,
    speedSquares: 3,
    position: { x: 0, y: 4 },
    attacks: [LONGSWORD],
    conditions: [],
    initiative: 0,
    ...overrides,
  }
}

/** Hero first, goblin second, with movement and action available. */
function encounter(overrides: Partial<EncounterShape> = {}): EncounterShape {
  const heroine = hero()
  const goblin = spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 0 } })
  return {
    round: 1,
    order: ['hero', 'goblin'],
    activeIndex: 0,
    combatants: { hero: heroine, goblin },
    movementRemaining: 3,
    hasActed: false,
    bonusActionSpent: false,
    log: [],
    ...overrides,
  }
}

test('creating an encounter rolls initiative and orders everyone', () => {
  const goblin = spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 0 } })
  // Hero rolls 18 (+1 dex = 19), goblin rolls 4 (+2 dex = 6).
  const rng = sequenceRng([faceValue(18, 20), faceValue(4, 20)])
  const state = createEncounter([hero(), goblin], rng)

  assert.deepEqual(state.order, ['hero', 'goblin'])
  assert.equal(state.round, 1)
  assert.equal(state.activeIndex, 0)
  assert.equal(state.combatants.hero?.initiative, 19)
  assert.equal(state.combatants.goblin?.initiative, 6)
  assert.equal(state.movementRemaining, 3, 'the first combatant starts with full movement')
  assert.equal(state.hasActed, false)
  assert.match(state.log[0] ?? '', /Turn order/)
})

test('a slower hero goes second', () => {
  const goblin = spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 0 } })
  const rng = sequenceRng([faceValue(2, 20), faceValue(19, 20)])
  const state = createEncounter([hero(), goblin], rng)
  assert.deepEqual(state.order, ['goblin', 'hero'])
  assert.equal(activeCombatant(state)?.id, 'goblin')
})

test('reachable squares respect movement, the board edge and other bodies', () => {
  const state = encounter({ movementRemaining: 1 })
  const squares = reachableSquares(state)

  // The hero stands at (0, 4), a corner, so only three neighbours exist.
  assert.deepEqual(
    squares.map(({ x, y }) => `${x},${y}`).sort(),
    ['0,3', '1,3', '1,4'],
  )
  assert.ok(squares.every(({ x, y }) => x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE))
})

test('a square holding someone else is not reachable', () => {
  const state = encounter({
    movementRemaining: 1,
    combatants: {
      hero: hero({ position: { x: 2, y: 2 } }),
      goblin: spawnMonster(GOBLIN, { id: 'goblin', position: { x: 2, y: 3 } }),
    },
  })
  const squares = reachableSquares(state).map(({ x, y }) => `${x},${y}`)
  assert.ok(!squares.includes('2,3'), 'the goblin is standing there')
  assert.ok(squares.includes('1,3'))
})

test('no movement left means nowhere to go', () => {
  assert.deepEqual(reachableSquares(encounter({ movementRemaining: 0 })), [])
})

test('moving spends movement and leaves the action untouched', () => {
  const moved = moveActive(encounter(), { x: 2, y: 2 })
  assert.deepEqual(moved.combatants.hero?.position, { x: 2, y: 2 })
  assert.equal(moved.movementRemaining, 1, 'a two-square diagonal costs two')
  assert.equal(moved.hasActed, false, 'movement is not an action')
  assert.match(moved.log.at(-1) ?? '', /moves 2 squares/)
})

test('a move beyond the remaining movement is refused outright', () => {
  const state = encounter({ movementRemaining: 1 })
  assert.equal(moveActive(state, { x: 4, y: 0 }), state, 'the state is returned unchanged')
})

test('you cannot walk onto an occupied square', () => {
  const state = encounter({
    combatants: {
      hero: hero({ position: { x: 2, y: 2 } }),
      goblin: spawnMonster(GOBLIN, { id: 'goblin', position: { x: 2, y: 3 } }),
    },
  })
  assert.equal(moveActive(state, { x: 2, y: 3 }), state)
})

test('a hero with movement left always has something to do', () => {
  assert.equal(hasLegalAction(encounter()), true)
})

test('being out of movement but next to the goblin still leaves the swing', () => {
  const state = encounter({
    combatants: {
      hero: hero({ position: { x: 3, y: 0 } }),
      goblin: spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 0 } }),
    },
    movementRemaining: 0,
  })
  assert.equal(hasLegalAction(state), true)
})

test('out of movement and out of reach is the stranded case', () => {
  assert.equal(hasLegalAction(encounter({ movementRemaining: 0 })), false)
})

test('an adjacent hero who already acted is stranded too', () => {
  const state = encounter({
    combatants: {
      hero: hero({ position: { x: 3, y: 0 } }),
      goblin: spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 0 } }),
    },
    movementRemaining: 0,
    hasActed: true,
  })
  assert.equal(hasLegalAction(state), false)
})

test('a downed enemy is not a target worth keeping the turn open for', () => {
  const state = encounter({
    combatants: {
      hero: hero({ position: { x: 3, y: 0 } }),
      goblin: {
        ...spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 0 } }),
        currentHp: 0,
      },
    },
    movementRemaining: 0,
  })
  assert.equal(hasLegalAction(state), false)
})

test('attacking out of reach is refused with a reason the banner can show', () => {
  const result = attackWith(encounter(), { targetId: 'goblin', attackId: 'longsword' })
  assert.equal(result.outcome, null)
  assert.match(result.refusal ?? '', /out of reach/)
  assert.equal(result.encounter.hasActed, false, 'a refused attack does not burn the action')
})

test('an adjacent attack lands, deals damage and spends the action', () => {
  const state = encounter({
    combatants: {
      hero: hero({ position: { x: 2, y: 2 } }),
      goblin: spawnMonster(GOBLIN, { id: 'goblin', position: { x: 2, y: 3 } }),
    },
  })
  const rng = sequenceRng([faceValue(15, 20), faceValue(4, 8)])
  const result = attackWith(state, { targetId: 'goblin', attackId: 'longsword', rng })

  assert.equal(result.refusal, null)
  assert.equal(result.outcome?.kind, 'hit')
  assert.equal(result.encounter.hasActed, true)
  assert.equal(result.encounter.combatants.goblin?.currentHp, 0, '7 hp minus 4 + 3 str')
  assert.match(result.encounter.log.at(-1) ?? '', /out of the fight/)
})

test('a second attack in the same turn is refused', () => {
  const state = encounter({
    hasActed: true,
    combatants: {
      hero: hero({ position: { x: 2, y: 2 } }),
      goblin: spawnMonster(GOBLIN, { id: 'goblin', position: { x: 2, y: 3 } }),
    },
  })
  const result = attackWith(state, { targetId: 'goblin', attackId: 'longsword' })
  assert.match(result.refusal ?? '', /already taken your action/)
})

test('ending a turn hands over to the next combatant with fresh movement', () => {
  const next = endTurn(encounter({ movementRemaining: 0, hasActed: true }))
  assert.equal(next.activeIndex, 1)
  assert.equal(activeCombatant(next)?.id, 'goblin')
  assert.equal(next.movementRemaining, 3, "the goblin's own speed")
  assert.equal(next.hasActed, false)
  assert.equal(next.round, 1)
})

test('wrapping past the last combatant starts a new round', () => {
  const next = endTurn(encounter({ activeIndex: 1 }))
  assert.equal(next.round, 2)
  assert.equal(next.activeIndex, 0)
  assert.match(next.log.at(-1) ?? '', /Round 2/)
})

test('a new round counts down timed conditions', () => {
  const state = encounter({
    activeIndex: 1,
    combatants: {
      hero: hero({ conditions: [{ id: 'poisoned', roundsRemaining: 1 }] }),
      goblin: spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 0 } }),
    },
  })
  const next = endTurn(state)
  assert.deepEqual(next.combatants.hero?.conditions, [], 'the poison wore off')
})

test('turn order skips anyone who is down', () => {
  const state = encounter({
    order: ['hero', 'goblin', 'goblin2'],
    activeIndex: 0,
    combatants: {
      hero: hero(),
      goblin: spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 0 } }),
      goblin2: {
        ...spawnMonster(GOBLIN, { id: 'goblin2', position: { x: 4, y: 1 } }),
        currentHp: 0,
      },
    },
  })
  const first = endTurn(state)
  assert.equal(activeCombatant(first)?.id, 'goblin')
  const second = endTurn(first)
  assert.equal(activeCombatant(second)?.id, 'hero', 'the downed goblin is skipped')
  assert.equal(second.round, 2)
})

test('the encounter is won when one side is entirely down', () => {
  assert.equal(encounterWinner(encounter()), null)

  const goblinDown = encounter({
    combatants: {
      hero: hero(),
      goblin: { ...spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 0 } }), currentHp: 0 },
    },
  })
  assert.equal(encounterWinner(goblinDown), 'party')

  const heroDown = encounter({
    combatants: {
      hero: hero({ currentHp: 0 }),
      goblin: spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 0 } }),
    },
  })
  assert.equal(encounterWinner(heroDown), 'foes')
})

test('ending a turn after the fight is over changes nothing', () => {
  const finished = encounter({
    combatants: {
      hero: hero(),
      goblin: { ...spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 0 } }), currentHp: 0 },
    },
  })
  assert.equal(endTurn(finished), finished)
})

test('the goblin closes the distance and swings in one turn', () => {
  const state = encounter({
    activeIndex: 1,
    movementRemaining: 3,
    combatants: {
      hero: hero({ position: { x: 2, y: 2 } }),
      goblin: spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 4 } }),
    },
  })
  // Two diagonal steps close the gap, then the attack roll and damage die.
  const rng = sequenceRng([faceValue(19, 20), faceValue(3, 6)])
  const { encounter: after, outcome } = takeEnemyTurn(state, rng)

  assert.deepEqual(after.combatants.goblin?.position, { x: 3, y: 3 }, 'stops when adjacent')
  assert.equal(after.movementRemaining, 2, 'only one square was needed')
  assert.equal(outcome?.kind, 'hit')
  assert.equal(after.combatants.hero?.currentHp, 8, '13 hp minus 3 + 2 dex')
  assert.equal(after.hasActed, true)
})

test('a goblin that cannot reach anyone says so instead of throwing', () => {
  const state = encounter({
    activeIndex: 1,
    movementRemaining: 0,
    combatants: {
      hero: hero({ position: { x: 0, y: 0 } }),
      goblin: spawnMonster(GOBLIN, { id: 'goblin', position: { x: 4, y: 4 } }),
    },
  })
  const { outcome, encounter: after } = takeEnemyTurn(state, constantRng(0.5))
  assert.equal(outcome, null)
  assert.match(after.log.at(-1) ?? '', /cannot reach/)
})

test('a hero can win the fight inside two rounds', () => {
  let state = createEncounter(
    [
      hero({ position: { x: 2, y: 2 } }),
      spawnMonster(GOBLIN, { id: 'goblin', position: { x: 2, y: 3 } }),
    ],
    sequenceRng([faceValue(20, 20), faceValue(2, 20)]),
  )
  assert.equal(activeCombatant(state)?.id, 'hero')

  const swing = attackWith(state, {
    targetId: 'goblin',
    attackId: 'longsword',
    rng: sequenceRng([faceValue(17, 20), faceValue(5, 8)]),
  })
  state = swing.encounter

  assert.equal(swing.outcome?.kind, 'hit')
  assert.equal(encounterWinner(state), 'party', '5 + 3 beats the goblin’s 7 hit points')
})
