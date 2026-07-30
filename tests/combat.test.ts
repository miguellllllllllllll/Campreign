import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyDamage,
  applyHealing,
  attackBonusFor,
  canAct,
  gridDistance,
  initiativeOrder,
  isDefeated,
  isInRange,
  resolveAttack,
  rollInitiative,
} from '../src/lib/dnd/combat.ts'
import { GOBLIN, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import type { AttackAction } from '../src/types/action.ts'
import type { Combatant } from '../src/types/combat.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'

const LONGSWORD: AttackAction = {
  id: 'longsword',
  name: 'Longsword',
  kind: 'weapon',
  ability: 'str',
  proficient: true,
  damage: '1d8',
  damageType: 'slashing',
  addAbilityToDamage: true,
  ranged: false,
  rangeSquares: 1,
  description: 'A broad swing with a steel blade.',
}

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'hero',
    name: 'Hero',
    team: 'party',
    level: 1,
    scores: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 12,
    currentHp: 12,
    ac: 14,
    speedSquares: 3,
    position: { x: 0, y: 0 },
    attacks: [LONGSWORD],
    conditions: [],
    initiative: 0,
    ...overrides,
  }
}

test('initiative is a d20 plus the dexterity modifier', () => {
  const nimble = makeCombatant({ scores: { str: 8, dex: 18, con: 10, int: 10, wis: 10, cha: 10 } })
  const rng = sequenceRng([faceValue(11, 20)])
  assert.equal(rollInitiative(nimble, rng), 15, '11 + 4 dex')
})

test('a negative modifier subtracts instead of breaking the notation', () => {
  const clumsy = makeCombatant({ scores: { str: 8, dex: 6, con: 10, int: 10, wis: 10, cha: 10 } })
  assert.equal(rollInitiative(clumsy, sequenceRng([faceValue(11, 20)])), 9, '11 - 2 dex')

  const untrained = { ...LONGSWORD, proficient: false }
  assert.equal(attackBonusFor(clumsy, untrained), -1)
  const outcome = resolveAttack({
    attacker: clumsy,
    target: makeCombatant({ id: 'target', ac: 10, team: 'foes' }),
    attack: untrained,
    rng: sequenceRng([faceValue(12, 20)]),
  })
  assert.equal(outcome.breakdown.total, 11, '12 - 1 str')
  assert.equal(outcome.kind, 'hit')
})

test('initiative order is highest first, breaking ties on dexterity then name', () => {
  const fast = makeCombatant({ id: 'fast', name: 'Fast', initiative: 20 })
  const slow = makeCombatant({ id: 'slow', name: 'Slow', initiative: 4 })
  const tiedNimble = makeCombatant({
    id: 'tied-nimble',
    name: 'Zara',
    initiative: 12,
    scores: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  })
  const tiedClumsy = makeCombatant({
    id: 'tied-clumsy',
    name: 'Abel',
    initiative: 12,
    scores: { str: 10, dex: 8, con: 10, int: 10, wis: 10, cha: 10 },
  })

  assert.deepEqual(
    initiativeOrder([slow, tiedClumsy, tiedNimble, fast]),
    ['fast', 'tied-nimble', 'tied-clumsy', 'slow'],
  )

  const twinA = makeCombatant({ id: 'a', name: 'Aaron', initiative: 9 })
  const twinB = makeCombatant({ id: 'b', name: 'Bella', initiative: 9 })
  assert.deepEqual(initiativeOrder([twinB, twinA]), ['a', 'b'], 'name breaks a full tie')
})

test('initiativeOrder does not reorder its input', () => {
  const first = makeCombatant({ id: 'first', initiative: 1 })
  const second = makeCombatant({ id: 'second', initiative: 30 })
  const roster = [first, second]
  initiativeOrder(roster)
  assert.equal(roster[0]?.id, 'first')
})

test('attack bonus is ability plus proficiency when trained', () => {
  const hero = makeCombatant()
  assert.equal(attackBonusFor(hero, LONGSWORD), 4, '+2 str, +2 prof')
  assert.equal(
    attackBonusFor(hero, { ...LONGSWORD, proficient: false }),
    2,
    'untrained drops the proficiency bonus',
  )
})

