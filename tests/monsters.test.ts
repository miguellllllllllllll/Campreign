import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GIANT_BAT,
  GIANT_SPIDER,
  GOBLIN,
  MONSTERS,
  SKELETON,
  TRAINING_DUMMY,
  spawnMonster,
} from '../src/lib/dnd/data/monsters.ts'
import { attackBonusFor, effectiveAc, resolveAttack } from '../src/lib/dnd/combat.ts'
import { LOYAL_SQUIRE } from '../src/lib/dnd/data/companions.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import {
  attackWith, castFromActive, createEncounter, drinkPotion, encounterWinner,
  endTurn, moveActive, reachableSquares, takeAutomaticTurn,
} from '../src/lib/dnd/encounter.ts'
import { spawnCompanion } from '../src/lib/dnd/data/companions.ts'
import type { GridPosition } from '../src/types/combat.ts'

/** A tiny deterministic PRNG, so four hundred simulated fights are repeatable. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const apart = (a: GridPosition, b: GridPosition): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** One run of the tutorial's second fight, played by a serviceable cleric. */
function playSecondEncounter(rng: () => number): boolean {
  const hero = buildCharacter(
    {
      classId: 'cleric', raceId: 'human', backgroundId: 'noble', flawId: 'obeyed',
      equipmentChoice: 'offensive', auraId: 'amber', magicStyleId: 'healersMercy',
    },
    'Cleric',
    { id: 'h', now: 1 },
  )
  let encounter = createEncounter([
    { ...characterToCombatant(hero, { position: { x: 2, y: 4 } }), initiative: 20 },
    { ...spawnCompanion(LOYAL_SQUIRE, { position: { x: 1, y: 4 }, id: 'sq' }), initiative: 15 },
    { ...spawnMonster(GIANT_BAT, { position: { x: 1, y: 0 }, id: 'bat' }), initiative: 10 },
    { ...spawnMonster(SKELETON, { position: { x: 3, y: 0 }, id: 'skel' }), initiative: 5 },
  ])

  for (let turn = 0; turn < 80; turn += 1) {
    if (encounterWinner(encounter) !== null) break
    if (encounter.order[encounter.activeIndex] !== 'h') {
      encounter = endTurn(takeAutomaticTurn(encounter, rng).encounter, rng)
      continue
    }
    let me = encounter.combatants.h
    if (me !== undefined && me.currentHp > 0) {
      const living = () =>
        Object.values(encounter.combatants).filter((c) => c.team === 'foes' && c.currentHp > 0)
      const canHeal = (me.spellSlots?.[1] ?? 0) > 0
        && (me.preparedSpells ?? []).includes('cureWounds')
      if (me.currentHp <= me.maxHp / 2 && canHeal) {
        encounter = castFromActive(encounter, { spellId: 'cureWounds', targetId: 'h', rng }).encounter
      } else if (me.currentHp <= me.maxHp / 3 && (me.potions ?? 0) > 0) {
        encounter = drinkPotion(encounter).encounter
      } else {
        for (let step = 0; step < 6; step += 1) {
          me = encounter.combatants.h
          const foes = living()
          if (me === undefined || foes.length === 0) break
          const near = [...foes].sort((a, b) => apart(me!.position, a.position) - apart(me!.position, b.position))[0]
          if (near === undefined || apart(me.position, near.position) <= 1) break
          const options = reachableSquares(encounter)
          const best = [...options].sort((a, b) => apart(a, near.position) - apart(b, near.position))[0]
          if (best === undefined || apart(best, near.position) >= apart(me.position, near.position)) break
          const moved = moveActive(encounter, best)
          if (moved === encounter) break
          encounter = moved
        }
        me = encounter.combatants.h
        const foes = living()
        const near = me === undefined
          ? undefined
          : [...foes].sort((a, b) => apart(me!.position, a.position) - apart(me!.position, b.position))[0]
        const weapon = me?.attacks[0]
        if (me !== undefined && near !== undefined && weapon !== undefined
          && apart(me.position, near.position) <= 1) {
          encounter = attackWith(encounter, { targetId: near.id, attackId: weapon.id, rng }).encounter
        }
      }
    }
    encounter = endTurn(encounter, rng)
  }
  return encounterWinner(encounter) === 'party'
}
import { damageNotation } from '../src/lib/dnd/characterBuilder.ts'
import { isDead } from '../src/lib/dnd/dying.ts'
import { faceValue } from './helpers/rng.ts'

const NEW_MONSTERS = [GIANT_BAT, SKELETON, GIANT_SPIDER]

function spawn(preset: typeof GOBLIN) {
  return spawnMonster(preset, { id: preset.id, position: { x: 0, y: 0 } })
}

/**
 * Attack bonuses are derived from scores and level rather than written down, so
 * these assert the SRD's published to-hit numbers come out of the model. A
 * preset with the right flavour and the wrong Dexterity would otherwise pass
 * every other test in the suite.
 */
test('each monster swings at the bonus the SRD prints for it', () => {
  const expected: Record<string, number> = {
    goblin: 4,
    giantBat: 4,
    skeleton: 4,
    giantSpider: 5,
  }
  for (const preset of [GOBLIN, ...NEW_MONSTERS]) {
    const combatant = spawn(preset)
    const attack = combatant.attacks[0]
    assert.ok(attack !== undefined, `${preset.id} has nothing to swing`)
    assert.equal(attackBonusFor(combatant, attack), expected[preset.id], `${preset.id} to-hit`)
  }
})

