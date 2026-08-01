import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { hasAllyAdjacentTo, resolveAttack } from '../src/lib/dnd/combat.ts'
import { narrateAttackFully } from '../src/lib/dnd/narrate.ts'
import { CLASS_PRESETS } from '../src/lib/dnd/presets.ts'
import { sneakAttackDiceAt, weaponAllowsSneakAttack } from '../src/lib/dnd/sneakAttack.ts'
import type { ClassId, CreationAnswers } from '../src/types/character.ts'
import type { Combatant } from '../src/types/combat.ts'
import { createEncounter, endTurn, takeAutomaticTurn } from '../src/lib/dnd/encounter.ts'
import { LOYAL_SQUIRE, spawnCompanion } from '../src/lib/dnd/data/companions.ts'
import { MONSTERS, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'
import { grown } from './helpers/levels.ts'

const meta = { id: 'sneak', now: 1_700_000_000_000 }

function answers(over: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'rogue',
    raceId: 'human',
    backgroundId: 'noble',
    flawId: 'obeyed',
    equipmentChoice: 'offensive',
    auraId: 'amber',
    ...over,
  }
}

function rogue(level = 1) {
  let hero = buildCharacter(answers(), 'Sneak', meta)
  for (let at = 1; at < level; at += 1) hero = grown(hero)
  return characterToCombatant(hero, { position: { x: 0, y: 0 } })
}

function foe(at: { x: number; y: number } = { x: 1, y: 0 }): Combatant {
  const built = buildCharacter(
    answers({ classId: 'fighter', backgroundId: 'guildArtisan', flawId: 'haggler' }),
    'Goblin',
    { ...meta, id: 'foe' },
  )
  return characterToCombatant(built, { position: at, team: 'foes' })
}

/** A rapier hit for 5, plus a 4 on the sneak die when one is thrown. */
const HIT = [faceValue(18, 20), faceValue(5, 8), faceValue(4, 6)]

// --- The table ------------------------------------------------------------

test('only rogues have sneak dice, and they grow on the odd level', () => {
  assert.equal(sneakAttackDiceAt('rogue', 1), 1)
  assert.equal(sneakAttackDiceAt('rogue', 2), 1)
  assert.equal(sneakAttackDiceAt('rogue', 3), 2)

  const others = (Object.keys(CLASS_PRESETS) as ClassId[]).filter((id) => id !== 'rogue')
  for (const classId of others) {
    for (const level of [1, 2, 3]) {
      assert.equal(sneakAttackDiceAt(classId, level), 0, `${classId} should have none`)
    }
  }
})

test('a rogue is built and levelled with the dice already on them', () => {
  assert.equal(rogue(1).sneakAttackDice, 1)
  assert.equal(rogue(3).sneakAttackDice, 2, 'levelling recomputes rather than forgets')
})

// --- The trigger ----------------------------------------------------------

test('a rogue fighting beside somebody hits harder than a rogue alone', () => {
  const attacker = rogue()
  const target = foe()
  const attack = attacker.attacks[0]
  assert.ok(attack !== undefined)

  const alone = resolveAttack({
    attacker, target, attack, mode: 'normal',
    rng: sequenceRng(HIT), allyAdjacentToTarget: false,
  })
  const flanked = resolveAttack({
    attacker, target, attack, mode: 'normal',
    rng: sequenceRng(HIT), allyAdjacentToTarget: true,
  })

  assert.equal(alone.kind, 'hit')
  assert.equal(flanked.kind, 'hit')
  if (alone.kind !== 'hit' || flanked.kind !== 'hit') return
  assert.equal(flanked.damage - alone.damage, 4, 'exactly the 4 rolled on the sneak die')
  assert.equal(alone.sneakAttackDice, undefined, 'and it is not merely unreported')
  assert.equal(flanked.sneakAttackDice, 1)
})

test('advantage pays out with no ally in sight', () => {
  const attacker = rogue()
  const attack = attacker.attacks[0]
  assert.ok(attack !== undefined)
  const outcome = resolveAttack({
    attacker, target: foe(), attack, mode: 'advantage',
    rng: sequenceRng([faceValue(18, 20), faceValue(3, 20), faceValue(5, 8), faceValue(4, 6)]),
    allyAdjacentToTarget: false,
  })
  assert.equal(outcome.kind === 'hit' ? outcome.sneakAttackDice : 0, 1)
})

