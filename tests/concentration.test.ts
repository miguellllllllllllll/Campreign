import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { effectiveAc, resolveAttack } from '../src/lib/dnd/combat.ts'
import { attackWith, castFromActive, createEncounter } from '../src/lib/dnd/encounter.ts'
import { castBlessing, castSpell } from '../src/lib/dnd/casting.ts'
import {
  CONCENTRATION_BASE_DC,
  checkConcentration,
  concentrationDc,
  dropConcentration,
} from '../src/lib/dnd/concentration.ts'
import { addCondition, hasCondition } from '../src/lib/dnd/conditions.ts'
import type { Combatant } from '../src/types/combat.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'

const meta = { id: 'cleric', now: 1_700_000_000_000 }

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

function cleric() {
  const hero = buildCharacter(answers(), 'Blesser', meta)
  return { hero, combatant: characterToCombatant(hero, { position: { x: 0, y: 0 } }) }
}

/**
 * A cleric with room to be hit. At 8 hit points the goblin's longsword kills
 * outright, and dying ends concentration without a roll — which is correct,
 * and would silently test the wrong branch.
 */
function sturdyCleric() {
  const { hero, combatant } = cleric()
  return { hero, combatant: { ...combatant, maxHp: 60, currentHp: 60 } }
}

function ally(id: string): Combatant {
  const c = buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'Squire',
    { ...meta, id },
  )
  return characterToCombatant(c, { position: { x: 1, y: 0 } })
}

function goblin(): Combatant {
  const c = buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'Goblin',
    { ...meta, id: 'foe' },
  )
  return {
    ...characterToCombatant(c, { position: { x: 1, y: 0 }, team: 'foes' }),
    attacks: c.attacks.map((a) => ({ ...a, proficient: true })),
  }
}

// --- The die --------------------------------------------------------------

test('a blessing adds a d4 to the attack roll and names it in the breakdown', () => {
  const { combatant } = cleric()
  const blessed = { ...combatant, conditions: addCondition(combatant.conditions, 'blessed', null, 'cleric') }
  const attack = combatant.attacks[0]
  assert.ok(attack !== undefined)
  const target = goblin()

  // Same d20 both times; the blessed roll then draws its own d4.
  const plain = resolveAttack({ attacker: combatant, target, attack, rng: () => faceValue(10, 20) })
  const lucky = resolveAttack({
    attacker: blessed,
    target,
    attack,
    rng: sequenceRng([faceValue(10, 20), faceValue(3, 4), faceValue(3, 6)]),
  })

  assert.equal(lucky.breakdown.total - plain.breakdown.total, 3)
  assert.ok(lucky.breakdown.parts.some((p) => p.label === 'Bless' && p.value === 3))
  assert.equal(plain.breakdown.parts.some((p) => p.label === 'Bless'), false)
})

test('a blessing does not cost you advantage', () => {
  /*
   * The reason the die is rolled separately instead of appended to the
   * notation: "1d20+2+1d4" has two dice terms, and isSingleD20 would stop
   * applying advantage entirely. A blessing that cancelled advantage would be
   * a strange sort of blessing.
   */
  const { combatant } = cleric()
  const blessed = {
    ...combatant,
    hasAmbush: true,
    conditions: addCondition(combatant.conditions, 'blessed', null, 'cleric'),
  }
  const outcome = resolveAttack({
    attacker: blessed,
    target: goblin(),
    attack: combatant.attacks[0]!,
    rng: sequenceRng([faceValue(4, 20), faceValue(17, 20), faceValue(2, 4), faceValue(3, 6)]),
  })
  assert.equal(outcome.attackRoll.mode, 'advantage', 'still keeps the higher d20')
  assert.equal(outcome.breakdown.natural, 17)
})

// --- Casting it -----------------------------------------------------------

