import test from 'node:test'
import assert from 'node:assert/strict'
import { canDash, hasCunningActionAt, narrateDash } from '../src/lib/dnd/cunningAction.ts'
import { arcaneRecoveryBudget, recoverSlots } from '../src/lib/dnd/arcaneRecovery.ts'
import { featuresGainedAt, levelUp, spellSlotsAt } from '../src/lib/dnd/leveling.ts'
import { slotsAt } from '../src/lib/dnd/slots.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { createEncounter, dash } from '../src/lib/dnd/encounter.ts'
import { GOBLIN, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import { useTutorialStore } from '../src/stores/tutorialStore.ts'
import { GOBLIN_CELLAR } from '../src/content/goblinCellar.ts'
import type { ClassId, CreationAnswers } from '../src/types/character.ts'

const meta = { id: 'hero', now: 1_700_000_000_000 }
const CLASS_IDS: readonly ClassId[] = ['fighter', 'wizard', 'rogue', 'cleric', 'paladin']

function hero(classId: ClassId, level = 1) {
  const style = classId === 'wizard' ? 'pyromancer' : classId === 'cleric' ? 'healersMercy' : undefined
  let built = buildCharacter(
    {
      classId, raceId: 'human', backgroundId: 'streetUrchin', flawId: 'hoarder',
      equipmentChoice: 'offensive', auraId: 'amber',
      ...(style === undefined ? {} : { magicStyleId: style }),
    } as CreationAnswers,
    'Riser',
    meta,
  )
  for (let at = 1; at < level; at += 1) built = levelUp(built).character
  return built
}

// --- Cunning Action -------------------------------------------------------

test('only a rogue dashes, and only from second level', () => {
  for (const classId of CLASS_IDS) assert.equal(hasCunningActionAt(classId, 1), false)
  assert.equal(hasCunningActionAt('rogue', 2), true)
  for (const classId of CLASS_IDS.filter((one) => one !== 'rogue')) {
    assert.equal(hasCunningActionAt(classId, 2), false, `${classId} should not dash`)
  }
})

test('levelling grants it and it reaches the board', () => {
  assert.equal('hasCunningAction' in hero('rogue', 1), false)
  const grown = hero('rogue', 2)
  assert.equal(grown.hasCunningAction, true)
  assert.equal(
    characterToCombatant(grown, { position: { x: 0, y: 0 } }).hasCunningAction,
    true,
  )
})

test('it costs the bonus action and only that', () => {
  assert.equal(canDash({ hasCunningAction: true }, false), true)
  assert.equal(canDash({ hasCunningAction: true }, true), false, 'bonus already spent')
  assert.equal(canDash({}, false), false, 'nobody else has it')
})

function board(classId: ClassId = 'rogue') {
  const combatant = characterToCombatant(hero(classId, 2), {
    position: { x: 0, y: 0 },
    speedSquares: 3,
  })
  const foe = spawnMonster(GOBLIN, { id: 'foe', position: { x: 4, y: 4 } })
  return {
    combatant,
    encounter: createEncounter([combatant, foe], () => 0.99, { leadId: combatant.id }),
  }
}

test('dashing adds a full move rather than resetting to one', () => {
  /*
   * Added, not reset. Resetting would punish a player for dashing after they
   * had already walked — the button would be worth less the later you pressed
   * it, which is the opposite of how a bonus action should feel.
   */
  const { encounter } = board()
  const walked = { ...encounter, movementRemaining: 1 }
  const dashed = dash(walked)
  assert.equal(dashed.refusal, null)
  assert.equal(dashed.encounter.movementRemaining, 1 + 3)
  assert.equal(dashed.encounter.bonusActionSpent, true)
  assert.ok(dashed.encounter.log.some((line) => /dashes/.test(line)))
})

test('you cannot dash twice, or dash without the feature', () => {
  const { encounter } = board()
  const once = dash(encounter)
  assert.equal(once.refusal, null)
  assert.match(dash(once.encounter).refusal ?? '', /already used your bonus action/)

  const fighter = board('fighter')
  assert.match(dash(fighter.encounter).refusal ?? '', /no way to move that fast/)
})

test('the log says how much further you can go', () => {
  assert.match(narrateDash('Knife', 3), /3 more squares/)
  assert.match(narrateDash('Knife', 1), /1 more square\b/)
})

// --- Arcane Recovery ------------------------------------------------------

test('only a wizard recovers, and the budget is half their level', () => {
  for (const classId of CLASS_IDS) assert.equal(arcaneRecoveryBudget(classId, 1), 0)
  assert.equal(arcaneRecoveryBudget('wizard', 2), 1)
  assert.equal(arcaneRecoveryBudget('wizard', 3), 2)
  for (const classId of CLASS_IDS.filter((one) => one !== 'wizard')) {
    assert.equal(arcaneRecoveryBudget(classId, 3), 0, `${classId} recovers nothing`)
  }
})

test('recovery buys the cheapest slots first', () => {
  // A 1st-level slot costs one point and a 2nd costs two, so a budget of two
  // buys two firsts rather than one second — the better outcome, and a
  // beginner should not have to work that out to get it.
  const full = spellSlotsAt('wizard', 3)
  const dry = [0, 0, 0]
  assert.deepEqual(recoverSlots(dry, full, 2), [0, 2, 0])
  assert.deepEqual(recoverSlots(dry, full, 1), [0, 1, 0])
})

test('recovery never exceeds what you started the day with', () => {
  const full = spellSlotsAt('wizard', 2)
  const untouched = [...full]
  assert.deepEqual(recoverSlots(untouched, full, 5), untouched, 'nothing to give back')
})

test('a class with no recovery is handed back exactly what it had', () => {
  const full = spellSlotsAt('cleric', 2)
  const spent = [0, 1]
  assert.deepEqual(recoverSlots(spent, full, arcaneRecoveryBudget('cleric', 2)), spent)
})

// --- What levelling says --------------------------------------------------

test('every class is told something true at second level', () => {
  for (const classId of CLASS_IDS) {
    const features = featuresGainedAt(classId, 2)
    assert.ok(features.length > 0, `${classId} gains nothing worth saying`)
  }
})

test('third level names the only thing that actually changes', () => {
  /*
   * The SRD hands out subclasses at 3rd; this build already gave them at 2nd,
   * so a fighter genuinely gains nothing but hit points. Saying nothing is the
   * honest answer — inventing a feature to fill the panel would be worse.
   */
  assert.deepEqual(featuresGainedAt('fighter', 3), [])
  assert.deepEqual(featuresGainedAt('rogue', 3), [])
  assert.deepEqual(featuresGainedAt('paladin', 3), [], 'a half caster waits until fifth')

  for (const classId of ['wizard', 'cleric'] as const) {
    const names = featuresGainedAt(classId, 3).map((one) => one.name)
    assert.deepEqual(names, ['Second-level spells'])
  }
})

test('what third level promises is what it hands over', () => {
  const grown = levelUp(hero('wizard', 2))
  assert.ok(grown.gains !== null)
  const named = grown.gains.features.some((one) => one.id === 'secondLevelSpells')
  const actual = slotsAt(grown.character.spellSlots, 2)
  assert.equal(named, actual > 0, 'the panel and the slots agree')
  assert.equal(actual, 2)
})

// --- Levelling more than once in one breath --------------------------------

/**
 * Walks the script to the step that levels twice, dispatching the same events
 * the runner dispatches.
 *
 * The point is that nothing here reimplements the merge. It goes through
 * `dispatch` and therefore through `applyEffect`, so if that stopped calling
 * `mergeGains` these tests would fail — which the previous version of them
 * would not have, because it did the merging itself and only checked its own
 * arithmetic.
 */
function walkToDoubleLevelUp(classId: ClassId) {
  const store = useTutorialStore
  store.getState().begin(hero(classId, 1))
  const send = (event: Parameters<ReturnType<typeof store.getState>['dispatch']>[0]) =>
    store.getState().dispatch(event)

  send({ type: 'acknowledged' })                                   // arrive
  send({ type: 'skillCheck', skill: 'perception', success: true }) // listen
  send({ type: 'acknowledged' })                                   // descend
  send({ type: 'choicePicked', choiceId: 'attack', success: true })// parley
  send({ type: 'acknowledged' })                                   // initiative
  send({ type: 'moved' })                                          // move
  send({ type: 'attackResolved' })                                 // attack
  send({ type: 'turnEnded' })                                      // endTurn
  send({ type: 'enemyDefeated' })                                  // rout -> aftermath
  send({ type: 'acknowledged' })                                   // aftermath -> deeper
  send({ type: 'acknowledged' })                                   // deeper -> swarm
  send({ type: 'enemyDefeated' })                                  // swarm -> rafters
  return store.getState()
}

test('the script really does reach the step that levels twice', () => {
  // Guards the walk itself. If the tutorial is restructured again this fails
  // first, rather than the assertions below quietly testing nothing.
  const state = walkToDoubleLevelUp('fighter')
  assert.equal(state.stepId, 'rafters')
  const step = GOBLIN_CELLAR.find((one) => one.id === 'rafters')
  assert.equal(
    (step?.onEnter ?? []).filter((effect) => effect.kind === 'levelUp').length,
    2,
    'and it is still two level-ups, which is the whole premise',
  )
})

test('a jump from 1 to 3 announces everything earned on the way', () => {
  /*
   * Each `levelUp` effect used to replace the recorded gains rather than merge
   * them, so the panel reported only what third level gave — and a fighter
   * silently gained Action Surge, a rogue silently gained Cunning Action, a
   * paladin silently gained Divine Smite.
   */
  for (const [classId, expected] of [
    ['fighter', 'Action Surge'],
    ['rogue', 'Cunning Action'],
    ['wizard', 'Arcane Recovery'],
    ['paladin', 'Divine Smite'],
  ] as const) {
    const gains = walkToDoubleLevelUp(classId).levelGains
    assert.ok(gains !== null, `${classId} recorded nothing`)
    assert.equal(gains.level, 3, `${classId} should end at third level`)
    assert.ok(
      gains.features.some((one) => one.name === expected),
      `${classId} gained ${expected} and was not told: `
        + `${gains.features.map((one) => one.name).join(', ') || 'nothing'}`,
    )
  }
})

test('the reported hit points are both levels, not the last one', () => {
  const state = walkToDoubleLevelUp('fighter')
  const gains = state.levelGains
  const character = state.character
  assert.ok(gains !== null && character !== null)

  const started = hero('fighter', 1)
  assert.equal(character.level, 3)
  assert.equal(
    gains.hitPointsGained,
    character.maxHp - started.maxHp,
    'the panel and the sheet agree on what was gained',
  )
})

test('a caster is told about both tiers it crossed', () => {
  // A wizard passes through 2nd and 3rd in one step, so the panel owes them
  // Arcane Recovery *and* the new tier of spells.
  const gains = walkToDoubleLevelUp('wizard').levelGains
  assert.ok(gains !== null)
  const names = gains.features.map((one) => one.name)
  assert.ok(names.includes('Arcane Recovery'), names.join(', '))
  assert.ok(names.includes('Second-level spells'), names.join(', '))
})

test('gains do not leak in from an earlier level-up moment', () => {
  /*
   * The accumulation resets when a step that levels is entered. Without that,
   * a second level-up beat would report the first one's features again — the
   * opposite failure to the one being fixed, and just as wrong.
   */
  const first = walkToDoubleLevelUp('fighter').levelGains
  assert.ok(first !== null)
  const second = walkToDoubleLevelUp('fighter').levelGains
  assert.ok(second !== null)
  assert.equal(
    second.features.length,
    first.features.length,
    'a fresh run reports the same, not twice as much',
  )
  assert.equal(second.hitPointsGained, first.hitPointsGained)
})

