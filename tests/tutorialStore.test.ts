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
  assert.equal(useTutorialStore.getState().stepId, 'rout')
  assert.equal(useTutorialStore.getState().finished, false)

  // Winning the first fight is no longer the end of anything but the goblin.
  store.dispatch({ type: 'enemyDefeated' })
  assert.equal(useTutorialStore.getState().stepId, 'aftermath')
  assert.equal(useTutorialStore.getState().finished, false)

  store.dispatch({ type: 'acknowledged' })
  assert.equal(useTutorialStore.getState().stepId, 'deeper')
  store.dispatch({ type: 'acknowledged' })
  assert.equal(useTutorialStore.getState().stepId, 'swarm')

  // Winning the second fight brings the spider down out of the rafters rather
  // than ending the tutorial — the venom lesson is the last thing taught.
  store.dispatch({ type: 'enemyDefeated' })
  assert.equal(useTutorialStore.getState().stepId, 'rafters')
  assert.equal(useTutorialStore.getState().finished, false)

  store.dispatch({ type: 'acknowledged' })
  assert.equal(useTutorialStore.getState().stepId, 'venom')

  store.dispatch({ type: 'enemyDefeated' })
  assert.equal(useTutorialStore.getState().stepId, FINAL_STEP_ID)
  assert.equal(useTutorialStore.getState().finished, true)

  store.dispatch({ type: 'acknowledged' })
  assert.equal(useTutorialStore.getState().finished, true, 'a finished tutorial ignores events')
})

test('the second fight puts two foes on the board, not another goblin', () => {
  const store = walkToSecondFight()
  const encounter = useCombatStore.getState().encounter
  assert.equal(encounter?.order.length, 4, 'hero, squire and two of them')

  const foes = Object.values(encounter?.combatants ?? {}).filter((one) => one.team === 'foes')
  assert.deepEqual(
    foes.map((one) => one.id).sort(),
    ['giantBat', 'skeleton'],
    'the bestiary finally reaches a board',
  )
  assert.equal(store.stepId, 'swarm')
})

test('the hero arrives at the second fight levelled and rested', () => {
  /*
   * The reason the roster is rebuilt rather than stored once at the start: a
   * level-2 hero has hit points and slots that a roster built before the first
   * fight cannot know about.
   */
  begin()
  const before = useTutorialStore.getState().character
  assert.ok(before !== null)

  walkToSecondFight()
  const after = useTutorialStore.getState().character
  assert.ok(after !== null)
  assert.equal(after.level, 2)
  assert.ok(after.maxHp > before.maxHp, 'levelling gave hit points')
  assert.equal(after.currentHp, after.maxHp, 'and the rest gave them back')

  const hero = useCombatStore.getState().encounter?.combatants[after.id]
  assert.equal(hero?.maxHp, after.maxHp, 'the board agrees with the sheet')
  assert.equal(hero?.level, 2)
})

test('what changed is recorded so the aftermath step can say it', () => {
  begin()
  const store = useTutorialStore.getState()
  assert.equal(store.levelGains, null)

  walkToRout()
  useTutorialStore.getState().dispatch({ type: 'enemyDefeated' })

  const gains = useTutorialStore.getState().levelGains
  assert.equal(gains?.level, 2)
  assert.ok((gains?.hitPointsGained ?? 0) > 0)
})

test('killing the goblin early goes to the aftermath, not nowhere', () => {
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
  assert.equal(useTutorialStore.getState().stepId, 'aftermath')
  assert.equal(useTutorialStore.getState().finished, false, 'there is a second fight to come')
})

test('playing it again starts from the hero who walked in, not the levelled one', () => {
  /*
   * Levelling lives in this store rather than the persisted character precisely
   * so replaying cannot stack levels a single goblin never justified.
   */
  begin()
  const original = useTutorialStore.getState().character
  walkToSecondFight()
  assert.equal(useTutorialStore.getState().character?.level, 2)

  useTutorialStore.getState().restart()
  const after = useTutorialStore.getState()
  assert.equal(after.character?.level, 1)
  assert.deepEqual(after.character, original)
  assert.equal(after.levelGains, null)
  assert.equal(after.stepId, 'arrive')
})

function walkToRout() {
  const store = useTutorialStore.getState()
  store.dispatch({ type: 'acknowledged' })
  store.dispatch({ type: 'skillCheck', skill: 'perception', success: true })
  store.dispatch({ type: 'acknowledged' })
  store.dispatch({ type: 'choicePicked', choiceId: 'persuade', success: true })
  store.dispatch({ type: 'acknowledged' })
  store.dispatch({ type: 'moved' })
  store.dispatch({ type: 'attackResolved' })
  store.dispatch({ type: 'turnEnded' })
  return useTutorialStore.getState()
}

/** Everything up to and including the second roster hitting the board. */
function walkToSecondFight() {
  begin()
  walkToRout()
  useTutorialStore.getState().dispatch({ type: 'enemyDefeated' })
  useTutorialStore.getState().dispatch({ type: 'acknowledged' })
  useTutorialStore.getState().dispatch({ type: 'acknowledged' })
  return useTutorialStore.getState()
}

test('a win before combat begins is not enough to skip the lessons', () => {
  begin()
  useTutorialStore.getState().dispatch({ type: 'enemyDefeated' })
  assert.equal(useTutorialStore.getState().stepId, 'arrive')
  assert.equal(useTutorialStore.getState().finished, false)
})

test('restarting clears the board, so a defeat is escapable', () => {
  /*
   * The runner renders its defeat panel from `encounterWinner`, not from
   * tutorial state. Leaving a lost encounter behind meant "Try again" reset the
   * script and then drew the same panel again — the one route out being the
   * button that had just visibly done nothing.
   */
  begin()
  walkToRout()
  assert.ok(useCombatStore.getState().encounter !== null, 'a fight is on the board')

  useTutorialStore.getState().restart()
  assert.equal(useCombatStore.getState().encounter, null, 'and the board is cleared with it')
  assert.equal(useTutorialStore.getState().stepId, 'arrive')
})
