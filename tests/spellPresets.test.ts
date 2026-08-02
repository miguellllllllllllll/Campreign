import test from 'node:test'
import assert from 'node:assert/strict'
import { MAGIC_STYLE_PRESETS } from '../src/content/spellPresets.ts'
import { BACKGROUND_PRESETS, RACE_PRESETS } from '../src/lib/dnd/presets.ts'
import { getSpellcastingLimits } from '../src/lib/dnd/spellcasting.ts'
import { buildCharacter, resolveSpellSelection } from '../src/lib/dnd/characterBuilder.ts'
import { castableSpells } from '../src/lib/dnd/casting.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { abilityModifier } from '../src/lib/dnd/stats.ts'
import { spellsByIds, spellsFor } from '../src/content/spells.ts'
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
    // Healing Word, not Cure Wounds. Once both exist the bonus-action one is
    // what "Mercy & Mending" actually means — you pick somebody up and still act.
    healersMercy: 'healingWord',
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
  //
  // Measured against the style rather than a literal. This said `4`, which was
  // that style's length at the time and had nothing to do with what the test is
  // about — adding a fifth spell to Mercy & Mending broke it, and the thing it
  // exists to check had not changed at all.
  const style = MAGIC_STYLE_PRESETS.find((one) => one.id === 'healersMercy')
  assert.ok(style !== undefined)
  const selection = resolveSpellSelection({ classId: 'cleric', magicStyleId: 'healersMercy' })
  assert.equal(selection.preparedSpellIds.length, style.preparedSpellIds.length)
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

test('every caster style carries something it can attack at range with', () => {
  /*
   * Measured rather than felt. Mercy & Mending held no attack cantrip, so its
   * only reach was a mace — 3000 simulated runs of the second encounter put it
   * at a 53% chance of ending unconscious, against 22% for the other cleric
   * styles and 3% for a paladin. Reach is the variable that matters on a
   * five-square board.
   */
  for (const style of MAGIC_STYLE_PRESETS) {
    const cantrips = spellsByIds(style.cantripIds)
    const reach = Math.max(0, ...cantrips.map((spell) => spell.attack?.rangeSquares ?? 0))
    assert.ok(reach > 1, `${style.id} has no cantrip it can attack at range with`)
  }
})

test('no two styles of a class are the same character', () => {
  /*
   * The trap the reach fix walked into. Handing Mercy & Mending the obvious
   * third working cantrip made it identical to Shield of the Faithful — same
   * cantrips, and the same prepared spells for every ancestry. Two of three
   * choices would have collapsed into one, which is a worse bug than the one
   * being fixed.
   *
   * Note what this does *not* catch, because it took another session to point
   * out: the check is `!(sameCantrips && samePrepared)`, so two styles that
   * share a prepared list but differ by one cantrip pass. That is exactly the
   * shape the wizard styles were in — three styles, one shared prepared
   * constant, different cantrips — and this test stayed green through all of
   * it. "The same character" and "a choice that changes nothing" are different
   * claims; the test below makes the second one.
   */
  const key = (ids: readonly string[]) => [...ids].sort().join(',')
  for (const classId of ['cleric', 'wizard'] as const) {
    const styles = MAGIC_STYLE_PRESETS.filter((one) => one.classId === classId)
    for (let i = 0; i < styles.length; i += 1) {
      for (let j = i + 1; j < styles.length; j += 1) {
        const a = styles[i]!
        const b = styles[j]!
        const sameCantrips = key(a.cantripIds) === key(b.cantripIds)
        const samePrepared = key(a.preparedSpellIds) === key(b.preparedSpellIds)
        assert.ok(
          !(sameCantrips && samePrepared),
          `${a.id} and ${b.id} are the same character`,
        )
      }
    }
  }
})

