import test from 'node:test'
import assert from 'node:assert/strict'
import { MAGIC_STYLE_PRESETS } from '../src/content/spellPresets.ts'
import { BACKGROUND_PRESETS, RACE_PRESETS } from '../src/lib/dnd/presets.ts'
import { getSpellcastingLimits } from '../src/lib/dnd/spellcasting.ts'
import { buildCharacter, resolveSpellSelection } from '../src/lib/dnd/characterBuilder.ts'
import { abilityModifier } from '../src/lib/dnd/stats.ts'
import { spellsFor } from '../src/content/spells.ts'
import type { CreationAnswers } from '../src/types/character.ts'

/**
 * Creation will not advance off the magic step until the chosen style fills
 * both caps exactly. A style that resolves to the wrong number is therefore not
 * a cosmetic shortfall but a dead end, and it shipped as one: every cleric
 * offered three 1st-level spells against a cap of four, with no way forward but
 * the customise panel.
 *
 * Every race, because the cap moves with the racial bonus — a cleric prepares
 * four or three depending on whether the race pushes Wisdom to 16. That is the
 * whole reason presets are written long and trimmed, and testing a single race
 * would have missed it in exactly the way the old test did.
 */
function everyBuild(): { answers: CreationAnswers; where: string }[] {
  const builds: { answers: CreationAnswers; where: string }[] = []
  for (const race of Object.values(RACE_PRESETS)) {
    for (const background of Object.values(BACKGROUND_PRESETS)) {
      const flaw = background.flaws[0]
      if (flaw === undefined) continue
      for (const style of MAGIC_STYLE_PRESETS) {
        builds.push({
          answers: {
            classId: style.classId,
            raceId: race.id,
            backgroundId: background.id,
            flawId: flaw.id,
            equipmentChoice: 'defensive',
            auraId: 'amber',
            magicStyleId: style.id,
          } as CreationAnswers,
          where: `${race.id}/${background.id}/${style.id}`,
        })
      }
    }
  }
  return builds
}

function capsFor(answers: CreationAnswers) {
  const hero = buildCharacter(answers, 'Probe', { id: 'probe', now: 0 })
  return getSpellcastingLimits(
    hero.classId,
    abilityModifier(hero.scores.wis),
    abilityModifier(hero.scores.int),
  )
}

test('every style resolves to exactly the spells its character can hold', () => {
  for (const { answers, where } of everyBuild()) {
    const limits = capsFor(answers)
    const selection = resolveSpellSelection(answers)

    assert.equal(
      selection.cantripIds.length,
      limits.cantripsCount,
      `${where}: cantrips ${selection.cantripIds.length} of ${limits.cantripsCount}`,
    )
    assert.equal(
      selection.preparedSpellIds.length,
      limits.preparedSpellsCount,
      `${where}: prepared ${selection.preparedSpellIds.length} of ${limits.preparedSpellsCount}`,
    )
  }
})

test('a preset is written long enough to fill the largest cap it will meet', () => {
  // Trimming can only ever remove. Anything short here is short forever.
  for (const { answers, where } of everyBuild()) {
    const limits = capsFor(answers)
    const style = MAGIC_STYLE_PRESETS.find((one) => one.id === answers.magicStyleId)
    assert.ok(style !== undefined)
    assert.ok(
      style.cantripIds.length >= limits.cantripsCount,
      `${where}: ${style.cantripIds.length} cantrips written for a cap of ${limits.cantripsCount}`,
    )
    assert.ok(
      style.preparedSpellIds.length >= limits.preparedSpellsCount,
      `${where}: ${style.preparedSpellIds.length} spells written for a cap of `
        + `${limits.preparedSpellsCount}`,
    )
  }
})

