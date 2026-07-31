import test from 'node:test'
import assert from 'node:assert/strict'
import { GUIDANCE_DIE, resolveCheck } from '../src/lib/dnd/checks.ts'
import { castSpell, castableOutOfCombat, castableSpells, guidesChecks } from '../src/lib/dnd/casting.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { useTutorialStore } from '../src/stores/tutorialStore.ts'
import { SPELLS_BY_ID } from '../src/content/spells.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'

const meta = { id: 'hero', now: 1_700_000_000_000 }

function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'cleric',
    raceId: 'human',
    backgroundId: 'noble',
    flawId: 'obeyed',
    equipmentChoice: 'defensive',
    auraId: 'amber',
    magicStyleId: 'healersMercy',
    ...overrides,
  }
}

const cleric = () => buildCharacter(answers(), 'Guide', meta)
const fighter = () =>
  buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'Swinger',
    meta,
  )

const baseCheck = {
  skill: 'perception' as const,
  level: 1,
  proficientSkills: [] as const,
  dc: 12,
}

// --- the die ---------------------------------------------------------------

test('Guidance adds its die to the roll and names it in the breakdown', () => {
  const hero = cleric()
  const shared = { ...baseCheck, scores: hero.scores }
  // Same d20, then a 3 on the guidance die.
  const plain = resolveCheck({ ...shared, rng: () => faceValue(9, 20) })
  const guided = resolveCheck({
    ...shared,
    guided: true,
    rng: sequenceRng([faceValue(9, 20), faceValue(3, 4)]),
  })

  assert.equal(guided.breakdown.natural, plain.breakdown.natural, 'the d20 is untouched')
  assert.equal(guided.breakdown.total, plain.breakdown.total + 3)
  const part = guided.breakdown.parts.find((one) => one.label === 'Guidance')
  assert.equal(part?.value, 3, 'no number appears in the total unexplained')
})

test('the die can turn a near miss into a success', () => {
  // The entire point of the spell, asserted rather than assumed.
  const hero = cleric()
  // Wisdom 16 is +3, so a 10 on the die reaches 13 against a DC of 15 — two
  // short, and exactly the gap a d4 is meant to close.
  const shared = { ...baseCheck, scores: hero.scores, dc: 15 }
  const missed = resolveCheck({ ...shared, rng: () => faceValue(10, 20) })
  const made = resolveCheck({
    ...shared,
    guided: true,
    rng: sequenceRng([faceValue(10, 20), faceValue(3, 4)]),
  })

  assert.equal(missed.breakdown.total, 13)
  assert.equal(made.breakdown.total, 16)

  assert.equal(missed.success, false)
  assert.equal(made.success, true)
})

test('an unguided check rolls no extra die at all', () => {
  /*
   * Guards against the die being rolled and discarded, which would desync every
   * seeded test downstream of a check — the reason Bless is rolled the same way.
   */
  const hero = cleric()
  const rng = sequenceRng([faceValue(11, 20), faceValue(2, 6)])
  const result = resolveCheck({ ...baseCheck, scores: hero.scores, rng })

  assert.equal(result.breakdown.parts.some((one) => one.label === 'Guidance'), false)
  // The second value is still unspent, so the next consumer sees it.
  assert.equal(rng(), faceValue(2, 6))
})

test('the die is the one the spell declares', () => {
  const spell = SPELLS_BY_ID['guidance']
  assert.equal(spell?.effect?.kind, 'guideCheck')
  assert.equal(spell?.effect?.kind === 'guideCheck' ? spell.effect.die : null, GUIDANCE_DIE)
})

// --- which spells reach which surface --------------------------------------

test('Guidance is offered outside a fight and nowhere else', () => {
  const hero = cleric()
  assert.deepEqual(
    castableOutOfCombat(hero).map((one) => one.id),
    ['guidance'],
  )

  const combatant = characterToCombatant(hero, { position: { x: 0, y: 0 } })
  assert.equal(
    castableSpells(combatant, [combatant]).some((one) => one.spell.id === 'guidance'),
    false,
    'a button that can never be pressed is clutter, not information',
  )
})

test('casting it in a fight is refused with a reason', () => {
  const combatant = characterToCombatant(cleric(), { position: { x: 0, y: 0 } })
  const result = castSpell({ caster: combatant, target: combatant, spellId: 'guidance' })
  assert.match(result.refusal ?? '', /skill check/)
})

test('a hero who knows no such spell is offered nothing', () => {
  assert.deepEqual(castableOutOfCombat(fighter()), [])
  assert.deepEqual(castableOutOfCombat({}), [])
})

test('guidesChecks reads the registry rather than matching an id', () => {
  assert.equal(guidesChecks('guidance'), true)
  assert.equal(guidesChecks('light'), false)
  assert.equal(guidesChecks(null), false)
})

// --- concentration, session-scoped ------------------------------------------

function freshStore() {
  useTutorialStore.getState().begin(cleric())
  return useTutorialStore
}