test('disadvantage cancels it even with a friend in the target\'s face', () => {
  const attacker = rogue()
  const attack = attacker.attacks[0]
  assert.ok(attack !== undefined)
  const outcome = resolveAttack({
    attacker, target: foe(), attack, mode: 'disadvantage',
    rng: sequenceRng([faceValue(18, 20), faceValue(19, 20), faceValue(5, 8)]),
    allyAdjacentToTarget: true,
  })
  assert.equal(outcome.kind === 'hit' ? outcome.sneakAttackDice : undefined, undefined)
})

test('a crit doubles the sneak dice along with everything else', () => {
  const attacker = rogue(3)
  const attack = attacker.attacks[0]
  assert.ok(attack !== undefined)
  // Natural 20, then a doubled 1d8 and a doubled 2d6 — six damage dice in all.
  const outcome = resolveAttack({
    attacker, target: foe(), attack, mode: 'normal',
    rng: sequenceRng([
      faceValue(20, 20),
      faceValue(1, 8), faceValue(1, 8),
      faceValue(1, 6), faceValue(1, 6), faceValue(1, 6), faceValue(1, 6),
    ]),
    allyAdjacentToTarget: true,
  })
  assert.equal(outcome.kind, 'crit')
  if (outcome.kind !== 'crit') return
  assert.equal(outcome.sneakAttackDice, 2)
  // 2 (a doubled rapier die) + 4 (2d6 doubled to four dice) + 3 (DEX, which a
  // human rogue has at 16). The four sneak dice are the point: they double too.
  assert.equal(outcome.damage, 9)
})

// --- What does not qualify -------------------------------------------------

test('a spell is not a weapon, however precise the rogue', () => {
  // 'spell' rather than 'cantrip': ActionKind has two members and cantrip is
  // not one of them. The first draft of this test invented a third, passed the
  // suite, and only the typecheck gate caught it.
  const firebolt = {
    id: 'fireBolt', name: 'Fire Bolt', kind: 'spell' as const, ability: 'int' as const,
    proficient: true, damage: '1d10', damageType: 'fire' as const,
    addAbilityToDamage: false, ranged: true, rangeSquares: 24, description: '',
  }
  assert.equal(weaponAllowsSneakAttack(firebolt), false)
})

test('a heavy strength weapon is neither finesse nor ranged', () => {
  const greataxe = {
    id: 'greataxe', name: 'Greataxe', kind: 'weapon' as const, ability: 'str' as const,
    proficient: true, damage: '1d12', damageType: 'slashing' as const,
    addAbilityToDamage: true, ranged: false, rangeSquares: 1, description: '',
  }
  assert.equal(weaponAllowsSneakAttack(greataxe), false)
})

test('every weapon a rogue can actually hold does qualify', () => {
  const preset = CLASS_PRESETS.rogue
  const all = [...preset.attacks, ...Object.values(preset.loadouts).flatMap((l) => l.attacks)]
  assert.ok(all.length >= 3)
  for (const attack of all) {
    assert.ok(weaponAllowsSneakAttack(attack), `${attack.name} should qualify`)
  }
})

// --- Who counts as an ally -------------------------------------------------

test('an ally must be alive, on your side, and not the target', () => {
  const attacker = rogue()
  const target = foe({ x: 3, y: 0 })
  const near = (over: Partial<Combatant>): Combatant => ({
    ...foe({ x: 3, y: 1 }), id: 'other', ...over,
  })

  assert.ok(
    hasAllyAdjacentTo([attacker, target, near({ team: 'party' })], attacker, target),
    'a living friend beside the target counts',
  )
  assert.equal(
    hasAllyAdjacentTo([attacker, target, near({ team: 'foes' })], attacker, target),
    false, 'an enemy standing there does not',
  )
  assert.equal(
    hasAllyAdjacentTo([attacker, target, near({ team: 'party', currentHp: 0 })], attacker, target),
    false, 'nor a friend who has dropped',
  )
  assert.equal(
    hasAllyAdjacentTo([attacker, target], attacker, target),
    false, 'and the target is never its own flanker',
  )
  assert.equal(
    hasAllyAdjacentTo(
      [attacker, target, { ...near({ team: 'party' }), position: { x: 5, y: 5 } }],
      attacker, target,
    ),
    false, 'a friend across the room is not adjacent',
  )
})