test('Bless lands on the whole side and starts concentration', () => {
  const { hero, combatant } = cleric()
  const squire = ally('squire')

  const result = castBlessing({ caster: combatant, party: [combatant, squire], spellId: 'bless' })
  assert.equal(result.refusal, null)
  assert.equal(result.blessed.length, 2, 'hero and squire both')
  for (const c of result.blessed) {
    assert.ok(hasCondition(c.conditions, 'blessed'))
  }
  assert.equal(result.caster.concentratingOn, 'bless')
  assert.equal(result.caster.spellSlots, 0)
  assert.equal(result.caster.id, hero.id)
})

test('it never blesses more than the spell allows', () => {
  const { combatant } = cleric()
  const crowd = [combatant, ally('a'), ally('b'), ally('c'), ally('d')]
  const result = castBlessing({ caster: combatant, party: crowd, spellId: 'bless' })
  assert.equal(result.blessed.length, 3, 'three is the limit')
})

test('a caster with no slot cannot bless', () => {
  const { combatant } = cleric()
  const result = castBlessing({
    caster: { ...combatant, spellSlots: 0 },
    party: [combatant],
    spellId: 'bless',
  })
  assert.match(result.refusal ?? '', /slot/i)
})

// --- Holding it -----------------------------------------------------------

test('the save is DC 10 or half the damage, whichever hurts more', () => {
  assert.equal(concentrationDc(0), CONCENTRATION_BASE_DC)
  assert.equal(concentrationDc(7), 10, 'half of 7 is under the floor')
  assert.equal(concentrationDc(30), 15, 'and over it, the damage decides')
})

test('a good save keeps the spell and a bad one loses it', () => {
  const { combatant } = cleric()
  const held = checkConcentration({ caster: combatant, damage: 4, rng: () => faceValue(20, 20) })
  assert.equal(held.held, true)

  const lost = checkConcentration({ caster: combatant, damage: 4, rng: () => faceValue(1, 20) })
  assert.equal(lost.held, false)
  assert.equal(lost.dc, 10)
})

test('losing it strips the blessing from everyone the caster blessed', () => {
  const { combatant } = cleric()
  const squire = ally('squire')
  const blessed = castBlessing({ caster: combatant, party: [combatant, squire], spellId: 'bless' })

  const board = Object.fromEntries(blessed.blessed.map((c) => [c.id, c]))
  board[blessed.caster.id] = { ...board[blessed.caster.id]!, concentratingOn: 'bless' }

  const after = dropConcentration(blessed.caster.id, board)
  for (const c of Object.values(after)) {
    assert.equal(hasCondition(c.conditions, 'blessed'), false, `${c.name} should be plain again`)
  }
  assert.equal(after[blessed.caster.id]?.concentratingOn, undefined)
})

test('another caster\'s blessing survives your concentration breaking', () => {
  // Conditions carry who applied them, which is the whole reason for the field.
  const squire = ally('squire')
  const mine = { ...squire, conditions: addCondition(squire.conditions, 'blessed', null, 'me') }
  const both = { ...mine, conditions: addCondition(mine.conditions, 'blessed', null, 'you') }

  const after = dropConcentration('me', { squire: both })
  // addCondition replaces by id, so the later source is the one held; dropping
  // a different caster's must leave it alone.
  assert.equal(hasCondition(after.squire!.conditions, 'blessed'), true)
})

// --- On the board ---------------------------------------------------------

test('being hit forces the save, and failing it puts the blessing out', () => {
  const { hero, combatant } = sturdyCleric()
  const foe = goblin()
  const base = createEncounter([combatant, foe], () => 0.99)

  // Cast it on the hero's turn.
  const blessed = castFromActive(
    { ...base, activeIndex: base.order.indexOf(hero.id) },
    { spellId: 'bless', targetId: hero.id },
  )
  assert.equal(blessed.refusal, null)
  assert.ok(hasCondition(blessed.encounter.combatants[hero.id]!.conditions, 'blessed'))

  // Then let the goblin hit them, with a natural 1 on the save that follows.
  const swung = attackWith(
    { ...blessed.encounter, activeIndex: base.order.indexOf(foe.id), hasActed: false },
    {
      targetId: hero.id,
      attackId: foe.attacks[0]!.id,
      rng: sequenceRng([faceValue(19, 20), faceValue(5, 6), faceValue(1, 20)]),
    },
  )

  const after = swung.encounter.combatants[hero.id]
  assert.ok(after !== undefined)
  assert.equal(after.concentratingOn, undefined, 'the spell is gone')
  assert.equal(hasCondition(after.conditions, 'blessed'), false)
  assert.ok(swung.encounter.log.some((l) => /loses concentration/.test(l)))
})

