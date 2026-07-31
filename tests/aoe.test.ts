import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { castAreaSpell, resolveAoeTargetSave, spellSaveDcFor } from '../src/lib/dnd/casting.ts'
import { castFromActive, createEncounter } from '../src/lib/dnd/encounter.ts'
import { SPELLS_BY_ID } from '../src/content/spells.ts'
import { SUBCLASSES } from '../src/content/subclasses.ts'
import type { Combatant } from '../src/types/combat.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'

const meta = { id: 'evoker', now: 1_700_000_000_000 }

function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'wizard',
    raceId: 'human',
    backgroundId: 'noble',
    flawId: 'obeyed',
    equipmentChoice: 'offensive',
    auraId: 'amber',
    magicStyleId: 'pyromancer',
    ...overrides,
  }
}

function wizard(subclassId?: string) {
  const hero = buildCharacter(
    answers(subclassId === undefined ? {} : { subclassId }),
    'Evoker',
    meta,
  )
  return { hero, combatant: characterToCombatant(hero, { position: { x: 0, y: 0 } }) }
}

function goblin(id: string, x: number): Combatant {
  const foe = buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    `Goblin ${id}`,
    { ...meta, id },
  )
  return characterToCombatant(foe, { position: { x, y: 0 }, team: 'foes' })
}

// --- The spell has real mechanics now -------------------------------------

test('Burning Hands carries structured area data, not just prose', () => {
  const effect = SPELLS_BY_ID.burningHands?.effect
  assert.ok(effect !== undefined)
  assert.equal(effect.kind, 'aoeSave')
  if (effect.kind !== 'aoeSave') return
  assert.equal(effect.dice, '3d6')
  assert.equal(effect.saveAbility, 'dex')
  assert.equal(effect.halfOnSuccess, true)
})

test('a wizard prepares it and can reach the area path', () => {
  const { combatant } = wizard()
  assert.ok((combatant.preparedSpells ?? []).includes('burningHands'))
})

// --- Saving throws --------------------------------------------------------

test('a failed save takes the whole blast, a successful one takes half', () => {
  const { combatant } = wizard()
  const target = goblin('g1', 1)

  const failed = resolveAoeTargetSave({
    caster: combatant, target,
    saveAbility: 'dex', saveDc: 30, rawDamage: 11,
    halfOnSuccess: true, casterSculpts: false,
    rng: () => faceValue(1, 20),
  })
  assert.equal(failed.saveSuccessful, false)
  assert.equal(failed.damageTaken, 11)

  const saved = resolveAoeTargetSave({
    caster: combatant, target,
    saveAbility: 'dex', saveDc: 2, rawDamage: 11,
    halfOnSuccess: true, casterSculpts: false,
    rng: () => faceValue(20, 20),
  })
  assert.equal(saved.saveSuccessful, true)
  assert.equal(saved.damageTaken, 5, '11 halved and rounded down')
})

test('a spell with no half-damage clause gives nothing away on a save', () => {
  const { combatant } = wizard()
  const outcome = resolveAoeTargetSave({
    caster: combatant, target: goblin('g1', 1),
    saveAbility: 'dex', saveDc: 2, rawDamage: 11,
    halfOnSuccess: false, casterSculpts: false,
    rng: () => faceValue(20, 20),
  })
  assert.equal(outcome.damageTaken, 0)
})

test('the save DC is the caster\'s, not a constant', () => {
  const { hero, combatant } = wizard()
  const int = Math.floor((hero.scores.int - 10) / 2)
  assert.equal(spellSaveDcFor(combatant), 8 + hero.proficiencyBonus + int)
})

// --- Sculpt Spells: wired, and provably unreachable ------------------------

test('sculpting waives an ally\'s save entirely when there is an ally', () => {
  // Constructed by hand. The app never builds a roster like this — which is
  // exactly why the subclass stays inactive — but the branch is real and this
  // pins its behaviour for whenever a companion exists.
  const { combatant } = wizard('evocation')
  const ally: Combatant = { ...goblin('friend', 1), team: 'party', name: 'Ally' }

  const outcome = resolveAoeTargetSave({
    caster: combatant, target: ally,
    saveAbility: 'dex', saveDc: 30, rawDamage: 11,
    halfOnSuccess: true, casterSculpts: true,
    rng: () => faceValue(1, 20),
  })
  assert.equal(outcome.isSculpted, true)
  assert.equal(outcome.damageTaken, 0, 'nothing, not half')
  assert.equal(outcome.saveSuccessful, true, 'the save is waived, not rolled')
})

