import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKGROUND_PRESETS, UNIVERSAL_FLAWS, flawsFor, personalityOf } from '../src/lib/dnd/presets.ts'
import { flawChoices } from '../src/content/creationQuestions.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { SKILL_LABELS } from '../src/lib/dnd/stats.ts'
import type { BackgroundId, CreationAnswers } from '../src/types/character.ts'

const BACKGROUNDS = Object.values(BACKGROUND_PRESETS)

test('every background is finished, not a stub', () => {
  for (const background of BACKGROUNDS) {
    assert.equal(background.skills.length, 2, `${background.id} should train two skills`)
    for (const skill of background.skills) {
      assert.ok(skill in SKILL_LABELS, `${background.id} trains an unknown skill: ${skill}`)
    }
    assert.ok(background.tagline.length > 10, `${background.id} has no tagline`)
    assert.ok(background.description.length > 40, `${background.id} needs a real description`)
    assert.ok(background.ideal.length > 15, `${background.id} has no ideal`)
    assert.ok(background.bond.length > 15, `${background.id} has no bond`)
    assert.ok(background.blurb.length > 10, `${background.id} has no blurb`)
    assert.ok(background.trinket.name.length > 5, `${background.id} has no trinket`)
    assert.ok(background.flaws.length >= 3, `${background.id} needs its own weaknesses`)
  }
})

test('a weakness is written in the first person, because you are admitting to it', () => {
  for (const flaw of [...BACKGROUNDS.flatMap((one) => one.flaws), ...UNIVERSAL_FLAWS]) {
    /*
     * First person, not necessarily the word "I" first. This asserted `/^I /`
     * and failed on "Shoddy work offends me more than cruelty does" — which is
     * a confession in the first person and simply does not open with the
     * pronoun. The rule is the voice, so test the voice.
     */
    assert.match(flaw.text, /\b(I|me|my)\b/, `${flaw.id} is not written in the first person`)
    assert.match(flaw.text, /[.!]$/, `${flaw.id} is not a finished sentence`)
    assert.ok(flaw.text.length > 25, `${flaw.id} is too thin to be a character trait`)
  }
})

test('no two weaknesses share an id, or one would silently shadow the other', () => {
  /*
   * `personalityOf` resolves a flaw by finding the first match across both
   * pools, so a background flaw colliding with a universal one would quietly
   * win and the player would get text they did not pick.
   */
  for (const background of BACKGROUNDS) {
    const ids = flawsFor(background).map((flaw) => flaw.id)
    assert.equal(new Set(ids).size, ids.length, `${background.id} has a duplicate flaw id`)
  }
  const universalIds = UNIVERSAL_FLAWS.map((flaw) => flaw.id)
  assert.equal(new Set(universalIds).size, universalIds.length)
})

test('any weakness can be carried by any background', () => {
  // The point of the change. A flaw is pure personality — nothing mechanical
  // hangs off it — so there was never a reason to chain it to where you came
  // from, and doing so kept the whole cast to nine possible people.
  for (const background of BACKGROUNDS) {
    for (const flaw of UNIVERSAL_FLAWS) {
      const personality = personalityOf(background, flaw.id)
      assert.equal(personality.flaw, flaw.text, `${background.id} could not carry ${flaw.id}`)
      assert.equal(personality.ideal, background.ideal, 'the ideal still comes from the background')
    }
  }
})

test('a background keeps its own weaknesses at the top of the list', () => {
  // Order is the guidance: the obvious answer first, the rest for somebody
  // building a specific person.
  for (const background of BACKGROUNDS) {
    const offered = flawChoices(background.id as BackgroundId)
    assert.equal(offered.length, background.flaws.length + UNIVERSAL_FLAWS.length)
    for (const [index, own] of background.flaws.entries()) {
      assert.equal(offered[index]?.id, own.id, `${background.id} reordered its own flaws`)
      assert.equal(offered[index]?.tagline, '', 'its own need no explaining')
    }
    for (const choice of offered.slice(background.flaws.length)) {
      assert.match(choice.tagline, /Anyone can carry/, 'a shared one says so')
    }
  }
})

test('an unknown flaw id falls back rather than leaving the sheet blank', () => {
  const background = BACKGROUND_PRESETS.noble
  const personality = personalityOf(background, 'no-such-flaw')
  assert.ok(personality.flaw.length > 0, 'a stale save must not produce an empty character')
})

test('every background builds a complete character', () => {
  for (const background of BACKGROUNDS) {
    for (const flaw of flawsFor(background)) {
      const hero = buildCharacter(
        {
          classId: 'fighter',
          raceId: 'human',
          backgroundId: background.id,
          flawId: flaw.id,
          equipmentChoice: 'defensive',
          auraId: 'amber',
        } as CreationAnswers,
        'Probe',
        { id: `${background.id}-${flaw.id}`, now: 0 },
      )
      assert.equal(hero.personality.flaw, flaw.text)
      for (const skill of background.skills) {
        assert.ok(
          hero.skillProficiencies.includes(skill),
          `${background.id} did not train ${skill}`,
        )
      }
    }
  }
})

test('the cast is meaningfully bigger than it was', () => {
  // Three backgrounds with three flaws each was nine possible people.
  const combinations = BACKGROUNDS.reduce((sum, one) => sum + flawsFor(one).length, 0)
  assert.ok(combinations >= 60, `only ${combinations} combinations`)
  assert.ok(BACKGROUNDS.length >= 6, 'and more than three places to have come from')
})
