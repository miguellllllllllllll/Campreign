import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseNotation,
  roll,
  rollDie,
  toCriticalNotation,
  keptDice,
} from '../src/lib/dnd/dice.ts'
import { sequenceRng, constantRng, faceValue, seededRng } from './helpers/rng.ts'

test('parseNotation reads dice and flat modifiers', () => {
  assert.deepEqual(parseNotation('1d20+5'), [
    { kind: 'dice', sign: 1, count: 1, size: 20 },
    { kind: 'flat', sign: 1, value: 5 },
  ])
  assert.deepEqual(parseNotation('2d6+3'), [
    { kind: 'dice', sign: 1, count: 2, size: 6 },
    { kind: 'flat', sign: 1, value: 3 },
  ])
})

test('parseNotation handles bare dice, implicit counts and negatives', () => {
  assert.deepEqual(parseNotation('d20'), [{ kind: 'dice', sign: 1, count: 1, size: 20 }])
  assert.deepEqual(parseNotation('1d8-1'), [
    { kind: 'dice', sign: 1, count: 1, size: 8 },
    { kind: 'flat', sign: -1, value: 1 },
  ])
  assert.deepEqual(parseNotation('1d20 + 3'), [
    { kind: 'dice', sign: 1, count: 1, size: 20 },
    { kind: 'flat', sign: 1, value: 3 },
  ])
})

test('parseNotation rejects nonsense rather than guessing', () => {
  assert.throws(() => parseNotation(''))
  assert.throws(() => parseNotation('1d7'))
  assert.throws(() => parseNotation('0d6'))
  assert.throws(() => parseNotation('banana'))
})

test('rollDie stays within bounds at both extremes of the RNG', () => {
  assert.equal(rollDie(20, constantRng(0)), 1)
  assert.equal(rollDie(20, constantRng(0.999999)), 20)
  assert.equal(rollDie(6, constantRng(0.5)), 4)
})

test('roll sums dice and modifier deterministically', () => {
  const rng = sequenceRng([faceValue(14, 20)])
  const result = roll('1d20+5', { rng })
  assert.equal(result.total, 19)
  assert.equal(result.modifier, 5)
  assert.deepEqual(keptDice(result), [14])
})

test('roll adds every die in a multi-dice term', () => {
  const rng = sequenceRng([faceValue(4, 6), faceValue(5, 6)])
  const result = roll('2d6+3', { rng })
  assert.equal(result.total, 12)
  assert.deepEqual(keptDice(result), [4, 5])
})

test('advantage keeps the higher d20, disadvantage the lower', () => {
  const rolls = [faceValue(7, 20), faceValue(18, 20)]

  const adv = roll('1d20+2', { rng: sequenceRng(rolls), mode: 'advantage' })
  assert.deepEqual(adv.groups[0]?.results, [7, 18])
  assert.deepEqual(adv.groups[0]?.kept, [18])
  assert.equal(adv.total, 20)

  const dis = roll('1d20+2', { rng: sequenceRng(rolls), mode: 'disadvantage' })
  assert.deepEqual(dis.groups[0]?.kept, [7])
  assert.equal(dis.total, 9)
})

test('advantage is ignored when the notation is not a single d20', () => {
  const rng = sequenceRng([faceValue(3, 6), faceValue(6, 6)])
  const result = roll('2d6', { rng, mode: 'advantage' })
  assert.equal(result.mode, 'normal')
  assert.equal(result.total, 9)
})

test('natural 20 and natural 1 are flagged as crit and fumble', () => {
  assert.equal(roll('1d20+7', { rng: constantRng(faceValue(20, 20)) }).crit, 'hit')
  assert.equal(roll('1d20+7', { rng: constantRng(faceValue(1, 20)) }).crit, 'fumble')
  assert.equal(roll('1d20+7', { rng: constantRng(faceValue(12, 20)) }).crit, null)
})

test('crit is judged on the kept die, not the discarded one', () => {
  const rng = sequenceRng([faceValue(1, 20), faceValue(20, 20)])
  const result = roll('1d20', { rng, mode: 'advantage' })
  assert.equal(result.crit, 'hit')
})

test('damage dice are not eligible for crit flags', () => {
  assert.equal(roll('2d6+3', { rng: constantRng(faceValue(6, 6)) }).crit, null)
})

test('toCriticalNotation doubles dice but leaves the modifier alone', () => {
  assert.equal(toCriticalNotation('1d8+3'), '1d8+3'.replace('1d8', '2d8'))
  assert.equal(toCriticalNotation('2d6+4'), '4d6+4')
  assert.equal(toCriticalNotation('1d12'), '2d12')
})

test('seeded rolls never leave the legal range', () => {
  const rng = seededRng(20260729)
  for (let i = 0; i < 500; i += 1) {
    const value = roll('1d20', { rng }).total
    assert.ok(value >= 1 && value <= 20, `d20 produced ${value}`)
  }
})
