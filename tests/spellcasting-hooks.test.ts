import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSpellCastHook,
  applyDamageWithWard,
  type SpellCastEvent,
  type SubclassFeatureCarrier,
} from '../src/lib/dnd/spellcasting.ts';

// ============================================================================
// TEST HELPERS: MOCK CARRIERS
// ============================================================================

const createClericCarrier = (features: string[] = ['life_domain_disciple_of_life']): SubclassFeatureCarrier => ({
  level: 1,
  intMod: 0,
  hasFeature: (id) => features.includes(id),
});

const createWizardCarrier = (
  features: string[] = ['abjuration_arcane_ward'],
  intMod = 3,
  currentWardHp?: number
): SubclassFeatureCarrier => ({
  level: 1,
  intMod,
  currentWardHp,
  hasFeature: (id) => features.includes(id),
});

// ============================================================================
// 1. CANTRIP REJECTION (SRD RULE 0: LEVEL 0 SPELLS NEVER TRIGGER WARD OR LIFE)
// ============================================================================

test('resolveSpellCastHook: cantrips (level 0) never trigger Disciple of Life', () => {
  const event: SpellCastEvent = {
    casterId: 'cleric_1',
    targetId: 'ally_1',
    spellId: 'spare_the_dying',
    school: 'necromancy',
    level: 0,
    isHealing: true,
    baseAmount: 4,
  };

  const outcome = resolveSpellCastHook(event, createClericCarrier());

  assert.strictEqual(outcome.finalAmount, 4, 'cantrip healing should remain unmodified');
  assert.deepEqual(outcome.triggeredFeatures, [], 'no features should fire on level 0 spells');
});

test('resolveSpellCastHook: cantrips (level 0) never trigger Arcane Ward', () => {
  const event: SpellCastEvent = {
    casterId: 'wizard_1',
    targetId: 'wizard_1',
    spellId: 'blade_ward',
    school: 'abjuration',
    level: 0,
    isHealing: false,
    baseAmount: 0,
  };

  const outcome = resolveSpellCastHook(event, createWizardCarrier());

  assert.strictEqual(outcome.updatedCasterWardHp, undefined, 'cantrip should not initialize a ward');
  assert.deepEqual(outcome.triggeredFeatures, [], 'no features should fire on level 0 spells');
});

// ============================================================================
// 2. LIFE DOMAIN: DISCIPLE OF LIFE (+2 + SPELL LEVEL HEALING)
// ============================================================================

test('resolveSpellCastHook: Disciple of Life adds (2 + spellLevel) to 1st-level healing', () => {
  const event: SpellCastEvent = {
    casterId: 'cleric_1',
    targetId: 'ally_1',
    spellId: 'cure_wounds',
    school: 'evocation',
    level: 1,
    isHealing: true,
    baseAmount: 6, // Rolled 1d8
  };

  const outcome = resolveSpellCastHook(event, createClericCarrier());

  // Expected: 6 base + (2 + 1 level) = 9
  assert.strictEqual(outcome.finalAmount, 9, 'should add +3 bonus healing for a 1st-level spell');
  assert.deepEqual(outcome.triggeredFeatures, ['life_domain_disciple_of_life']);
});

test('resolveSpellCastHook: Disciple of Life ignores non-healing leveled spells', () => {
  const event: SpellCastEvent = {
    casterId: 'cleric_1',
    targetId: 'goblin_1',
    spellId: 'guiding_bolt',
    school: 'evocation',
    level: 1,
    isHealing: false,
    baseAmount: 14,
  };

  const outcome = resolveSpellCastHook(event, createClericCarrier());

  assert.strictEqual(outcome.finalAmount, 14, 'damage spells should not receive Disciple of Life bonus');
  assert.deepEqual(outcome.triggeredFeatures, []);
});

// ============================================================================
// 3. SCHOOL OF ABJURATION: ARCANE WARD (2 * LEVEL + INT MOD)
// ============================================================================

test('resolveSpellCastHook: Arcane Ward initializes buffer on 1st-level abjuration spell', () => {
  const event: SpellCastEvent = {
    casterId: 'wizard_1',
    targetId: 'wizard_1',
    spellId: 'mage_armor',
    school: 'abjuration',
    level: 1,
    isHealing: false,
    baseAmount: 0,
  };

  // Level 1 wizard with +3 INT -> max ward = (2 * 1) + 3 = 5 HP
  const outcome = resolveSpellCastHook(event, createWizardCarrier(['abjuration_arcane_ward'], 3, undefined));

  assert.strictEqual(outcome.updatedCasterWardHp, 5, 'should initialize ward at (2 * wizardLevel) + intMod');
  assert.deepEqual(outcome.triggeredFeatures, ['abjuration_arcane_ward']);
});

test('resolveSpellCastHook: Arcane Ward recharges by (2 * spellLevel) without exceeding max HP', () => {
  const event: SpellCastEvent = {
    casterId: 'wizard_1',
    targetId: 'wizard_1',
    spellId: 'shield',
    school: 'abjuration',
    level: 1,
    isHealing: false,
    baseAmount: 0,
  };

  // Max is 5 HP. Current ward is at 4 HP. Recharging adds (2 * 1) = 2 HP, but must cap at 5.
  const outcome = resolveSpellCastHook(event, createWizardCarrier(['abjuration_arcane_ward'], 3, 4));

  assert.strictEqual(outcome.updatedCasterWardHp, 5, 'ward recharge must clamp to maxWardHp');
  assert.deepEqual(outcome.triggeredFeatures, ['abjuration_arcane_ward']);
});

