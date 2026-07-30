import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCheck } from '../src/lib/dnd/checks.ts'
import { resolveAttack } from '../src/lib/dnd/combat.ts'
import { GOBLIN, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import { roll } from '../src/lib/dnd/dice.ts'
import {
  describeMath,
  describeMode,
  narrateAttack,
  narrateAttackFully,
  narrateCheck,
  narrateCheckFully,
  narrateDamage,
} from '../src/lib/dnd/narrate.ts'
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

function hero(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'hero',
    name: 'Bruenna',
    team: 'party',
    level: 1,
    scores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 13,
    currentHp: 13,
    ac: 16,
    speedSquares: 3,
    position: { x: 0, y: 0 },
    attacks: [LONGSWORD],
    conditions: [],
    initiative: 0,
    ...overrides,
  }
}

function goblinAt(x: number, y: number): Combatant {
  return spawnMonster(GOBLIN, { id: 'goblin-1', position: { x, y } })
}

test('the attack breakdown matches the format the tutorial promises', () => {
  const rng = sequenceRng([faceValue(14, 20), faceValue(5, 8)])
  const outcome = resolveAttack({
    attacker: hero(), target: goblinAt(1, 0), attack: LONGSWORD, rng,
  })

  assert.equal(
    narrateAttack(outcome, 'Goblin'),
    'Rolled 14 + 3 (STR) + 2 (Prof) = 19 vs Goblin AC 12. HIT!',
  )
})

test('describeMath spells out every bonus in order', () => {
  assert.equal(
    describeMath(14, [{ label: 'STR', value: 3 }, { label: 'Prof', value: 2 }], 19),
    'Rolled 14 + 3 (STR) + 2 (Prof) = 19',
  )
  assert.equal(
    describeMath(11, [{ label: 'INT', value: -1 }], 10),
    'Rolled 11 - 1 (INT) = 10',
    'penalties subtract rather than adding a negative',
  )
  assert.equal(describeMath(11, [], 11), 'Rolled 11', 'no bonuses means no arithmetic to show')
})

test('a miss and a hit read the same up to the verdict', () => {
  const rng = sequenceRng([faceValue(3, 20)])
  const outcome = resolveAttack({
    attacker: hero(), target: goblinAt(1, 0), attack: LONGSWORD, rng,
  })
  assert.equal(
    narrateAttack(outcome, 'Goblin'),
    'Rolled 3 + 3 (STR) + 2 (Prof) = 8 vs Goblin AC 12. MISS.',
  )
})

test('a critical hit is announced and explained', () => {
  const rng = sequenceRng([faceValue(20, 20), faceValue(6, 8), faceValue(4, 8)])
  const outcome = resolveAttack({
    attacker: hero(), target: goblinAt(1, 0), attack: LONGSWORD, rng,
  })

  assert.equal(
    narrateAttackFully(outcome, 'Goblin', 'slashing'),
    'Rolled 20 + 3 (STR) + 2 (Prof) = 25 vs Goblin AC 12. CRITICAL HIT! '
      + 'A natural 20 always hits, and it doubles the damage dice. '
      + 'Damage: 6 + 4 + 3 = 13 slashing damage.',
  )
})

test('a fumble explains why the bonuses did not save it', () => {
  const rng = sequenceRng([faceValue(1, 20)])
  const outcome = resolveAttack({
    attacker: hero(), target: goblinAt(1, 0), attack: LONGSWORD, rng,
  })

  assert.equal(
    narrateAttackFully(outcome, 'Goblin'),
    'Rolled 1 + 3 (STR) + 2 (Prof) = 6 vs Goblin AC 12. MISS. '
      + 'A natural 1 always misses, however big the bonuses.',
  )
})

test('damage shows its working only when there is working to show', () => {
  const withModifier = roll('1d8+3', { rng: sequenceRng([faceValue(5, 8)]) })
  assert.equal(narrateDamage(withModifier, 'slashing'), 'Damage: 5 + 3 = 8 slashing damage.')

  const bareDie = roll('1d10', { rng: sequenceRng([faceValue(7, 10)]) })
  assert.equal(narrateDamage(bareDie, 'fire'), 'Damage: 7 fire damage.')
  assert.equal(narrateDamage(bareDie), 'Damage: 7 damage.', 'the damage type is optional')

  const twoDice = roll('2d6', { rng: sequenceRng([faceValue(2, 6), faceValue(5, 6)]) })
  assert.equal(narrateDamage(twoDice), 'Damage: 2 + 5 = 7 damage.')
})

test('advantage and disadvantage explain the discarded die', () => {
  const advantage = roll('1d20+2', {
    rng: sequenceRng([faceValue(4, 20), faceValue(17, 20)]),
    mode: 'advantage',
  })
  assert.equal(describeMode(advantage), 'Advantage: rolled 4 and 17, kept the higher (17).')

  const disadvantage = roll('1d20+2', {
    rng: sequenceRng([faceValue(4, 20), faceValue(17, 20)]),
    mode: 'disadvantage',
  })
  assert.equal(describeMode(disadvantage), 'Disadvantage: rolled 4 and 17, kept the lower (4).')

  const straight = roll('1d20+2', { rng: sequenceRng([faceValue(9, 20)]) })
  assert.equal(describeMode(straight), null, 'a normal roll needs no explanation')
})

test('an attack made with disadvantage leads with the reason', () => {
  const poisoned = hero({ conditions: [{ id: 'poisoned', roundsRemaining: null }] })
  const rng = sequenceRng([faceValue(18, 20), faceValue(5, 20)])
  const outcome = resolveAttack({
    attacker: poisoned, target: goblinAt(1, 0), attack: LONGSWORD, rng,
  })

  assert.equal(
    narrateAttackFully(outcome, 'Goblin'),
    'Disadvantage: rolled 18 and 5, kept the lower (5). '
      + 'Rolled 5 + 3 (STR) + 2 (Prof) = 10 vs Goblin AC 12. MISS.',
  )
})

test('a skill check names the skill and the difficulty class', () => {
  const result = resolveCheck({
    scores: { str: 10, dex: 14, con: 12, int: 8, wis: 16, cha: 12 },
    skill: 'perception',
    level: 1,
    proficientSkills: ['perception'],
    dc: 12,
    rng: sequenceRng([faceValue(9, 20)]),
  })

  assert.equal(narrateCheck(result), 'Perception: Rolled 9 + 3 (WIS) + 2 (Prof) = 14 vs DC 12. SUCCESS!')
})

test('a failed check says so plainly', () => {
  const result = resolveCheck({
    scores: { str: 10, dex: 14, con: 12, int: 8, wis: 16, cha: 12 },
    skill: 'persuasion',
    level: 1,
    proficientSkills: [],
    dc: 15,
    rng: sequenceRng([faceValue(6, 20)]),
  })

  assert.equal(
    narrateCheckFully(result),
    'Persuasion: Rolled 6 + 1 (CHA) = 7 vs DC 15. FAILURE.',
  )
})

test('a check rolled with advantage explains the extra die', () => {
  const result = resolveCheck({
    scores: { str: 10, dex: 14, con: 12, int: 8, wis: 16, cha: 12 },
    skill: 'stealth',
    level: 1,
    proficientSkills: ['stealth'],
    dc: 12,
    rng: sequenceRng([faceValue(7, 20), faceValue(15, 20)]),
    mode: 'advantage',
  })

  assert.equal(
    narrateCheckFully(result),
    'Advantage: rolled 7 and 15, kept the higher (15). '
      + 'Stealth: Rolled 15 + 2 (DEX) + 2 (Prof) = 19 vs DC 12. SUCCESS!',
  )
})
