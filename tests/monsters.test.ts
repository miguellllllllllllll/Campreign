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

test('the bat is the only thing on the board faster than a goblin', () => {
  assert.ok(GIANT_BAT.speedSquares > GOBLIN.speedSquares)
  assert.equal(SKELETON.speedSquares, GOBLIN.speedSquares)
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
