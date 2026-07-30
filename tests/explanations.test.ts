import test from 'node:test'
import assert from 'node:assert/strict'
import { EXPLANATIONS, explain, type ExplainKey } from '../src/lib/dnd/explanations.ts'
import { ABILITY_NAMES } from '../src/lib/dnd/stats.ts'

test('every explanation has a title and a usable plain-English sentence', () => {
  const entries = Object.entries(EXPLANATIONS)
  assert.ok(entries.length > 20, 'the registry should cover the whole first-level vocabulary')

  for (const [key, value] of entries) {
    assert.ok(value.title.length > 0, `${key} has no title`)
    assert.ok(value.plain.length > 30, `${key} needs a real explanation, not a stub`)
    assert.match(value.plain, /[.!]$/, `${key} should read as a finished sentence`)
    assert.doesNotMatch(value.plain, /TODO|FIXME/i, `${key} still has a placeholder`)
  }
})

test('every ability score is explainable, so a stat block can annotate itself', () => {
  for (const ability of ABILITY_NAMES) {
    assert.ok(ability in EXPLANATIONS, `no explanation for ${ability}`)
  }
})

test('explain returns the same entry as a direct lookup', () => {
  const key: ExplainKey = 'ac'
  assert.equal(explain(key), EXPLANATIONS[key])
  assert.match(explain('ac').plain, /hard you are to hit/)
})
