import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PALADIN_LEVEL_1_FEATURES,
  PALADIN_LEVEL_2_PREVIEW,
  calculateSpellStats,
  getSpellcastingLimits,
  spellcastingAbilityFor,
} from '../src/lib/dnd/spellcasting.ts'
import { SPELLS, SPELLS_BY_ID, spellsByIds, spellsFor } from '../src/content/spells.ts'
import { MAGIC_STYLE_PRESETS, magicStyleById, magicStylesFor } from '../src/content/spellPresets.ts'
import type { AbilityScores } from '../src/types/character.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { levelUp } from '../src/lib/dnd/leveling.ts'

function scores(overrides: Partial<AbilityScores> = {}): AbilityScores {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...overrides }
}

// --- Spell save DC and attack bonus ---------------------------------------

test('a wizard casts off Intelligence', () => {
  const stats = calculateSpellStats('wizard', scores({ int: 16 }), 2)
  assert.deepEqual(stats, { spellcastingAbility: 'int', spellSaveDC: 13, spellAttackBonus: 5 })
})

test('a cleric casts off Wisdom', () => {
  const stats = calculateSpellStats('cleric', scores({ wis: 15 }), 2)
  assert.deepEqual(stats, { spellcastingAbility: 'wis', spellSaveDC: 12, spellAttackBonus: 4 })
})

test('a paladin has the numbers off Charisma before it has the spells', () => {
  const stats = calculateSpellStats('paladin', scores({ cha: 14 }), 2)
  assert.deepEqual(stats, { spellcastingAbility: 'cha', spellSaveDC: 12, spellAttackBonus: 4 })
})

test('classes that never cast report no spell numbers at all', () => {
  assert.equal(calculateSpellStats('fighter', scores({ str: 16 }), 2), null)
  assert.equal(calculateSpellStats('rogue', scores({ dex: 16 }), 2), null)
})

test('the save DC tracks proficiency as well as the ability', () => {
  const low = calculateSpellStats('wizard', scores({ int: 16 }), 2)
  const high = calculateSpellStats('wizard', scores({ int: 16 }), 4)
  assert.equal(low?.spellSaveDC, 13)
  assert.equal(high?.spellSaveDC, 15)
})

test('a negative casting modifier lowers the DC rather than being ignored', () => {
  const stats = calculateSpellStats('wizard', scores({ int: 8 }), 2)
  assert.deepEqual(stats, { spellcastingAbility: 'int', spellSaveDC: 9, spellAttackBonus: 1 })
})

test('every class maps to exactly one casting ability, or none', () => {
  assert.equal(spellcastingAbilityFor('wizard'), 'int')
  assert.equal(spellcastingAbilityFor('cleric'), 'wis')
  assert.equal(spellcastingAbilityFor('paladin'), 'cha')
  assert.equal(spellcastingAbilityFor('fighter'), null)
  assert.equal(spellcastingAbilityFor('rogue'), null)
})

// --- Selection limits ------------------------------------------------------

test('a wizard picks three cantrips and prepares four', () => {
  const limits = getSpellcastingLimits('wizard', 1, 3)
  assert.equal(limits.cantripsCount, 3)
  assert.equal(limits.preparedSpellsCount, 4)
  assert.equal(limits.unlocksAtLevel, undefined)
})

test("a cleric's prepared count follows Wisdom", () => {
  assert.equal(getSpellcastingLimits('cleric', 2, 0).preparedSpellsCount, 3)
  assert.equal(getSpellcastingLimits('cleric', 3, 0).preparedSpellsCount, 4)
})

test('a dim cleric still prepares one spell rather than none', () => {
  assert.equal(getSpellcastingLimits('cleric', 0, 0).preparedSpellsCount, 1)
  assert.equal(getSpellcastingLimits('cleric', -1, 0).preparedSpellsCount, 1)
  assert.equal(getSpellcastingLimits('cleric', -3, 0).preparedSpellsCount, 1)
})

test('a level 1 paladin gets no magic but is told when it arrives', () => {
  const limits = getSpellcastingLimits('paladin', 0, 0)
  assert.equal(limits.cantripsCount, 0)
  assert.equal(limits.preparedSpellsCount, 0)
  assert.equal(limits.unlocksAtLevel, 2)
})

test('fighters and rogues get no magic and are promised none later', () => {
  for (const classId of ['fighter', 'rogue'] as const) {
    const limits = getSpellcastingLimits(classId, 2, 2)
    assert.equal(limits.cantripsCount, 0)
    assert.equal(limits.preparedSpellsCount, 0)
    assert.equal(limits.unlocksAtLevel, undefined)
  }
})

test('paladins have their level 1 features to show instead of spells', () => {
  const ids = PALADIN_LEVEL_1_FEATURES.map((feature) => feature.id)
  assert.deepEqual(ids, ['layOnHands', 'divineSense'])
  for (const feature of PALADIN_LEVEL_1_FEATURES) {
    assert.ok(feature.value.length > 0)
    assert.ok(feature.description.length > 0)
  }
})