test('resolveSpellCastHook: Arcane Ward ignores non-abjuration leveled spells', () => {
  const event: SpellCastEvent = {
    casterId: 'wizard_1',
    targetId: 'goblin_1',
    spellId: 'magic_missile',
    school: 'evocation',
    level: 1,
    isHealing: false,
    baseAmount: 10,
  };

  const outcome = resolveSpellCastHook(event, createWizardCarrier(['abjuration_arcane_ward'], 3, undefined));

  assert.strictEqual(outcome.updatedCasterWardHp, undefined, 'evocation spells should not create or recharge a ward');
  assert.deepEqual(outcome.triggeredFeatures, []);
});

// ============================================================================
// 4. DAMAGE ABSORPTION SEAM (applyDamageWithWard)
// ============================================================================

test('applyDamageWithWard: ward absorbs entire hit when incoming damage <= ward HP', () => {
  // 4 damage vs 10 HP / 5 Ward
  const result = applyDamageWithWard(4, 10, 5);

  assert.strictEqual(result.newHp, 10, 'character HP should remain untouched');
  assert.strictEqual(result.newWardHp, 1, 'ward should absorb 4 damage, leaving 1');
  assert.strictEqual(result.damageAbsorbed, 4);
});

test('applyDamageWithWard: excess damage spills over to character HP when incoming > ward HP', () => {
  // 7 damage vs 10 HP / 5 Ward -> Ward eats 5, HP takes remaining 2
  const result = applyDamageWithWard(7, 10, 5);

  assert.strictEqual(result.newHp, 8, 'character HP should take the 2 overflow damage');
  assert.strictEqual(result.newWardHp, 0, 'ward should be depleted to 0');
  assert.strictEqual(result.damageAbsorbed, 5);
});

test('applyDamageWithWard: behaves identically to standard damage when ward HP is 0 or undefined', () => {
  const resultZero = applyDamageWithWard(6, 10, 0);
  const resultUndefined = applyDamageWithWard(6, 10, undefined);

  assert.strictEqual(resultZero.newHp, 4);
  assert.strictEqual(resultZero.newWardHp, 0);
  assert.strictEqual(resultZero.damageAbsorbed, 0);

  assert.strictEqual(resultUndefined.newHp, 4);
  assert.strictEqual(resultUndefined.newWardHp, 0);
  assert.strictEqual(resultUndefined.damageAbsorbed, 0);
});

// ============================================================================
// 5. GAPS THE SUITE ABOVE LEAVES OPEN
// ============================================================================

test('resolveSpellCastHook: a ward at 0 recharges rather than springing back to full', () => {
  // The case that separates "0 means empty" from "0 means absent". A ward the
  // goblin has just broken should regain twice the spell level — 2 — not the
  // whole 5 it started with, which would make being worn down free to undo.
  const event: SpellCastEvent = {
    casterId: 'wizard_1',
    targetId: 'wizard_1',
    spellId: 'shield',
    school: 'abjuration',
    level: 1,
    isHealing: false,
    baseAmount: 0,
  };

  const outcome = resolveSpellCastHook(event, createWizardCarrier(['abjuration_arcane_ward'], 3, 0));

  assert.strictEqual(outcome.updatedCasterWardHp, 2, 'an empty ward recharges by 2 x spell level');
  assert.deepEqual(outcome.triggeredFeatures, ['abjuration_arcane_ward']);
});

test('resolveSpellCastHook: only undefined means the ward has never been raised', () => {
  const raise: SpellCastEvent = {
    casterId: 'wizard_1',
    targetId: 'wizard_1',
    spellId: 'mage_armor',
    school: 'abjuration',
    level: 1,
    isHealing: false,
    baseAmount: 0,
  };

  const first = resolveSpellCastHook(raise, createWizardCarrier(['abjuration_arcane_ward'], 3, undefined));
  const empty = resolveSpellCastHook(raise, createWizardCarrier(['abjuration_arcane_ward'], 3, 0));

  assert.strictEqual(first.updatedCasterWardHp, 5, 'the first cast raises it at full strength');
  assert.notStrictEqual(empty.updatedCasterWardHp, 5, '0 must not be mistaken for "no ward yet"');
});

test('resolveSpellCastHook: a cantrip leaves an existing ward exactly where it was', () => {
  const event: SpellCastEvent = {
    casterId: 'wizard_1',
    targetId: 'wizard_1',
    spellId: 'ray_of_frost',
    school: 'evocation',
    level: 0,
    isHealing: false,
    baseAmount: 0,
  };

  const outcome = resolveSpellCastHook(event, createWizardCarrier(['abjuration_arcane_ward'], 3, 3));

  assert.strictEqual(outcome.updatedCasterWardHp, 3, 'a cantrip neither charges nor clears the ward');
  assert.deepEqual(outcome.triggeredFeatures, []);
});

test('applyDamageWithWard: hit points never go below zero on an overkill blow', () => {
  const result = applyDamageWithWard(40, 10, 5);

  assert.strictEqual(result.newHp, 0, 'a corpse does not owe hit points');
  assert.strictEqual(result.newWardHp, 0);
  assert.strictEqual(result.damageAbsorbed, 5, 'the ward still ate what it could');
});

test('resolveSpellCastHook: a caster without the feature gets nothing from either hook', () => {
  const healing: SpellCastEvent = {
    casterId: 'cleric_1',
    targetId: 'ally_1',
    spellId: 'cure_wounds',
    school: 'evocation',
    level: 1,
    isHealing: true,
    baseAmount: 6,
  };

  const outcome = resolveSpellCastHook(healing, createClericCarrier([]));

  assert.strictEqual(outcome.finalAmount, 6, 'no subclass, no bonus');
  assert.deepEqual(outcome.triggeredFeatures, []);
});
