import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { GOBLIN, MONSTERS, TRAINING_DUMMY, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import { LOYAL_SQUIRE, spawnCompanion } from '../src/lib/dnd/data/companions.ts'
import { CLASS_PRESETS } from '../src/lib/dnd/presets.ts'
import type { TokenId } from '../src/types/combat.ts'
import type { ClassId, CreationAnswers } from '../src/types/character.ts'

/**
 * Every creature on the board has a shape to be drawn as.
 *
 * The art side is already exhaustive at compile time — creature-icons declares
 * `Record<TokenId, ReactNode>`, so widening the union without drawing the new
 * silhouette will not build. These cover the half a type cannot: that the data
 * actually resolves to one of those keys, and that nothing reaches the grid
 * carrying a token nobody can render.
 *
 * The list below is deliberately written out rather than derived. A union has
 * no runtime form, so if these two ever disagree the test is the thing that
 * says so — which is the entire point of pinning it.
 */
const EVERY_TOKEN: readonly TokenId[] = [
  'fighter',
  'wizard',
  'rogue',
  'cleric',
  'paladin',
  'goblin',
  'dummy',
  'squire',
]

const CLASS_IDS: readonly ClassId[] = ['fighter', 'wizard', 'rogue', 'cleric', 'paladin']

function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'fighter',
    raceId: 'human',
    backgroundId: 'guildArtisan',
    flawId: 'haggler',
    equipmentChoice: 'defensive',
    auraId: 'amber',
    ...overrides,
  }
}

const meta = { id: 'tok', now: 1_700_000_000_000 }

// --- The union and the classes agree --------------------------------------

test('every class is a token in its own right', () => {
  // TokenId is `ClassId | 'goblin' | 'dummy' | 'squire'`, so a new class widens
  // it for free — but only if CLASS_PRESETS and the union stay in step.
  for (const id of Object.keys(CLASS_PRESETS) as ClassId[]) {
    assert.ok(EVERY_TOKEN.includes(id), `${id} has no silhouette`)
  }
  assert.equal(Object.keys(CLASS_PRESETS).length, CLASS_IDS.length, 'a class was added')
})

test('the token list has no duplicates and nothing spare', () => {
  assert.equal(new Set(EVERY_TOKEN).size, EVERY_TOKEN.length)
  // Five classes plus the three creatures that are not one.
  assert.equal(EVERY_TOKEN.length, CLASS_IDS.length + 3)
})

// --- Presets resolve ------------------------------------------------------

test('every monster preset carries a token that can be drawn', () => {
  const presets = [GOBLIN, TRAINING_DUMMY, ...Object.values(MONSTERS)]
  assert.ok(presets.length > 0)
  for (const preset of presets) {
    assert.ok(
      EVERY_TOKEN.includes(preset.tokenId),
      `${preset.id} asks for a token nobody has drawn: ${preset.tokenId}`,
    )
  }
})

test('the companion preset carries one too', () => {
  assert.ok(EVERY_TOKEN.includes(LOYAL_SQUIRE.tokenId))
  assert.equal(LOYAL_SQUIRE.tokenId, 'squire')
})

test('spawning carries the token onto the board rather than dropping it', () => {
  const goblin = spawnMonster(GOBLIN, { id: 'g', position: { x: 0, y: 0 } })
  assert.equal(goblin.tokenId, GOBLIN.tokenId)

  const squire = spawnCompanion(LOYAL_SQUIRE, { position: { x: 1, y: 0 } })
  assert.equal(squire.tokenId, LOYAL_SQUIRE.tokenId)
})

// --- Characters -----------------------------------------------------------

test('a hero of any class reaches the grid with a drawable token', () => {
  for (const classId of CLASS_IDS) {
    const hero = buildCharacter(answers({ classId }), 'A', meta)
    const combatant = characterToCombatant(hero, { position: { x: 0, y: 0 } })

    assert.equal(combatant.tokenId, classId, `${classId} should stand as itself`)
    assert.ok(EVERY_TOKEN.includes(combatant.tokenId as TokenId))
  }
})

test('a character saved before tokens existed still gets one', () => {
  /*
   * The returning-player path, and the reason this is worth a test at all.
   * tokenId is derived from classId inside characterToCombatant rather than
   * stored on the Character, so a hero sitting in localStorage from before the
   * field existed rehydrates without it and still reaches the board drawable.
   * If it ever becomes a stored field, this test should fail and force a
   * migration rather than a blank square.
   */
  const hero = buildCharacter(answers({ classId: 'cleric' }), 'Old Save', meta)
  assert.equal('tokenId' in hero, false, 'tokenId must stay derived, not persisted')

  const legacy = { ...hero } as typeof hero & { tokenId?: unknown }
  delete legacy.tokenId

  const combatant = characterToCombatant(legacy, { position: { x: 0, y: 0 } })
  assert.equal(combatant.tokenId, 'cleric')
  assert.ok(EVERY_TOKEN.includes(combatant.tokenId as TokenId))
})

test('nothing that reaches the board is missing a token', () => {
  // The whole invariant in one place: everything spawnable, spawned.
  const onBoard = [
    characterToCombatant(buildCharacter(answers(), 'A', meta), { position: { x: 0, y: 0 } }),
    spawnCompanion(LOYAL_SQUIRE, { position: { x: 1, y: 0 } }),
    spawnMonster(GOBLIN, { id: 'g', position: { x: 2, y: 0 } }),
    spawnMonster(TRAINING_DUMMY, { id: 'd', position: { x: 3, y: 0 } }),
  ]

  for (const combatant of onBoard) {
    assert.notEqual(combatant.tokenId, undefined, `${combatant.name} would render blank`)
    assert.ok(
      EVERY_TOKEN.includes(combatant.tokenId as TokenId),
      `${combatant.name} carries an unknown token`,
    )
  }
})
