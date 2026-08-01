import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTION_SURGES_AT_LEVEL_2,
  actionSurgesFor,
  canActionSurge,
  spendActionSurge,
} from '../src/lib/dnd/actionSurge.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { levelUp } from '../src/lib/dnd/leveling.ts'
import { actionSurge, attackWith, createEncounter } from '../src/lib/dnd/encounter.ts'
import { spawnMonster, GOBLIN } from '../src/lib/dnd/data/monsters.ts'
import { faceValue } from './helpers/rng.ts'
import type { ClassId, CreationAnswers } from '../src/types/character.ts'

const meta = { id: 'hero', now: 1_700_000_000_000 }
const CLASS_IDS: readonly ClassId[] = ['fighter', 'wizard', 'rogue', 'cleric', 'paladin']

function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'fighter',
    raceId: 'human',
    backgroundId: 'guildArtisan',
    flawId: 'haggler',
    equipmentChoice: 'offensive',
    auraId: 'amber',
    ...overrides,
  }
}

const fighter = () => buildCharacter(answers(), 'Surger', meta)

// --- who gets one ---------------------------------------------------------

test('only a fighter surges, and only from second level', () => {
  for (const classId of CLASS_IDS) {
    assert.equal(actionSurgesFor(classId, 1), undefined, `${classId} surges at level 1`)
  }
  assert.equal(actionSurgesFor('fighter', 2), ACTION_SURGES_AT_LEVEL_2)
  for (const classId of CLASS_IDS.filter((one) => one !== 'fighter')) {
    assert.equal(actionSurgesFor(classId, 2), undefined, `${classId} should not surge`)
  }
})

test('a level-1 fighter carries no surge field at all', () => {
  // Absent rather than zero, so nothing downstream has to ask what class it is.
  const hero = fighter()
  assert.equal('actionSurges' in hero, false)
  assert.equal(characterToCombatant(hero, { position: { x: 0, y: 0 } }).actionSurges, undefined)
})

test('levelling grants it, and it reaches the board', () => {
  const grown = levelUp(fighter()).character
  assert.equal(grown.actionSurges, ACTION_SURGES_AT_LEVEL_2)
  const onBoard = characterToCombatant(grown, { position: { x: 0, y: 0 } })
  assert.equal(onBoard.actionSurges, ACTION_SURGES_AT_LEVEL_2)
})

test('levelling a wizard grants nothing of the kind', () => {
  const grown = levelUp(
    buildCharacter(answers({ classId: 'wizard', magicStyleId: 'pyromancer' }), 'W', meta),
  ).character
  assert.equal('actionSurges' in grown, false)
})

// --- when it may be spent -------------------------------------------------

test('it is offered only once the action is gone', () => {
  /*
   * A surge spent to recover an action you still had is the player paying a
   * once-per-rest resource for nothing. The button must not exist yet.
   */
  const surger = { actionSurges: 1 }
  assert.equal(canActionSurge(surger, false), false, 'action still in hand')
  assert.equal(canActionSurge(surger, true), true)
  assert.equal(canActionSurge({ actionSurges: 0 }, true), false)
  assert.equal(canActionSurge({}, true), false, 'nobody else has one')
})

test('spending leaves one fewer and never goes below zero', () => {
  const hero = characterToCombatant(levelUp(fighter()).character, { position: { x: 0, y: 0 } })
  const once = spendActionSurge(hero)
  assert.equal(once.actionSurges, 0)
  assert.equal(spendActionSurge(once).actionSurges, 0, 'floored')
  assert.equal(hero.actionSurges, ACTION_SURGES_AT_LEVEL_2, 'nothing here mutates')
})

// --- on the board ---------------------------------------------------------

function board() {
  const hero = characterToCombatant(levelUp(fighter()).character, {
    position: { x: 0, y: 0 },
    speedSquares: 3,
  })
  const foe = spawnMonster(GOBLIN, { id: 'goblin', position: { x: 1, y: 0 } })
  return { hero, encounter: createEncounter([hero, foe], () => 0.99, { leadId: hero.id }) }
}

test('surging hands back the action that was spent', () => {
  const { hero, encounter } = board()
  const swung = attackWith(encounter, {
    targetId: 'goblin',
    attackId: hero.attacks[0]!.id,
    rng: () => faceValue(12, 20),
  })
  assert.equal(swung.encounter.hasActed, true)

  const surged = actionSurge(swung.encounter)
  assert.equal(surged.refusal, null)
  assert.equal(surged.encounter.hasActed, false, 'a second action, right now')
  assert.equal(surged.encounter.combatants[hero.id]?.actionSurges, 0)
  assert.ok(surged.encounter.log.some((line) => /surges/.test(line)))
})

test('surging does not also refill movement', () => {
  /*
   * Action Surge grants an action in the SRD and nothing else. A feature that
   * quietly restored movement too would be a different, better feature that
   * the tutorial never explained.
   */
  const { hero, encounter } = board()
  const moved = { ...encounter, movementRemaining: 0, hasActed: true }
  const surged = actionSurge(moved)
  assert.equal(surged.refusal, null)
  assert.equal(surged.encounter.movementRemaining, 0)
  assert.equal(surged.encounter.combatants[hero.id]?.actionSurges, 0)
})

test('you cannot surge before you have acted, or twice', () => {
  const { encounter } = board()
  assert.match(actionSurge(encounter).refusal ?? '', /spend it before you surge/)

  const acted = { ...encounter, hasActed: true }
  const once = actionSurge(acted)
  assert.equal(once.refusal, null)

  const again = actionSurge({ ...once.encounter, hasActed: true })
  assert.match(again.refusal ?? '', /no surge left/)
})

test('a hero without one is refused rather than quietly given a turn', () => {
  const hero = characterToCombatant(fighter(), { position: { x: 0, y: 0 }, speedSquares: 3 })
  const foe = spawnMonster(GOBLIN, { id: 'goblin', position: { x: 1, y: 0 } })
  const encounter = createEncounter([hero, foe], () => 0.99, { leadId: hero.id })
  const result = actionSurge({ ...encounter, hasActed: true })
  assert.match(result.refusal ?? '', /no surge left/)
  assert.equal(result.encounter.hasActed, true, 'and the turn is untouched')
})

test('the second action can actually be used to attack again', () => {
  // The end-to-end claim. Two attacks in one turn is the whole feature.
  //
  // The goblin is propped up to 40 hit points on purpose: at its own 7 a
  // greatsword drops it with the first swing and the second is refused for
  // having nothing to hit, which would test the wrong thing entirely.
  const { hero, encounter: base } = board()
  const tough = base.combatants['goblin']
  assert.ok(tough !== undefined)
  const encounter = {
    ...base,
    combatants: { ...base.combatants, goblin: { ...tough, maxHp: 40, currentHp: 40 } },
  }
  const first = attackWith(encounter, {
    targetId: 'goblin',
    attackId: hero.attacks[0]!.id,
    rng: () => faceValue(18, 20),
  })
  const surged = actionSurge(first.encounter)
  const second = attackWith(surged.encounter, {
    targetId: 'goblin',
    attackId: hero.attacks[0]!.id,
    rng: () => faceValue(18, 20),
  })
  assert.equal(second.refusal, null, 'the second swing is legal')
  assert.equal(second.outcome?.kind === 'hit' || second.outcome?.kind === 'crit', true)
  assert.equal(second.encounter.hasActed, true, 'and spends the turn again')
})
