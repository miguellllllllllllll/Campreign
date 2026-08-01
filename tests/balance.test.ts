import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { levelUp } from '../src/lib/dnd/leveling.ts'
import { rosterFor } from '../src/stores/tutorialStore.ts'
import { winRate } from './helpers/autoplay.ts'
import type { Character, CreationAnswers } from '../src/types/character.ts'

/*
 * The encounter numbers, made re-runnable.
 *
 * `rosterFor` is imported from the store rather than rebuilt here on purpose.
 * A copy of the roster would measure the fight I remembered writing instead of
 * the one that ships, and would stay green through exactly the change these
 * assertions exist to catch — somebody adding a second monster to the rafters.
 *
 * The bands are wide because the point is not to pin a number. 600 runs of a
 * coin-flip fight carry a couple of points of noise on their own, and a swing
 * inside the band changes no design decision. A swing outside it means the
 * sentence written next to the encounter is no longer true.
 */

function fighterAtLevel(level: number): Character {
  let character = buildCharacter(
    {
      classId: 'fighter',
      raceId: 'human',
      backgroundId: 'soldier',
      flawId: 'orders',
      equipmentChoice: 'defensive',
      auraId: 'amber',
      subclassId: 'battleMaster',
    } as CreationAnswers,
    'Sim',
    { id: 'sim', now: 0 },
  )
  while (character.level < level) {
    const result = levelUp(character)
    assert.equal(result.refusal, null, 'the fixture could not be levelled')
    character = result.character
  }
  return character
}

const RUNS = 600

test('the spider alone is a fight the party usually wins', () => {
  const hero = fighterAtLevel(2)
  const rate = winRate(() => rosterFor('rafters', hero), RUNS)

  assert.equal(rate.undecided, 0, 'a fight nobody can finish means the harness is lying')
  // Documented at 59%. Auto-play never casts, drinks or surges, so the real
  // player sits above this.
  assert.ok(
    rate.party > 0.5 && rate.party < 0.7,
    `the spider is meant to be a close fight the party takes; got ${(rate.party * 100).toFixed(1)}%`,
  )
})

test('the bat and skeleton are the gentler fight that comes first', () => {
  const hero = fighterAtLevel(2)
  const rate = winRate(() => rosterFor('deeper', hero), RUNS)

  assert.equal(rate.undecided, 0)
  // Documented at 96%. This one is meant to feel survivable — it is the fight
  // that teaches two enemies at once, not the one that tests the lesson.
  assert.ok(
    rate.party > 0.85,
    `the second encounter should not be a coin flip; got ${(rate.party * 100).toFixed(1)}%`,
  )
})

test('the rafters are harder than the fight before them', () => {
  /*
   * The ordering is the real claim, and it survives both numbers drifting. If a
   * change ever made the spider the easier of the two, the tutorial would be
   * teaching a difficulty curve that runs backwards, and both assertions above
   * could still pass while it did.
   */
  const hero = fighterAtLevel(2)
  const rafters = winRate(() => rosterFor('rafters', hero), RUNS)
  const deeper = winRate(() => rosterFor('deeper', hero), RUNS)

  assert.ok(
    rafters.party < deeper.party,
    `rafters ${(rafters.party * 100).toFixed(1)}% should be below deeper ${(deeper.party * 100).toFixed(1)}%`,
  )
})

test('the opening goblin is the easiest thing in the game', () => {
  // Level 1, because that is who meets it. It has AC 12 rather than the SRD's
  // 15 for exactly this reason, and that divergence is documented as deliberate.
  const rate = winRate(() => rosterFor('cellar', fighterAtLevel(1)), RUNS)

  assert.equal(rate.undecided, 0)
  assert.ok(
    rate.party > 0.9,
    `the first fight anybody has should not be losable; got ${(rate.party * 100).toFixed(1)}%`,
  )
})
