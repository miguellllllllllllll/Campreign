import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_LEVEL,
  SPELL_SLOTS_BY_LEVEL,
  castingProgressionFor,
  featuresGainedAt,
  hitPointsGainedAt,
  levelUp,
  spellSlotsAt,
} from '../src/lib/dnd/leveling.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { getSpellcastingLimits } from '../src/lib/dnd/spellcasting.ts'
import { CLASS_PRESETS } from '../src/lib/dnd/presets.ts'
import { abilityModifier, proficiencyBonus } from '../src/lib/dnd/stats.ts'
import type { ClassId, CreationAnswers } from '../src/types/character.ts'

const CLASS_IDS: readonly ClassId[] = ['fighter', 'wizard', 'rogue', 'cleric', 'paladin']

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

function hero(classId: ClassId) {
  const style =
    classId === 'wizard' ? 'pyromancer' : classId === 'cleric' ? 'healersMercy' : undefined
  return buildCharacter(
    {
      ...answers({ classId }),
      backgroundId: 'guildArtisan',
      flawId: 'haggler',
      ...(style === undefined ? { magicStyleId: undefined } : { magicStyleId: style }),
    } as CreationAnswers,
    'Riser',
    { id: 'riser', now: 0 },
  )
}

// --- hit points ------------------------------------------------------------

test('a level adds the fixed average of the hit die plus Constitution', () => {
  // d10 averages 6 by the SRD's fixed rule, not 5.5 rounded.
  assert.equal(hitPointsGainedAt(10, 0), 6)
  assert.equal(hitPointsGainedAt(8, 0), 5)
  assert.equal(hitPointsGainedAt(6, 0), 4)
  assert.equal(hitPointsGainedAt(10, 3), 9)
})

test('levelling never costs hit points, however dreadful the Constitution', () => {
  assert.equal(hitPointsGainedAt(6, -5), 1)
  assert.ok(hitPointsGainedAt(6, -100) >= 1)
})

test('current hit points rise with maximum rather than refilling', () => {
  /*
   * Levelling up is not a heal. A character who levels at 3 of 10 should be at
   * 9 of 16 — richer, and still hurt.
   */
  const wounded = { ...hero('fighter'), currentHp: 3, maxHp: 10 }
  const result = levelUp(wounded)
  assert.equal(result.refusal, null)
  assert.equal(result.gains?.hitPointsGained, hitPointsGainedAt(10, abilityModifier(wounded.scores.con)))
  assert.equal(result.character.maxHp - result.character.currentHp, 7, 'the same wound, on a bigger frame')
})

test('every class gains the average of its own die', () => {
  for (const classId of CLASS_IDS) {
    const before = hero(classId)
    const after = levelUp(before)
    const expected = hitPointsGainedAt(
      CLASS_PRESETS[classId].hitDie,
      abilityModifier(before.scores.con),
    )
    assert.equal(after.character.maxHp - before.maxHp, expected, `${classId} gained the wrong amount`)
  }
})

// --- spell slots -----------------------------------------------------------

test('a full caster goes from the tutorial-s one slot to the SRD-s three', () => {
  /*
   * One at 1st level is this app's divergence, made so that spending it is a
   * decision. From 2nd level the SRD's table takes over.
   */
  assert.equal(spellSlotsAt('cleric', 1), 1)
  assert.equal(spellSlotsAt('cleric', 2), 3)
  assert.equal(spellSlotsAt('wizard', 2), 3)
})

test('a paladin has no magic at all until second level, then has some', () => {
  // The half-caster's whole shape, and the promise `unlocksAtLevel` was making.
  assert.equal(spellSlotsAt('paladin', 1), 0)
  assert.equal(spellSlotsAt('paladin', 2), 2)
  assert.equal(getSpellcastingLimits('paladin', 1, 1, 1).unlocksAtLevel, 2)
  assert.equal(getSpellcastingLimits('paladin', 1, 1, 2).unlocksAtLevel, undefined)
  assert.ok(getSpellcastingLimits('paladin', 1, 1, 2).preparedSpellsCount > 0)
})

