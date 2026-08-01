import test from 'node:test'
import assert from 'node:assert/strict'
import { slotsAt } from '../src/lib/dnd/slots.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { castAreaSpell, resolveAoeTargetSave, spellSaveDcFor } from '../src/lib/dnd/casting.ts'
import { castFromActive, createEncounter } from '../src/lib/dnd/encounter.ts'
import { SPELLS_BY_ID } from '../src/content/spells.ts'
import { SUBCLASSES } from '../src/content/subclasses.ts'
import { useTutorialStore } from '../src/stores/tutorialStore.ts'
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

test('the tutorial now fields an ally worth shielding', () => {
  // This assertion used to read `party.length === 1`, and was the stated reason
  // the tenth flag stayed false. A squire exists now, so it says the opposite.
  const { hero } = wizard('evocation')
  useTutorialStore.getState().begin(
    buildCharacter(answers({ subclassId: 'evocation' }), 'Evoker', meta),
  )
  const roster = useTutorialStore.getState().roster ?? []
  const party = roster.filter((c) => c.team === 'party')

  assert.equal(party.length, 2, 'the hero has somebody to sculpt around')
  assert.ok(party.some((c) => c.id === hero.id), 'and one of them is the player')
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
  assert.equal(slotsAt(result.caster.spellSlots, 1), 0, 'the slot is spent once, not per target')
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
    caster: { ...combatant, spellSlots: [0, 0] },
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

test('Sculpt Spells is active, and carries no blocker at all', () => {
  const evocation = SUBCLASSES.find((s) => s.id === 'evocation')
  assert.ok(evocation !== undefined)
  assert.equal(evocation.feature.active, true)
  assert.notEqual(evocation.effect, undefined)
  assert.equal(evocation.feature.pending, undefined, 'nothing is blocking it now')
})

test('every subclass feature in the game is wired', () => {
  // Ten of ten. Each one is pressable, observable, and covered — and the
  // invariant below still binds effect and active together, so a future
  // feature cannot be declared without being built.
  const inert = SUBCLASSES.filter((s) => !s.feature.active)
  assert.deepEqual(inert, [], 'no feature is waiting on a primitive any more')
  for (const subclass of SUBCLASSES) {
    assert.notEqual(subclass.effect, undefined, `${subclass.id} claims to work`)
    assert.equal(subclass.feature.pending, undefined, `${subclass.id} has no excuse left`)
  }
  assert.equal(SUBCLASSES.length, 10)
})

test('an Evoker on the real tutorial board spares the squire and burns the goblin', () => {
  /*
   * The end of a long road. This uses the roster the app actually builds — no
   * hand-assembled ally — so it proves the feature is reachable by a player
   * rather than merely correct in isolation.
   */
  const hero = buildCharacter(answers({ subclassId: 'evocation' }), 'Evoker', meta)
  useTutorialStore.getState().begin(hero)
  const roster = useTutorialStore.getState().roster ?? []

  const caster = roster.find((c) => c.id === hero.id)
  const squire = roster.find((c) => c.team === 'party' && c.id !== hero.id)
  const goblin = roster.find((c) => c.team === 'foes')
  assert.ok(caster !== undefined && squire !== undefined && goblin !== undefined)

  // Move the goblin into the blast; it starts four squares off.
  const inRange = { ...goblin, position: { x: caster.position.x, y: caster.position.y - 2 } }

  const result = castAreaSpell({
    caster: { ...caster, preparedSpells: ['burningHands'], spellSlots: [0, 1] },
    candidates: [caster, squire, inRange],
    spellId: 'burningHands',
    subclassId: 'evocation',
    rng: sequenceRng([
      faceValue(4, 6), faceValue(4, 6), faceValue(3, 6),
      faceValue(1, 20),
    ]),
  })

  assert.equal(result.refusal, null)
  const hitSquire = result.affected.find((c) => c.id === squire.id)
  const hitGoblin = result.affected.find((c) => c.id === goblin.id)
  assert.ok(hitSquire !== undefined && hitGoblin !== undefined, 'both were in the fire')

  assert.equal(hitSquire.currentHp, squire.maxHp, 'the squire is sculpted clear and untouched')
  assert.ok(hitGoblin.currentHp < inRange.currentHp, 'the goblin is not')
  assert.ok(result.lines.some((l) => /sculpted clear/.test(l)))
})
