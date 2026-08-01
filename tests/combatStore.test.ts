import test from 'node:test'
import assert from 'node:assert/strict'
import { activeCombatant, encounterWinner } from '../src/lib/dnd/encounter.ts'
import { faceValue, seededRng, sequenceRng } from './helpers/rng.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { GOBLIN, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import { useCombatStore } from '../src/stores/combatStore.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { levelUp } from '../src/lib/dnd/leveling.ts'

const answers: CreationAnswers = {
  classId: 'fighter',
  raceId: 'dwarf',
  backgroundId: 'guildArtisan',
  flawId: 'haggler',
  equipmentChoice: 'defensive',
  auraId: 'amber',
}

function roster() {
  const hero = buildCharacter(answers, 'Test Hero', { id: 'hero-1', now: 1 })
  return [
    characterToCombatant(hero, { position: { x: 2, y: 4 }, speedSquares: 3 }),
    spawnMonster(GOBLIN, { id: 'goblin', position: { x: 2, y: 0 } }),
  ]
}

/*
 * The goblin's Dex beats a dwarf's often enough that this must never deadlock.
 * These pin the rng rather than rolling for real: with Math.random, a natural 20
 * on the goblin's opening swing kills a 13 hit-point fighter outright, which made
 * the old single assertion fail for about one run in ten.
 */

/** Hero rolls 1 for initiative, goblin rolls 20, then the goblin fumbles. */
const FOE_FIRST_THEN_MISSES = sequenceRng([
  faceValue(1, 20),
  faceValue(20, 20),
  faceValue(1, 20),
])

/** Same order of initiative, but the goblin crits and both damage dice max out. */
const FOE_FIRST_THEN_KILLS = sequenceRng([
  faceValue(1, 20),
  faceValue(20, 20),
  faceValue(20, 20),
  faceValue(6, 6),
  faceValue(6, 6),
])

test('the player opens the fight however the initiative fell', () => {
  /*
   * The scripted opening. This seed rolls the goblin a 20 and the hero a 1, and
   * the hero still acts first — a lesson that teaches "move, then attack" cannot
   * teach it on a board that has already been fought over.
   */
  useCombatStore.getState().reset()
  useCombatStore.getState().start(roster(), 'hero-1', FOE_FIRST_THEN_MISSES)
  const encounter = useCombatStore.getState().encounter
  assert.ok(encounter)

  assert.equal(encounter.order[0], 'hero-1', 'the player leads round one')
  assert.equal(activeCombatant(encounter)?.id, 'hero-1')
  assert.equal(encounterWinner(encounter), null)
  assert.equal(
    encounter.combatants['goblin']?.currentHp,
    encounter.combatants['goblin']?.maxHp,
    'nobody has traded blows before the player has moved',
  )
})

test('the goblin is still rolled into the order rather than skipped', () => {
  // Leading is a reordering, not an exemption: everybody still rolls and
  // everybody still gets a turn.
  useCombatStore.getState().reset()
  useCombatStore.getState().start(roster(), 'hero-1', FOE_FIRST_THEN_MISSES)
  const encounter = useCombatStore.getState().encounter
  assert.ok(encounter)

  assert.ok(encounter.order.includes('goblin'))
  assert.equal(encounter.order.length, 2)
  assert.ok((encounter.combatants['goblin']?.initiative ?? 0) > 0, 'the goblin did roll')
})

test('after the opening round, a foe going first still hands control back', () => {
  /*
   * The invariant the two tests here used to cover through start(). It still
   * matters — it just moved, because from round two onward nothing is scripted
   * and the goblin can lead.
   */
  useCombatStore.getState().reset()
  useCombatStore.getState().start(roster(), 'hero-1', seededRng(4242))
  useCombatStore.getState().finishTurn(seededRng(4242))

  const encounter = useCombatStore.getState().encounter
  assert.ok(encounter)
  const decided = encounterWinner(encounter) !== null
  assert.ok(
    activeCombatant(encounter)?.id === 'hero-1' || decided,
    'the player must never be handed a live board that is not theirs',
  )
})

test('a foe that drops the hero outright ends the fight instead of passing the turn', () => {
  useCombatStore.getState().reset()
  useCombatStore.getState().start(roster(), 'hero-1', FOE_FIRST_THEN_KILLS)
  // The hero leads now, so end their turn to let the goblin swing.
  useCombatStore.getState().finishTurn(FOE_FIRST_THEN_KILLS)
  const encounter = useCombatStore.getState().encounter
  assert.ok(encounter)

  // There is no turn to hand back once the hero is down, so a foe staying
  // active is correct.
  if (encounterWinner(encounter) === 'foes') {
    assert.equal(activeCombatant(encounter)?.team, 'foes')
  } else {
    assert.equal(activeCombatant(encounter)?.id, 'hero-1')
  }
})

/**
 * The invariant that actually matters, over many deterministic seeds: the player
 * is never shown a board that is still live but offers them nothing to do.
 */
