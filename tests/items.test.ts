import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { attackWith, createEncounter, drinkPotion, endTurn } from '../src/lib/dnd/encounter.ts'
import { STARTING_POTIONS, hasPotion, resolveItemUseCost } from '../src/lib/dnd/items.ts'
import { hasFastHandsFor, SUBCLASS_FEATURE_LEVEL } from '../src/content/subclasses.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'
import { grown } from './helpers/levels.ts'

const meta = { id: 'rogue', now: 1_700_000_000_000 }

function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'rogue',
    raceId: 'human',
    backgroundId: 'streetUrchin',
    flawId: 'debt',
    equipmentChoice: 'offensive',
    auraId: 'amber',
    ...overrides,
  }
}

function board(subclassId?: string) {
  const hero = grown(
    buildCharacter(answers(subclassId === undefined ? {} : { subclassId }), 'Fingers', meta),
  )
  const foe = buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'Goblin',
    { ...meta, id: 'foe' },
  )
  const base = createEncounter(
    [
      { ...characterToCombatant(hero, { position: { x: 0, y: 0 } }), currentHp: 1 },
      characterToCombatant(foe, { position: { x: 1, y: 0 }, team: 'foes' }),
    ],
    () => 0.99,
  )
  return { hero, foe, encounter: { ...base, activeIndex: base.order.indexOf(hero.id) } }
}

// --- Who pays what --------------------------------------------------------

test('only the Thief drinks on a bonus action', () => {
  assert.equal(hasFastHandsFor('thief', SUBCLASS_FEATURE_LEVEL), true)
  assert.equal(hasFastHandsFor('assassin', SUBCLASS_FEATURE_LEVEL), false)
  assert.equal(hasFastHandsFor(undefined, SUBCLASS_FEATURE_LEVEL), false)

  assert.equal(resolveItemUseCost({ hasFastHands: true }), 'bonusAction')
  assert.equal(resolveItemUseCost({}), 'action')
})

test('everyone carries a potion, and the Thief carries the flag too', () => {
  const { hero } = board('thief')
  assert.equal(hero.potions, STARTING_POTIONS)
  assert.equal(hero.hasFastHands, true)

  const plain = board('assassin')
  assert.equal(plain.hero.potions, STARTING_POTIONS)
  assert.equal('hasFastHands' in plain.hero, false)
})

test('an empty flask is not drinkable', () => {
  assert.equal(hasPotion({ potions: 1 }), true)
  assert.equal(hasPotion({ potions: 0 }), false)
  assert.equal(hasPotion({}), false)
})

// --- The budget seam ------------------------------------------------------

test('drinking heals, and spends the flask', () => {
  const { hero, encounter } = board('assassin')
  const result = drinkPotion(encounter, () => faceValue(3, 4))

  assert.equal(result.refusal, null)
  const after = result.encounter.combatants[hero.id]!
  assert.ok(after.currentHp > 1, 'the potion should have done something')
  assert.equal(after.potions, 0)
})

test('an ordinary hero spends their action and cannot then attack', () => {
  const { hero, foe, encounter } = board('assassin')
  const drunk = drinkPotion(encounter, () => faceValue(3, 4)).encounter

  assert.equal(drunk.hasActed, true, 'drinking costs the action')
  assert.equal(drunk.bonusActionSpent, false, 'and leaves the bonus action alone')

  const swing = attackWith(drunk, {
    targetId: foe.id,
    attackId: hero.attacks[0]!.id,
    rng: sequenceRng([faceValue(18, 20), faceValue(4, 6)]),
  })
  assert.match(swing.refusal ?? '', /already taken your action/i)
})

test('a Thief drinks and still swings in the same turn', () => {
  // The whole feature, in one assertion.
  const { hero, foe, encounter } = board('thief')
  const drunk = drinkPotion(encounter, () => faceValue(3, 4)).encounter

  assert.equal(drunk.bonusActionSpent, true, 'the bonus action pays for it')
  assert.equal(drunk.hasActed, false, 'the action is untouched')

  const swing = attackWith(drunk, {
    targetId: foe.id,
    attackId: hero.attacks[0]!.id,
    rng: sequenceRng([faceValue(18, 20), faceValue(4, 6)]),
  })
  assert.equal(swing.refusal, null, 'the Thief may still attack')
  assert.equal(swing.encounter.hasActed, true)
})

test('a Thief cannot drink twice in one turn either', () => {
  const { encounter } = board('thief')
  const once = drinkPotion(encounter, () => faceValue(3, 4)).encounter
  // Refill so the refusal is about the budget, not the flask.
  const refilled = {
    ...once,
    combatants: Object.fromEntries(
      Object.entries(once.combatants).map(([id, c]) => [id, { ...c, potions: 1 }]),
    ),
  }
  const twice = drinkPotion(refilled, () => faceValue(3, 4))
  assert.match(twice.refusal ?? '', /bonus action/i)
})

test('drinking with nothing left is refused and costs nothing', () => {
  const { hero, encounter } = board('thief')
  const dry = {
    ...encounter,
    combatants: {
      ...encounter.combatants,
      [hero.id]: { ...encounter.combatants[hero.id]!, potions: 0 },
    },
  }
  const result = drinkPotion(dry)
  assert.match(result.refusal ?? '', /nothing left/i)
  assert.equal(result.encounter, dry, 'a refusal must not change the board')
})

// --- Turn boundaries ------------------------------------------------------

test('both budgets come back with the next turn', () => {
  const { hero, encounter } = board('thief')
  const drunk = drinkPotion(encounter, () => faceValue(3, 4)).encounter
  assert.equal(drunk.bonusActionSpent, true)

  // Round the table back to the same hero.
  const next = endTurn(endTurn(drunk))
  assert.equal(next.bonusActionSpent, false, 'the bonus action refreshes')
  assert.equal(next.hasActed, false)
  assert.equal(next.combatants[hero.id]?.potions, 0, 'but the flask stays empty')
})

test('a fresh encounter starts with both budgets available', () => {
  const { encounter } = board('thief')
  assert.equal(encounter.hasActed, false)
  assert.equal(encounter.bonusActionSpent, false)
})
