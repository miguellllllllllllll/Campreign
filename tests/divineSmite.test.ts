import test from 'node:test'
import assert from 'node:assert/strict'
import { slotsAt } from '../src/lib/dnd/slots.ts'
import {
  SMITE_DICE,
  canSmite,
  narrateSmite,
  resolveSmite,
} from '../src/lib/dnd/divineSmite.ts'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { levelUp } from '../src/lib/dnd/leveling.ts'
import { SPELLS } from '../src/content/spells.ts'
import { attackWith, createEncounter } from '../src/lib/dnd/encounter.ts'
import { GOBLIN, SKELETON, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import { faceValue, sequenceRng } from './helpers/rng.ts'
import type { CreationAnswers } from '../src/types/character.ts'

const meta = { id: 'hero', now: 1_700_000_000_000 }

function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'paladin',
    raceId: 'human',
    backgroundId: 'noble',
    flawId: 'obeyed',
    equipmentChoice: 'offensive',
    auraId: 'amber',
    ...overrides,
  }
}

const paladin = (over: Partial<CreationAnswers> = {}) =>
  buildCharacter(answers(over), 'Oathkeeper', meta)

// --- the hole this fills --------------------------------------------------

test('a level-2 paladin has slots, and smite is what they are for', () => {
  /*
   * The bug that prompted this. Paladins gain spellcasting at 2nd level, so
   * levelling grants two slots — and the registry holds no paladin spells at
   * all, so they arrived with nothing to spend them on. Smite is the spend.
   */
  const grown = levelUp(paladin()).character
  assert.equal(slotsAt(grown.spellSlots, 1), 2)
  assert.equal(grown.preparedSpells, undefined, 'still no paladin spell list')
  assert.equal(canSmite(characterToCombatant(grown, { position: { x: 0, y: 0 } })), true)
})

test('a level-1 paladin has nothing to burn', () => {
  const fresh = characterToCombatant(paladin(), { position: { x: 0, y: 0 } })
  assert.equal(fresh.spellSlots, undefined)
  assert.equal(canSmite(fresh), false)
})

// --- the roll -------------------------------------------------------------

function smiter() {
  return characterToCombatant(levelUp(paladin()).character, {
    position: { x: 0, y: 0 },
    speedSquares: 3,
  })
}

test('it rolls 2d8 and spends exactly one slot', () => {
  const attacker = smiter()
  const result = resolveSmite({
    attacker,
    target: {},
    rng: sequenceRng([faceValue(5, 8), faceValue(6, 8)]),
  })
  assert.equal(result.damage, 11)
  assert.equal(result.againstUndead, false)
  assert.equal(slotsAt(result.attacker.spellSlots, 1), 1, 'two slots, one spent')
  assert.equal(slotsAt(attacker.spellSlots, 1), 2, 'nothing here mutates')
})

test('the undead take an extra die, and the log says why', () => {
  // There is a skeleton in the second encounter, which is the whole reason
  // this rider is worth having rather than being SRD trivia.
  const result = resolveSmite({
    attacker: smiter(),
    target: { undead: true },
    rng: sequenceRng([faceValue(5, 8), faceValue(6, 8), faceValue(4, 8)]),
  })
  assert.equal(result.damage, 15)
  assert.equal(result.againstUndead, true)
  assert.match(narrateSmite(result, 'Skeleton'), /undead/)
})

test('the skeleton is undead and nothing else is', () => {
  assert.equal(SKELETON.undead, true)
  assert.equal(GOBLIN.undead, undefined)
  assert.equal(spawnMonster(SKELETON, { id: 's', position: { x: 0, y: 0 } }).undead, true)
  assert.equal(spawnMonster(GOBLIN, { id: 'g', position: { x: 0, y: 0 } }).undead, undefined)
})

test('smiting with no slots left is not possible', () => {
  const dry = { ...smiter(), spellSlots: [0, 0] }
  assert.equal(canSmite(dry), false)
  // Floored rather than negative, if something calls it anyway.
  assert.equal(slotsAt(resolveSmite({ attacker: dry, target: {} }).attacker.spellSlots, 1), 0)
})

test('the die is the one the module declares', () => {
  assert.equal(SMITE_DICE, '2d8')
})

