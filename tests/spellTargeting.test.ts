import test from 'node:test'
import assert from 'node:assert/strict'
import { spellTargetsEnemies } from '../src/lib/dnd/casting.ts'
import { SPELLS } from '../src/content/spells.ts'
import type { SpellEffect } from '../src/content/spells.ts'

/**
 * Which way each kind of spell points.
 *
 * Exhaustive on purpose. `spellTargetsEnemies` derives direction from the
 * effect kind, and its own comment claimed that meant a new spell could not
 * forget to declare one — but `saveOrCondition` was added and the predicate was
 * not, so Blindness shipped aimed at the caster and the hero rolled a save
 * against their own spell. Derivation stops a spell forgetting to declare;
 * only this stops the predicate forgetting to ask.
 *
 * Adding an effect kind fails this test until somebody writes down where it
 * points, which is the entire intent.
 */
const DIRECTION: Record<SpellEffect['kind'], 'enemy' | 'friendly'> = {
  spellAttack: 'enemy',
  aoeSave: 'enemy',
  autoHit: 'enemy',
  saveOrCondition: 'enemy',
  heal: 'friendly',
  blessAllies: 'friendly',
  setAc: 'friendly',
  wardTarget: 'friendly',
  stabilise: 'friendly',
  guideCheck: 'friendly',
  reactionSpell: 'friendly',
}

test('every effect kind in the registry has a declared direction', () => {
  for (const spell of SPELLS) {
    if (spell.effect === undefined) continue
    assert.ok(
      spell.effect.kind in DIRECTION,
      `${spell.id} has effect kind "${spell.effect.kind}", which nothing has classified`,
    )
  }
})

test('a spell that makes its victim roll is aimed at the victim', () => {
  for (const spell of SPELLS) {
    if (spell.effect === undefined) continue
    const expected = DIRECTION[spell.effect.kind] === 'enemy'
    assert.equal(
      spellTargetsEnemies(spell.id),
      expected,
      `${spell.id} (${spell.effect.kind}) points the wrong way`,
    )
  }
})

test('Blindness specifically points at the enemy', () => {
  // The one that shipped wrong, named so the regression is unmistakable.
  assert.equal(spellTargetsEnemies('blindness'), true)
})
