import test from 'node:test'
import assert from 'node:assert/strict'
import { FINAL_STEP_ID, FIRST_STEP_ID, GOBLIN_CELLAR, stepById } from '../src/content/goblinCellar.ts'
import { SKILL_LABELS } from '../src/lib/dnd/stats.ts'
import type { TutorialPhase } from '../src/types/tutorial.ts'

test('step ids are unique and the first step exists', () => {
  const ids = GOBLIN_CELLAR.map((step) => step.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(stepById(FIRST_STEP_ID), 'the entry point must resolve')
})

test('every next pointer resolves, and exactly one step ends the tutorial', () => {
  const endings = GOBLIN_CELLAR.filter((step) => step.next === null)
  assert.equal(endings.length, 1, 'there is one and only one finish line')
  assert.equal(endings[0]?.id, FINAL_STEP_ID, 'FINAL_STEP_ID names the real ending')

  for (const step of GOBLIN_CELLAR) {
    if (step.next === null) continue
    assert.ok(stepById(step.next), `${step.id} points at missing step "${step.next}"`)
  }
})

test('walking the chain from the start reaches the end without looping', () => {
  const visited: string[] = []
  let current = stepById(FIRST_STEP_ID)

  while (current !== undefined) {
    assert.ok(!visited.includes(current.id), `${current.id} was visited twice`)
    visited.push(current.id)
    current = current.next === null ? undefined : stepById(current.next)
  }

  assert.equal(visited.length, GOBLIN_CELLAR.length, 'no step is unreachable')
})

test('the three taught phases appear in order', () => {
  const phases: TutorialPhase[] = []
  for (const step of GOBLIN_CELLAR) {
    if (phases.at(-1) !== step.phase) phases.push(step.phase)
  }
  assert.deepEqual(phases, ['exploration', 'social', 'combat'])
})

test('every step gives the player an instruction they can act on', () => {
  for (const step of GOBLIN_CELLAR) {
    assert.ok(step.title.length > 0, `${step.id} has no title`)
    assert.ok(step.narration.length > 40, `${step.id} narration is too thin`)
    assert.ok(step.guidance.length > 30, `${step.id} guidance must tell the player what to do`)
    assert.doesNotMatch(step.guidance, /TODO|TBD/i, `${step.id} guidance is a placeholder`)
  }
})

test('a step that completes on a skill check carries the check it needs', () => {
  for (const step of GOBLIN_CELLAR) {
    if (step.completion.when !== 'skillCheck') continue
    assert.ok(step.check, `${step.id} completes on a check but defines none`)
    assert.equal(step.check?.skill, step.completion.skill, `${step.id} checks the wrong skill`)
    assert.ok((step.check?.dc ?? 0) >= 5, `${step.id} needs a sensible difficulty`)
    assert.ok(step.check?.onSuccess.length ?? 0 > 0)
    assert.ok(step.check?.onFailure.length ?? 0 > 0)
  }
})

test('a step that completes on a choice offers choices, all fully written', () => {
  const choiceSteps = GOBLIN_CELLAR.filter((step) => step.completion.when === 'choicePicked')
  assert.ok(choiceSteps.length > 0, 'the social phase needs at least one decision')

  for (const step of choiceSteps) {
    assert.ok((step.choices?.length ?? 0) >= 2, `${step.id} needs a real decision`)
    for (const choice of step.choices ?? []) {
      assert.ok(choice.label.length > 0)
      assert.ok(choice.onSuccess.length > 20, `${choice.id} has no success text`)
      assert.ok(choice.onFailure.length > 20, `${choice.id} has no failure text`)
      if (choice.check !== undefined) {
        assert.ok(choice.check.skill in SKILL_LABELS, `${choice.id} rolls an unknown skill`)
      }
    }
  }
})

test('at least one choice needs no roll, so the player is never blocked by bad luck', () => {
  const parley = GOBLIN_CELLAR.find((step) => step.completion.when === 'choicePicked')
  assert.ok(parley?.choices?.some((choice) => choice.check === undefined))
})

test('each fight is started once, by an effect on entering a step', () => {
  const starters = GOBLIN_CELLAR.flatMap((step) =>
    (step.onEnter ?? [])
      .filter((effect) => effect.kind === 'startCombat')
      .map((effect) => ({ step, encounterId: effect.encounterId })),
  )
  assert.equal(starters.length, 2, 'one cellar goblin, then whatever came through the drain')
  for (const { step } of starters) assert.equal(step.phase, 'combat')

  /*
   * Distinct ids, or the second fight silently respawns the first. The opening
   * encounter deliberately names none — it predates there being a choice, and
   * `startCombat` with no id still means "the one at the start".
   */
  const ids = starters.map((one) => one.encounterId)
  assert.equal(new Set(ids).size, ids.length, 'two starts, two rosters')
  assert.equal(ids[0], undefined)
})

test('every fight has somewhere to go when it is won', () => {
  /*
   * The bug this exists to catch: a combat step with no `victory` swallows the
   * win, and the player stands on a cleared board with nothing to press. It was
   * a single hard-coded jump to the ending until there were two fights.
   */
  for (const step of GOBLIN_CELLAR) {
    if (step.phase !== 'combat') continue
    const canBeWonHere = step.completion.when !== 'acknowledged'
    if (!canBeWonHere) continue
    assert.ok(step.victory !== undefined, `${step.id} can be won and goes nowhere`)
    assert.ok(stepById(step.victory), `${step.id} points at a step that does not exist`)
  }
})

test('the combat phase teaches movement, then action, then ending the turn', () => {
  const combat = GOBLIN_CELLAR.filter((step) => step.phase === 'combat')
  const order = combat.map((step) => step.completion.when)
  const moved = order.indexOf('moved')
  const acted = order.indexOf('attackResolved')
  const ended = order.indexOf('turnEnded')

  assert.ok(moved >= 0 && acted >= 0 && ended >= 0, 'all three lessons are present')
  assert.ok(moved < acted, 'movement is taught before the action')
  assert.ok(acted < ended, 'the action is taught before ending the turn')
  /*
   * The ending is now a step of its own rather than the winning step itself.
   * With two fights, "somebody won" and "the tutorial is over" are different
   * events, so what matters is that the last thing before the ending is a win.
   */
  const ending = combat.at(-1)
  assert.equal(ending?.next, null, 'the last combat step is the ending')
  assert.equal(combat.at(-2)?.completion.when, 'enemyDefeated', 'and it is reached by winning')
})
