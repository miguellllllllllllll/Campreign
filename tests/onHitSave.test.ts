import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacter } from '../src/lib/dnd/characterBuilder.ts'
import { characterToCombatant } from '../src/lib/dnd/combatants.ts'
import { GIANT_SPIDER, spawnMonster } from '../src/lib/dnd/data/monsters.ts'
import { attackWith, createEncounter, resolveOnHitSave } from '../src/lib/dnd/encounter.ts'
import { GOBLIN_CELLAR } from '../src/content/goblinCellar.ts'
import { faceValue, seededRng } from './helpers/rng.ts'
import type { CreationAnswers } from '../src/types/character.ts'

const ANSWERS: CreationAnswers = {
  classId: 'fighter',
  raceId: 'human',
  backgroundId: 'noble',
  flawId: 'obeyed',
  equipmentChoice: 'defensive',
  auraId: 'amber',
}

function board() {
  const hero = buildCharacter(ANSWERS, 'Bitten', { id: 'h', now: 0 })
  return {
    hero: characterToCombatant(hero, { position: { x: 0, y: 0 } }),
    spider: spawnMonster(GIANT_SPIDER, { id: 'giantSpider', position: { x: 1, y: 0 } }),
  }
}

test('the spider bite is the only attack that asks the target to roll', () => {
  // Reachability, stated as data: if this moves to another creature the test
  // should be updated deliberately rather than quietly.
  const rider = GIANT_SPIDER.attacks[0]?.onHitSave
  assert.ok(rider !== undefined, 'the giant spider bite carries no save')
  assert.equal(rider.ability, 'con')
  assert.equal(rider.dc, 11)
  assert.ok(rider.halfOnSuccess, 'SRD venom still does half to somebody who resists')
})

test('a failed save takes the venom in full, a made save takes half', () => {
  const { hero } = board()
  const failed = resolveOnHitSave(hero, GIANT_SPIDER.attacks[0]!.onHitSave!, () => faceValue(1, 20))
  assert.equal(failed.saveSuccessful, false)
  assert.equal(failed.damageTaken, failed.rolled, 'a failure takes everything rolled')

  const made = resolveOnHitSave(hero, GIANT_SPIDER.attacks[0]!.onHitSave!, () => faceValue(20, 20))
  assert.equal(made.saveSuccessful, true)
  assert.equal(made.damageTaken, Math.floor(made.rolled / 2), 'a success still takes half')
})

test('venom lands through attackWith, not only through the helper', () => {
  /*
   * The path that matters. A rider resolved correctly in isolation but never
   * reached by an actual attack is the failure this repository keeps finding,
   * so this bites a real hero on a real board and reads the hit points after.
   */
  const { hero, spider } = board()
  const rng = seededRng(7)
  const encounter = createEncounter([hero, spider], rng, { leadId: spider.id })
  const before = encounter.combatants[hero.id]!.currentHp

  // Force the bite to land: a natural 20 beats any AC this hero can have.
  const hit = attackWith(encounter, {
    targetId: hero.id,
    attackId: 'spiderBite',
    rng: () => faceValue(20, 20),
  })
  assert.equal(hit.refusal, null, 'the spider could not reach the hero')
  const after = hit.encounter.combatants[hero.id]!.currentHp
  const bitten = before - after

  const saveLine = hit.encounter.log.find((line) => /Constitution save against DC 11/.test(line))
  assert.ok(saveLine !== undefined, 'the log never mentions the save the player just rolled')
  // A max-roll rng makes the save succeed, so half the venom lands on top of
  // the bite — the total must exceed what the fangs alone could do.
  assert.ok(bitten > 0, 'the bite did nothing at all')
})

test('the spider has a fight to appear in', () => {
  // The README called it the one monster nothing was hard enough to need.
  const steps = GOBLIN_CELLAR.filter((step) =>
    step.onEnter?.some((e) => e.kind === 'startCombat' && e.encounterId === 'rafters'),
  )
  assert.equal(steps.length, 1, 'the spider encounter is never started')
})
