import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { applyHealing } from '../src/lib/dnd/combat.ts'
import { createEncounter, endTurn } from '../src/lib/dnd/encounter.ts'
import {
  castSpell,
  castableSpells,
  spellTargetsDying,
  spellTargetsEnemies,
} from '../src/lib/dnd/casting.ts'
import { spawnCompanion, LOYAL_SQUIRE } from '../src/lib/dnd/data/companions.ts'
import { GOBLIN, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import {
  DEATH_SAVES_NEEDED,
  DEATH_SAVE_DC,
  clearDeathSaves,
  isDead,
  isDown,
  isDying,
  isStable,
  rollDeathSave,
  stabilise,
} from '../src/lib/dnd/dying.ts'
import type { Combatant } from '../src/types/combat.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'

const meta = { id: 'hero', now: 1_700_000_000_000 }

function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'cleric',
    raceId: 'human',
    backgroundId: 'noble',
    flawId: 'obeyed',
    equipmentChoice: 'defensive',
    auraId: 'amber',
    magicStyleId: 'healersMercy',
    ...overrides,
  }
}

function hero(id = 'hero'): Combatant {
  const built = buildCharacter(answers(), 'Mercy', { ...meta, id })
  return characterToCombatant(built, { position: { x: 0, y: 0 } })
}

/** Someone already at 0, mid-slip. */
function downed(overrides: Partial<Combatant> = {}): Combatant {
  return { ...hero('faller'), currentHp: 0, position: { x: 1, y: 0 }, ...overrides }
}

// --- who dies and who merely drops ---------------------------------------

test('a monster at 0 is dead, because it never had saves to roll', () => {
  const goblin = { ...spawnGoblin(), currentHp: 0 }
  assert.equal(goblin.deathSaves, undefined, 'nothing to track')
  assert.ok(isDown(goblin))
  assert.ok(isDead(goblin))
  assert.equal(isDying(goblin), false, 'a goblin does not linger')
})

test('a hero at 0 is dying, not dead', () => {
  const faller = downed()
  assert.ok(isDown(faller))
  assert.ok(isDying(faller))
  assert.equal(isDead(faller), false)
  assert.equal(isStable(faller), false)
})

test('the squire goes down the same way the player does', () => {
  const squire = spawnCompanion(LOYAL_SQUIRE, { position: { x: 2, y: 2 } })
  assert.deepEqual(squire.deathSaves, { successes: 0, failures: 0 })
  assert.ok(isDying({ ...squire, currentHp: 0 }))
})

test('standing combatants are neither down nor dead however the saves read', () => {
  // Guards the ordering inside the predicates: a hero who was dropped, saved
  // twice and then healed must not read as dying because of the leftovers.
  const up = { ...hero(), deathSaves: { successes: 2, failures: 2 } }
  assert.equal(isDown(up), false)
  assert.equal(isDying(up), false)
  assert.equal(isDead(up), false)
  assert.equal(isStable(up), false)
})

// --- the roll itself -------------------------------------------------------

test('10 or better succeeds and 9 or worse fails, with nothing added either way', () => {
  const faller = downed()
  const pass = rollDeathSave({ combatant: faller, rng: () => faceValue(DEATH_SAVE_DC, 20) })
  assert.equal(pass.outcome, 'success')
  assert.deepEqual(pass.combatant.deathSaves, { successes: 1, failures: 0 })

  const fail = rollDeathSave({ combatant: faller, rng: () => faceValue(DEATH_SAVE_DC - 1, 20) })
  assert.equal(fail.outcome, 'failure')
  assert.deepEqual(fail.combatant.deathSaves, { successes: 0, failures: 1 })
})

test('a natural 1 costs two failures at once', () => {
  const result = rollDeathSave({ combatant: downed(), rng: () => faceValue(1, 20) })
  assert.equal(result.natural, 1)
  assert.deepEqual(result.combatant.deathSaves, { successes: 0, failures: 2 })
  assert.equal(result.outcome, 'failure', 'two of three is bad, not fatal')
  assert.ok(isDying(result.combatant))
})

test('a natural 1 on the second failure is fatal', () => {
  const faller = downed({ deathSaves: { successes: 0, failures: 1 } })
  const result = rollDeathSave({ combatant: faller, rng: () => faceValue(1, 20) })
  assert.equal(result.outcome, 'died')
  assert.ok(isDead(result.combatant))
})

test('a natural 20 puts them back on their feet at one hit point', () => {
  const faller = downed({ deathSaves: { successes: 0, failures: 2 } })
  const result = rollDeathSave({ combatant: faller, rng: () => faceValue(20, 20) })
  assert.equal(result.outcome, 'revived')
  assert.equal(result.combatant.currentHp, 1)
  assert.deepEqual(
    result.combatant.deathSaves,
    { successes: 0, failures: 0 },
    'the two failures do not follow them back up',
  )
  assert.equal(isDown(result.combatant), false)
})

