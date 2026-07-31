import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { applyDamage, resolveAttack } from '../src/lib/dnd/combat.ts'
import { addCondition, hasCondition, tickConditions } from '../src/lib/dnd/conditions.ts'
import { castSpell, castableSpells, spellTargetsEnemies } from '../src/lib/dnd/casting.ts'
import { FIRST_LEVEL_SLOTS } from '../src/lib/dnd/spellcasting.ts'
import { castFromActive, createEncounter } from '../src/lib/dnd/encounter.ts'
import { SUBCLASSES } from '../src/content/subclasses.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'

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
    [
      'abjuration', 'assassin', 'battlemaster', 'champion', 'devotion',
      'evocation', 'life', 'light', 'thief', 'vengeance',
    ],
    'all ten features should now be genuinely wired',
  )
})

// --- Guiding Bolt ---------------------------------------------------------

test('Guiding Bolt is castable and aimed outward', () => {
  const { combatant } = caster()
  const listed = castableSpells(combatant).find((e) => e.spell.id === 'guidingBolt')
  assert.ok(listed !== undefined, 'a radiantWrath cleric prepares it')
  assert.equal(listed.castable, true)
  assert.equal(spellTargetsEnemies('guidingBolt'), true)
  // Heals and wards still land on the caster.
  assert.equal(spellTargetsEnemies('cureWounds'), false)
  assert.equal(spellTargetsEnemies('mageArmor'), false)
})

test('a hit deals radiant damage, spends the slot, and leaves the target glowing', () => {
  const { hero, combatant } = caster()
  const foe = buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'Goblin',
    { ...meta, id: 'foe' },
  )
  const target = { ...characterToCombatant(foe, { position: { x: 1, y: 0 }, team: 'foes' }), maxHp: 40, currentHp: 40 }

  // A natural 20 to be sure it lands, then the doubled damage dice.
  const result = castSpell({
    caster: combatant,
    target,
    spellId: 'guidingBolt',
    rng: sequenceRng([
      faceValue(20, 20),
      faceValue(4, 6), faceValue(4, 6), faceValue(4, 6), faceValue(4, 6),
      faceValue(4, 6), faceValue(4, 6), faceValue(4, 6), faceValue(4, 6),
    ]),
  })

  assert.equal(result.refusal, null)
  assert.ok(result.target.currentHp < 40, 'the beam should hurt')
  assert.equal(result.caster.spellSlots, 0, 'a levelled spell costs its slot')
  assert.ok(
    hasCondition(result.target.conditions, 'dazzled'),
    'the rider is what separates this from a cantrip',
  )
  assert.ok(result.lines.some((l) => /glowing/.test(l)))
  assert.equal(hero.id, result.caster.id)
})

test('a miss deals nothing and leaves no glow', () => {
  const { combatant } = caster()
  const foe = buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'Goblin',
    { ...meta, id: 'foe' },
  )
  const target = characterToCombatant(foe, { position: { x: 1, y: 0 }, team: 'foes' })

  const result = castSpell({
    caster: combatant,
    target,
    spellId: 'guidingBolt',
    rng: () => faceValue(1, 20),
  })

  assert.equal(result.target.currentHp, target.currentHp)
  assert.equal(hasCondition(result.target.conditions, 'dazzled'), false)
  assert.equal(result.caster.spellSlots, 0, 'the slot goes whether or not it connects')
})

test('the glow actually makes the next attack easier', () => {
  // The whole point of the rider, asserted through the roll mode rather than
  // by trusting the condition table.
  const { combatant } = caster()
  const foe = buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'Goblin',
    { ...meta, id: 'foe' },
  )
  const plain = characterToCombatant(foe, { position: { x: 1, y: 0 }, team: 'foes' })
  const lit = { ...plain, conditions: addCondition(plain.conditions, 'dazzled', 1) }
  const attack = combatant.attacks[0]
  assert.ok(attack !== undefined)

  const normal = resolveAttack({ attacker: combatant, target: plain, attack, rng: () => faceValue(10, 20) })
  const withGlow = resolveAttack({ attacker: combatant, target: lit, attack, rng: () => faceValue(10, 20) })

  assert.equal(normal.attackRoll.mode, 'normal')
  assert.equal(withGlow.attackRoll.mode, 'advantage')
})