test('classes without magic never acquire any', () => {
  for (const classId of ['fighter', 'rogue'] as const) {
    assert.equal(castingProgressionFor(classId), 'none')
    for (let level = 1; level <= 5; level += 1) assert.equal(spellSlotsAt(classId, level), 0)
    assert.equal(levelUp(hero(classId)).character.spellSlots, undefined)
  }
})

test('a level past the written table does not fall off the end', () => {
  // Guards the index clamp rather than the numbers: no undefined, no crash.
  for (const classId of CLASS_IDS) {
    assert.equal(Number.isInteger(spellSlotsAt(classId, 99)), true)
    assert.ok(spellSlotsAt(classId, 99) >= 0)
  }
})

test('levelling a cleric actually hands them the slots', () => {
  const before = hero('cleric')
  assert.equal(before.spellSlots, 1)
  const after = levelUp(before)
  assert.equal(after.character.spellSlots, 3)
  assert.equal(after.gains?.spellSlots, 3)
})

test('a cleric prepares Wisdom plus level, which is what it always was at level 1', () => {
  // The generalisation has to agree with the old flat formula where they overlap,
  // or every existing character silently changes shape.
  for (const wis of [-1, 0, 2, 3]) {
    assert.equal(getSpellcastingLimits('cleric', wis, 0, 1).preparedSpellsCount, Math.max(1, 1 + wis))
    assert.equal(getSpellcastingLimits('cleric', wis, 0, 2).preparedSpellsCount, Math.max(1, 2 + wis))
  }
})

// --- features ---------------------------------------------------------------

test('every class gains something nameable at second level', () => {
  for (const classId of CLASS_IDS) {
    const features = featuresGainedAt(classId, 2)
    assert.ok(features.length > 0, `${classId} gains nothing worth saying`)
    for (const feature of features) {
      assert.ok(feature.name.length > 0)
      assert.ok(feature.description.length > 20, `${feature.id} needs a real sentence`)
    }
  }
})

test('levels that grant nothing say so rather than inventing something', () => {
  for (const classId of CLASS_IDS) {
    assert.deepEqual(featuresGainedAt(classId, 1), [])
    assert.deepEqual(featuresGainedAt(classId, 3), [])
  }
})

test('the paladin gains spellcasting by name, since that is the headline', () => {
  const ids = featuresGainedAt('paladin', 2).map((one) => one.id)
  assert.ok(ids.includes('paladinSpellcasting'))
})

// --- the cap ----------------------------------------------------------------

test('levelling refuses at the cap instead of silently doing nothing', () => {
  let character = hero('fighter')
  for (let i = 1; i < MAX_LEVEL; i += 1) character = levelUp(character).character
  assert.equal(character.level, MAX_LEVEL)

  const refused = levelUp(character)
  assert.match(refused.refusal ?? '', /as far as this build goes/)
  assert.equal(refused.gains, null)
  assert.equal(refused.character, character, 'and hands back exactly what it was given')
})

test('the cap sits exactly where second-level spell slots would start', () => {
  /*
   * This is the whole reason MAX_LEVEL is 2. `Character.spellSlots` is one
   * number meaning first-level slots, so the first level that grants a second
   * tier is the first level this app cannot represent. If someone raises the cap
   * without giving slots a table, this is the test that should stop them.
   */
  assert.equal(MAX_LEVEL, 2)
  assert.equal(SPELL_SLOTS_BY_LEVEL.full[MAX_LEVEL], 3, 'still first-level slots only')
  assert.ok(MAX_LEVEL + 1 === 3, 'third level is where the SRD adds 2nd-level slots')
})

test('proficiency does not move at second level, and the gains do not claim it did', () => {
  assert.equal(proficiencyBonus(1), proficiencyBonus(2))
  const gains = levelUp(hero('rogue')).gains
  assert.equal(gains?.proficiencyBonus, undefined, 'only reported when it actually changed')
})

test('a levelled character is a new object, and the old one is untouched', () => {
  const before = hero('cleric')
  const snapshot = { ...before }
  const after = levelUp(before)
  assert.notEqual(after.character, before)
  assert.deepEqual(before, snapshot, 'nothing here mutates')
})