test('casting it starts concentration; a second cast is refused', () => {
  const store = freshStore()
  assert.equal(store.getState().concentratingOn, null)

  assert.equal(store.getState().castOutOfCombat('guidance'), null)
  assert.equal(store.getState().concentratingOn, 'guidance')

  assert.match(store.getState().castOutOfCombat('guidance') ?? '', /already holding/)
})

test('a spell with nothing to do out here is refused', () => {
  const store = freshStore()
  assert.match(store.getState().castOutOfCombat('cureWounds') ?? '', /nothing out here/)
  assert.equal(store.getState().concentratingOn, null)
})

test('a skill check spends it', () => {
  const store = freshStore()
  store.getState().castOutOfCombat('guidance')
  store.getState().dispatch({ type: 'skillCheck', skill: 'perception', success: true })
  assert.equal(store.getState().concentratingOn, null, 'one check, and it is gone')
})

test('a check that does not advance the tutorial still spends it', () => {
  /*
   * The die was rolled either way. Leaving it held because the step happened not
   * to care would hand the player a second free d4.
   */
  const store = freshStore()
  store.getState().castOutOfCombat('guidance')
  store.getState().dispatch({ type: 'skillCheck', skill: 'athletics', success: true })
  assert.equal(store.getState().concentratingOn, null)
})

test('acknowledging a step does not spend it', () => {
  const store = freshStore()
  store.getState().castOutOfCombat('guidance')
  store.getState().dispatch({ type: 'acknowledged' })
  assert.equal(store.getState().concentratingOn, 'guidance', 'no die was rolled')
})

test('restarting drops whatever was held', () => {
  const store = freshStore()
  store.getState().castOutOfCombat('guidance')
  store.getState().restart()
  assert.equal(store.getState().concentratingOn, null)
})

test('beginning a fresh run drops it too', () => {
  const store = freshStore()
  store.getState().castOutOfCombat('guidance')
  store.getState().begin(cleric())
  assert.equal(store.getState().concentratingOn, null)
})

test('concentration is not part of the character, because that is persisted', () => {
  /*
   * The reason it lives in tutorialStore at all. A spell you are holding is a
   * thing happening right now, not a property of who your hero is — persisting
   * it would mean reloading the page and finding you had held Guidance all week.
   */
  const hero = cleric()
  assert.equal('concentratingOn' in hero, false)
  const store = freshStore()
  store.getState().castOutOfCombat('guidance')
  assert.equal('concentratingOn' in useTutorialStore.getState().roster![0]!, false)
})

test('the first check on the way spends it, not the last', () => {
  /*
   * Cast at the cellar door and it is gone by the time you reach the goblin —
   * the Perception roll on the stairs used it. That is the spell working, and
   * the reason the cast button only appears on a check that is still unrolled.
   */
  const store = freshStore()
  store.getState().castOutOfCombat('guidance')
  store.getState().dispatch({ type: 'acknowledged' })
  assert.equal(store.getState().stepId, 'listen')
  assert.equal(store.getState().concentratingOn, 'guidance', 'nothing rolled yet')

  store.getState().dispatch({ type: 'skillCheck', skill: 'perception', success: true })
  assert.equal(store.getState().concentratingOn, null, 'the stairs took it')
})

test('an event that rolls nothing leaves it held', () => {
  // The false branch of "was a die actually rolled": a choice dispatched at a
  // step that has no choices resolves nothing, so it must cost nothing.
  const store = freshStore()
  store.getState().castOutOfCombat('guidance')
  assert.equal(store.getState().stepId, 'arrive')
  store.getState().dispatch({ type: 'choicePicked', choiceId: 'persuade', success: true })
  assert.equal(store.getState().concentratingOn, 'guidance')
})

test('a dialogue option that rolls does spend it', () => {
  const store = freshStore()
  while (store.getState().stepId !== 'parley') {
    store.getState().dispatch({ type: 'acknowledged' })
    store.getState().dispatch({ type: 'skillCheck', skill: 'perception', success: true })
  }
  store.getState().castOutOfCombat('guidance')
  store.getState().dispatch({ type: 'choicePicked', choiceId: 'persuade', success: true })
  assert.equal(store.getState().concentratingOn, null)
})

test('drawing steel puts out whatever was still burning', () => {
  /*
   * Guidance is spent on an ability check and there are none once initiative is
   * rolled, so carrying it onto the board would be carrying a number with
   * nothing left to add itself to.
   */
  const store = freshStore()
  while (store.getState().stepId !== 'parley') {
    store.getState().dispatch({ type: 'acknowledged' })
    store.getState().dispatch({ type: 'skillCheck', skill: 'perception', success: true })
  }
  store.getState().castOutOfCombat('guidance')
  assert.equal(store.getState().concentratingOn, 'guidance')

  store.getState().dispatch({ type: 'choicePicked', choiceId: 'attack', success: true })
  assert.equal(store.getState().stepId, 'initiative', 'combat is starting')
  assert.equal(store.getState().concentratingOn, null, 'and the spell goes out with it')
})
