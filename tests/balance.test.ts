import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { levelUp } from '../src/lib/dnd/leveling.ts'
import { rosterFor } from '../src/stores/tutorialStore.ts'
import { levelAtEncounter, winRate } from './helpers/autoplay.ts'
import { MONSTERS } from '../src/lib/dnd/data/monsters.ts'
import { LOYAL_SQUIRE } from '../src/lib/dnd/data/companions.ts'
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
      subclassId: 'battlemaster',
    } as CreationAnswers,
    'Sim',
    { id: 'sim', now: 0 },
  )
  /*
   * Asserted rather than trusted. `buildCharacter` drops a subclass id it does
   * not recognise and says nothing, so this fixture spent its first version
   * measuring a Battle Master that was never one — the id was `battleMaster`
   * and every real id here is lower case.
   */
  assert.equal(character.subclassId, 'battlemaster', 'the fixture lost its subclass')
  while (character.level < level) {
    const result = levelUp(character)
    assert.equal(result.refusal, null, 'the fixture could not be levelled')
    character = result.character
  }
  return character
}

const RUNS = 600

/*
 * Read out of the tutorial, not chosen. Every figure below was once measured at
 * level 2 for all three fights, which is true of none of them: `deeper` is
 * reached with no level-up since the goblin, and `rafters` carries two in its
 * own `onEnter`. The second encounter was being scored a level too strong and
 * the third a level too weak, and every floor set from those numbers was
 * guarding a party the game never produces.
 */
const LEVELS = levelAtEncounter()

test('the spider alone is a fight the party usually wins', () => {
  const hero = fighterAtLevel(LEVELS.rafters ?? 3)
  const rate = winRate(() => rosterFor('rafters', hero), RUNS)

  assert.equal(rate.undecided, 0, 'a fight nobody can finish means the harness is lying')
  /*
   * 82% for a fighter, at the 3rd level it is actually met at. The 67% this
   * said before was the same fight measured at 2nd, which is a level nobody
   * fights it at — the two level-ups sit in the encounter's own `onEnter`.
   * Auto-play still never casts, drinks or surges, so a real player sits above
   * even this.
   */
  assert.ok(
    rate.party > 0.72 && rate.party < 0.92,
    `the spider is meant to be a close fight the party takes; got ${(rate.party * 100).toFixed(1)}%`,
  )
})

test('the bat and skeleton are the gentler fight that comes first', () => {
  const hero = fighterAtLevel(LEVELS.deeper ?? 1)
  const rate = winRate(() => rosterFor('deeper', hero), RUNS)

  assert.equal(rate.undecided, 0)
  // Documented at 96%. This one is meant to feel survivable — it is the fight
  // that teaches two enemies at once, not the one that tests the lesson.
  assert.ok(
    rate.party > 0.85,
    `the second encounter should not be a coin flip; got ${(rate.party * 100).toFixed(1)}%`,
  )
})

test('the last fight is the harder one for a fighter, as played', () => {
  /*
   * This used to build one hero at level 2 and send it into both encounters. As
   * a comparison of the two *encounters* that was fair; as a statement about the
   * game it was meaningless, because nobody meets them at the same level. The
   * spider is fought at 3rd — two level-ups sit in its own `onEnter` — and the
   * bat and skeleton at 1st.
   *
   * At the levels actually played it still holds for a fighter, whose kit does
   * not change much with a level: 79% against the spider, 91% against the pair.
   */
  const rafters = winRate(
    () => rosterFor('rafters', fighterAtLevel(LEVELS.rafters ?? 3)),
    RUNS,
  )
  const deeper = winRate(() => rosterFor('deeper', fighterAtLevel(LEVELS.deeper ?? 1)), RUNS)

  assert.ok(
    rafters.party < deeper.party,
    `rafters ${(rafters.party * 100).toFixed(1)}% should be below deeper ${(deeper.party * 100).toFixed(1)}%`,
  )
})

