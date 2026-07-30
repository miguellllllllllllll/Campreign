import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter, maxHitPoints, previewCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { CLASS_PRESETS } from '../src/lib/dnd/presets.ts'
import { rollInitiative } from '../src/lib/dnd/combat.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { FEATS, bonusInitiative, bonusMaxHp, featById } from '../src/content/feats.ts'
import { SUBCLASSES, subclassById, subclassesFor } from '../src/content/subclasses.ts'
import { stepsFor } from '../src/content/creationQuestions.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { faceValue } from './helpers/rng.ts'

const meta = { id: 'test-id', now: 1_700_000_000_000 }

function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'fighter',
    raceId: 'human',
    backgroundId: 'guildArtisan',
    flawId: 'haggler',
    equipmentChoice: 'defensive',
    auraId: 'amber',
    ...overrides,
  }
}

// --- Feat data ------------------------------------------------------------

test('only feats the engine can actually apply are offered', () => {
  // A feat that silently does nothing costs the player a choice and gives back
  // a lie, so the list is allowed to be short but not aspirational.
  for (const feat of FEATS) {
    assert.ok(feat.effect.amount > 0, `${feat.id} has no effect worth picking`)
    assert.ok(feat.effectLabel.length > 0, `${feat.id} does not say what it does`)
    assert.ok(feat.description.length > 30, `${feat.id} needs a real sentence`)
  }
})