test('every level 1 feature value splits into an amount and a period', () => {
  // PaladinPowerCard splits on ' / ' so the period can carry its own tooltip.
  // If a value ever stops having one, the card would render a bare amount.
  for (const feature of PALADIN_LEVEL_1_FEATURES) {
    const parts = feature.value.split(' / ')
    assert.equal(parts.length, 2, `${feature.id} should read "<amount> / <period>"`)
    assert.ok(parts[0].length > 0, `${feature.id} has no amount`)
    assert.ok(parts[1].length > 0, `${feature.id} has no period`)
  }
})

test("Lay on Hands is the pool the card's Long Rest tooltip hangs off", () => {
  const layOnHands = PALADIN_LEVEL_1_FEATURES.find((f) => f.id === 'layOnHands')
  assert.ok(layOnHands !== undefined)
  assert.equal(layOnHands.value, '5 HP / Long Rest')
})

// --- The level 2 preview --------------------------------------------------

test('the preview shows the spells a paladin is actually handed', () => {
  /*
   * This used to pin four names — Divine Favor, Searing Smite, Cure Wounds,
   * Heroism — and it stayed green while the registry held no paladin spells at
   * all. It was testing that a hardcoded list matched itself.
   *
   * The preview is now derived from the registry, so the assertion that matters
   * is that it agrees with what levelling actually grants. Searing Smite and
   * Heroism are gone rather than faked: one needs damage that ticks on later
   * turns, the other needs temporary hit points, and neither subsystem exists.
   */
  const previewed = PALADIN_LEVEL_2_PREVIEW.map((spell) => spell.id).sort()
  const real = spellsFor('paladin', 1).map((spell) => spell.id).sort()
  assert.deepEqual(previewed, real, 'the card promises exactly the registry')
  assert.ok(previewed.length > 0, 'and the registry is not empty')

  const granted = levelUp(
    buildCharacter(
      { classId: 'paladin', raceId: 'human', backgroundId: 'noble', flawId: 'obeyed',
        equipmentChoice: 'offensive', auraId: 'amber' } as never,
      'Oath', { id: 'preview', now: 0 },
    ),
  ).character.preparedSpells
  for (const id of granted ?? []) {
    assert.ok(previewed.includes(id), `${id} is granted but never previewed`)
  }
})

test('every previewed spell can fill a card without a blank field', () => {
  for (const spell of PALADIN_LEVEL_2_PREVIEW) {
    assert.ok(spell.id.length > 0, 'a preview spell needs an id to key on')
    assert.ok(spell.name.length > 0, `${spell.id} has no name`)
    assert.ok(spell.school.length > 0, `${spell.id} has no school`)
    assert.ok(spell.effect.length > 0, `${spell.id} has no effect`)
    assert.ok(spell.description.length > 30, `${spell.id} needs a real sentence, not a stub`)
    assert.match(spell.description, /[.!]$/, `${spell.id} should read as a finished sentence`)
  }
})