test('for a caster the curve runs backwards, which is a real problem', () => {
  /*
   * Recorded because it is true, not because it is wanted.
   *
   * A wizard meets the bat and skeleton at 1st level with one spell slot, and
   * the spider at 3rd with two levels and a second tier of magic that arrived
   * ninety seconds earlier. So the fight the tutorial calls its hardest is the
   * one it wins most: 98% against the spider, 91% against the pair.
   *
   * The two level-ups are stacked immediately before the last encounter, which
   * is a pacing decision — it is where the game teaches levelling — and it means
   * the difficulty curve of the tutorial rises for the classes whose power comes
   * from equipment and falls for the classes whose power comes from level.
   *
   * Asserted so that fixing it is a deliberate act with a failing test attached,
   * rather than something that could be undone by accident. If this ever goes
   * red because the spider outgrew the level-ups, that is the good outcome and
   * the test should be rewritten to say so.
   */
  const spec = { classId: 'wizard', subclassId: 'evocation', magicStyleId: 'pyromancer' } as const
  const rafters = winRate(
    () => rosterFor('rafters', buildAtLevel(spec, LEVELS.rafters ?? 3)),
    RUNS,
    1,
    true,
  )
  const deeper = winRate(
    () => rosterFor('deeper', buildAtLevel(spec, LEVELS.deeper ?? 1)),
    RUNS,
    1,
    true,
  )

  assert.ok(
    rafters.party > deeper.party,
    `the inversion has gone: rafters ${(rafters.party * 100).toFixed(1)}%, `
      + `deeper ${(deeper.party * 100).toFixed(1)}% — rewrite this test`,
  )
})

test('the opening goblin is the easiest thing in the game', () => {
  // Level 1, because that is who meets it. It has AC 12 rather than the SRD's
  // 15 for exactly this reason, and that divergence is documented as deliberate.
  const rate = winRate(() => rosterFor('cellar', fighterAtLevel(LEVELS.cellar ?? 1)), RUNS)

  assert.equal(rate.undecided, 0)
  assert.ok(
    rate.party > 0.9,
    `the first fight anybody has should not be losable; got ${(rate.party * 100).toFixed(1)}%`,
  )
})

// --- Every class, not just the one the encounter was tuned on ---------------

/*
 * The numbers above describe a fighter, and for a long while that was the only
 * build anybody had measured. Running the other four turned up a simulation
 * defect rather than a design one: `takeAutomaticTurn` swung `attacks[0]`,
 * which is always the melee weapon, so an auto-played wizard walked into knife
 * range holding Fire Bolt and won 16.7% of the rafters. Choosing by reach and
 * damage instead put it at 54%.
 *
 * What survives is a real spread — a fighter takes the rafters about twice as
 * often as a life cleric — and these assertions exist to keep it from widening
 * into a fight some classes simply cannot be brought to.
 */

const BUILDS = [
  { classId: 'fighter', subclassId: 'champion' },
  { classId: 'rogue', subclassId: 'thief' },
  { classId: 'cleric', subclassId: 'life', magicStyleId: 'healersMercy' },
  { classId: 'cleric', subclassId: 'light', magicStyleId: 'radiantWrath' },
  { classId: 'wizard', subclassId: 'evocation', magicStyleId: 'pyromancer' },
  { classId: 'wizard', subclassId: 'abjuration', magicStyleId: 'guardianMage' },
  { classId: 'paladin', subclassId: 'devotion' },
] as const

function buildAtLevel(spec: (typeof BUILDS)[number], level: number): Character {
  let character = buildCharacter(
    {
      raceId: 'human',
      backgroundId: 'soldier',
      flawId: 'orders',
      equipmentChoice: 'defensive',
      auraId: 'amber',
      ...spec,
    } as CreationAnswers,
    'Sim',
    { id: 'sim', now: 0 },
  )
  assert.equal(character.subclassId, spec.subclassId, `${spec.classId} lost its subclass`)
  while (character.level < level) {
    character = levelUp(character).character
  }
  return character
}

test('no class is locked out of the tutorial it has to finish', () => {
  for (const spec of BUILDS) {
    const name = `${spec.classId}/${spec.subclassId}`
    const cellar = winRate(() => rosterFor('cellar', buildAtLevel(spec, LEVELS.cellar ?? 1)), RUNS)
    const forDeeper = buildAtLevel(spec, LEVELS.deeper ?? 1)
    const forRafters = buildAtLevel(spec, LEVELS.rafters ?? 3)
    const deeper = winRate(() => rosterFor('deeper', forDeeper), RUNS)
    const rafters = winRate(() => rosterFor('rafters', forRafters), RUNS)

    assert.equal(cellar.undecided + deeper.undecided + rafters.undecided, 0, `${name} stalled`)
    assert.ok(cellar.party > 0.95, `${name} cellar ${(cellar.party * 100).toFixed(1)}%`)
    /*
     * 0.65, lowered from 0.7 when `stepsToward` landed on main and it caught
     * that immediately — the first thing this harness did on somebody else's
     * change. An actor that cannot take the straight step now routes around
     * instead of stalling, which matters in `deeper` and not in `rafters`
     * because four bodies on a five-by-five board block each other and three do
     * not. Enemies that reliably arrive cost the casters most, and both clerics
     * and the wizard fell about fifteen points to ~69%.
     *
     * Lowered rather than argued with. The movement fix is right, the ordering
     * below still holds for every build, and a floor set on numbers measured
     * before a bug was fixed is not evidence of anything.
     *
     * 0.55 rather than 0.65 because the worst build is the guardian mage at
     * 64%, and a floor set one point under whatever was last measured is a
     * tripwire for noise rather than for design. All seven, post-merge:
     *
     *   fighter/champion   96.2   rogue/thief        87.7
     *   paladin/devotion   94.3   wizard/evocation   70.0
     *   cleric/life        69.2   cleric/light       69.2
     *   wizard/abjuration  63.8
     */
    assert.ok(deeper.party > 0.55, `${name} deeper ${(deeper.party * 100).toFixed(1)}%`)
    /*
     * A third is the floor, and it is deliberately generous. Auto-play never
     * heals, so a life cleric — whose whole kit is healing — is the build this
     * measurement flatters least, and it sits closest to the line at ~35%.
     */
    assert.ok(rafters.party > 0.3, `${name} rafters ${(rafters.party * 100).toFixed(1)}%`)
  }
})

