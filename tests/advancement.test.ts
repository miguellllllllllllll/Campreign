import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter, maxHitPoints, previewCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { CLASS_PRESETS } from '../src/lib/dnd/presets.ts'
import { resolveAttack, rollInitiative } from '../src/lib/dnd/combat.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { DEFAULT_CRIT_ON, roll } from '../src/lib/dnd/dice.ts'
import {
  FEATS,
  bonusInitiative,
  bonusMaxHp,
  cantripChoicesFor,
  featById,
  grantedCantripId,
} from '../src/content/feats.ts'
import { SPELLS_BY_ID } from '../src/content/spells.ts'
import {
  SUPERIORITY_DICE_AT_LEVEL_1,
  canSpendSuperiorityDie,
  maneuverSaveDc,
  resolveTripAttack,
} from '../src/lib/dnd/maneuvers.ts'
import { attackWith, createEncounter } from '../src/lib/dnd/encounter.ts'
import { hasCondition } from '../src/lib/dnd/conditions.ts'
import {
  SUBCLASSES,
  critThresholdFor,
  subclassById,
  subclassesFor,
} from '../src/content/subclasses.ts'
import { magicInitiateChoices, stepsFor } from '../src/content/creationQuestions.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'

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
  // a lie, so the list is allowed to be short but not aspirational. The switch
  // is exhaustive on purpose: a new effect kind must state what "real" means
  // for it here before it can ship.
  for (const feat of FEATS) {
    const effect = feat.effect
    switch (effect.kind) {
      case 'maxHp':
      case 'initiative':
        assert.ok(effect.amount > 0, `${feat.id} grants nothing`)
        break
      case 'cantrip':
        assert.ok(effect.choices.length > 1, `${feat.id} offers no real choice`)
        for (const id of effect.choices) {
          assert.ok(SPELLS_BY_ID[id] !== undefined, `${feat.id} offers unknown spell ${id}`)
          assert.equal(SPELLS_BY_ID[id]?.level, 0, `${feat.id} may only grant cantrips`)
        }
        break
    }
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

test('a subclass changes a number only when it declares that it does', () => {
  // The honesty rule, stated as an invariant: an effect and an active feature
  // travel together. A subclass may not quietly alter the sheet, and one that
  // claims to be wired up may not turn out to be decorative.
  for (const subclass of SUBCLASSES) {
    const hasEffect = subclass.effect !== undefined
    assert.equal(
      hasEffect,
      subclass.feature.active,
      `${subclass.id}: effect and active must agree`,
    )
  }
})

test('a subclass with no effect leaves every number untouched', () => {
  const plain = buildCharacter(answers(), 'A', meta)
  for (const subclass of subclassesFor('fighter')) {
    if (subclass.effect !== undefined) continue
    const specialised = buildCharacter(answers({ subclassId: subclass.id }), 'A', meta)
    assert.equal(specialised.maxHp, plain.maxHp)
    assert.equal(specialised.ac, plain.ac)
    assert.equal(specialised.critOn, undefined)
    assert.equal(specialised.subclassId, subclass.id)
  }
})

// --- Improved Critical ----------------------------------------------------

test('only the Champion widens the critical range', () => {
  assert.equal(critThresholdFor('champion'), 19)
  assert.equal(critThresholdFor('battlemaster'), undefined)
  assert.equal(critThresholdFor('no-such-subclass'), undefined)
  assert.equal(critThresholdFor(undefined), undefined)
})

test('a Champion carries the threshold onto the sheet and into combat', () => {
  const champion = buildCharacter(answers({ subclassId: 'champion' }), 'A', meta)
  assert.equal(champion.critOn, 19)
  assert.equal(characterToCombatant(champion, { position: { x: 0, y: 0 } }).critOn, 19)
})

test('everyone else stores no threshold at all', () => {
  const plain = buildCharacter(answers({ subclassId: 'battlemaster' }), 'A', meta)
  assert.equal('critOn' in plain, false)
  assert.equal(characterToCombatant(plain, { position: { x: 0, y: 0 } }).critOn, undefined)
})

test('a natural 19 is an ordinary hit normally and a critical for a Champion', () => {
  const nineteen = () => faceValue(19, 20)
  assert.equal(roll('1d20', { rng: nineteen }).crit, null)
  assert.equal(roll('1d20', { rng: nineteen, critOn: 19 }).crit, 'hit')
})

test('a natural 18 is not a critical even for a Champion', () => {
  assert.equal(roll('1d20', { rng: () => faceValue(18, 20), critOn: 19 }).crit, null)
})

test('a natural 20 stays a critical for everybody', () => {
  const twenty = () => faceValue(20, 20)
  assert.equal(roll('1d20', { rng: twenty }).crit, 'hit')
  assert.equal(roll('1d20', { rng: twenty, critOn: 19 }).crit, 'hit')
})

test('widening the critical range never widens the fumble range', () => {
  const one = () => faceValue(1, 20)
  assert.equal(roll('1d20', { rng: one }).crit, 'fumble')
  assert.equal(roll('1d20', { rng: one, critOn: 19 }).crit, 'fumble')
  // The pathological case: a threshold of 1 must not make a 1 both at once.
  assert.equal(roll('1d20', { rng: one, critOn: 1 }).crit, 'fumble')
})

test('the default threshold is exactly the old behaviour', () => {
  assert.equal(DEFAULT_CRIT_ON, 20)
  for (const face of [2, 10, 18, 19]) {
    assert.equal(roll('1d20', { rng: () => faceValue(face, 20) }).crit, null, `face ${face}`)
  }
})

test("a Champion's 19 crits in a real attack, and a rogue's does not", () => {
  const nineteen = () => faceValue(19, 20)
  const champion = buildCharacter(answers({ subclassId: 'champion' }), 'A', meta)
  const ordinary = buildCharacter(answers(), 'A', meta)
  const attack = champion.attacks[0]
  assert.ok(attack !== undefined)

  const dummy = characterToCombatant(ordinary, { position: { x: 1, y: 0 }, team: 'foes' })

  const asChampion = resolveAttack({
    attacker: characterToCombatant(champion, { position: { x: 0, y: 0 } }),
    target: dummy,
    attack,
    rng: nineteen,
  })
  const asOrdinary = resolveAttack({
    attacker: characterToCombatant(ordinary, { position: { x: 0, y: 0 } }),
    target: dummy,
    attack,
    rng: nineteen,
  })

  assert.equal(asChampion.kind, 'crit')
  assert.equal(asOrdinary.kind, 'hit')
})

// --- Battle Master: superiority dice and Trip Attack ----------------------

test('a Battle Master starts with a pool and nobody else has one', () => {
  const bm = buildCharacter(answers({ subclassId: 'battlemaster' }), 'A', meta)
  assert.equal(bm.superiorityDice, SUPERIORITY_DICE_AT_LEVEL_1)
  assert.equal(characterToCombatant(bm, { position: { x: 0, y: 0 } }).superiorityDice, 2)

  const champion = buildCharacter(answers({ subclassId: 'champion' }), 'A', meta)
  assert.equal('superiorityDice' in champion, false)
})

test('a pool is only spendable while it has dice in it', () => {
  assert.equal(canSpendSuperiorityDie({ superiorityDice: 2 }), true)
  assert.equal(canSpendSuperiorityDie({ superiorityDice: 0 }), false)
  assert.equal(canSpendSuperiorityDie({}), false)
})

test('the manoeuvre DC follows the ability the attack itself uses', () => {
  const hero = buildCharacter(answers({ subclassId: 'battlemaster' }), 'A', meta)
  const combatant = characterToCombatant(hero, { position: { x: 0, y: 0 } })
  const attack = hero.attacks[0]
  assert.ok(attack !== undefined)
  const expected = 8 + hero.proficiencyBonus + Math.floor((hero.scores[attack.ability] - 10) / 2)
  assert.equal(maneuverSaveDc(combatant, attack), expected)
})

test('a failed save knocks the target down and a passed one does not', () => {
  const hero = buildCharacter(answers({ subclassId: 'battlemaster' }), 'A', meta)
  const attacker = characterToCombatant(hero, { position: { x: 0, y: 0 } })
  const target = characterToCombatant(
    buildCharacter(answers(), 'B', { ...meta, id: 'b' }),
    { position: { x: 1, y: 0 }, team: 'foes' },
  )
  const attack = hero.attacks[0]
  assert.ok(attack !== undefined)

  // First value feeds the damage die, second the saving throw.
  const failed = resolveTripAttack({
    attacker, target, attack,
    rng: sequenceRng([faceValue(3, 6), faceValue(1, 20)]),
  })
  assert.equal(failed.knockedProne, true)
  assert.equal(failed.save.success, false)

  const saved = resolveTripAttack({
    attacker, target, attack,
    rng: sequenceRng([faceValue(3, 6), faceValue(20, 20)]),
  })
  assert.equal(saved.knockedProne, false)
  assert.equal(saved.save.success, true)
})

test('spending a die leaves one fewer, and never goes below zero', () => {
  const hero = buildCharacter(answers({ subclassId: 'battlemaster' }), 'A', meta)
  const attack = hero.attacks[0]
  assert.ok(attack !== undefined)
  const target = characterToCombatant(
    buildCharacter(answers(), 'B', { ...meta, id: 'b' }),
    { position: { x: 1, y: 0 }, team: 'foes' },
  )
  const rng = sequenceRng([faceValue(3, 6), faceValue(10, 20)])

  const withTwo = characterToCombatant(hero, { position: { x: 0, y: 0 } })
  assert.equal(resolveTripAttack({ attacker: withTwo, target, attack, rng }).diceRemaining, 1)

  const empty = { ...withTwo, superiorityDice: 0 }
  assert.equal(resolveTripAttack({ attacker: empty, target, attack, rng }).diceRemaining, 0)
})

test('an encounter refuses a manoeuvre nobody can pay for', () => {
  const plain = buildCharacter(answers(), 'A', meta)
  const foe = buildCharacter(answers(), 'B', { ...meta, id: 'b' })
  const attack = plain.attacks[0]
  assert.ok(attack !== undefined)

  const encounter = createEncounter(
    [
      characterToCombatant(plain, { position: { x: 0, y: 0 }, initiative: 20 }),
      characterToCombatant(foe, { position: { x: 1, y: 0 }, team: 'foes', initiative: 1 }),
    ],
    () => 0.99,
  )
  const result = attackWith(encounter, {
    targetId: foe.id,
    attackId: attack.id,
    maneuverId: 'trip',
    rng: () => 0.5,
  })
  assert.match(result.refusal ?? '', /superiority dice/i)
  assert.equal(result.encounter, encounter, 'a refusal must not consume the turn')
})

test('a landed Trip Attack adds damage, spends a die, and floors the target', () => {
  const bm = buildCharacter(answers({ subclassId: 'battlemaster' }), 'A', meta)
  const foe = buildCharacter(answers(), 'B', { ...meta, id: 'b' })
  const attack = bm.attacks[0]
  assert.ok(attack !== undefined)

  // Deliberately tough, so the hit lands without killing: you cannot knock down
  // somebody who is already on the floor, which the assertion below would
  // otherwise be silently testing instead.
  const target = {
    ...characterToCombatant(foe, { position: { x: 1, y: 0 }, team: 'foes', initiative: 1 }),
    maxHp: 60,
    currentHp: 60,
  }
  const encounter = createEncounter(
    [characterToCombatant(bm, { position: { x: 0, y: 0 }, initiative: 20 }), target],
    () => 0.99,
  )

  // A 15 to hit, minimum weapon damage, then a natural 1 on the target's save.
  const rng = sequenceRng([
    faceValue(15, 20), faceValue(1, 8),
    faceValue(4, 6), faceValue(1, 20),
  ])
  const result = attackWith(encounter, {
    targetId: foe.id, attackId: attack.id, maneuverId: 'trip', rng,
  })

  assert.equal(result.refusal, null)
  assert.ok(result.maneuver !== undefined)
  assert.equal(result.maneuver.knockedProne, true)
  assert.equal(result.encounter.combatants[bm.id]?.superiorityDice, 1)

  const hit = result.encounter.combatants[foe.id]
  assert.ok(hit !== undefined && hit.currentHp < 60, 'the attack should have landed')
  assert.ok(hasCondition(hit.conditions, 'prone'))
})

test('a target dropped by the same blow is not also knocked prone', () => {
  // Prone is a state a standing creature enters. Someone at 0 hit points is
  // already down, and stacking the condition would read as a second effect the
  // player did not get.
  const bm = buildCharacter(answers({ subclassId: 'battlemaster' }), 'A', meta)
  const foe = buildCharacter(answers(), 'B', { ...meta, id: 'b' })
  const attack = bm.attacks[0]
  assert.ok(attack !== undefined)

  const frail = {
    ...characterToCombatant(foe, { position: { x: 1, y: 0 }, team: 'foes', initiative: 1 }),
    maxHp: 2,
    currentHp: 2,
  }
  const encounter = createEncounter(
    [characterToCombatant(bm, { position: { x: 0, y: 0 }, initiative: 20 }), frail],
    () => 0.99,
  )
  const result = attackWith(encounter, {
    targetId: foe.id,
    attackId: attack.id,
    maneuverId: 'trip',
    rng: sequenceRng([
      faceValue(20, 20), faceValue(8, 8), faceValue(8, 8),
      faceValue(6, 6), faceValue(1, 20),
    ]),
  })

  const dropped = result.encounter.combatants[foe.id]
  assert.ok(dropped !== undefined)
  assert.equal(dropped.currentHp, 0)
  assert.equal(hasCondition(dropped.conditions, 'prone'), false)
  // The die is still spent: it was thrown, and the save genuinely failed.
  assert.equal(result.encounter.combatants[bm.id]?.superiorityDice, 1)
})

test('a manoeuvre may not be spent on a spell', () => {
  const caster = buildCharacter(
    answers({ classId: 'wizard', magicStyleId: 'evoker' }),
    'A',
    meta,
  )
  const spell = caster.attacks.find((a) => a.kind === 'spell')
  if (spell === undefined) return
  const foe = buildCharacter(answers(), 'B', { ...meta, id: 'b' })
  const encounter = createEncounter(
    [
      { ...characterToCombatant(caster, { position: { x: 0, y: 0 }, initiative: 20 }), superiorityDice: 2 },
      characterToCombatant(foe, { position: { x: 1, y: 0 }, team: 'foes', initiative: 1 }),
    ],
    () => 0.99,
  )
  const result = attackWith(encounter, {
    targetId: foe.id, attackId: spell.id, maneuverId: 'trip', rng: () => 0.5,
  })
  assert.match(result.refusal ?? '', /weapon/i)
})

// --- Magic Initiate -------------------------------------------------------

test('Magic Initiate offers a real choice of known cantrips', () => {
  const choices = cantripChoicesFor('magicInitiate')
  assert.ok(choices.length >= 2)
  for (const id of choices) assert.equal(SPELLS_BY_ID[id]?.level, 0)
  assert.deepEqual(cantripChoicesFor('tough'), [])
  assert.deepEqual(cantripChoicesFor(undefined), [])
})

test('only a spell the feat actually offers can be granted', () => {
  assert.equal(grantedCantripId('magicInitiate', 'fireBolt'), 'fireBolt')
  // Not on the feat's list, so it must not reach the sheet even if stored.
  assert.equal(grantedCantripId('magicInitiate', 'cureWounds'), undefined)
  assert.equal(grantedCantripId('tough', 'fireBolt'), undefined)
  assert.equal(grantedCantripId('magicInitiate', undefined), undefined)
})

test('a fighter with Magic Initiate carries the cantrip and its button', () => {
  const hero = buildCharacter(
    answers({ featId: 'magicInitiate', magicInitiateSpellId: 'fireBolt' }),
    'A',
    meta,
  )
  assert.ok(hero.cantrips?.includes('fireBolt'))
  assert.ok(hero.attacks.some((attack) => attack.id === 'fireBolt'))
  assert.equal(hero.magicInitiateSpellId, 'fireBolt')
})

test('a utility cantrip grants no attack button', () => {
  const hero = buildCharacter(
    answers({ featId: 'magicInitiate', magicInitiateSpellId: 'guidance' }),
    'A',
    meta,
  )
  assert.ok(hero.cantrips?.includes('guidance'))
  assert.equal(hero.attacks.some((attack) => attack.id === 'guidance'), false)
})

test('the feat never prints a duplicate button for a caster who already has it', () => {
  const wizard = buildCharacter(
    answers({
      classId: 'wizard',
      magicStyleId: 'evoker',
      featId: 'magicInitiate',
      magicInitiateSpellId: 'fireBolt',
    }),
    'A',
    meta,
  )
  const fireBolts = wizard.attacks.filter((attack) => attack.id === 'fireBolt')
  assert.ok(fireBolts.length <= 1, 'Fire Bolt must not appear twice on the bar')
  assert.equal(wizard.cantrips?.filter((id) => id === 'fireBolt').length, 1)
})

test('Magic Initiate changes nothing for a hero who did not take it', () => {
  const plain = buildCharacter(answers(), 'A', meta)
  assert.equal('magicInitiateSpellId' in plain, false)
  assert.equal('cantrips' in plain, false)
})

test('the cantrip question is invisible until the feat is taken', () => {
  assert.deepEqual(magicInitiateChoices(undefined), [])
  assert.deepEqual(magicInitiateChoices('tough'), [])
  assert.ok(magicInitiateChoices('magicInitiate').length >= 2)
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