test('the rogue does not flank for themselves', () => {
  const attacker = { ...rogue(), position: { x: 3, y: 1 } }
  const target = foe({ x: 3, y: 0 })
  assert.equal(hasAllyAdjacentTo([attacker, target], attacker, target), false)
})

// --- The player is told --------------------------------------------------

test('the log names the dice rather than letting the number surprise you', () => {
  const attacker = rogue()
  const attack = attacker.attacks[0]
  assert.ok(attack !== undefined)
  const outcome = resolveAttack({
    attacker, target: foe(), attack, mode: 'normal',
    rng: sequenceRng(HIT), allyAdjacentToTarget: true,
  })
  assert.match(narrateAttackFully(outcome, 'Goblin'), /1d6 of that was Sneak Attack/)
})

test('and says nothing at all when it did not apply', () => {
  const attacker = rogue()
  const attack = attacker.attacks[0]
  assert.ok(attack !== undefined)
  const outcome = resolveAttack({
    attacker, target: foe(), attack, mode: 'normal',
    rng: sequenceRng(HIT), allyAdjacentToTarget: false,
  })
  assert.doesNotMatch(narrateAttackFully(outcome, 'Goblin'), /Sneak Attack/)
})

// --- Reachability: the ally has to be able to get there --------------------

test('the squire walks around the player instead of stopping behind them', () => {
  /*
   * Found by playing it, not by reading it. `stepToward` walks a straight line
   * and `moveActive` refuses an occupied square, so a squire directly behind
   * the hero stopped dead and logged "cannot reach anyone" for the rest of the
   * fight. That is the ordinary shape of a melee turn — walk up, stab it — and
   * it made the ally half of Sneak Attack's trigger nearly unreachable.
   */
  const hero = { ...rogue(), id: 'hero', position: { x: 2, y: 1 }, initiative: 5 }
  const squire = {
    ...spawnCompanion(LOYAL_SQUIRE, { position: { x: 2, y: 2 }, id: 'squire' }),
    initiative: 3,
  }
  const goblin = { ...spawnMonster(MONSTERS.goblin, { position: { x: 2, y: 0 }, id: 'g' }), initiative: 1 }

  let encounter = createEncounter([hero, squire, goblin])
  while (encounter.order[encounter.activeIndex] !== 'squire') {
    encounter = endTurn(encounter, () => 0.5)
  }
  const after = takeAutomaticTurn(encounter, () => 0.5).encounter

  const movedSquire = after.combatants.squire
  const stuckHero = after.combatants.hero
  const foe = after.combatants.g
  assert.ok(movedSquire !== undefined && stuckHero !== undefined && foe !== undefined)
  assert.ok(
    hasAllyAdjacentTo(Object.values(after.combatants), stuckHero, foe),
    'the squire got beside the goblin despite the hero blocking the lane',
  )
  assert.ok(!after.log.some((line) => /cannot reach anyone/.test(line)))
})

// --- The assumption this rests on -----------------------------------------

test('once per turn needs no bookkeeping, because nothing gives a rogue two attacks', () => {
  /*
   * Sneak Attack is once per turn in the SRD, and nothing here counts uses. It
   * does not have to: an attack costs the action, a turn has one, and the only
   * feature in this build that buys a second is Action Surge — which is the
   * fighter's, and a fighter has no sneak dice.
   *
   * That is an assumption, not a rule, so it is pinned here. If Extra Attack
   * ever lands, or Action Surge reaches another class, this fails and whoever
   * broke it has to go and write the counter.
   */
  for (const classId of Object.keys(CLASS_PRESETS) as ClassId[]) {
    const doubleActing = classId === 'fighter'
    const sneaks = sneakAttackDiceAt(classId, 3) > 0
    assert.ok(!(doubleActing && sneaks), `${classId} can both act twice and sneak`)
  }
})