// --- on the board ---------------------------------------------------------

function board(foeUndead = false) {
  const hero = smiter()
  const preset = foeUndead ? SKELETON : GOBLIN
  const foe = {
    ...spawnMonster(preset, { id: 'foe', position: { x: 1, y: 0 } }),
    maxHp: 60,
    currentHp: 60,
  }
  return { hero, encounter: createEncounter([hero, foe], () => 0.99, { leadId: hero.id }) }
}

test('an armed smite adds its damage and burns the slot when the blow lands', () => {
  const { hero, encounter } = board()
  const swung = attackWith(encounter, {
    targetId: 'foe',
    attackId: hero.attacks[0]!.id,
    smite: true,
    rng: () => faceValue(18, 20),
  })

  assert.equal(swung.refusal, null)
  assert.ok(swung.smite !== undefined, 'the smite resolved')
  assert.equal(slotsAt(swung.encounter.combatants[hero.id]?.spellSlots, 1), 1)
  assert.ok(swung.encounter.log.some((line) => /Divine Smite/.test(line)))

  const foe = swung.encounter.combatants['foe']
  assert.ok(foe !== undefined)
  const dealt = 60 - foe.currentHp
  assert.ok(dealt > (swung.outcome?.kind === 'hit' ? swung.outcome.damage : 0),
    'the total is more than the weapon alone')
})

test('a missed swing costs no slot at all', () => {
  /*
   * The divergence worth stating: the SRD lets you decide after you know you
   * hit, so a miss never costs you. Armed up front, the engine has to give the
   * slot back by simply not taking it.
   */
  const { hero, encounter } = board()
  const missed = attackWith(encounter, {
    targetId: 'foe',
    attackId: hero.attacks[0]!.id,
    smite: true,
    rng: () => faceValue(1, 20),
  })
  assert.equal(missed.smite, undefined)
  assert.equal(slotsAt(missed.encounter.combatants[hero.id]?.spellSlots, 1), 2, 'nothing spent on a miss')
})

test('smiting a skeleton hits harder than smiting a goblin', () => {
  // Same dice, same roll — only the target differs.
  const rng = () => faceValue(5, 8)
  const living = attackWith(board(false).encounter, {
    targetId: 'foe', attackId: smiter().attacks[0]!.id, smite: true, rng,
  })
  const dead = attackWith(board(true).encounter, {
    targetId: 'foe', attackId: smiter().attacks[0]!.id, smite: true, rng,
  })
  assert.ok(living.smite !== undefined && dead.smite !== undefined)
  assert.ok(dead.smite.damage > living.smite.damage, 'the extra die shows up')
  assert.equal(dead.smite.againstUndead, true)
})

test('a hero with no slots swings normally rather than being refused', () => {
  const { hero, encounter } = board()
  const dry = {
    ...encounter,
    combatants: {
      ...encounter.combatants,
      [hero.id]: { ...encounter.combatants[hero.id]!, spellSlots: [0, 0] },
    },
  }
  const swung = attackWith(dry, {
    targetId: 'foe',
    attackId: hero.attacks[0]!.id,
    smite: true,
    rng: () => faceValue(18, 20),
  })
  assert.equal(swung.refusal, null, 'the attack still happens')
  assert.equal(swung.smite, undefined, 'there was just nothing to burn')
})

test('the level-up promises the paladin only what the build can give', () => {
  /*
   * It used to say "you gain spell slots and a list of prepared spells". The
   * slots are real; the list does not exist — there are zero paladin spells in
   * the registry. A level-up panel that names something the player will then go
   * looking for is the same broken promise as an inert button, in prose.
   */
  const gains = levelUp(paladin()).gains
  assert.ok(gains !== null)
  const spellcasting = gains.features.find((one) => one.id === 'paladinSpellcasting')
  assert.ok(spellcasting !== undefined)
  assert.doesNotMatch(spellcasting.description, /prepared spells/)
  assert.match(spellcasting.description, /Divine Smite/, 'it says what the slots are for')

  assert.equal(
    SPELLS.filter((spell) => spell.classes.includes('paladin' as never)).length,
    0,
    'if paladin spells ever land, this promise can be widened again',
  )
})