test('three successes stabilise; three failures kill', () => {
  let living = downed()
  for (let i = 0; i < DEATH_SAVES_NEEDED; i += 1) {
    living = rollDeathSave({ combatant: living, rng: () => faceValue(15, 20) }).combatant
  }
  assert.ok(isStable(living))
  assert.equal(isDying(living), false, 'stable creatures stop rolling')
  assert.equal(isDead(living), false)
  assert.equal(living.currentHp, 0, 'stable is not healed')

  let dying = downed()
  for (let i = 0; i < DEATH_SAVES_NEEDED; i += 1) {
    dying = rollDeathSave({ combatant: dying, rng: () => faceValue(5, 20) }).combatant
  }
  assert.ok(isDead(dying))
  assert.equal(isDying(dying), false)
})

// --- coming back ----------------------------------------------------------

test('healing above 0 wipes the count, so the next fall starts clean', () => {
  const faller = downed({ deathSaves: { successes: 0, failures: 2 } })
  const healed = applyHealing(faller, 4)
  assert.equal(healed.currentHp, 4)
  assert.deepEqual(healed.deathSaves, { successes: 0, failures: 0 })
})

test('healing a monster does not invent saves it never had', () => {
  const goblin = { ...spawnGoblin(), currentHp: 1 }
  assert.equal(applyHealing(goblin, 3).deathSaves, undefined)
  assert.equal(clearDeathSaves(goblin).deathSaves, undefined)
})

test('healing that restores nothing leaves a dying creature dying', () => {
  const faller = downed({ deathSaves: { successes: 0, failures: 1 } })
  const nudged = applyHealing(faller, 0)
  assert.ok(isDying(nudged))
  assert.deepEqual(nudged.deathSaves, { successes: 0, failures: 1 }, 'no free reset')
})

// --- Spare the Dying ------------------------------------------------------

test('Spare the Dying stops the rolling without restoring a hit point', () => {
  const caster = hero()
  const faller = downed({ deathSaves: { successes: 0, failures: 2 } })

  const result = castSpell({ caster, target: faller, spellId: 'spareTheDying' })
  assert.equal(result.refusal, null)
  assert.equal(result.target.currentHp, 0, 'it is not healing')
  assert.ok(isStable(result.target))
  assert.equal(isDying(result.target), false)
  assert.deepEqual(result.caster.spellSlots, caster.spellSlots, 'a cantrip costs nothing')
})

test('Spare the Dying is refused on somebody still standing', () => {
  const caster = hero()
  const upright = { ...hero('other'), position: { x: 1, y: 0 } }
  const result = castSpell({ caster, target: upright, spellId: 'spareTheDying' })
  assert.match(result.refusal ?? '', /still on their feet/)
})

test('Spare the Dying is refused on somebody already stable', () => {
  const result = castSpell({
    caster: hero(),
    target: stabilise(downed()),
    spellId: 'spareTheDying',
  })
  assert.match(result.refusal ?? '', /already stopped slipping/)
})

test('Spare the Dying needs a hand on them', () => {
  const result = castSpell({
    caster: hero(),
    target: downed({ position: { x: 4, y: 4 } }),
    spellId: 'spareTheDying',
  })
  assert.match(result.refusal ?? '', /out of reach/)
})

test('it cannot bring anyone back once they are gone', () => {
  const gone = downed({ deathSaves: { successes: 0, failures: DEATH_SAVES_NEEDED } })
  const result = castSpell({ caster: hero(), target: gone, spellId: 'spareTheDying' })
  assert.match(result.refusal ?? '', /too late/)
  assert.ok(isDead(result.target))
})

// --- the turn hook --------------------------------------------------------

test('the save is rolled when the turn order reaches them', () => {
  const player = hero()
  const faller = downed()
  const goblin = spawnGoblin({ x: 4, y: 4 })
  const base = createEncounter([player, faller, goblin], () => 0.5)

  // Park the pointer just before the dying hero so one endTurn walks onto them.
  const before = base.order.indexOf(faller.id) - 1
  const started = { ...base, activeIndex: before < 0 ? base.order.length - 1 : before }
  const after = endTurn(started, () => faceValue(15, 20))

  assert.deepEqual(after.combatants[faller.id]?.deathSaves, { successes: 1, failures: 0 })
  assert.ok(after.log.some((line) => /holds on/.test(line)))
  assert.notEqual(
    after.order[after.activeIndex],
    faller.id,
    'succeeding does not hand them a turn',
  )
})

test('rolling a 20 on your own turn means you get to take it', () => {
  const player = hero()
  const faller = downed()
  const goblin = spawnGoblin({ x: 4, y: 4 })
  const base = createEncounter([player, faller, goblin], () => 0.5)
  const before = base.order.indexOf(faller.id) - 1
  const started = { ...base, activeIndex: before < 0 ? base.order.length - 1 : before }

  const after = endTurn(started, () => faceValue(20, 20))
  const revived = after.combatants[faller.id]
  assert.equal(revived?.currentHp, 1)
  assert.equal(after.order[after.activeIndex], faller.id, 'up, and it is their go')
  assert.equal(after.movementRemaining, revived?.speedSquares)
  assert.ok(after.log.some((line) => /opens their eyes/.test(line)))
})