test('a total exactly equal to armour class is a hit', () => {
  const hero = makeCombatant()
  const goblin = spawnMonster(GOBLIN, { id: 'goblin-1', position: { x: 1, y: 0 } })
  // 8 + 4 = 12 versus AC 12.
  const rng = sequenceRng([faceValue(8, 20), faceValue(3, 8)])
  const outcome = resolveAttack({ attacker: hero, target: goblin, attack: LONGSWORD, rng })

  assert.equal(outcome.kind, 'hit')
  assert.equal(outcome.breakdown.total, 12)
  assert.equal(outcome.breakdown.targetAc, 12)
  assert.deepEqual(outcome.breakdown.parts, [
    { label: 'STR', value: 2 },
    { label: 'Prof', value: 2 },
  ])
  assert.equal(outcome.kind === 'hit' ? outcome.damage : -1, 5, '3 on the d8 + 2 str')
})

test('one short of armour class is a miss and rolls no damage', () => {
  const hero = makeCombatant()
  const target = makeCombatant({ id: 'target', ac: 13, team: 'foes' })
  const rng = sequenceRng([faceValue(8, 20)])
  const outcome = resolveAttack({ attacker: hero, target, attack: LONGSWORD, rng })

  assert.equal(outcome.kind, 'miss')
  assert.equal(outcome.breakdown.total, 12)
})

test('a natural 20 crits and doubles the damage dice but not the modifier', () => {
  const hero = makeCombatant()
  const wall = makeCombatant({ id: 'wall', ac: 30, team: 'foes' })
  const rng = sequenceRng([faceValue(20, 20), faceValue(4, 8), faceValue(6, 8)])
  const outcome = resolveAttack({ attacker: hero, target: wall, attack: LONGSWORD, rng })

  assert.equal(outcome.kind, 'crit', 'a natural 20 beats any armour class')
  assert.equal(outcome.breakdown.natural, 20)
  assert.equal(outcome.kind === 'crit' ? outcome.damageRoll.notation : '', '2d8+2')
  assert.equal(outcome.kind === 'crit' ? outcome.damage : -1, 12, '4 + 6 + 2 str')
})

test('a natural 1 always misses however large the bonus', () => {
  const hero = makeCombatant({ scores: { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } })
  const pushover = makeCombatant({ id: 'pushover', ac: 1, team: 'foes' })
  const rng = sequenceRng([faceValue(1, 20)])
  const outcome = resolveAttack({ attacker: hero, target: pushover, attack: LONGSWORD, rng })

  assert.equal(outcome.kind, 'fumble')
  assert.equal(outcome.breakdown.natural, 1)
})

test('conditions decide the roll mode without the caller asking', () => {
  const poisoned = makeCombatant({ conditions: [{ id: 'poisoned', roundsRemaining: null }] })
  const goblin = spawnMonster(GOBLIN, { id: 'goblin-1', position: { x: 1, y: 0 } })
  const rng = sequenceRng([faceValue(18, 20), faceValue(5, 20), faceValue(1, 8)])
  const outcome = resolveAttack({ attacker: poisoned, target: goblin, attack: LONGSWORD, rng })

  assert.equal(outcome.attackRoll.mode, 'disadvantage')
  assert.equal(outcome.breakdown.natural, 5, 'disadvantage keeps the worse die')
})

test('an explicit mode overrides the conditions', () => {
  const poisoned = makeCombatant({ conditions: [{ id: 'poisoned', roundsRemaining: null }] })
  const goblin = spawnMonster(GOBLIN, { id: 'goblin-1', position: { x: 1, y: 0 } })
  const rng = sequenceRng([faceValue(18, 20), faceValue(5, 20), faceValue(1, 8)])
  const outcome = resolveAttack({
    attacker: poisoned, target: goblin, attack: LONGSWORD, rng, mode: 'advantage',
  })

  assert.equal(outcome.attackRoll.mode, 'advantage')
  assert.equal(outcome.breakdown.natural, 18)
})