test('feat ids are unique', () => {
  const ids = FEATS.map((feat) => feat.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('an unknown or absent feat id is worth nothing rather than throwing', () => {
  assert.equal(bonusMaxHp(undefined), 0)
  assert.equal(bonusInitiative(undefined), 0)
  assert.equal(bonusMaxHp('no-such-feat'), 0)
  assert.equal(bonusInitiative('no-such-feat'), 0)
  assert.equal(featById('no-such-feat'), undefined)
})

test('each feat pays out on exactly one axis', () => {
  assert.equal(bonusMaxHp('tough'), 2)
  assert.equal(bonusInitiative('tough'), 0)
  assert.equal(bonusInitiative('alert'), 5)
  assert.equal(bonusMaxHp('alert'), 0)
})

// --- Feats reaching a built character -------------------------------------

test('Tough adds its hit points on top of the class total', () => {
  const plain = buildCharacter(answers(), 'A', meta)
  const tough = buildCharacter(answers({ featId: 'tough' }), 'A', meta)
  assert.equal(tough.maxHp, plain.maxHp + 2)
  assert.equal(tough.currentHp, tough.maxHp, 'a new hero starts full')
})

test('the base hit point formula is untouched by the feat', () => {
  // The sheet explains maxHitPoints to the player; the feat must not change
  // what that explanation is describing.
  const klass = CLASS_PRESETS.fighter
  const tough = buildCharacter(answers({ featId: 'tough' }), 'A', meta)
  assert.equal(tough.maxHp, maxHitPoints(klass.hitDie, tough.scores.con) + 2)
})

test('Alert is stored as an initiative bonus, not folded into a score', () => {
  const alert = buildCharacter(answers({ featId: 'alert' }), 'A', meta)
  const plain = buildCharacter(answers(), 'A', meta)
  assert.equal(alert.initiativeBonus, 5)
  assert.deepEqual(alert.scores, plain.scores, 'Dexterity itself must not move')
  assert.equal(alert.maxHp, plain.maxHp)
})

test('a fast-track character carries no advanced fields at all', () => {
  // This is what keeps the layer opt-in: nothing downstream, including the
  // persisted store and the printed sheet, has to know the feature exists.
  const hero = buildCharacter(answers(), 'A', meta)
  assert.equal('subclassId' in hero, false)
  assert.equal('featId' in hero, false)
  assert.equal('initiativeBonus' in hero, false)
})

test('a stale id from an older save degrades to no advanced pick', () => {
  const hero = buildCharacter(
    answers({ subclassId: 'deleted-subclass', featId: 'deleted-feat' }),
    'A',
    meta,
  )
  assert.equal('subclassId' in hero, false)
  assert.equal('featId' in hero, false)
  assert.equal(hero.maxHp, buildCharacter(answers(), 'A', meta).maxHp)
})

test('the same answers still produce the same character', () => {
  const a = buildCharacter(answers({ subclassId: 'champion', featId: 'tough' }), 'Hero', meta)
  const b = buildCharacter(answers({ subclassId: 'champion', featId: 'tough' }), 'Hero', meta)
  assert.deepEqual(a, b)
})

test('the preview sidebar shows the feat as soon as it is picked', () => {
  const before = previewCharacter({ classId: 'fighter', raceId: 'human' }, 'A', meta)
  const after = previewCharacter(
    { classId: 'fighter', raceId: 'human', featId: 'tough' },
    'A',
    meta,
  )
  assert.ok(before !== null && after !== null)
  assert.equal(after.maxHp, before.maxHp + 2)
})

// --- Feats reaching combat ------------------------------------------------

test('Alert reaches the initiative roll through the combatant', () => {
  const alert = buildCharacter(answers({ featId: 'alert' }), 'A', meta)
  const combatant = characterToCombatant(alert, { position: { x: 0, y: 0 } })
  assert.equal(combatant.initiativeBonus, 5)
})

test('a hero without the feat has no initiative bonus to carry', () => {
  const plain = buildCharacter(answers(), 'A', meta)
  const combatant = characterToCombatant(plain, { position: { x: 0, y: 0 } })
  assert.equal(combatant.initiativeBonus, undefined)
})

test('the initiative bonus is worth exactly five on the die', () => {
  const rng = () => faceValue(10, 20)
  const plain = buildCharacter(answers(), 'A', meta)
  const alert = buildCharacter(answers({ featId: 'alert' }), 'A', meta)

  const withoutFeat = rollInitiative(characterToCombatant(plain, { position: { x: 0, y: 0 } }), rng)
  const withFeat = rollInitiative(characterToCombatant(alert, { position: { x: 0, y: 0 } }), rng)

  assert.equal(withFeat - withoutFeat, 5)
})

// --- Subclass data --------------------------------------------------------

test('every class has at least two specialisations to choose between', () => {
  for (const classId of ['fighter', 'wizard', 'rogue', 'cleric', 'paladin'] as const) {
    assert.ok(subclassesFor(classId).length >= 2, `${classId} needs a real choice`)
  }
})

test('a specialisation is only ever offered to its own class', () => {
  for (const subclass of SUBCLASSES) {
    assert.ok(
      subclassesFor(subclass.classId).includes(subclass),
      `${subclass.id} is not offered to ${subclass.classId}`,
    )
  }
})

test('subclass ids are unique', () => {
  const ids = SUBCLASSES.map((subclass) => subclass.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('an unknown subclass id resolves to undefined rather than throwing', () => {
  assert.equal(subclassById('no-such-subclass'), undefined)
  assert.equal(subclassById(undefined), undefined)
  assert.equal(subclassById('champion')?.label, 'Champion')
})

test('a feature that is not wired up says so, and one that is does not', () => {
  // The honesty rule: `active: false` must come with an explanation, because
  // the UI prints it rather than quietly greying the card out.
  for (const subclass of SUBCLASSES) {
    if (subclass.feature.active) {
      assert.equal(subclass.feature.pending, undefined, `${subclass.id} is active but pending`)
    } else {
      assert.ok(
        (subclass.feature.pending ?? '').length > 0,
        `${subclass.id} is inactive without saying why`,
      )
    }
  }
})

test('no subclass silently changes a number', () => {
  // Tier 1 deliberately ships subclasses as identity only. If one ever starts
  // carrying a stat, this test should fail and force the engine work with it.
  const plain = buildCharacter(answers(), 'A', meta)
  for (const subclass of subclassesFor('fighter')) {
    const specialised = buildCharacter(answers({ subclassId: subclass.id }), 'A', meta)
    assert.equal(specialised.maxHp, plain.maxHp)
    assert.equal(specialised.ac, plain.ac)
    assert.equal(specialised.initiativeBonus, plain.initiativeBonus)
    assert.equal(specialised.subclassId, subclass.id)
  }
})

// --- Step gating ----------------------------------------------------------

test('the advanced step is absent until the player opts in', () => {
  const ids = stepsFor({ classId: 'fighter' }).map((step) => step.id)
  assert.ok(!ids.includes('advanced'))
})

test('opting in inserts the step before the loadout', () => {
  const ids = stepsFor({ classId: 'fighter', advanced: true }).map((step) => step.id)
  assert.ok(ids.includes('advanced'))
  assert.ok(ids.indexOf('advanced') < ids.indexOf('loadout'))
})

test('opting in does not give a fighter a magic step', () => {
  const ids = stepsFor({ classId: 'fighter', advanced: true }).map((step) => step.id)
  assert.ok(!ids.includes('magic'))
})

test('a caster keeps both the magic step and the advanced one', () => {
  const ids = stepsFor({ classId: 'cleric', advanced: true }).map((step) => step.id)
  assert.ok(ids.includes('magic'))
  assert.ok(ids.includes('advanced'))
  assert.ok(ids.indexOf('magic') < ids.indexOf('advanced'))
})

test('the fast-track road is exactly as long as it was', () => {
  const fastTrack = stepsFor({ classId: 'fighter' })
  const advanced = stepsFor({ classId: 'fighter', advanced: true })
  assert.equal(advanced.length, fastTrack.length + 1)
})
