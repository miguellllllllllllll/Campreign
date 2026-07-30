import test from 'node:test'
import assert from 'node:assert/strict'
import {
  abilityModifier,
  proficiencyBonus,
  skillBonus,
  passiveScore,
  formatModifier,
} from '../src/lib/dnd/stats.ts'
import type { AbilityScores } from '../src/types/character.ts'

test('abilityModifier follows floor((score - 10) / 2)', () => {
  assert.equal(abilityModifier(1), -5)
  assert.equal(abilityModifier(8), -1)
  assert.equal(abilityModifier(9), -1)
  assert.equal(abilityModifier(10), 0)
  assert.equal(abilityModifier(11), 0)
  assert.equal(abilityModifier(12), 1)
  assert.equal(abilityModifier(15), 2)
  assert.equal(abilityModifier(20), 5)
  assert.equal(abilityModifier(30), 10)
})

test('odd scores round down, never up', () => {
  assert.equal(abilityModifier(13), 1)
  assert.equal(abilityModifier(7), -2)
})

test('proficiencyBonus scales +2 at level 1 and +6 at level 20', () => {
  assert.equal(proficiencyBonus(1), 2)
  assert.equal(proficiencyBonus(4), 2)
  assert.equal(proficiencyBonus(5), 3)
  assert.equal(proficiencyBonus(8), 3)
  assert.equal(proficiencyBonus(9), 4)
  assert.equal(proficiencyBonus(13), 5)
  assert.equal(proficiencyBonus(17), 6)
  assert.equal(proficiencyBonus(20), 6)
})

test('proficiencyBonus clamps out-of-range levels', () => {
  assert.equal(proficiencyBonus(0), 2)
  assert.equal(proficiencyBonus(-3), 2)
  assert.equal(proficiencyBonus(99), 6)
})

const scores: AbilityScores = { str: 16, dex: 14, con: 15, int: 8, wis: 12, cha: 10 }

test('skillBonus adds proficiency only for trained skills', () => {
  assert.equal(skillBonus(scores, 'athletics', 1, ['athletics']), 5)
  assert.equal(skillBonus(scores, 'athletics', 1, []), 3)
  assert.equal(skillBonus(scores, 'perception', 1, ['perception']), 3)
  assert.equal(skillBonus(scores, 'arcana', 1, ['arcana']), 1)
})

test('skillBonus maps each skill to its governing ability', () => {
  assert.equal(skillBonus(scores, 'stealth', 1, []), 2)
  assert.equal(skillBonus(scores, 'persuasion', 1, []), 0)
  assert.equal(skillBonus(scores, 'investigation', 1, []), -1)
})

test('passiveScore is 10 plus the bonus', () => {
  assert.equal(passiveScore(3), 13)
  assert.equal(passiveScore(-1), 9)
})

test('formatModifier always shows a sign', () => {
  assert.equal(formatModifier(3), '+3')
  assert.equal(formatModifier(0), '+0')
  assert.equal(formatModifier(-2), '-2')
})