test('trimming keeps the spells that make it that style', () => {
  /*
   * Order is load-bearing, not decorative. Shield of the Faithful cut down to
   * three has to keep Shield of Faith, or a player picked a style by reading its
   * description and got somebody else's character.
   */
  const signatures: Record<string, string> = {
    radiantWrath: 'guidingBolt',
    healersMercy: 'cureWounds',
    faithfulWard: 'shieldOfFaith',
  }
  for (const [styleId, spellId] of Object.entries(signatures)) {
    const style = MAGIC_STYLE_PRESETS.find((one) => one.id === styleId)
    assert.equal(style?.preparedSpellIds[0], spellId, `${styleId} must lead with ${spellId}`)
  }
})

test('a legal hand-picked list is left exactly as it is', () => {
  // Clamping only ever cuts what is over the cap. Anything at or under it is the
  // player's business and is handed back untouched, in their order.
  const chosen = ['shieldOfFaith', 'guidingBolt', 'bless']
  const selection = resolveSpellSelection({
    classId: 'cleric',
    raceId: 'elf',
    magicStyleId: 'healersMercy',
    preparedSpellIds: chosen,
  })
  assert.deepEqual([...selection.preparedSpellIds], chosen)
})

test('an explicit list over the cap is clamped, wherever it came from', () => {
  /*
   * The bug this replaces a wrong assumption with. The old rule was "an explicit
   * list is never trimmed, because only a player produces one" — but choosing a
   * style copies the preset straight into the draft, so from here it is
   * indistinguishable from a hand-picked list. Every non-human cleric was shown
   * "1st Level 4/3", reported from the interface session.
   */
  const selection = resolveSpellSelection({
    classId: 'cleric',
    raceId: 'dwarf',
    magicStyleId: 'radiantWrath',
    preparedSpellIds: ['guidingBolt', 'cureWounds', 'bless', 'shieldOfFaith'],
  })
  assert.equal(selection.preparedSpellIds.length, 3, 'a dwarf cleric prepares three')
  assert.equal(selection.preparedSpellIds[0], 'guidingBolt', 'and keeps the signature one')
})

test('the draft the creation wizard actually builds is legal for every ancestry', () => {
  /*
   * Picking a style writes the preset's lists into the draft, so this walks the
   * shape the UI really produces rather than the derived one. The previous test
   * only exercised the path where the lists are absent — which is why it stayed
   * green while the screen showed an illegal list.
   */
  for (const { answers, where } of everyBuild()) {
    const style = MAGIC_STYLE_PRESETS.find((one) => one.id === answers.magicStyleId)
    assert.ok(style !== undefined)
    const asTheWizardWritesIt = {
      ...answers,
      cantripIds: [...style.cantripIds],
      preparedSpellIds: [...style.preparedSpellIds],
    }
    const limits = capsFor(answers)
    const selection = resolveSpellSelection(asTheWizardWritesIt)

    assert.equal(
      selection.preparedSpellIds.length,
      limits.preparedSpellsCount,
      `${where}: prepared ${selection.preparedSpellIds.length} of ${limits.preparedSpellsCount}`,
    )
    assert.equal(
      selection.cantripIds.length,
      limits.cantripsCount,
      `${where}: cantrips ${selection.cantripIds.length} of ${limits.cantripsCount}`,
    )
  }
})

test('a draft too early to know its caps is left alone', () => {
  // No race yet means no modifier, so nothing to trim against. The style's full
  // list stands until there is a real answer to measure it by.
  const selection = resolveSpellSelection({ classId: 'cleric', magicStyleId: 'healersMercy' })
  assert.equal(selection.preparedSpellIds.length, 4)
})

test('a preset never lists the same spell twice', () => {
  for (const style of MAGIC_STYLE_PRESETS) {
    const all = [...style.cantripIds, ...style.preparedSpellIds]
    assert.equal(new Set(all).size, all.length, `${style.id} repeats a spell`)
  }
})

test('every spell a preset names is real, and on that class list', () => {
  for (const style of MAGIC_STYLE_PRESETS) {
    for (const [level, ids] of [[0, style.cantripIds], [1, style.preparedSpellIds]] as const) {
      const legal = new Set(spellsFor(style.classId, level).map((spell) => spell.id))
      for (const id of ids) {
        assert.ok(legal.has(id), `${style.id} names ${id}, which is not a ${style.classId} spell`)
      }
    }
  }
})
