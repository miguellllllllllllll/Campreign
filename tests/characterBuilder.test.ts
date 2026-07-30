import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCharacter,
  applyRacialBonuses,
  armorClass,
  maxHitPoints,
  attackBonus,
  damageNotation,
} from '../src/lib/dnd/characterBuilder.ts'
import { ARMORS, CLASS_PRESETS } from '../src/lib/dnd/presets.ts'
import type { CreationAnswers } from '../src/types/character.ts'

const meta = { id: 'test-id', now: 1_700_000_000_000 }

test('racial bonuses are added per ability', () => {
  const base = { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }
  assert.deepEqual(applyRacialBonuses(base, { con: 2 }), {
    str: 15, dex: 13, con: 16, int: 8, wis: 12, cha: 10,
  })
  assert.deepEqual(applyRacialBonuses(base, { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }), {
    str: 16, dex: 14, con: 15, int: 9, wis: 13, cha: 11,
  })
})

test('armor class respects each armour category dex cap', () => {
  const noArmor = ARMORS.none
  const leather = ARMORS.leather
  const scale = ARMORS.scaleMail
  const chain = ARMORS.chainMail
  assert.ok(noArmor && leather && scale && chain)

  assert.equal(armorClass(noArmor, 14, false), 12)
  assert.equal(armorClass(leather, 16, false), 14)
  assert.equal(armorClass(scale, 20, false), 16, 'medium armour caps dex at +2')
  assert.equal(armorClass(chain, 20, false), 16, 'heavy armour ignores dex entirely')
  assert.equal(armorClass(scale, 14, true), 18, 'shield adds +2')
})

test('first level hit points are max hit die plus constitution', () => {
  assert.equal(maxHitPoints(10, 16), 13)
  assert.equal(maxHitPoints(6, 13), 7)
  assert.equal(maxHitPoints(6, 6), 4)
  assert.equal(maxHitPoints(6, 1), 1, 'never drops below 1')
})

test('a dwarf fighter is fully statted from three answers', () => {
  const answers: CreationAnswers = { classId: 'fighter', raceId: 'dwarf', motivationId: 'glory' }
  const hero = buildCharacter(answers, 'Bruenna', meta)

  assert.equal(hero.name, 'Bruenna')
  assert.equal(hero.level, 1)
  assert.equal(hero.scores.con, 16, 'dwarf +2 constitution')
  assert.equal(hero.maxHp, 13, 'd10 hit die + 3 con')
  assert.equal(hero.currentHp, hero.maxHp)
  assert.equal(hero.speedFeet, 25)
  assert.equal(hero.ac, 16, 'chain mail ignores dexterity')
  assert.equal(hero.proficiencyBonus, 2)
  assert.ok(hero.skillProficiencies.includes('intimidation'), 'motivation grants a skill')
  assert.ok(hero.attacks.length > 0)
})

test('an elf rogue leans on dexterity', () => {
  const answers: CreationAnswers = { classId: 'rogue', raceId: 'elf', motivationId: 'secrets' }
  const hero = buildCharacter(answers, 'Sylvi', meta)

  assert.equal(hero.scores.dex, 17)
  assert.equal(hero.ac, 14, 'leather 11 + 3 dex')
  assert.equal(hero.maxHp, 10, 'd8 + 2 con')
  assert.ok(hero.skillProficiencies.includes('investigation'))
})

test('a human wizard gets +1 to everything', () => {
  const hero = buildCharacter(
    { classId: 'wizard', raceId: 'human', motivationId: 'fortune' },
    'Alarin',
    meta,
  )
  assert.equal(hero.scores.int, 16)
  assert.equal(hero.scores.con, 14)
  assert.equal(hero.maxHp, 8, 'd6 + 2 con')
  assert.equal(hero.ac, 12, 'unarmoured 10 + 2 dex (score 15)')
})

test('a cleric carries a shield', () => {
  const hero = buildCharacter(
    { classId: 'cleric', raceId: 'human', motivationId: 'protect' },
    'Doran',
    meta,
  )
  assert.equal(hero.hasShield, true)
  assert.match(hero.armorName, /Shield/)
  assert.equal(hero.ac, 15, 'scale 14 - 1 dex (score 9) + 2 shield')
})

test('duplicate skills from class and motivation collapse', () => {
  const hero = buildCharacter(
    { classId: 'rogue', raceId: 'elf', motivationId: 'secrets' },
    'Sylvi',
    meta,
  )
  const unique = new Set(hero.skillProficiencies)
  assert.equal(unique.size, hero.skillProficiencies.length)
})

test('attack and damage bonuses use the right ability', () => {
  const fighter = buildCharacter(
    { classId: 'fighter', raceId: 'dwarf', motivationId: 'glory' },
    'Bruenna',
    meta,
  )
  const longsword = CLASS_PRESETS.fighter.attacks[0]
  assert.ok(longsword)
  assert.equal(attackBonus(longsword, fighter.scores, 1), 4, '+2 str, +2 proficiency')
  assert.equal(damageNotation(longsword, fighter.scores), '1d8+2')

  const wizard = buildCharacter(
    { classId: 'wizard', raceId: 'human', motivationId: 'secrets' },
    'Alarin',
    meta,
  )
  const fireBolt = CLASS_PRESETS.wizard.attacks[0]
  assert.ok(fireBolt)
  assert.equal(attackBonus(fireBolt, wizard.scores, 1), 5, '+3 int, +2 proficiency')
  assert.equal(damageNotation(fireBolt, wizard.scores), '1d10', 'cantrips add no ability damage')
})

test('the same answers always build an identical character', () => {
  const answers: CreationAnswers = { classId: 'cleric', raceId: 'halfling', motivationId: 'protect' }
  const first = buildCharacter(answers, 'Pip', meta)
  const second = buildCharacter(answers, 'Pip', meta)
  assert.deepEqual(first, second)
})

test('a blank name falls back rather than rendering empty', () => {
  const hero = buildCharacter(
    { classId: 'fighter', raceId: 'human', motivationId: 'glory' },
    '   ',
    meta,
  )
  assert.equal(hero.name, 'Unnamed Hero')
})
