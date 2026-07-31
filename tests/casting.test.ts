import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { applyDamage } from '../src/lib/dnd/combat.ts'
import { castSpell, castableSpells } from '../src/lib/dnd/casting.ts'
import { FIRST_LEVEL_SLOTS } from '../src/lib/dnd/spellcasting.ts'
import { castFromActive, createEncounter } from '../src/lib/dnd/encounter.ts'
import { SUBCLASSES } from '../src/content/subclasses.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { faceValue } from './helpers/rng.ts'

const meta = { id: 'caster', now: 1_700_000_000_000 }

function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'cleric',
    raceId: 'human',
    backgroundId: 'noble',
    flawId: 'obeyed',
    equipmentChoice: 'defensive',
    auraId: 'amber',
    magicStyleId: 'radiantWrath',
    ...overrides,
  }
}

function caster(subclassId?: string, over: Partial<CreationAnswers> = {}) {
  const hero = buildCharacter(
    answers({ ...over, ...(subclassId === undefined ? {} : { subclassId }) }),
    'Caster',
    meta,
  )
  return { hero, combatant: characterToCombatant(hero, { position: { x: 0, y: 0 } }) }
}

// --- Slots ----------------------------------------------------------------

test('a caster gets a slot and a fighter does not', () => {
  const { hero } = caster()
  assert.equal(hero.spellSlots, FIRST_LEVEL_SLOTS)

  const fighter = buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'A',
    meta,
  )
  assert.equal('spellSlots' in fighter, false, 'no prepared spells means no slot to carry')
})

test('the slot and the prepared list reach the board', () => {
  const { combatant } = caster()
  assert.equal(combatant.spellSlots, 1)
  assert.ok((combatant.preparedSpells ?? []).length > 0)
  assert.equal(combatant.castingAbility, 'wis')
})

// --- What can be cast -----------------------------------------------------

test('a prepared spell with no engine support is offered but refused', () => {
  const { combatant } = caster()
  const listed = castableSpells(combatant)
  const bless = listed.find((entry) => entry.spell.id === 'bless')
  assert.ok(bless !== undefined, 'Bless should still be visible on the bar')
  assert.equal(bless.castable, false)
  assert.match(bless.reason ?? '', /not ready/i)
})

test('Cure Wounds is castable while a slot remains, and not after', () => {
  const { combatant } = caster()
  const withSlot = castableSpells(combatant).find((e) => e.spell.id === 'cureWounds')
  assert.equal(withSlot?.castable, true)

  const spent = castableSpells({ ...combatant, spellSlots: 0 }).find((e) => e.spell.id === 'cureWounds')
  assert.equal(spent?.castable, false)
  assert.match(spent?.reason ?? '', /slot/i)
})

// --- Healing --------------------------------------------------------------

test('Cure Wounds heals the roll plus the casting ability', () => {
  const { hero, combatant } = caster()
  const hurt = { ...combatant, currentHp: 1 }
  const wis = Math.floor((hero.scores.wis - 10) / 2)

  const result = castSpell({
    caster: hurt,
    target: hurt,
    spellId: 'cureWounds',
    rng: () => faceValue(5, 8),
  })
  assert.equal(result.refusal, null)
  assert.equal(result.target.currentHp, 1 + 5 + wis)
})

test('casting spends the slot', () => {
  const { combatant } = caster()
  const result = castSpell({
    caster: { ...combatant, currentHp: 1 },
    target: { ...combatant, currentHp: 1 },
    spellId: 'cureWounds',
    rng: () => faceValue(5, 8),
  })
  assert.equal(result.caster.spellSlots, 0)
})

test('a caster with no slots is refused and pays nothing', () => {
  const { combatant } = caster()
  const empty = { ...combatant, spellSlots: 0, currentHp: 1 }
  const result = castSpell({ caster: empty, target: empty, spellId: 'cureWounds' })
  assert.match(result.refusal ?? '', /slot/i)
  assert.equal(result.caster, empty, 'a refusal must not change the caster')
})

