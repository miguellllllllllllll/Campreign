import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONDITIONS,
  addCondition,
  attackRollMode,
  blocksActions,
  combineRollModes,
  hasCondition,
  removeCondition,
  tickConditions,
} from '../src/lib/dnd/conditions.ts'
import type { ActiveCondition, ConditionId } from '../src/types/combat.ts'

test('every condition carries beginner-facing copy', () => {
  const ids: ConditionId[] = [
    'poisoned', 'prone', 'frightened', 'restrained', 'blinded', 'unconscious',
  ]
  for (const id of ids) {
    const info = CONDITIONS[id]
    assert.equal(info.id, id)
    assert.ok(info.label.length > 0)
    assert.ok(info.plain.length > 20, `${id} needs a real explanation`)
  }
})

test('adding a condition twice does not duplicate it', () => {
  const once = addCondition([], 'poisoned', 3)
  const twice = addCondition(once, 'poisoned', 5)
  assert.equal(twice.length, 1)
  assert.equal(twice[0]?.roundsRemaining, 5, 'the newer duration wins')
})

test('conditions can be added, queried and removed independently', () => {
  let active = addCondition([], 'prone')
  active = addCondition(active, 'blinded', 2)
  assert.ok(hasCondition(active, 'prone'))
  assert.ok(hasCondition(active, 'blinded'))

  active = removeCondition(active, 'prone')
  assert.equal(hasCondition(active, 'prone'), false)
  assert.ok(hasCondition(active, 'blinded'))
})

test('timed conditions count down and expire, permanent ones persist', () => {
  const start: ActiveCondition[] = [
    { id: 'poisoned', roundsRemaining: 1 },
    { id: 'prone', roundsRemaining: null },
    { id: 'blinded', roundsRemaining: 2 },
  ]
  const after = tickConditions(start)
  assert.deepEqual(after, [
    { id: 'prone', roundsRemaining: null },
    { id: 'blinded', roundsRemaining: 1 },
  ], 'poisoned wore off')

  const later = tickConditions(after)
  assert.deepEqual(later, [{ id: 'prone', roundsRemaining: null }])
})

test('tickConditions does not mutate the input', () => {
  const start: ActiveCondition[] = [{ id: 'poisoned', roundsRemaining: 2 }]
  tickConditions(start)
  assert.equal(start[0]?.roundsRemaining, 2)
})

test('only incapacitating conditions block actions', () => {
  assert.equal(blocksActions([{ id: 'poisoned', roundsRemaining: null }]), false)
  assert.equal(blocksActions([{ id: 'prone', roundsRemaining: null }]), false)
  assert.equal(blocksActions([{ id: 'unconscious', roundsRemaining: null }]), true)
})

test('advantage and disadvantage cancel instead of stacking', () => {
  assert.equal(combineRollModes([]), 'normal')
  assert.equal(combineRollModes(['advantage']), 'advantage')
  assert.equal(combineRollModes(['advantage', 'advantage']), 'advantage', 'two sources are still one advantage')
  assert.equal(combineRollModes(['disadvantage', 'disadvantage']), 'disadvantage')
  assert.equal(combineRollModes(['advantage', 'disadvantage']), 'normal')
  assert.equal(
    combineRollModes(['advantage', 'advantage', 'disadvantage']),
    'normal',
    'any of each cancels entirely',
  )
})

test('attack roll mode reads both sides of the exchange', () => {
  const none: ActiveCondition[] = []

  assert.equal(attackRollMode(none, none), 'normal')
  assert.equal(
    attackRollMode([{ id: 'poisoned', roundsRemaining: null }], none),
    'disadvantage',
    'a poisoned attacker rolls worse',
  )
  assert.equal(
    attackRollMode(none, [{ id: 'prone', roundsRemaining: null }]),
    'advantage',
    'a prone target is easier to hit',
  )
  assert.equal(
    attackRollMode(
      [{ id: 'poisoned', roundsRemaining: null }],
      [{ id: 'prone', roundsRemaining: null }],
    ),
    'normal',
    'poisoned attacker versus prone target washes out',
  )
})
