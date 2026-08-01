import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { levelUp } from '../src/lib/dnd/leveling.ts'
import { slotsAt } from '../src/lib/dnd/slots.ts'
import { spellsFor, SPELLS_BY_ID } from '../src/content/spells.ts'
import { getSpellcastingLimits, PALADIN_LEVEL_2_PREVIEW } from '../src/lib/dnd/spellcasting.ts'
import { attackWith, castFromActive, createEncounter } from '../src/lib/dnd/encounter.ts'
import { damageRiderFor } from '../src/lib/dnd/combat.ts'
import { hasCondition } from '../src/lib/dnd/conditions.ts'
import { GOBLIN, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import { faceValue } from './helpers/rng.ts'
import type { CreationAnswers } from '../src/types/character.ts'

const meta = { id: 'hero', now: 1_700_000_000_000 }

const paladin = () =>
  buildCharacter(
    { classId: 'paladin', raceId: 'human', backgroundId: 'noble', flawId: 'obeyed',
      equipmentChoice: 'offensive', auraId: 'amber' } as CreationAnswers,
    'Oathkeeper',
    meta,
  )

// --- the list exists at all -----------------------------------------------

test('a paladin has spells, which is new', () => {
  const ids = spellsFor('paladin', 1).map((spell) => spell.id)
  assert.ok(ids.length > 0, 'the registry held none of these until now')
  assert.ok(ids.includes('divineFavor'))
  // Shared with the cleric rather than duplicated — the SRD gives both.
  for (const id of ['cureWounds', 'bless', 'shieldOfFaith']) {
    assert.ok(ids.includes(id), `${id} should be a paladin spell too`)
    assert.ok(SPELLS_BY_ID[id]?.classes.includes('cleric'), `${id} is still a cleric spell`)
  }
})

test('levelling hands them the list, because creation never could', () => {
  /*
   * A paladin has no magic at 1st level, so there is no creation step in which
   * to choose. Levelling has to grant something or the slots arrive empty —
   * which is exactly how they arrived before this.
   */
  const fresh = paladin()
  assert.equal(fresh.preparedSpells, undefined)

  const grown = levelUp(fresh).character
  assert.ok((grown.preparedSpells ?? []).length > 0)
  assert.equal(grown.preparedSpells?.[0], 'divineFavor', 'the signature one survives the trim')
})

test('the count is Charisma plus half level, not half level alone', () => {
  // Charisma is the ability the class is about; leaving it out gave every
  // paladin the same single spell whatever they had built.
  for (const cha of [-1, 0, 2, 3]) {
    assert.equal(
      getSpellcastingLimits('paladin', 0, 0, 2, cha).preparedSpellsCount,
      Math.max(1, cha + 1),
    )
  }
  assert.equal(getSpellcastingLimits('paladin', 0, 0, 1, 3).preparedSpellsCount, 0, 'not yet')
})

test('the preview promises exactly what the registry holds', () => {
  // It was a hand-written list of four and drifted to promising spells that did
  // not exist. Derived now, so the two cannot disagree.
  assert.deepEqual(
    PALADIN_LEVEL_2_PREVIEW.map((one) => one.id).sort(),
    spellsFor('paladin', 1).map((one) => one.id).sort(),
  )
})

// --- Divine Favor ---------------------------------------------------------

function board() {
  const hero = characterToCombatant(levelUp(paladin()).character, {
    position: { x: 0, y: 0 },
    speedSquares: 3,
  })
  const foe = {
    ...spawnMonster(GOBLIN, { id: 'foe', position: { x: 1, y: 0 } }),
    maxHp: 60,
    currentHp: 60,
  }
  return { hero, encounter: createEncounter([hero, foe], () => 0.99, { leadId: hero.id }) }
}

test('a condition can lend damage the way one lends armour', () => {
  const plain = board().hero
  assert.equal(damageRiderFor(plain), null, 'almost nobody has one')
  assert.equal(
    damageRiderFor({
      ...plain,
      conditions: [{ id: 'favoured', roundsRemaining: null, source: plain.id }],
    }),
    '1d4',
  )
})

test('casting it on yourself keeps the slot, the concentration AND the condition', () => {
  /*
   * The bug this test exists for. Self-casting merged the caster over the
   * target and then rescued `currentHp` and `ac` by name — a whitelist, so any
   * spell touching a new field on the target lost it. Divine Favor touches
   * `conditions`: it spent a slot, started concentrating, and granted nothing.
   */
  const { hero, encounter } = board()
  const before = slotsAt(encounter.combatants[hero.id]?.spellSlots, 1)

  const cast = castFromActive(encounter, { spellId: 'divineFavor', targetId: hero.id })
  assert.equal(cast.refusal, null)

  const after = cast.encounter.combatants[hero.id]
  assert.ok(after !== undefined)
  assert.equal(slotsAt(after.spellSlots, 1), before - 1, 'the slot was spent')
  assert.equal(after.concentratingOn, 'divineFavor', 'and it is being held')
  assert.ok(hasCondition(after.conditions, 'favoured'), 'and the condition actually landed')
})

test('the favour adds its die to every hit while it holds', () => {
  const { hero, encounter } = board()
  const cast = castFromActive(encounter, { spellId: 'divineFavor', targetId: hero.id })
  const armed = { ...cast.encounter, hasActed: false }

  const swung = attackWith(armed, {
    targetId: 'foe',
    attackId: hero.attacks[0]!.id,
    rng: () => faceValue(18, 20),
  })
  assert.equal(swung.refusal, null)

  const plain = attackWith(encounter, {
    targetId: 'foe',
    attackId: hero.attacks[0]!.id,
    rng: () => faceValue(18, 20),
  })
  const favoured = swung.outcome?.kind === 'hit' ? swung.outcome.damage : 0
  const ordinary = plain.outcome?.kind === 'hit' ? plain.outcome.damage : 0
  assert.ok(favoured > ordinary, 'the rider shows up in the damage')
})

test('losing concentration takes the die back with it', () => {
  // Derived rather than written into the weapon, so nothing has to remember
  // what the weapon used to do — the same reason `warded` lends armour.
  const { hero, encounter } = board()
  const cast = castFromActive(encounter, { spellId: 'divineFavor', targetId: hero.id })
  const held = cast.encounter.combatants[hero.id]
  assert.ok(held !== undefined)
  assert.equal(damageRiderFor(held), '1d4')

  const dropped = { ...held, conditions: [] }
  assert.equal(damageRiderFor(dropped), null)
})

test('it costs a bonus action, so you can favour your weapon and still swing', () => {
  assert.equal(SPELLS_BY_ID['divineFavor']?.castingCost, 'bonusAction')
  const { hero, encounter } = board()
  const acted = { ...encounter, hasActed: true }
  const cast = castFromActive(acted, { spellId: 'divineFavor', targetId: hero.id })
  assert.equal(cast.refusal, null, 'a different budget from the attack')
  assert.equal(cast.encounter.bonusActionSpent, true)
})

test('the level-up panel never shows a raw slot table', () => {
  /*
   * `spellSlots` became an array indexed by spell level, and two display
   * components rendered it directly — so a paladin's two first-level slots
   * reached production reading "02", the leading zero being the cantrip index
   * nobody spends. Typecheck was clean: React will happily print an array.
   *
   * This asserts the shape a reader should never see, rather than the exact
   * wording, so the copy can change without the guard going quiet.
   */
  const gains = levelUp(paladin()).gains
  assert.ok(gains?.spellSlots !== undefined)
  const rendered = describeSlotsForTest(gains.spellSlots)
  assert.doesNotMatch(rendered, /^0/, 'the cantrip index must not lead')
  assert.match(rendered, /^\d/, 'and it still starts with a number')
  assert.equal(rendered, '2', 'a level-2 paladin has two first-level slots')
})

/** Mirrors the panel's formatter; kept here so the rule has a test at all. */
function describeSlotsForTest(slots: readonly number[]): string {
  const first = slots[1] ?? 0
  const second = slots[2] ?? 0
  return second > 0 ? `${first} · ${second} second-level` : String(first)
}

test('a full caster at third level shows both tiers, not a concatenation', () => {
  const wizard = buildCharacter(
    { classId: 'wizard', raceId: 'human', backgroundId: 'noble', flawId: 'obeyed',
      equipmentChoice: 'offensive', auraId: 'amber', magicStyleId: 'pyromancer' } as CreationAnswers,
    'Mage',
    { ...meta, id: 'mage' },
  )
  const third = levelUp(levelUp(wizard).character)
  assert.ok(third.gains?.spellSlots !== undefined)
  const rendered = describeSlotsForTest(third.gains.spellSlots)
  assert.match(rendered, /second-level/, 'the second tier is named rather than run together')
})
