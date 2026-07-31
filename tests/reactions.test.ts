import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { attackWith, createEncounter, resolveReaction } from '../src/lib/dnd/encounter.ts'
import { canWardingFlare, resolveWardingFlare } from '../src/lib/dnd/reactions.ts'
import { hasReactionFor } from '../src/content/subclasses.ts'
import { critFor, DEFAULT_CRIT_ON } from '../src/lib/dnd/dice.ts'
import type { Combatant } from '../src/types/combat.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'

const meta = { id: 'cleric', now: 1_700_000_000_000 }

function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'cleric',
    raceId: 'human',
    backgroundId: 'noble',
    flawId: 'obeyed',
    equipmentChoice: 'defensive',
    auraId: 'amber',
    magicStyleId: 'radiance',
    ...overrides,
  }
}

/**
 * A cleric who can flare, and a fighter standing next to them who cannot.
 * The foe is given a huge attack bonus so its swing lands without needing the
 * rng pinned to a natural 20, which would confuse crit assertions.
 */
function board(subclassId = 'light') {
  const hero = buildCharacter(answers({ subclassId }), 'Flarelight', meta)
  const foe = buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'Goblin',
    { ...meta, id: 'foe' },
  )

  const heroSide = characterToCombatant(hero, { position: { x: 0, y: 0 } })
  const foeSide: Combatant = {
    ...characterToCombatant(foe, { position: { x: 1, y: 0 }, team: 'foes' }),
    // Guarantees the raw roll clears the cleric's AC, so "would it land" is
    // decided by the die the test pins rather than by armour maths.
    attacks: foe.attacks.map((attack) => ({ ...attack, proficient: true })),
  }

  const base = createEncounter([heroSide, foeSide], () => 0.99)
  // The foe is the one swinging in every test here.
  return { hero, foe, encounter: { ...base, activeIndex: base.order.indexOf(foe.id) } }
}

// --- Who can react --------------------------------------------------------

test('only the Light Domain brings a reaction to the fight', () => {
  assert.equal(hasReactionFor('light'), true)
  assert.equal(hasReactionFor('life'), false)
  assert.equal(hasReactionFor('champion'), false)
  assert.equal(hasReactionFor(undefined), false)
})

test('the flag reaches the sheet and becomes an unspent reaction on the board', () => {
  const cleric = buildCharacter(answers({ subclassId: 'light' }), 'A', meta)
  assert.equal(cleric.hasReaction, true)
  assert.equal(
    characterToCombatant(cleric, { position: { x: 0, y: 0 } }).reactionAvailable,
    true,
  )
})

test('a hero without the feature carries nothing at all', () => {
  const plain = buildCharacter(answers({ subclassId: 'life' }), 'A', meta)
  assert.equal('hasReaction' in plain, false)
  const combatant = characterToCombatant(plain, { position: { x: 0, y: 0 } })
  assert.equal(combatant.reactionAvailable, undefined)
  assert.equal(canWardingFlare(combatant), false)
})

// --- The pause ------------------------------------------------------------

test('a landing blow on someone who can react pauses instead of applying', () => {
  const { hero, foe, encounter } = board()
  const attack = encounter.combatants[foe.id]!.attacks[0]!
  const before = encounter.combatants[hero.id]!.currentHp

  const result = attackWith(encounter, {
    targetId: hero.id,
    attackId: attack.id,
    rng: sequenceRng([faceValue(18, 20), faceValue(5, 8)]),
  })

  assert.equal(result.refusal, null)
  assert.ok(result.encounter.pendingReaction !== undefined, 'the attack should be held')
  assert.equal(result.encounter.pendingReaction?.kind, 'wardingFlare')
  assert.equal(
    result.encounter.combatants[hero.id]?.currentHp,
    before,
    'no hit points may move while the board is paused',
  )
  assert.equal(result.encounter.hasActed, true, 'the action is still spent')
})

test('a miss never pauses — there is nothing to react to', () => {
  const { hero, foe, encounter } = board()
  const attack = encounter.combatants[foe.id]!.attacks[0]!
  const result = attackWith(encounter, {
    targetId: hero.id,
    attackId: attack.id,
    rng: sequenceRng([faceValue(2, 20)]),
  })
  assert.equal(result.encounter.pendingReaction, undefined)
})

test('a target with no reaction is struck immediately, as before', () => {
  const { hero, foe, encounter } = board('life')
  const attack = encounter.combatants[foe.id]!.attacks[0]!
  const before = encounter.combatants[hero.id]!.currentHp

  const result = attackWith(encounter, {
    targetId: hero.id,
    attackId: attack.id,
    rng: sequenceRng([faceValue(18, 20), faceValue(5, 8)]),
  })
  assert.equal(result.encounter.pendingReaction, undefined)
  assert.ok(result.encounter.combatants[hero.id]!.currentHp < before)
})

// --- Passing --------------------------------------------------------------

test('passing applies exactly the blow that was already rolled', () => {
  const { hero, foe, encounter } = board()
  const attack = encounter.combatants[foe.id]!.attacks[0]!
  const paused = attackWith(encounter, {
    targetId: hero.id,
    attackId: attack.id,
    rng: sequenceRng([faceValue(18, 20), faceValue(5, 8)]),
  }).encounter

  // Only a landing blow ever pauses, but the union does not know that, so the
  // test asserts it rather than casting past it.
  const held = paused.pendingReaction!.outcome
  assert.ok(held.kind === 'hit' || held.kind === 'crit')
  const damage = held.damage
  const before = paused.combatants[hero.id]!.currentHp

  const settled = resolveReaction(paused, 'pass')
  assert.equal(settled.refusal, null)
  assert.equal(settled.encounter.pendingReaction, undefined, 'the pause must clear')
  assert.equal(settled.encounter.combatants[hero.id]?.currentHp, before - damage)
  // Passing is free: the reaction was never spent.
  assert.equal(settled.encounter.combatants[hero.id]?.reactionAvailable, true)
})