test('cantrip damage ignores the casting ability', () => {
  const wizard = makeCombatant({
    scores: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
  })
  const fireBolt: AttackAction = {
    ...LONGSWORD,
    id: 'fireBolt',
    name: 'Fire Bolt',
    kind: 'spell',
    ability: 'int',
    damage: '1d10',
    damageType: 'fire',
    addAbilityToDamage: false,
    ranged: true,
    rangeSquares: 4,
  }
  const goblin = spawnMonster(GOBLIN, { id: 'goblin-1', position: { x: 3, y: 0 } })
  const rng = sequenceRng([faceValue(15, 20), faceValue(7, 10)])
  const outcome = resolveAttack({ attacker: wizard, target: goblin, attack: fireBolt, rng })

  assert.equal(outcome.kind, 'hit')
  assert.equal(outcome.kind === 'hit' ? outcome.damage : -1, 7, 'no INT added to damage')
})

test('hit points never fall below zero or rise above the maximum', () => {
  const hero = makeCombatant({ currentHp: 5 })
  assert.equal(applyDamage(hero, 3).currentHp, 2)
  assert.equal(applyDamage(hero, 99).currentHp, 0, 'damage floors at zero')
  assert.equal(applyDamage(hero, -4).currentHp, 5, 'negative damage does not heal')
  assert.equal(applyHealing(hero, 3).currentHp, 8)
  assert.equal(applyHealing(hero, 99).currentHp, 12, 'healing caps at max hp')
  assert.equal(applyHealing(hero, -4).currentHp, 5, 'negative healing does no harm')
})

test('applyDamage returns a new combatant rather than mutating', () => {
  const hero = makeCombatant({ currentHp: 5 })
  const hurt = applyDamage(hero, 2)
  assert.equal(hero.currentHp, 5)
  assert.equal(hurt.currentHp, 3)
})

test('defeat is zero hit points, and the defeated cannot act', () => {
  const standing = makeCombatant({ currentHp: 1 })
  const downed = makeCombatant({ currentHp: 0 })
  assert.equal(isDefeated(standing), false)
  assert.equal(isDefeated(downed), true)
  assert.equal(canAct(standing), true)
  assert.equal(canAct(downed), false)
  assert.equal(
    canAct(makeCombatant({ conditions: [{ id: 'unconscious', roundsRemaining: null }] })),
    false,
  )
  assert.equal(
    canAct(makeCombatant({ conditions: [{ id: 'poisoned', roundsRemaining: null }] })),
    true,
    'poison hurts your aim but you still get a turn',
  )
})

test('diagonal squares cost the same as straight ones', () => {
  assert.equal(gridDistance({ x: 0, y: 0 }, { x: 0, y: 0 }), 0)
  assert.equal(gridDistance({ x: 0, y: 0 }, { x: 3, y: 0 }), 3)
  assert.equal(gridDistance({ x: 0, y: 0 }, { x: 2, y: 2 }), 2, 'a diagonal is one square')
  assert.equal(gridDistance({ x: 4, y: 1 }, { x: 1, y: 3 }), 3)
})

test('reach is measured in squares', () => {
  const hero = makeCombatant({ position: { x: 0, y: 0 } })
  const adjacent = makeCombatant({ id: 'adjacent', position: { x: 1, y: 1 }, team: 'foes' })
  const distant = makeCombatant({ id: 'distant', position: { x: 4, y: 0 }, team: 'foes' })

  assert.equal(isInRange(hero, adjacent, LONGSWORD), true)
  assert.equal(isInRange(hero, distant, LONGSWORD), false)
  assert.equal(isInRange(hero, distant, { ...LONGSWORD, rangeSquares: 4 }), true)
})

test('the tutorial goblin is beatable by a level one hero', () => {
  const goblin = spawnMonster(GOBLIN, { id: 'goblin-1', position: { x: 2, y: 2 }, initiative: 11 })
  assert.equal(goblin.team, 'foes')
  assert.equal(goblin.currentHp, goblin.maxHp)
  assert.equal(goblin.ac, 12)
  assert.equal(goblin.maxHp, 7)
  assert.equal(goblin.position.x, 2)
  assert.equal(goblin.initiative, 11)
  assert.ok(goblin.attacks.length > 0)
  assert.notEqual(goblin.attacks[0], GOBLIN.attacks[0], 'attacks are copied, not shared')
})