test('each monster deals the damage the SRD prints for it', () => {
  const expected: Record<string, string> = {
    giantBat: '1d6+2',
    skeleton: '1d6+2',
    giantSpider: '1d8+3',
  }
  for (const preset of NEW_MONSTERS) {
    const combatant = spawn(preset)
    const attack = combatant.attacks[0]!
    assert.equal(damageNotation(attack, combatant.scores), expected[preset.id], preset.id)
  }
})

test('the bestiary gets harder in the order it is meant to be met', () => {
  // Not decoration: a bestiary whose "step up" is softer than the tutorial
  // goblin has no reason to exist.
  assert.ok(GIANT_SPIDER.maxHp > GIANT_BAT.maxHp)
  assert.ok(GIANT_BAT.maxHp > GOBLIN.maxHp)
  assert.ok(GIANT_SPIDER.ac > GOBLIN.ac)
  for (const preset of NEW_MONSTERS) {
    assert.ok(preset.ac >= GOBLIN.ac, `${preset.id} is softer than the first fight`)
  }
})

test('the bat is the fastest thing on the board and the skeleton the slowest', () => {
  /*
   * The skeleton used to match the goblin here, which is the SRD's flat 30 feet
   * for both. It is slower now, and that is the one stat in this file chosen to
   * tune a fight rather than to describe a creature — see its own comment for
   * what was measured. Asserted as an ordering rather than a number so the
   * shape survives a re-tune and a silent revert does not.
   */
  assert.ok(GIANT_BAT.speedSquares > GOBLIN.speedSquares)
  assert.ok(SKELETON.speedSquares < GOBLIN.speedSquares, 'slow, and it keeps coming')
  assert.ok(GIANT_BAT.speedSquares > SKELETON.speedSquares)
  assert.equal(GIANT_SPIDER.speedSquares, GOBLIN.speedSquares)
})

test('every monster is registered, and every registration is real', () => {
  for (const preset of [GOBLIN, TRAINING_DUMMY, ...NEW_MONSTERS]) {
    assert.equal(MONSTERS[preset.id], preset, `${preset.id} is missing from MONSTERS`)
  }
  for (const [key, preset] of Object.entries(MONSTERS)) {
    assert.equal(key, preset.id, 'the registry key must be the id')
    assert.ok(preset.name.length > 0)
    assert.ok(preset.blurb.length > 20, `${key} needs a sentence somebody can read aloud`)
    assert.ok(preset.maxHp > 0)
    assert.ok(preset.ac > 0)
  }
})

test('a spawned monster carries no death saves, so it dies when it drops', () => {
  /*
   * The other half of the dying rules. A bestiary that accidentally handed
   * monsters death saves would turn every kill into three more rolls.
   */
  for (const preset of NEW_MONSTERS) {
    const combatant = spawn(preset)
    assert.equal(combatant.deathSaves, undefined, `${preset.id} should not linger`)
    assert.ok(isDead({ ...combatant, currentHp: 0 }))
  }
})

test('they are actually fightable — a hit lands and takes hit points off', () => {
  // An end-to-end sanity pass, because a preset that typechecks can still be
  // unusable if a field the engine reads is wrong.
  for (const preset of NEW_MONSTERS) {
    const attacker = spawn(GOBLIN)
    const target = { ...spawn(preset), id: `${preset.id}-target`, position: { x: 1, y: 0 } }
    const outcome = resolveAttack({
      attacker,
      target,
      attack: attacker.attacks[0]!,
      rng: () => faceValue(20, 20),
    })
    assert.equal(outcome.kind, 'crit', `${preset.id} could not be hit by a natural 20`)
    assert.equal(outcome.breakdown.targetAc, effectiveAc(target))
  }
})

test('the practice dummy stays the one thing that cannot be killed', () => {
  assert.ok(TRAINING_DUMMY.maxHp > GIANT_SPIDER.maxHp * 10)
  assert.equal(TRAINING_DUMMY.attacks.length, 0, 'it does not hit back')
})

test('a creature the tutorial calls fragile is not the toughest thing on the board', () => {
  /*
   * The SRD gives the giant bat 22 hit points, which made it sturdier than the
   * skeleton standing beside it in the second encounter — while the narration
   * on that step calls it fragile. Prose and data have to agree, and the
   * encounter has to be survivable by somebody one fight into the game.
   */
  assert.ok(GIANT_BAT.maxHp < SKELETON.maxHp, 'the bat is the fragile one')
  assert.ok(GIANT_BAT.speedSquares > SKELETON.speedSquares, 'and the fast one')
})

test('the second encounter is survivable by the party that meets it', () => {
  /*
   * A simulation rather than a sanity bound, because the sanity bound was
   * measuring the wrong thing twice over.
   *
   * It used to hardcode "party at level 2 is roughly 17 + 12", and the party
   * stopped being level 2 when both level-ups moved to the spider — so it went
   * on passing against a party that no longer existed. Deriving the weakest
   * class's hit points instead only swapped one bad proxy for another: the
   * fewest hit points in this build belong to the wizard, who wins this fight
   * essentially always because it kills at range. Hit points do not measure
   * survival.
   *
   * So this plays the fight. The engine takes its randomness as a parameter,
   * which is the property that makes it possible to run four hundred of them
   * deterministically inside a unit test, and the cleric is the class that
   * breaks first — it broke at the bat's SRD 22 and it is still the canary.
   */
  const rng = seeded(0x5eed)
  let wins = 0
  const runs = 400
  for (let i = 0; i < runs; i += 1) if (playSecondEncounter(rng)) wins += 1
  const rate = wins / runs
  assert.ok(
    rate > 0.65,
    `a cleric wins the second encounter only ${(100 * rate).toFixed(1)}% of the time`,
  )
})