test('preview spell ids are unique, so React keys cannot collide', () => {
  const ids = PALADIN_LEVEL_2_PREVIEW.map((spell) => spell.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('concentration is recorded per spell rather than assumed', () => {
  const byName = new Map(PALADIN_LEVEL_2_PREVIEW.map((spell) => [spell.name, spell]))
  // Cure Wounds lands and is done; Divine Favor has to be held together.
  assert.equal(byName.get('Cure Wounds')?.isConcentration, false)
  assert.equal(byName.get('Divine Favor')?.isConcentration, true)
  // And the flag is the registry's, not a second copy that could disagree.
  for (const preview of PALADIN_LEVEL_2_PREVIEW) {
    assert.equal(preview.isConcentration, SPELLS_BY_ID[preview.id]?.isConcentration)
  }
})

test('the preview never overlaps the level 1 features it sits beneath', () => {
  const featureNames = new Set(PALADIN_LEVEL_1_FEATURES.map((f) => f.name))
  for (const spell of PALADIN_LEVEL_2_PREVIEW) {
    assert.ok(!featureNames.has(spell.name), `${spell.name} is already a level 1 feature`)
  }
})

test('a paladin has no castable magic even though the preview is populated', () => {
  // The preview is copy, not capability: the limits must still read zero, or a
  // level 1 paladin could end up holding spells the rules do not grant yet.
  const limits = getSpellcastingLimits('paladin', 2, 0)
  assert.equal(limits.cantripsCount, 0)
  assert.equal(limits.preparedSpellsCount, 0)
  assert.equal(limits.unlocksAtLevel, 2)
  assert.ok(PALADIN_LEVEL_2_PREVIEW.length > 0)
})

// --- The spell registry ---------------------------------------------------

test('every spell id is unique', () => {
  const ids = SPELLS.map((spell) => spell.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('the lookup table agrees with the list', () => {
  for (const spell of SPELLS) assert.equal(SPELLS_BY_ID[spell.id], spell)
})

test('each class has enough spells to fill its allocation', () => {
  assert.ok(spellsFor('wizard', 0).length >= 3)
  assert.ok(spellsFor('wizard', 1).length >= 4)
  assert.ok(spellsFor('cleric', 0).length >= 3)
  assert.ok(spellsFor('cleric', 1).length >= 3)
})

test('Light is on both class lists, as the SRD has it', () => {
  const light = SPELLS_BY_ID.light
  assert.deepEqual(light?.classes, ['wizard', 'cleric'])
  assert.ok(spellsFor('wizard', 0).includes(light!))
  assert.ok(spellsFor('cleric', 0).includes(light!))
})

test('cantrips are level 0 and prepared spells are level 1', () => {
  for (const spell of spellsFor('wizard', 0)) assert.equal(spell.level, 0)
  for (const spell of spellsFor('cleric', 1)) assert.equal(spell.level, 1)
})

test('Bless is an Enchantment spell and needs concentration', () => {
  const bless = SPELLS_BY_ID.bless
  assert.equal(bless?.school, 'Enchantment')
  assert.equal(bless?.isConcentration, true)
})

test('only the spells that genuinely need concentration are flagged', () => {
  const concentrating = SPELLS.filter((spell) => spell.isConcentration).map((spell) => spell.id)
  assert.deepEqual(concentrating.sort(), ['bless', 'divineFavor', 'guidance', 'shieldOfFaith'])
})

test('an aimed cantrip carries a real attack, a utility one does not', () => {
  const fireBolt = SPELLS_BY_ID.fireBolt
  assert.equal(fireBolt?.attack?.damage, '1d10')
  assert.equal(fireBolt?.attack?.damageType, 'fire')
  // Cantrips never add the ability modifier to damage at 1st level.
  assert.equal(fireBolt?.attack?.addAbilityToDamage, false)
  assert.equal(SPELLS_BY_ID.mageHand?.attack, undefined)
})

test('auto-hit and save-based spells carry no attack roll', () => {
  assert.equal(SPELLS_BY_ID.magicMissile?.attack, undefined)
  assert.equal(SPELLS_BY_ID.burningHands?.attack, undefined)
})

test('a spell range always states the square count when it has one', () => {
  for (const spell of SPELLS) {
    if (spell.range.includes('ft') && !spell.range.startsWith('Self')) {
      assert.match(spell.range, /\(\d+ squares\)/, `${spell.id} is missing its square count`)
    }
  }
})

test('resolving ids returns spells and silently drops unknown ones', () => {
  assert.deepEqual(
    spellsByIds(['fireBolt', 'nonsense', 'light']).map((spell) => spell.id),
    ['fireBolt', 'light'],
  )
})

// --- Magic style presets --------------------------------------------------

test('each class offers at least two magic styles', () => {
  assert.ok(magicStylesFor('wizard').length >= 2)
  assert.ok(magicStylesFor('cleric').length >= 2)
})

test('a magic style only ever names spells its own class can cast', () => {
  for (const preset of MAGIC_STYLE_PRESETS) {
    for (const id of [...preset.cantripIds, ...preset.preparedSpellIds]) {
      const spell = SPELLS_BY_ID[id]
      assert.ok(spell !== undefined, `${preset.id} names unknown spell ${id}`)
      assert.ok(
        spell.classes.includes(preset.classId),
        `${preset.id} names ${id}, which is not a ${preset.classId} spell`,
      )
    }
  }
})

test('a magic style separates cantrips from prepared spells correctly', () => {
  for (const preset of MAGIC_STYLE_PRESETS) {
    for (const id of preset.cantripIds) assert.equal(SPELLS_BY_ID[id]?.level, 0)
    for (const id of preset.preparedSpellIds) assert.equal(SPELLS_BY_ID[id]?.level, 1)
  }
})

test('a magic style never lists the same spell twice', () => {
  for (const preset of MAGIC_STYLE_PRESETS) {
    assert.equal(new Set(preset.cantripIds).size, preset.cantripIds.length)
    assert.equal(new Set(preset.preparedSpellIds).size, preset.preparedSpellIds.length)
  }
})

/*
 * Replaced by tests/spellPresets.test.ts, which walks real built characters.
 *
 * The version here passed a hard-coded +2 for both modifiers — the class array
 * before any racial bonus, which is a character nobody can create. It went
 * green for months while every cleric in the app was one spell short of the cap
 * and could not leave the magic step. An invariant checked against a
 * hypothetical is not checked.
 */

test('a style can be found by id and is unknown otherwise', () => {
  assert.equal(magicStyleById('pyromancer')?.classId, 'wizard')
  assert.equal(magicStyleById('healersMercy')?.classId, 'cleric')
  assert.equal(magicStyleById('nonsense'), undefined)
})