test('Disciple of Life adds its bonus to a real cast', () => {
  const plain = caster()
  const life = caster('life')
  const rng = () => faceValue(5, 8)

  // Deliberately roomy. A level 1 cleric healing themselves usually hits their
  // own maximum, and applyHealing clamps there — which would hide the bonus
  // rather than disprove it.
  const room = { currentHp: 1, maxHp: 50 }
  const without = castSpell({
    caster: { ...plain.combatant, ...room },
    target: { ...plain.combatant, ...room },
    spellId: 'cureWounds',
    rng,
  })
  const with_ = castSpell({
    caster: { ...life.combatant, ...room },
    target: { ...life.combatant, ...room },
    spellId: 'cureWounds',
    subclassId: 'life',
    rng,
  })

  // +2 plus the spell's level, so +3 for a 1st-level Cure Wounds.
  assert.equal(with_.target.currentHp - without.target.currentHp, 3)
  assert.ok(with_.lines.some((line) => /Disciple of Life/.test(line)))
})

// --- Arcane Ward ----------------------------------------------------------

test('an abjuration spell raises the ward, and damage drains it first', () => {
  const { combatant } = caster(undefined, { classId: 'wizard', magicStyleId: 'guardianMage' })
  assert.ok((combatant.preparedSpells ?? []).includes('mageArmor'), 'the style prepares it')
  const wizard = combatant

  const cast = castSpell({
    caster: wizard,
    target: wizard,
    spellId: 'mageArmor',
    subclassId: 'abjuration',
  })
  assert.equal(cast.refusal, null)
  const ward = cast.caster.arcaneWardHp
  assert.ok(ward !== undefined && ward > 0, 'the ward should be up')

  const hit = applyDamage(cast.caster, 2)
  assert.equal(hit.currentHp, cast.caster.currentHp, 'the ward eats it, hit points do not move')
  assert.equal(hit.arcaneWardHp, ward - 2)
})

test('damage past the ward spills onto hit points', () => {
  const { combatant } = caster(undefined, { classId: 'wizard', magicStyleId: 'guardianMage' })
  const warded = { ...combatant, arcaneWardHp: 2 }
  const hit = applyDamage(warded, 5)
  assert.equal(hit.arcaneWardHp, 0)
  assert.equal(hit.currentHp, warded.currentHp - 3)
})

test('a combatant with no ward takes damage exactly as it always did', () => {
  const { combatant } = caster()
  const hit = applyDamage(combatant, 4)
  assert.equal(hit.currentHp, combatant.currentHp - 4)
  assert.equal('arcaneWardHp' in hit, false, 'no ward must not be invented')
})

// --- On the board ---------------------------------------------------------

test('casting from the board spends the action and writes to the log', () => {
  const { hero, combatant } = caster('life')
  const foe = buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'Goblin',
    { ...meta, id: 'foe' },
  )
  const base = createEncounter(
    [
      { ...combatant, currentHp: 1 },
      characterToCombatant(foe, { position: { x: 1, y: 0 }, team: 'foes' }),
    ],
    () => 0.99,
  )
  const encounter = { ...base, activeIndex: base.order.indexOf(hero.id) }

  const result = castFromActive(encounter, {
    spellId: 'cureWounds',
    targetId: hero.id,
    subclassId: 'life',
    rng: () => faceValue(5, 8),
  })

  assert.equal(result.refusal, null)
  assert.equal(result.encounter.hasActed, true)
  assert.ok(result.encounter.combatants[hero.id]!.currentHp > 1)
  assert.ok(result.encounter.log.some((line) => /casts Cure Wounds/.test(line)))
})

test('casting twice in a turn is refused', () => {
  const { hero, combatant } = caster()
  const base = createEncounter([{ ...combatant, currentHp: 1 }], () => 0.99)
  const spent = { ...base, activeIndex: base.order.indexOf(hero.id), hasActed: true }

  const result = castFromActive(spent, { spellId: 'cureWounds', targetId: hero.id })
  assert.match(result.refusal ?? '', /already taken your action/i)
  assert.equal(result.encounter, spent)
})

// --- The honesty invariant, again -----------------------------------------

test('every subclass that claims to be active carries an effect', () => {
  for (const subclass of SUBCLASSES) {
    assert.equal(
      subclass.effect !== undefined,
      subclass.feature.active,
      `${subclass.id}: effect and active must still agree`,
    )
  }
  const active = SUBCLASSES.filter((s) => s.feature.active).map((s) => s.id)
  assert.deepEqual(
    active.sort(),
    ['abjuration', 'battlemaster', 'champion', 'devotion', 'life', 'light', 'vengeance'],
    'seven features should now be genuinely wired',
  )
})