test('a stable creature is passed over without rolling again', () => {
  const player = hero()
  const faller = stabilise(downed())
  const goblin = spawnGoblin({ x: 4, y: 4 })
  const base = createEncounter([player, faller, goblin], () => 0.5)
  const before = base.order.indexOf(faller.id) - 1
  const started = { ...base, activeIndex: before < 0 ? base.order.length - 1 : before }

  const after = endTurn(started, () => {
    throw new Error('a stable creature must not roll')
  })
  assert.deepEqual(after.combatants[faller.id]?.deathSaves, faller.deathSaves)
})

test('a decided fight rolls no more saves', () => {
  /*
   * The whole party is down, so the encounter is already lost. Making the
   * player watch three failures confirm it would add nothing but the wait.
   */
  const player = { ...hero(), currentHp: 0 }
  const goblin = spawnGoblin({ x: 4, y: 4 })
  const base = createEncounter([player, goblin], () => 0.5)
  const after = endTurn(base, () => {
    throw new Error('the fight is over')
  })
  assert.deepEqual(after.combatants[player.id]?.deathSaves, { successes: 0, failures: 0 })
})

test('three turns of bad luck kill a downed hero for good', () => {
  const player = hero()
  const faller = downed()
  const goblin = spawnGoblin({ x: 4, y: 4 })
  let encounter = createEncounter([player, faller, goblin], () => 0.5)
  const rng = sequenceRng(Array(12).fill(faceValue(4, 20)))

  for (let lap = 0; lap < encounter.order.length * DEATH_SAVES_NEEDED; lap += 1) {
    encounter = endTurn(encounter, rng)
  }

  const gone = encounter.combatants[faller.id]
  assert.ok(gone !== undefined)
  assert.ok(isDead(gone), 'three failures and they do not get up again')
  assert.ok(encounter.log.some((line) => /does not get up again/.test(line)))
})

function spawnGoblin(position = { x: 3, y: 3 }): Combatant {
  return spawnMonster(GOBLIN, { position, id: 'goblin' })
}

// --- reaching the button --------------------------------------------------

test('a utility cantrip is offered at all, which it never used to be', () => {
  /*
   * The reason Spare the Dying was dead code for so long: only cantrips
   * carrying an `attack` became buttons, and this one has nothing to aim.
   */
  const caster = hero()
  assert.ok(caster.cantrips?.includes('spareTheDying'), 'the loadout grants it')

  const offered = castableSpells(caster, [caster, downed()])
  assert.ok(
    offered.some((one) => one.spell.id === 'spareTheDying'),
    'it reaches the action bar',
  )
})

test('it greys out with a reason when nobody is down', () => {
  const caster = hero()
  const found = castableSpells(caster, [caster, { ...hero('upright'), currentHp: 9 }]).find(
    (one) => one.spell.id === 'spareTheDying',
  )
  assert.equal(found?.castable, false)
  assert.match(found?.reason ?? '', /Nobody is down/)
})

test('an enemy bleeding out is not your problem', () => {
  // Scoped to your own side, so a dying foe does not light up the button.
  const caster = hero()
  const dyingFoe = { ...downed(), team: 'foes' as const, deathSaves: { successes: 0, failures: 0 } }
  const found = castableSpells(caster, [caster, dyingFoe]).find(
    (one) => one.spell.id === 'spareTheDying',
  )
  assert.equal(found?.castable, false)
})

test('a cantrip stays castable with every slot spent', () => {
  const caster = { ...hero(), spellSlots: [0, 0] }
  const offered = castableSpells(caster, [caster, downed()])
  const cantrip = offered.find((one) => one.spell.id === 'spareTheDying')
  const levelled = offered.find((one) => one.spell.level >= 1)

  assert.equal(cantrip?.castable, true, 'cantrips do not run out')
  assert.equal(levelled?.castable, false)
  assert.match(levelled?.reason ?? '', /No spell slots/)
})

test('damage cantrips are not printed twice', () => {
  // Sacred Flame is already a weapon in `attacks`; it must not also be a spell.
  const caster = buildCharacter(
    answers({ magicStyleId: 'radiantWrath' }),
    'Burner',
    { ...meta, id: 'burner' },
  )
  const combatant = characterToCombatant(caster, { position: { x: 0, y: 0 } })
  assert.ok(combatant.cantrips?.includes('sacredFlame'))
  assert.ok(combatant.attacks.some((a) => a.id.toLowerCase().includes('sacredflame')))
  assert.equal(
    castableSpells(combatant, [combatant]).filter((one) => one.spell.id === 'sacredFlame').length,
    0,
    'it is a weapon here, not a spell button',
  )
})

test('the registry, not a hard-coded id, says what aims at the dying', () => {
  assert.equal(spellTargetsDying('spareTheDying'), true)
  assert.equal(spellTargetsDying('cureWounds'), false)
  assert.equal(spellTargetsEnemies('spareTheDying'), false, 'it lands on your own side')
})
