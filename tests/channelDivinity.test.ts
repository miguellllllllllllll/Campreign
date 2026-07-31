import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { attackBonusFor, resolveAttack } from '../src/lib/dnd/combat.ts'
import { channelDivinity, createEncounter } from '../src/lib/dnd/encounter.ts'
import {
  CHANNEL_DIVINITY_CHARGES_AT_LEVEL_1,
  canChannelDivinity,
  hasVowAgainst,
  sacredWeaponBonus,
  spendChannelDivinity,
} from '../src/lib/dnd/channelDivinity.ts'
import { channelDivinityFor, channelDivinityPowerFor } from '../src/content/subclasses.ts'
import type { CreationAnswers } from '../src/types/character.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'

const meta = { id: 'pal', now: 1_700_000_000_000 }

function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'paladin',
    raceId: 'human',
    backgroundId: 'noble',
    flawId: 'obeyed',
    equipmentChoice: 'defensive',
    auraId: 'amber',
    ...overrides,
  }
}

function paladin(subclassId: string) {
  return buildCharacter(answers({ subclassId }), 'Oathkeeper', meta)
}

function foe() {
  return buildCharacter(
    { ...answers({ classId: 'fighter' }), backgroundId: 'guildArtisan', flawId: 'haggler' },
    'Goblin',
    { ...meta, id: 'foe' },
  )
}

function fight(heroSubclass: string) {
  const hero = paladin(heroSubclass)
  const enemy = foe()
  const base = createEncounter(
    [
      characterToCombatant(hero, { position: { x: 0, y: 0 } }),
      characterToCombatant(enemy, { position: { x: 1, y: 0 }, team: 'foes' }),
    ],
    () => 0.99,
  )
  /*
   * createEncounter rolls its own initiative, so the turn order is not the
   * array order and an `initiative` passed in is overwritten. Every test here
   * is about what the paladin can do on their own turn, so point the index at
   * them rather than fighting the dice for it.
   */
  const activeIndex = base.order.indexOf(hero.id)
  assert.ok(activeIndex >= 0, 'the hero should be in the turn order')
  return { hero, enemy, encounter: { ...base, activeIndex } }
}

// --- The resource ---------------------------------------------------------

test('both oaths grant a charge and nobody else does', () => {
  assert.equal(channelDivinityFor('devotion'), CHANNEL_DIVINITY_CHARGES_AT_LEVEL_1)
  assert.equal(channelDivinityFor('vengeance'), CHANNEL_DIVINITY_CHARGES_AT_LEVEL_1)
  assert.equal(channelDivinityFor('champion'), undefined)
  assert.equal(channelDivinityFor('battlemaster'), undefined)
  assert.equal(channelDivinityFor(undefined), undefined)
})

test('each oath spends its charge on its own power', () => {
  assert.equal(channelDivinityPowerFor('devotion'), 'sacredWeapon')
  assert.equal(channelDivinityPowerFor('vengeance'), 'vowOfEnmity')
  assert.equal(channelDivinityPowerFor('champion'), undefined)
  assert.equal(channelDivinityPowerFor('no-such-subclass'), undefined)
})

test('the charge reaches the sheet and the board', () => {
  const hero = paladin('devotion')
  assert.equal(hero.channelDivinityCharges, 1)
  const combatant = characterToCombatant(hero, { position: { x: 0, y: 0 } })
  assert.equal(combatant.channelDivinityCharges, 1)
  assert.equal(combatant.channelDivinityMax, 1)
})

test('a paladin without an oath carries no charge at all', () => {
  const plain = buildCharacter(answers(), 'A', meta)
  assert.equal('channelDivinityCharges' in plain, false)
})

test('spending is only possible while a charge remains', () => {
  assert.equal(canChannelDivinity({ channelDivinityCharges: 1 }), true)
  assert.equal(canChannelDivinity({ channelDivinityCharges: 0 }), false)
  assert.equal(canChannelDivinity({}), false)
})

test('spending decrements and never goes below zero', () => {
  assert.equal(spendChannelDivinity({ channelDivinityCharges: 1 }, 'sacredWeapon').chargesRemaining, 0)
  assert.equal(spendChannelDivinity({ channelDivinityCharges: 0 }, 'sacredWeapon').chargesRemaining, 0)
})

// --- Sacred Weapon --------------------------------------------------------

test('Sacred Weapon is worth Charisma, floored at +1', () => {
  // The floor is the SRD's and it matters: a Strength paladin can have a
  // Charisma modifier of 0, and a charge that bought nothing reads as a bug.
  assert.equal(sacredWeaponBonus({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 }), 4)
  assert.equal(sacredWeaponBonus({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }), 1)
  assert.equal(sacredWeaponBonus({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 6 }), 1)
})

test('activating Sacred Weapon raises every attack bonus by exactly that much', () => {
  const { hero, encounter } = fight('devotion')
  const attack = hero.attacks[0]
  assert.ok(attack !== undefined)

  const before = attackBonusFor(encounter.combatants[hero.id]!, attack)
  const result = channelDivinity(encounter, { power: 'sacredWeapon' })
  assert.equal(result.refusal, null)

  const after = attackBonusFor(result.encounter.combatants[hero.id]!, attack)
  assert.equal(after - before, sacredWeaponBonus(hero.scores))
})