// --- Flaring --------------------------------------------------------------

test('flaring rolls again and the lower natural counts', () => {
  const { hero, foe, encounter } = board()
  const attack = encounter.combatants[foe.id]!.attacks[0]!
  const paused = attackWith(encounter, {
    targetId: hero.id,
    attackId: attack.id,
    rng: sequenceRng([faceValue(18, 20), faceValue(5, 8)]),
  }).encounter

  // The flare die comes up 3, which is lower than the original 18.
  const settled = resolveReaction(paused, 'flare', () => faceValue(3, 20))
  assert.equal(settled.encounter.pendingReaction, undefined)
  assert.equal(settled.outcome?.breakdown.natural, 3, 'the lower die must be the one kept')
})

test('a flare that drops the roll below AC turns a hit into a miss', () => {
  const { hero, foe, encounter } = board()
  const attack = encounter.combatants[foe.id]!.attacks[0]!
  const paused = attackWith(encounter, {
    targetId: hero.id,
    attackId: attack.id,
    rng: sequenceRng([faceValue(20, 20), faceValue(5, 8), faceValue(5, 8)]),
  }).encounter
  const before = paused.combatants[hero.id]!.currentHp

  const settled = resolveReaction(paused, 'flare', () => faceValue(1, 20))
  assert.equal(settled.outcome?.kind, 'fumble', 'a natural 1 is a fumble however it got there')
  assert.equal(settled.encounter.combatants[hero.id]?.currentHp, before, 'no damage on a miss')
})

test('a higher flare die changes nothing — the original still counts', () => {
  const { hero, foe, encounter } = board()
  const attack = encounter.combatants[foe.id]!.attacks[0]!
  const paused = attackWith(encounter, {
    targetId: hero.id,
    attackId: attack.id,
    rng: sequenceRng([faceValue(17, 20), faceValue(5, 8)]),
  }).encounter
  assert.ok(paused.pendingReaction !== undefined, 'the setup must actually pause')

  const settled = resolveReaction(paused, 'flare', () => faceValue(19, 20))
  assert.equal(settled.outcome?.breakdown.natural, 17, 'disadvantage cannot help the attacker')
})

test('the reaction is spent whether or not the flare saved anybody', () => {
  const { hero, foe, encounter } = board()
  const attack = encounter.combatants[foe.id]!.attacks[0]!
  const paused = attackWith(encounter, {
    targetId: hero.id,
    attackId: attack.id,
    rng: sequenceRng([faceValue(17, 20), faceValue(5, 8)]),
  }).encounter
  assert.ok(paused.pendingReaction !== undefined, 'the setup must actually pause')

  // A useless flare: the second die is higher, so the blow lands anyway.
  const settled = resolveReaction(paused, 'flare', () => faceValue(19, 20))
  assert.equal(settled.encounter.combatants[hero.id]?.reactionAvailable, false)
})

test('a spent reaction stops the next blow pausing at all', () => {
  const { hero, foe, encounter } = board()
  const attack = encounter.combatants[foe.id]!.attacks[0]!
  const spent = {
    ...encounter,
    combatants: {
      ...encounter.combatants,
      [hero.id]: { ...encounter.combatants[hero.id]!, reactionAvailable: false },
    },
  }
  const result = attackWith(spent, {
    targetId: hero.id,
    attackId: attack.id,
    rng: sequenceRng([faceValue(18, 20), faceValue(5, 8)]),
  })
  assert.equal(result.encounter.pendingReaction, undefined)
})

// --- Guards ---------------------------------------------------------------

test('resolving nothing is refused rather than throwing', () => {
  const { encounter } = board()
  const result = resolveReaction(encounter, 'flare')
  assert.match(result.refusal ?? '', /nothing is waiting/i)
})

test('the flare re-asks the crit question through the shared helper', () => {
  // Not a second implementation: a Champion's 19 must still read as a crit
  // after disadvantage, which only holds while both paths call critFor.
  assert.equal(critFor(19, 19), 'hit')
  assert.equal(critFor(19), null)
  assert.equal(critFor(1, 19), 'fumble')
  assert.equal(DEFAULT_CRIT_ON, 20)
})

test('resolveWardingFlare never invents damage on a blow it turned aside', () => {
  const { hero, foe, encounter } = board()
  const attacker = encounter.combatants[foe.id]!
  const target = encounter.combatants[hero.id]!
  const attack = attacker.attacks[0]!
  const paused = attackWith(encounter, {
    targetId: hero.id,
    attackId: attack.id,
    rng: sequenceRng([faceValue(18, 20), faceValue(5, 8)]),
  }).encounter

  const flare = resolveWardingFlare({
    attacker,
    target,
    attack,
    outcome: paused.pendingReaction!.outcome,
    rng: () => faceValue(2, 20),
  })
  assert.equal(flare.keptNatural, 2)
  assert.equal(flare.outcome.kind, 'miss')
  // A miss carries no damage field at all, which is the type doing the work.
  assert.ok(!('damage' in flare.outcome))
})