test('the glow fades rather than lasting the fight', () => {
  const faded = tickConditions([{ id: 'dazzled', roundsRemaining: 1 }])
  assert.deepEqual(faded, [], 'one round, then gone')
})

// --- Magic Missile --------------------------------------------------------

function evoker() {
  const hero = buildCharacter(
    answers({ classId: 'wizard', magicStyleId: 'pyromancer' }),
    'Evoker',
    meta,
  )
  return { hero, combatant: characterToCombatant(hero, { position: { x: 0, y: 0 } }) }
}

function target(maxHp = 40) {
  const foe = buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'Goblin',
    { ...meta, id: 'foe' },
  )
  return {
    ...characterToCombatant(foe, { position: { x: 1, y: 0 }, team: 'foes' }),
    maxHp,
    currentHp: maxHp,
  }
}

test('Magic Missile is castable and aimed outward', () => {
  const { combatant } = evoker()
  const listed = castableSpells(combatant).find((e) => e.spell.id === 'magicMissile')
  assert.ok(listed !== undefined, 'a pyromancer prepares it')
  assert.equal(listed.castable, true)
  assert.equal(spellTargetsEnemies('magicMissile'), true)
})

test('three darts land without any roll to stop them', () => {
  const { combatant } = evoker()
  const goblin = target()

  // Three separate 1d4+1, all maximum: (4+1) x 3 = 15.
  const result = castSpell({
    caster: combatant,
    target: goblin,
    spellId: 'magicMissile',
    rng: () => faceValue(4, 4),
  })

  assert.equal(result.refusal, null)
  assert.equal(result.target.currentHp, 40 - 15, 'each dart is 1d4+1, thrown three times')
  assert.equal(result.caster.spellSlots, 0)
})

test('the darts are rolled separately, not as one lump', () => {
  /*
   * Three 1d4+1 is a narrower spread than one 3d4+3, and the log shows three
   * numbers because that is what the spell does. A sequence proves each dart
   * drew its own die rather than one being multiplied.
   */
  const { combatant } = evoker()
  const result = castSpell({
    caster: combatant,
    target: target(),
    spellId: 'magicMissile',
    rng: sequenceRng([faceValue(1, 4), faceValue(2, 4), faceValue(3, 4)]),
  })

  // (1+1) + (2+1) + (3+1) = 9
  assert.equal(result.target.currentHp, 40 - 9)
  assert.ok(result.lines.some((l) => /2 \+ 3 \+ 4 = 9/.test(l)), 'each dart shown')
})

test('a missile has no attack roll to miss with, however low the dice fall', () => {
  const { combatant } = evoker()
  const goblin = target()
  // Minimum on every dart still connects: 1+1 three times.
  const result = castSpell({
    caster: combatant,
    target: goblin,
    spellId: 'magicMissile',
    rng: () => faceValue(1, 4),
  })
  assert.ok(result.target.currentHp < goblin.currentHp, 'it always lands')
  // Word boundary on purpose: a loose /miss/i matches "Magic Missile" itself.
  assert.equal(result.lines.some((l) => /\bMISS\b/.test(l)), false, 'no miss verdict')
})

test('darts that drop a target say so, like any other killing blow', () => {
  const { combatant } = evoker()
  const frail = target(4)
  const result = castSpell({
    caster: combatant,
    target: frail,
    spellId: 'magicMissile',
    rng: () => faceValue(4, 4),
  })
  assert.equal(result.target.currentHp, 0)
  assert.ok(result.lines.some((l) => /out of the fight/.test(l)))
})

test('Magic Missile with no slot left is refused', () => {
  const { combatant } = evoker()
  const result = castSpell({
    caster: { ...combatant, spellSlots: 0 },
    target: target(),
    spellId: 'magicMissile',
  })
  assert.match(result.refusal ?? '', /slot/i)
})