test('the bonus is named in the breakdown rather than folded in silently', () => {
  const { hero, enemy, encounter } = fight('devotion')
  const attack = hero.attacks[0]
  assert.ok(attack !== undefined)
  const lit = channelDivinity(encounter, { power: 'sacredWeapon' }).encounter

  const outcome = resolveAttack({
    attacker: lit.combatants[hero.id]!,
    target: lit.combatants[enemy.id]!,
    attack,
    rng: () => faceValue(10, 20),
  })
  const labels = outcome.breakdown.parts.map((part) => part.label)
  assert.ok(labels.includes('Sacred Weapon'), `expected a named part, got ${labels.join(', ')}`)
})

test('a charge cannot be spent twice', () => {
  const { encounter } = fight('devotion')
  const once = channelDivinity(encounter, { power: 'sacredWeapon' })
  const twice = channelDivinity(once.encounter, { power: 'sacredWeapon' })
  assert.match(twice.refusal ?? '', /already/i)
  assert.equal(twice.encounter, once.encounter, 'a refusal must not change the board')
})

// --- Vow of Enmity --------------------------------------------------------

test('a vow only applies to the foe it was sworn against', () => {
  const { hero, enemy, encounter } = fight('vengeance')
  const sworn = channelDivinity(encounter, {
    power: 'vowOfEnmity',
    targetId: enemy.id,
  }).encounter

  const attacker = sworn.combatants[hero.id]!
  assert.equal(hasVowAgainst(attacker, enemy.id), true)
  assert.equal(hasVowAgainst(attacker, 'somebody-else'), false)
})

test('a vow grants advantage on the attack roll', () => {
  const { hero, enemy, encounter } = fight('vengeance')
  const attack = hero.attacks[0]
  assert.ok(attack !== undefined)
  const sworn = channelDivinity(encounter, { power: 'vowOfEnmity', targetId: enemy.id }).encounter

  // Advantage rolls twice and keeps the higher; a low value first proves the
  // second die was rolled at all.
  const rng = sequenceRng([faceValue(3, 20), faceValue(19, 20), faceValue(4, 8)])
  const outcome = resolveAttack({
    attacker: sworn.combatants[hero.id]!,
    target: sworn.combatants[enemy.id]!,
    attack,
    rng,
  })
  assert.equal(outcome.attackRoll.mode, 'advantage')
  assert.equal(outcome.breakdown.natural, 19)
})

test('a vow adds no flat bonus — advantage is the whole of it', () => {
  const { hero, enemy, encounter } = fight('vengeance')
  const attack = hero.attacks[0]
  assert.ok(attack !== undefined)
  const before = attackBonusFor(encounter.combatants[hero.id]!, attack)
  const sworn = channelDivinity(encounter, { power: 'vowOfEnmity', targetId: enemy.id }).encounter
  assert.equal(attackBonusFor(sworn.combatants[hero.id]!, attack), before)
})

test('swearing at nobody is refused', () => {
  const { encounter } = fight('vengeance')
  const nobody = channelDivinity(encounter, { power: 'vowOfEnmity' })
  assert.match(nobody.refusal ?? '', /somebody/i)

  const ghost = channelDivinity(encounter, { power: 'vowOfEnmity', targetId: 'nope' })
  assert.match(ghost.refusal ?? '', /somebody/i)
})

// --- Everyone else --------------------------------------------------------

test('an attack by anyone without an oath is bit-for-bit unchanged', () => {
  const hero = buildCharacter(
    {
      classId: 'fighter',
      raceId: 'human',
      backgroundId: 'guildArtisan',
      flawId: 'haggler',
      equipmentChoice: 'defensive',
      auraId: 'amber',
    },
    'A',
    meta,
  )
  const enemy = foe()
  const attack = hero.attacks[0]
  assert.ok(attack !== undefined)

  const attacker = characterToCombatant(hero, { position: { x: 0, y: 0 } })
  const target = characterToCombatant(enemy, { position: { x: 1, y: 0 }, team: 'foes' })

  const outcome = resolveAttack({
    attacker,
    target,
    attack,
    rng: sequenceRng([faceValue(12, 20), faceValue(5, 8)]),
  })
  assert.equal(outcome.attackRoll.mode, 'normal')
  assert.equal(
    outcome.breakdown.parts.some((part) => part.label === 'Sacred Weapon'),
    false,
  )
})

test('an oath lasts the encounter rather than a turn', () => {
  // Deliberate divergence: the SRD says one minute, which is longer than any
  // fight in this build, so it is modelled as "the rest of this one".
  const { hero, encounter } = fight('devotion')
  const lit = channelDivinity(encounter, { power: 'sacredWeapon' }).encounter
  assert.equal(lit.combatants[hero.id]?.activeChannelDivinity?.type, 'sacredWeapon')
  assert.equal(lit.combatants[hero.id]?.channelDivinityCharges, 0)
})

test('calling on the oath is written into the log', () => {
  const { encounter } = fight('devotion')
  const lit = channelDivinity(encounter, { power: 'sacredWeapon' })
  assert.match(lit.encounter.log.at(-1) ?? '', /oath/i)
})
