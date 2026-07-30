import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCheck } from '../src/lib/dnd/checks.ts'
import type { AbilityScores } from '../src/types/character.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'

const SCORES: AbilityScores = { str: 10, dex: 14, con: 12, int: 8, wis: 16, cha: 12 }

test('a trained check adds both the ability modifier and proficiency', () => {
  const result = resolveCheck({
    scores: SCORES,
    skill: 'perception',
    level: 1,
    proficientSkills: ['perception'],
    dc: 12,
    rng: sequenceRng([faceValue(9, 20)]),
  })

  assert.equal(result.skill, 'perception')
  assert.equal(result.label, 'Perception')
  assert.equal(result.breakdown.natural, 9)
  assert.equal(result.breakdown.total, 14, '9 + 3 wis + 2 prof')
  assert.deepEqual(result.breakdown.parts, [
    { label: 'WIS', value: 3 },
    { label: 'Prof', value: 2 },
  ])
  assert.equal(result.success, true)
})

test('an untrained check leaves proficiency out of the breakdown', () => {
  const result = resolveCheck({
    scores: SCORES,
    skill: 'perception',
    level: 1,
    proficientSkills: ['stealth'],
    dc: 12,
    rng: sequenceRng([faceValue(9, 20)]),
  })

  assert.equal(result.breakdown.total, 12, '9 + 3 wis')
  assert.deepEqual(result.breakdown.parts, [{ label: 'WIS', value: 3 }])
  assert.equal(result.success, true, 'meeting the DC exactly succeeds')
})

test('falling one short of the difficulty class fails', () => {
  const result = resolveCheck({
    scores: SCORES,
    skill: 'perception',
    level: 1,
    proficientSkills: [],
    dc: 13,
    rng: sequenceRng([faceValue(9, 20)]),
  })
  assert.equal(result.breakdown.total, 12)
  assert.equal(result.success, false)
})

test('a zero ability modifier is omitted rather than shown as +0', () => {
  const result = resolveCheck({
    scores: SCORES,
    skill: 'athletics',
    level: 1,
    proficientSkills: [],
    dc: 10,
    rng: sequenceRng([faceValue(11, 20)]),
  })
  assert.deepEqual(result.breakdown.parts, [])
  assert.equal(result.breakdown.total, 11)
})

test('a negative ability modifier still appears in the breakdown', () => {
  const result = resolveCheck({
    scores: SCORES,
    skill: 'arcana',
    level: 1,
    proficientSkills: [],
    dc: 10,
    rng: sequenceRng([faceValue(11, 20)]),
  })
  assert.deepEqual(result.breakdown.parts, [{ label: 'INT', value: -1 }])
  assert.equal(result.breakdown.total, 10)
  assert.equal(result.success, true)
})

test('advantage keeps the better die, disadvantage the worse', () => {
  const dice = [faceValue(4, 20), faceValue(17, 20)]

  const lucky = resolveCheck({
    scores: SCORES, skill: 'stealth', level: 1, proficientSkills: [], dc: 15,
    rng: sequenceRng(dice), mode: 'advantage',
  })
  assert.equal(lucky.breakdown.natural, 17)
  assert.equal(lucky.diceRoll.mode, 'advantage')
  assert.equal(lucky.success, true)

  const unlucky = resolveCheck({
    scores: SCORES, skill: 'stealth', level: 1, proficientSkills: [], dc: 15,
    rng: sequenceRng(dice), mode: 'disadvantage',
  })
  assert.equal(unlucky.breakdown.natural, 4)
  assert.equal(unlucky.success, false)
})

test('proficiency scales with level', () => {
  const args = {
    scores: SCORES,
    skill: 'perception' as const,
    proficientSkills: ['perception' as const],
    dc: 10,
    rng: sequenceRng([faceValue(10, 20)]),
  }
  assert.equal(resolveCheck({ ...args, level: 4 }).breakdown.total, 15, '10 + 3 + 2')
  assert.equal(resolveCheck({ ...args, level: 5 }).breakdown.total, 16, '10 + 3 + 3')
  assert.equal(resolveCheck({ ...args, level: 17 }).breakdown.total, 19, '10 + 3 + 6')
})