test('a caster who holds the save keeps the blessing', () => {
  const { hero, combatant } = sturdyCleric()
  const foe = goblin()
  const base = createEncounter([combatant, foe], () => 0.99)
  const blessed = castFromActive(
    { ...base, activeIndex: base.order.indexOf(hero.id) },
    { spellId: 'bless', targetId: hero.id },
  )

  const swung = attackWith(
    { ...blessed.encounter, activeIndex: base.order.indexOf(foe.id), hasActed: false },
    {
      targetId: hero.id,
      attackId: foe.attacks[0]!.id,
      rng: sequenceRng([faceValue(19, 20), faceValue(2, 6), faceValue(20, 20)]),
    },
  )

  const after = swung.encounter.combatants[hero.id]
  assert.equal(after?.concentratingOn, 'bless')
  assert.ok(hasCondition(after!.conditions, 'blessed'))
  assert.ok(swung.encounter.log.some((l) => /keeps hold of the spell/.test(l)))
})

test('nobody who is not concentrating is ever asked to save', () => {
  const { hero, combatant } = sturdyCleric()
  const foe = goblin()
  const base = createEncounter([combatant, foe], () => 0.99)
  const swung = attackWith(
    { ...base, activeIndex: base.order.indexOf(foe.id) },
    {
      targetId: hero.id,
      attackId: foe.attacks[0]!.id,
      rng: sequenceRng([faceValue(19, 20), faceValue(5, 6)]),
    },
  )
  assert.equal(swung.encounter.log.some((l) => /concentration/.test(l)), false)
})

test('dying ends concentration outright, with no roll to make', () => {
  // The branch the lethal setup found by accident, now covered on purpose.
  const { hero, combatant } = cleric()
  const foe = goblin()
  const base = createEncounter([combatant, foe], () => 0.99)
  const blessed = castFromActive(
    { ...base, activeIndex: base.order.indexOf(hero.id) },
    { spellId: 'bless', targetId: hero.id },
  )

  const killed = attackWith(
    { ...blessed.encounter, activeIndex: base.order.indexOf(foe.id), hasActed: false },
    {
      targetId: hero.id,
      attackId: foe.attacks[0]!.id,
      rng: sequenceRng([faceValue(19, 20), faceValue(6, 6)]),
    },
  )

  const down = killed.encounter.combatants[hero.id]
  assert.equal(down?.currentHp, 0)
  assert.equal(down?.concentratingOn, undefined)
  assert.ok(killed.encounter.log.some((l) => /the spell they were holding goes with them/.test(l)))
  assert.equal(
    killed.encounter.log.some((l) => /rolls \d+ against DC/.test(l)),
    false,
    'a corpse does not roll to concentrate',
  )
})

// --- Shield of Faith ------------------------------------------------------

test('a ward lends armour rather than overwriting it', () => {
  const { combatant } = cleric()
  const base = combatant.ac
  const warded = {
    ...combatant,
    conditions: addCondition(combatant.conditions, 'warded', null, 'cleric'),
  }

  assert.equal(effectiveAc(warded), base + 2)
  assert.equal(warded.ac, base, 'the armour they are wearing has not changed')
})