test('nothing the machine steers carries a second attack', () => {
  /*
   * A tripwire, not a rule about the game.
   *
   * `takeAutomaticTurn` now picks between attacks instead of taking the first,
   * and that is a provable no-op for everything the machine actually drives —
   * because every monster and the squire carry exactly one. Give a monster a
   * bow as well as a bite and the choice starts deciding real fights, and the
   * numbers above would shift with nothing pointing at why.
   */
  for (const monster of Object.values(MONSTERS)) {
    assert.ok(
      monster.attacks.length <= 1,
      `${monster.id} has ${monster.attacks.length} attacks — re-check the balance figures`,
    )
  }
  assert.ok(LOYAL_SQUIRE.attacks.length <= 1)
})

// --- The same fights, with the spells actually cast -------------------------

test('the no-cast floor understates whoever has offensive spells', () => {
  /*
   * Guards the policy, not the game.
   *
   * `winRate(..., casts)` plays a meagre caster — heal yourself under half,
   * otherwise throw the biggest damaging spell that resolves, otherwise swing.
   * If it ever silently stopped casting, every figure it produces would quietly
   * become the default floor again and nothing would look wrong. So: a wizard
   * has to do materially better with its spells than without them.
   */
  const wizard = buildAtLevel(
    { classId: 'wizard', subclassId: 'evocation', magicStyleId: 'pyromancer' },
    LEVELS.rafters ?? 3,
  )
  const mute = winRate(() => rosterFor('rafters', wizard), RUNS)
  const casting = winRate(() => rosterFor('rafters', wizard), RUNS, 1, true)

  assert.ok(
    casting.party > mute.party + 0.2,
    `casting should transform a wizard; ${(mute.party * 100).toFixed(1)}% -> ${(casting.party * 100).toFixed(1)}%`,
  )
})

test('a fighter plays the same either way, because it has nothing to cast', () => {
  // The control. Any drift here means the casting branch is reaching combatants
  // it has no business touching.
  const fighter = fighterAtLevel(LEVELS.rafters ?? 3)
  const mute = winRate(() => rosterFor('rafters', fighter), RUNS)
  const casting = winRate(() => rosterFor('rafters', fighter), RUNS, 1, true)
  assert.equal(casting.party, mute.party)
})

test('the healer can now spend a turn on something other than mercy', () => {
  /*
   * The finding, pinned so it cannot quietly change without somebody noticing.
   *
   * Every other caster leaps when it starts casting — the wizard goes from 54%
   * to 92%, the light cleric from 52% to 83%. The life cleric goes *down*, 35%
   * to 32%, because the only thing its style gives it to spend an action on is
   * healing, and against a single enemy hitting as hard as the spider, healing
   * loses the race. Trading a turn for hit points you are about to lose again
   * is worse than trading it for damage, which is a real lesson about 5e and
   * not an artifact of playing badly — both policies agree, and they disagree
   * about everything else.
   *
   * Resolved by giving Mercy & Mending a Guiding Bolt, third in its list so the
   * trim cannot take it. 32% became 65% — beside the fighter's 69%, and still
   * well under Radiance & Wrath's 83%, which is the style that is supposed to
   * out-damage it. The band below is the shape that was bought: no longer the
   * outlier, not turned into a second wrath cleric.
   */
  const life = buildAtLevel(
    { classId: 'cleric', subclassId: 'life', magicStyleId: 'healersMercy' },
    LEVELS.rafters ?? 3,
  )
  const casting = winRate(() => rosterFor('rafters', life), RUNS, 1, true)
  assert.ok(
    casting.party > 0.5 && casting.party < 0.78,
    `life cleric rafters, casting: ${(casting.party * 100).toFixed(1)}%`,
  )
})