test('every spell a wizard style prepares reaches the action bar', () => {
  /*
   * The reachability check, walked rather than asserted. `castableSpells` is
   * what ActionBar renders, so going preset -> character -> combatant -> this
   * list is the same path a player takes; a spell that resolves correctly but
   * never appears as a button is the failure mode this repository keeps
   * rediscovering.
   *
   * Ray of Sickness is the reason it exists. It was added so the wizard's
   * prepared cap of four had five spells to choose from — before it, every
   * wizard prepared the whole list and the style question changed only
   * cantrips.
   */
  for (const style of MAGIC_STYLE_PRESETS.filter((one) => one.classId === 'wizard')) {
    const hero = buildCharacter(
      {
        classId: 'wizard',
        raceId: 'human',
        backgroundId: 'noble',
        flawId: 'obeyed',
        equipmentChoice: 'offensive',
        auraId: 'amber',
        magicStyleId: style.id,
      },
      'Mage',
      { id: 'reach-' + style.id, now: 1_700_000_000_000 },
    )
    const listed = castableSpells(characterToCombatant(hero, { position: { x: 0, y: 0 } }))
    for (const id of hero.preparedSpells ?? []) {
      const entry = listed.find((one) => one.spell.id === id)
      assert.ok(entry !== undefined, `${style.id} prepares ${id}, which never reaches the bar`)
      // Shield is castable only as a reaction, and says so rather than vanishing.
      if (id !== 'shield') {
        assert.ok(entry.castable, `${style.id}: ${id} is on the bar but refused — ${entry.reason}`)
      }
    }
  }
})

test('the wizard styles differ in what they prepare, not only in cantrips', () => {
  /*
   * Sharper than "no two styles are the same character", which only fires when
   * cantrips AND prepared lists both match — so it passed for the whole period
   * when all three wizard styles prepared one shared constant and differed by
   * cantrip alone. That is a cosmetic choice wearing a real one's clothes.
   */
  const wizards = MAGIC_STYLE_PRESETS.filter((one) => one.classId === 'wizard')
  const prepared = new Set(wizards.map((one) => [...one.preparedSpellIds].sort().join(',')))
  assert.equal(
    prepared.size,
    wizards.length,
    'two wizard styles prepare the same spells, so picking between them is decoration',
  )
})

// --- What the trim is allowed to take away ----------------------------------

const OFFENSIVE = new Set(['guidingBolt', 'inflictWounds', 'magicMissile', 'burningHands', 'rayOfSickness', 'shatter'])

test('trimming a style to the cap never removes its last offensive spell', () => {
  /*
   * The general form of two bugs, rather than a third restatement of them.
   *
   * Styles are written long and cut to 1 + Wisdom modifier, so the tail is
   * whatever the caster is not clever enough to keep. `faithfulWard` listed its
   * only offensive spell fourth, and a dwarf, elf, halfling or tiefling cleric
   * caps at three — so four races out of five were handed a style with nothing
   * to attack with, and the fifth was fine, which is exactly how it went
   * unnoticed. `healersMercy` had the same shape for a different reason: it
   * listed no offensive spell at all.
   *
   * Asserted over every style and every race, because the failure only appears
   * at some combinations and testing the one in front of you is what let this
   * survive.
   */
  for (const style of MAGIC_STYLE_PRESETS) {
    const listed = style.preparedSpellIds.filter((id) => OFFENSIVE.has(id))
    if (listed.length === 0) continue

    for (const raceId of Object.keys(RACE_PRESETS)) {
      const hero = buildCharacter(
        {
          classId: style.classId,
          raceId,
          backgroundId: 'noble',
          flawId: 'obeyed',
          equipmentChoice: 'defensive',
          auraId: 'amber',
          magicStyleId: style.id,
        } as CreationAnswers,
        'S',
        { id: 's', now: 0 },
      )
      const kept = (hero.preparedSpells ?? []).filter((id) => OFFENSIVE.has(id))
      assert.ok(
        kept.length > 0,
        `${style.id} + ${raceId} (wis ${hero.scores.wis}) trimmed away every offensive spell: `
          + `${(hero.preparedSpells ?? []).join(', ')}`,
      )
    }
  }
})

test('every cleric style can spend an action on something other than mercy', () => {
  /*
   * Mercy & Mending had four spells and all of them were kind. Simulated against
   * the last encounter it was the weakest build in the game and the only one
   * that got *worse* when it began casting — 35% down to 32% — because a turn
   * traded for hit points you are about to lose again loses to a turn traded for
   * damage. Guiding Bolt took it to 65%, beside the fighter's 69% and still well
   * under Radiance & Wrath's 83%, which is the style that is supposed to do this
   * better.
   */
  for (const style of MAGIC_STYLE_PRESETS.filter((one) => one.classId === 'cleric')) {
    assert.ok(
      style.preparedSpellIds.some((id) => OFFENSIVE.has(id)),
      `${style.id} has no way to hurt anything with a spell slot`,
    )
  }
})
