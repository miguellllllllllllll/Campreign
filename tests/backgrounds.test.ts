import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKGROUND_PRESETS,
  MAX_WRITTEN_FLAW,
  UNIVERSAL_FLAWS,
  flawsFor,
  personalityOf,
} from '../src/lib/dnd/presets.ts'
import { flawChoices, stepAnswered, stepsFor } from '../src/content/creationQuestions.ts'
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

// --- A weakness you wrote yourself ----------------------------------------

test('a written weakness wins over a picked one', () => {
  const base = {
    classId: 'fighter',
    raceId: 'human',
    backgroundId: 'noble',
    flawId: 'entitled',
    equipmentChoice: 'defensive',
    auraId: 'amber',
  } as CreationAnswers

  const picked = buildCharacter(base, 'A', { id: 'a', now: 0 })
  const written = buildCharacter(
    { ...base, flawText: 'I cannot walk past an argument without joining it.' },
    'A',
    { id: 'a', now: 0 },
  )
  assert.equal(picked.personality.flaw, 'I expect to be obeyed, and I am rude when I am not.')
  assert.equal(written.personality.flaw, 'I cannot walk past an argument without joining it.')
  assert.equal(written.personality.ideal, picked.personality.ideal, 'the background still speaks')
  assert.equal(written.personality.bond, picked.personality.bond)
})

test('clearing the box is how you take it back', () => {
  /*
   * The reason empty means "fall through" rather than "empty flaw". If blank
   * text won, a player who typed something and thought better of it would be
   * left with a character whose weakness is nothing at all, and no way back to
   * the list without knowing to retype.
   */
  const background = BACKGROUND_PRESETS.noble
  for (const blank of ['', '   ', '\n\t ']) {
    const personality = personalityOf(background, 'entitled', blank)
    assert.equal(personality.flaw, 'I expect to be obeyed, and I am rude when I am not.')
  }
})

test('surrounding whitespace is trimmed rather than printed', () => {
  const personality = personalityOf(BACKGROUND_PRESETS.noble, 'entitled', '  I bite my nails.  ')
  assert.equal(personality.flaw, 'I bite my nails.')
})

test('an essay is cut to something a sheet can hold', () => {
  // The engine enforces the ceiling itself rather than trusting the field: the
  // field is content and editable, and a saved draft can predate a change to it.
  const essay = 'I '.repeat(300)
  const personality = personalityOf(BACKGROUND_PRESETS.noble, 'entitled', essay)
  assert.equal(personality.flaw.length, MAX_WRITTEN_FLAW)
})

test('a written weakness works from any background', () => {
  for (const background of BACKGROUNDS) {
    const personality = personalityOf(background, background.flaws[0]!.id, 'I am afraid of birds.')
    assert.equal(personality.flaw, 'I am afraid of birds.')
  }
})

test('the field is optional, so nobody has to face a blank box', () => {
  const step = stepsFor({ classId: 'fighter' }).find((one) =>
    one.fields.some((field) => field.id === 'flawText'),
  )
  assert.ok(step !== undefined, 'the written field is on a real step')

  const fields = step.fields.map((field) => field.id)
  assert.ok(
    fields.indexOf('flawText') > fields.indexOf('flawId'),
    'and it sits below the ones you can pick, so the fast path comes first',
  )

  const written = step.fields.find((field) => field.id === 'flawText')
  assert.equal(written?.optional, true)
  assert.equal(written?.kind, 'text')
  assert.equal(written?.maxLength, MAX_WRITTEN_FLAW, 'the field and the engine agree')
  assert.ok((written?.placeholder ?? '').length > 10, 'an example beats an empty box')
})

test('a step with only a written answer still counts as finished', () => {
  /*
   * `stepAnswered` treats a field with no choices as answered, which is what
   * makes an optional text field safe — but it is worth pinning, because a
   * change there would silently make the whole step unfinishable.
   */
  const step = stepsFor({ classId: 'fighter' }).find((one) =>
    one.fields.some((field) => field.id === 'flawText'),
  )
  assert.ok(step !== undefined)
  assert.equal(
    stepAnswered(step, { classId: 'fighter', backgroundId: 'noble', flawId: 'entitled' }),
    true,
  )
})

test('a written weakness satisfies the step on its own', () => {
  /*
   * Found by typing one in a browser and being unable to press Next.
   *
   * The helper says what you write is used *instead* of the flaw above, and the
   * step then demanded you pick one anyway — so the promise was false and the
   * player was stuck on a question they had already answered their own way.
   * `supersededBy` is the honest model: still required, but another answer can
   * cover it.
   */
  const step = stepsFor({ classId: 'fighter' }).find((one) =>
    one.fields.some((field) => field.id === 'flawText'),
  )
  assert.ok(step !== undefined)
  const base = { classId: 'fighter', backgroundId: 'noble' } as const

  assert.equal(stepAnswered(step, base), false, 'neither answered')
  assert.equal(stepAnswered(step, { ...base, flawId: 'entitled' }), true, 'picked')
  assert.equal(
    stepAnswered(step, { ...base, flawText: 'I flinch at kindness.' }),
    true,
    'written alone is enough',
  )
  assert.equal(
    stepAnswered(step, { ...base, flawText: '   ' }),
    false,
    'a whitespace box has answered nothing',
  )
})

test('a built character needs no picked flaw when one was written', () => {
  // The end-to-end claim, and the shape the wizard actually produces: no
  // `flawId` in the draft at all, only text.
  const hero = buildCharacter(
    {
      classId: 'fighter',
      raceId: 'human',
      backgroundId: 'outlander',
      flawText: 'I flinch at kindness and cover it with a joke.',
      equipmentChoice: 'defensive',
      auraId: 'amber',
    } as unknown as CreationAnswers,
    'Written',
    { id: 'written', now: 0 },
  )
  assert.equal(hero.personality.flaw, 'I flinch at kindness and cover it with a joke.')
  assert.ok(hero.personality.ideal.length > 0, 'the background still supplies the rest')
})