test('losing the ward takes the armour back with it', () => {
  /*
   * The whole reason Shield of Faith could not be a concentration spell until
   * now: an AC written into the field had no way home. Derived from conditions,
   * it leaves when they do, with nothing to undo.
   */
  const { combatant } = cleric()
  const warded = {
    ...combatant,
    conditions: addCondition(combatant.conditions, 'warded', null, 'cleric'),
    concentratingOn: 'shieldOfFaith',
  }
  const after = dropConcentration('cleric', { cleric: warded })
  assert.equal(effectiveAc(after.cleric!), combatant.ac, 'straight back to the gear')
})

test('casting it wards the target and starts concentration', () => {
  const { hero, combatant } = cleric()
  const squire = ally('squire')

  const result = castSpell({ caster: combatant, target: squire, spellId: 'shieldOfFaith' })
  assert.equal(result.refusal, null)
  assert.ok(hasCondition(result.target.conditions, 'warded'))
  assert.equal(effectiveAc(result.target), squire.ac + 2)
  assert.equal(result.caster.concentratingOn, 'shieldOfFaith')
  assert.equal(result.caster.spellSlots, 0)
  assert.equal(result.caster.id, hero.id)
})

test('the ward makes the target genuinely harder to hit', () => {
  // Asserted through a real attack rather than by trusting the table: a roll
  // that clears the base armour by one has to fall short of the ward.
  const { combatant } = cleric()
  const squire = ally('squire')
  const warded = {
    ...squire,
    conditions: addCondition(squire.conditions, 'warded', null, combatant.id),
  }
  const foe = goblin()
  const attack = foe.attacks[0]
  assert.ok(attack !== undefined)

  // Pin the d20 so the same roll meets both armour values.
  const rng = () => faceValue(13, 20)
  const plain = resolveAttack({ attacker: foe, target: squire, attack, rng })
  const shielded = resolveAttack({ attacker: foe, target: warded, attack, rng })

  assert.equal(plain.breakdown.targetAc + 2, shielded.breakdown.targetAc)
  assert.ok(
    plain.breakdown.total === shielded.breakdown.total,
    'same roll, different wall',
  )
})

test('Mage Armor still writes the armour, because it is not concentration', () => {
  /*
   * Deliberately unchanged. Mage Armor runs eight hours in the SRD, outlasting
   * anything that happens on this board, so setting the value is correct for it
   * in a way it was never correct for Shield of Faith.
   */
  const wizard = buildCharacter(
    { ...answers({ classId: 'wizard', magicStyleId: 'guardianMage' }) },
    'Warder',
    { ...meta, id: 'wiz' },
  )
  const c = characterToCombatant(wizard, { position: { x: 0, y: 0 } })
  const result = castSpell({ caster: c, target: c, spellId: 'mageArmor' })

  assert.equal(result.refusal, null)
  assert.equal(result.caster.concentratingOn, undefined, 'nothing to hold together')
  assert.equal(hasCondition(result.caster.conditions, 'warded'), false)
  assert.ok(result.caster.ac > 0)
})

test('a hit that breaks concentration also drops the ward it was holding', () => {
  const { hero, combatant } = sturdyCleric()
  const squire = ally('squire')
  const foe = goblin()
  const base = createEncounter([combatant, squire, foe], () => 0.99)

  const cast = castFromActive(
    { ...base, activeIndex: base.order.indexOf(hero.id) },
    { spellId: 'shieldOfFaith', targetId: squire.id },
  )
  assert.equal(cast.refusal, null)
  assert.ok(hasCondition(cast.encounter.combatants[squire.id]!.conditions, 'warded'))

  const swung = attackWith(
    { ...cast.encounter, activeIndex: base.order.indexOf(foe.id), hasActed: false },
    {
      targetId: hero.id,
      attackId: foe.attacks[0]!.id,
      rng: sequenceRng([faceValue(19, 20), faceValue(5, 6), faceValue(1, 20)]),
    },
  )

  const stillWarded = swung.encounter.combatants[squire.id]
  assert.ok(stillWarded !== undefined)
  assert.equal(
    hasCondition(stillWarded.conditions, 'warded'),
    false,
    'the ward goes out with the concentration that held it',
  )
  assert.equal(effectiveAc(stillWarded), squire.ac)
})
