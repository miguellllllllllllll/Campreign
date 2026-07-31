import test from 'node:test'
import assert from 'node:assert/strict'
import { FINAL_STEP_ID, GOBLIN_CELLAR } from '../src/content/goblinCellar.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { useCombatStore } from '../src/stores/combatStore.ts'
import { useTutorialStore } from '../src/stores/tutorialStore.ts'
import type { CreationAnswers } from '../src/types/character.ts'

const answers: CreationAnswers = {
  classId: 'fighter',
  raceId: 'dwarf',
  backgroundId: 'guildArtisan',
  flawId: 'haggler',
  equipmentChoice: 'defensive',
  auraId: 'amber',
}

function freshHero() {
  return buildCharacter(answers, 'Test Hero', { id: 'hero-1', now: 1_700_000_000_000 })
}

function begin() {
  useCombatStore.getState().reset()
  useTutorialStore.getState().begin(freshHero())
  return useTutorialStore.getState()
}

test('begin puts a hero, a squire and a goblin on the board', () => {
  begin()
  const roster = useTutorialStore.getState().roster ?? []
  assert.equal(roster.length, 3)

  const party = roster.filter((c) => c.team === 'party')
  const foes = roster.filter((c) => c.team === 'foes')
  assert.equal(party.length, 2, 'the hero no longer stands alone')
  assert.equal(foes.length, 1)

  const hero = roster[0]
  const goblin = foes[0]
  assert.equal(hero?.speedSquares, 3, 'movement is capped so it fits the board')
  assert.equal(Math.abs((hero?.position.y ?? 0) - (goblin?.position.y ?? 0)), 4)
})

test('the squire stands inside a blast aimed from the hero', () => {
  // Sculpt Spells is only observable if the ally is somewhere the fire reaches.
  begin()
  const roster = useTutorialStore.getState().roster ?? []
  const [hero, squire] = roster.filter((c) => c.team === 'party')
  assert.ok(hero !== undefined && squire !== undefined)
  const distance = Math.max(
    Math.abs(hero.position.x - squire.position.x),
    Math.abs(hero.position.y - squire.position.y),
  )
  assert.ok(distance <= 3, 'Burning Hands has a three-square radius')
  assert.notEqual(hero.id, squire.id)
})

test('an event the current step does not care about is ignored', () => {
  begin()
  useTutorialStore.getState().dispatch({ type: 'moved' })
  assert.equal(useTutorialStore.getState().stepId, 'arrive')
})

test('acknowledging the first step advances to the perception check', () => {
  begin()
  useTutorialStore.getState().dispatch({ type: 'acknowledged' })
  assert.equal(useTutorialStore.getState().stepId, 'listen')
})

test('a skill check only counts when it is the skill the step asked for', () => {
  begin()
  useTutorialStore.getState().dispatch({ type: 'acknowledged' })
  useTutorialStore.getState().dispatch({ type: 'skillCheck', skill: 'stealth', success: true })
  assert.equal(useTutorialStore.getState().stepId, 'listen', 'the wrong skill proves nothing')

  useTutorialStore.getState().dispatch({ type: 'skillCheck', skill: 'perception', success: false })
  assert.equal(useTutorialStore.getState().stepId, 'descend')
})

test('a resolved check reads out the matching outcome, not both', () => {
  begin()
  useTutorialStore.getState().dispatch({ type: 'acknowledged' })

  useTutorialStore.getState().dispatch({ type: 'skillCheck', skill: 'perception', success: true })
  const listen = GOBLIN_CELLAR.find((step) => step.id === 'listen')
  assert.equal(useTutorialStore.getState().resolution, listen?.check?.onSuccess)
})

test('picking a choice reads out that choice’s own prose', () => {
  begin()
  const store = useTutorialStore.getState()
  store.dispatch({ type: 'acknowledged' })
  store.dispatch({ type: 'skillCheck', skill: 'perception', success: true })
  store.dispatch({ type: 'acknowledged' })
  assert.equal(useTutorialStore.getState().stepId, 'parley')

  store.dispatch({ type: 'choicePicked', choiceId: 'intimidate', success: false })
  const parley = GOBLIN_CELLAR.find((step) => step.id === 'parley')
  const intimidate = parley?.choices?.find((choice) => choice.id === 'intimidate')
  assert.equal(useTutorialStore.getState().resolution, intimidate?.onFailure)
})

test('entering the initiative step is what starts the encounter', () => {
  begin()
  const store = useTutorialStore.getState()
  store.dispatch({ type: 'acknowledged' })
  store.dispatch({ type: 'skillCheck', skill: 'perception', success: true })
  store.dispatch({ type: 'acknowledged' })
  assert.equal(useCombatStore.getState().encounter, null, 'no fight during the parley')

  store.dispatch({ type: 'choicePicked', choiceId: 'attack', success: true })
  assert.equal(useTutorialStore.getState().stepId, 'initiative')

  const encounter = useCombatStore.getState().encounter
  assert.ok(encounter, 'the startCombat effect built the encounter')
  assert.equal(encounter?.order.length, 3, 'hero, squire and goblin all roll initiative')
  assert.equal(encounter?.round, 1)
})

test('walking the whole script finishes the tutorial exactly once', () => {
  begin()
  const store = useTutorialStore.getState()
  store.dispatch({ type: 'acknowledged' })
  store.dispatch({ type: 'skillCheck', skill: 'perception', success: true })
  store.dispatch({ type: 'acknowledged' })
  store.dispatch({ type: 'choicePicked', choiceId: 'persuade', success: true })
  store.dispatch({ type: 'acknowledged' })
  store.dispatch({ type: 'moved' })
  store.dispatch({ type: 'attackResolved' })
  store.dispatch({ type: 'turnEnded' })
  assert.equal(useTutorialStore.getState().stepId, 'finish')
  assert.equal(useTutorialStore.getState().finished, false)

  store.dispatch({ type: 'enemyDefeated' })
  assert.equal(useTutorialStore.getState().finished, true)
  assert.equal(useTutorialStore.getState().stepId, 'finish', 'the last step stays on screen')

  store.dispatch({ type: 'acknowledged' })
  assert.equal(useTutorialStore.getState().finished, true, 'a finished tutorial ignores events')
})

test('killing the goblin early finishes the tutorial instead of stranding the player', () => {
  begin()
  const store = useTutorialStore.getState()
  store.dispatch({ type: 'acknowledged' })
  store.dispatch({ type: 'skillCheck', skill: 'perception', success: true })
  store.dispatch({ type: 'acknowledged' })
  store.dispatch({ type: 'choicePicked', choiceId: 'attack', success: true })
  store.dispatch({ type: 'acknowledged' })
  store.dispatch({ type: 'moved' })
  assert.equal(useTutorialStore.getState().stepId, 'attack')

  // A lucky first swing drops it before the End Turn lesson is ever shown.
  store.dispatch({ type: 'attackResolved' })
  store.dispatch({ type: 'enemyDefeated' })
  assert.equal(useTutorialStore.getState().stepId, FINAL_STEP_ID)
  assert.equal(useTutorialStore.getState().finished, true)
})

test('a win before combat begins is not enough to skip the lessons', () => {
  begin()
  useTutorialStore.getState().dispatch({ type: 'enemyDefeated' })
  assert.equal(useTutorialStore.getState().stepId, 'arrive')
  assert.equal(useTutorialStore.getState().finished, false)
})
