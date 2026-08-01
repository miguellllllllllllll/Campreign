import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { castSpell, castableSpells } from '../src/lib/dnd/casting.ts'
import { levelUp } from '../src/lib/dnd/leveling.ts'
import { slotsAt, hasSlot, spendSlot } from '../src/lib/dnd/slots.ts'
import { spellsFor } from '../src/content/spells.ts'
import { hasCondition } from '../src/lib/dnd/conditions.ts'
import { GOBLIN, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import { faceValue } from './helpers/rng.ts'
import type { CreationAnswers } from '../src/types/character.ts'

function caster(classId: 'wizard' | 'cleric') {
  return buildCharacter(
    {
      classId,
      raceId: 'human',
      backgroundId: 'noble',
      flawId: 'obeyed',
      equipmentChoice: 'offensive',
      auraId: 'amber',
      magicStyleId: classId === 'wizard' ? 'pyromancer' : 'healersMercy',
    } as CreationAnswers,
    'Caster',
    { id: 'c', now: 0 },
  )
}

/** A caster taken to 3rd level the way the tutorial does it. */
function atThird(classId: 'wizard' | 'cleric') {
  return levelUp(levelUp(caster(classId)).character).character
}

test('both casting classes have something to spend a second-level slot on', () => {
  /*
   * The gate that kept MAX_LEVEL at 2. Slots without spells is the inert
   * failure one layer up from slots the engine cannot represent, so this
   * asserts the content exists before anything asserts the cap moved.
   */
  for (const classId of ['wizard', 'cleric'] as const) {
    const second = spellsFor(classId, 2)
    assert.ok(second.length > 0, `${classId} has no second-level spells`)
    for (const spell of second) {
      assert.ok(spell.effect !== undefined, `${spell.id} cannot be resolved by the engine`)
    }
  }
})

test('a third-level caster actually holds second-level slots', () => {
  for (const classId of ['wizard', 'cleric'] as const) {
    const third = atThird(classId)
    assert.equal(third.level, 3)
    assert.equal(slotsAt(third.spellSlots, 1), 4, `${classId} first-level slots at 3rd`)
    assert.equal(slotsAt(third.spellSlots, 2), 2, `${classId} second-level slots at 3rd`)
  }
})

test('a second-level spell reaches the action bar, and refuses without the slot', () => {
  /*
   * Walked rather than asserted: castableSpells is the list ActionBar renders,
   * so a spell that resolves but never appears is caught here.
   */
  const third = atThird('wizard')
  const withSecond = {
    ...characterToCombatant(third, { position: { x: 0, y: 0 } }),
    preparedSpells: ['shatter'],
  }
  const listed = castableSpells(withSecond).find((one) => one.spell.id === 'shatter')
  assert.ok(listed !== undefined, 'Shatter never reaches the bar')
  assert.equal(listed.castable, true, `Shatter refused: ${listed.reason}`)

  const spent = { ...withSecond, spellSlots: spendSlot(withSecond.spellSlots, 2) }
  const dry = { ...spent, spellSlots: spendSlot(spent.spellSlots, 2) }
  const refused = castableSpells(dry).find((one) => one.spell.id === 'shatter')
  assert.equal(refused?.castable, false, 'a caster with no second-level slots may still cast one')
  assert.match(refused?.reason ?? '', /level 2/, 'and the refusal says which level ran out')
})

test('spending a second-level slot leaves the first-level ones alone', () => {
  // The bug the old single number could not even express.
  const third = atThird('cleric')
  const before = characterToCombatant(third, { position: { x: 0, y: 0 } })
  const after = { ...before, spellSlots: spendSlot(before.spellSlots, 2) }
  assert.equal(slotsAt(after.spellSlots, 2), 1, 'one second-level slot gone')
  assert.equal(slotsAt(after.spellSlots, 1), slotsAt(before.spellSlots, 1), 'first level untouched')
})

test('Blindness lands its condition on a failed save and nothing on a made one', () => {
  const third = atThird('cleric')
  const caster3 = {
    ...characterToCombatant(third, { position: { x: 0, y: 0 } }),
    preparedSpells: ['blindness'],
  }
  const goblin = spawnMonster(GOBLIN, { id: 'goblin', position: { x: 1, y: 0 } })

  const failed = castSpell({
    caster: caster3,
    target: goblin,
    spellId: 'blindness',
    rng: () => faceValue(1, 20),
  })
  assert.equal(failed.refusal, null)
  assert.ok(hasCondition(failed.target.conditions, 'blinded'), 'a natural 1 should be blinded')

  const made = castSpell({
    caster: caster3,
    target: goblin,
    spellId: 'blindness',
    rng: () => faceValue(20, 20),
  })
  assert.equal(made.refusal, null)
  assert.equal(hasCondition(made.target.conditions, 'blinded'), false, 'a 20 should shrug it off')
})

test('cantrips never consult the slot table', () => {
  // hasSlot answers yes for level 0 so no caller has to special-case it.
  assert.equal(hasSlot(undefined, 0), true)
  assert.equal(hasSlot([0, 0], 0), true)
  assert.equal(hasSlot([0, 0], 1), false)
})