test('the player is never left on an undecided board they cannot act on', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    useCombatStore.getState().reset()
    useCombatStore.getState().start(roster(), 'hero-1', seededRng(seed))
    const encounter = useCombatStore.getState().encounter
    assert.ok(encounter)

    const decided = encounterWinner(encounter) !== null
    const playersTurn = activeCombatant(encounter)?.team === 'party'
    assert.ok(
      playersTurn || decided,
      `seed ${seed}: the fight is undecided but it is not the player's turn`,
    )
  }
})

test('ending a turn hands control straight back, never mid-enemy-round', () => {
  useCombatStore.getState().reset()
  /*
   * Seeded on purpose. Left to Math.random this failed about one run in thirty:
   * the goblin would occasionally drop a level 1 hero inside the very round
   * being tested, the fight would end, and control would correctly *not* come
   * back to the party. That is the engine behaving, not breaking — but it makes
   * the assertion below a coin toss, and a suite that fails at random teaches
   * everyone to re-run it rather than read it.
   */
  useCombatStore.getState().start(roster(), 'hero-1', seededRng(20260801))
  useCombatStore.getState().finishTurn(seededRng(20260801))

  const encounter = useCombatStore.getState().encounter
  assert.ok(encounter)
  assert.equal(activeCombatant(encounter)?.team, 'party')
  assert.ok(encounter.round >= 2, 'a full pass through the order advanced the round')
})

test('an illegal move is refused in plain English', () => {
  useCombatStore.getState().reset()
  useCombatStore.getState().start(roster(), 'hero-1')

  const before = useCombatStore.getState().encounter
  assert.equal(useCombatStore.getState().move({ x: 0, y: 0 }), false)
  assert.equal(useCombatStore.getState().encounter, before, 'the board did not change')
  assert.ok(useCombatStore.getState().refusal)
})

test('the store forwards a smite to the engine, not just its type', () => {
  /*
   * This test exists because the store did not. `attack` destructured
   * `{ targetId, attackId, maneuverId }` and dropped `smite` on the floor while
   * its type signature happily accepted it — so typecheck passed, every engine
   * test passed (they call `attackWith` directly), and the feature reached
   * production doing nothing at all.
   *
   * The lesson is about where the tests point. A mechanic verified only at the
   * layer that implements it is not verified; the layers between the button and
   * the engine are exactly where it goes missing.
   */
  const hero = characterToCombatant(levelUp(paladinHero()).character, {
    position: { x: 0, y: 0 },
    speedSquares: 3,
  })
  const foe = {
    ...spawnMonster(GOBLIN, { id: 'foe', position: { x: 1, y: 0 } }),
    maxHp: 60,
    currentHp: 60,
  }
  useCombatStore.getState().start([hero, foe], hero.id, () => 0.99)

  const before = useCombatStore.getState().encounter?.combatants[hero.id]?.spellSlots
  assert.equal(before, 2)

  useCombatStore.getState().attack({
    targetId: 'foe',
    attackId: hero.attacks[0]!.id,
    smite: true,
    rng: () => faceValue(19, 20),
  })

  const after = useCombatStore.getState().encounter
  assert.equal(
    after?.combatants[hero.id]?.spellSlots,
    1,
    'the slot was burned, so the smite actually reached the engine',
  )
  assert.ok(after?.log.some((line) => /Divine Smite/.test(line)))
})

test('the store forwards a manoeuvre too, which is the same shape', () => {
  const hero = characterToCombatant(
    grownBattleMaster(),
    { position: { x: 0, y: 0 }, speedSquares: 3 },
  )
  const foe = {
    ...spawnMonster(GOBLIN, { id: 'foe', position: { x: 1, y: 0 } }),
    maxHp: 60,
    currentHp: 60,
  }
  useCombatStore.getState().start([hero, foe], hero.id, () => 0.99)
  useCombatStore.getState().attack({
    targetId: 'foe',
    attackId: hero.attacks[0]!.id,
    maneuverId: 'trip',
    rng: () => faceValue(19, 20),
  })
  const after = useCombatStore.getState().encounter
  assert.equal(after?.combatants[hero.id]?.superiorityDice, 1, 'a die was spent')
})

function paladinHero() {
  return buildCharacter(
    { classId: 'paladin', raceId: 'human', backgroundId: 'noble', flawId: 'obeyed',
      equipmentChoice: 'offensive', auraId: 'amber' } as never,
    'Oathkeeper', { id: 'smiter', now: 1_700_000_000_000 },
  )
}

function grownBattleMaster() {
  return levelUp(buildCharacter(
    { classId: 'fighter', raceId: 'human', backgroundId: 'guildArtisan', flawId: 'haggler',
      equipmentChoice: 'offensive', auraId: 'amber', subclassId: 'battlemaster' } as never,
    'Duellist', { id: 'bm', now: 1_700_000_000_000 },
  )).character
}