test('sculpting never shields an enemy', () => {
  const { combatant } = wizard('evocation')
  const outcome = resolveAoeTargetSave({
    caster: combatant, target: goblin('g1', 1),
    saveAbility: 'dex', saveDc: 30, rawDamage: 11,
    halfOnSuccess: true, casterSculpts: true,
    rng: () => faceValue(1, 20),
  })
  assert.equal(outcome.isSculpted, false)
  assert.equal(outcome.damageTaken, 11)
})

test('the app can never produce an ally for it to shield', () => {
  // The reason the tenth flag stays false. If this ever fails, a companion
  // exists and Sculpt Spells can honestly be switched on.
  const { hero, combatant } = wizard('evocation')
  const encounter = createEncounter([combatant, goblin('g1', 1)], () => 0.99)
  const party = Object.values(encounter.combatants).filter((c) => c.team === 'party')
  assert.equal(party.length, 1, 'a party of one has nobody to sculpt around')
  assert.equal(party[0]?.id, hero.id)
})

// --- The whole blast on the board -----------------------------------------

test('everything in range saves separately against one damage roll', () => {
  const { hero, combatant } = wizard()
  const near = goblin('near', 1)
  const alsoNear = goblin('alsoNear', 2)

  // 3d6 for the blast, then a d20 per target.
  const rng = sequenceRng([
    faceValue(4, 6), faceValue(4, 6), faceValue(3, 6),
    faceValue(1, 20),
    faceValue(20, 20),
  ])
  const result = castAreaSpell({
    caster: combatant,
    candidates: [combatant, near, alsoNear],
    spellId: 'burningHands',
    rng,
  })

  assert.equal(result.refusal, null)
  assert.equal(result.affected.length, 2, 'both goblins are caught')
  const [first, second] = result.affected
  assert.ok(first !== undefined && second !== undefined)
  assert.ok(
    first.currentHp < near.currentHp && second.currentHp < alsoNear.currentHp,
    'both took something',
  )
  assert.ok(
    near.currentHp - first.currentHp > alsoNear.currentHp - second.currentHp,
    'the one that failed its save took more than the one that made it',
  )
  assert.equal(result.caster.spellSlots, 0, 'the slot is spent once, not per target')
  assert.equal(hero.id, result.caster.id)
})

test('the caster is never caught in their own blast', () => {
  const { combatant } = wizard()
  const result = castAreaSpell({
    caster: combatant,
    candidates: [combatant, goblin('g1', 1)],
    spellId: 'burningHands',
    rng: () => faceValue(3, 6),
  })
  assert.ok(!result.affected.some((c) => c.id === combatant.id))
})

test('a blast with nobody in range is refused and costs no slot', () => {
  const { combatant } = wizard()
  const distant = goblin('far', 4)
  const result = castAreaSpell({
    caster: combatant,
    candidates: [combatant, distant],
    spellId: 'burningHands',
    rng: () => faceValue(3, 6),
  })
  assert.match(result.refusal ?? '', /close enough/i)
  assert.equal(result.caster, combatant, 'a refusal must not spend anything')
})

test('an area spell cast with no slots left is refused', () => {
  const { combatant } = wizard()
  const result = castAreaSpell({
    caster: { ...combatant, spellSlots: 0 },
    candidates: [combatant, goblin('g1', 1)],
    spellId: 'burningHands',
  })
  assert.match(result.refusal ?? '', /slot/i)
})

test('casting an area spell through the board spends the action and logs each save', () => {
  const { hero, combatant } = wizard()
  const foe = goblin('g1', 1)
  const base = createEncounter([combatant, foe], () => 0.99)
  const encounter = { ...base, activeIndex: base.order.indexOf(hero.id) }

  const result = castFromActive(encounter, {
    spellId: 'burningHands',
    targetId: foe.id,
    rng: sequenceRng([faceValue(4, 6), faceValue(4, 6), faceValue(3, 6), faceValue(1, 20)]),
  })

  assert.equal(result.refusal, null)
  assert.equal(result.encounter.hasActed, true)
  assert.ok(result.encounter.combatants[foe.id]!.currentHp < foe.currentHp)
  assert.ok(result.encounter.log.some((l) => /Burning Hands/.test(l)))
  assert.ok(result.encounter.log.some((l) => /rolls \d+ and/.test(l)), 'each save is narrated')
})

// --- The flag stays honest -------------------------------------------------

test('Sculpt Spells is still inactive, and says why accurately', () => {
  const evocation = SUBCLASSES.find((s) => s.id === 'evocation')
  assert.ok(evocation !== undefined)
  assert.equal(evocation.feature.active, false)
  assert.equal(evocation.effect, undefined)
  assert.match(evocation.feature.pending ?? '', /on your side of the board/i)
  assert.doesNotMatch(
    evocation.feature.pending ?? '',
    /targets an area/i,
    'the old blocker is obsolete now that Burning Hands covers one',
  )
})
