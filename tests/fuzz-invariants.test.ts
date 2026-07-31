import test from 'node:test'
import assert from 'node:assert/strict'
import { applyDamage, applyHealing } from '../src/lib/dnd/combat.ts'
import { combineRollModes } from '../src/lib/dnd/conditions.ts'
import { applyDamageWithWard, resolveSpellCastHook } from '../src/lib/dnd/spellcasting.ts'
import { resolveAoeTargetSave } from '../src/lib/dnd/casting.ts'
import { resolveWardingFlare } from '../src/lib/dnd/reactions.ts'
import { critFor, roll } from '../src/lib/dnd/dice.ts'
import type { Combatant } from '../src/types/combat.ts'
import type { RollMode } from '../src/types/dice.ts'
import type { AttackAction } from '../src/types/action.ts'

/**
 * Property tests over the pure reducers.
 *
 * Every case is generated from a seeded generator, so a failure here is a
 * failure everybody can reproduce — the same reason the engine takes `rng` as
 * a parameter instead of reaching for Math.random. A fuzz suite that cannot be
 * replayed is worse than no fuzz suite: it reports a bug and then loses it.
 */

/** Linear congruential generator. Small, seedable, and good enough for inputs. */
function createPrng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const ITERATIONS = 1000

function intBetween(rng: () => number, low: number, high: number): number {
  return low + Math.floor(rng() * (high - low + 1))
}

const SPEAR: AttackAction = {
  id: 'spear',
  name: 'Spear',
  kind: 'weapon',
  ability: 'str',
  proficient: true,
  damage: '1d6',
  damageType: 'piercing',
  addAbilityToDamage: true,
  ranged: false,
  rangeSquares: 1,
  description: 'A test spear.',
}

function subject(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'subject',
    name: 'Test Subject',
    team: 'party',
    level: 1,
    scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    maxHp: 20,
    currentHp: 20,
    ac: 15,
    speedSquares: 6,
    position: { x: 0, y: 0 },
    attacks: [SPEAR],
    conditions: [],
    initiative: 0,
    ...overrides,
  }
}

// --- Damage ---------------------------------------------------------------

test('fuzz: damage conserves the health pool and never goes negative', () => {
  const rng = createPrng(42)

  for (let i = 0; i < ITERATIONS; i += 1) {
    const maxHp = intBetween(rng, 1, 50)
    const currentHp = intBetween(rng, 0, maxHp)
    const ward = intBetween(rng, 0, 30)
    const damage = intBetween(rng, 0, 80)

    const before = subject({ maxHp, currentHp, arcaneWardHp: ward })
    const after = applyDamage(before, damage)

    assert.ok(after.currentHp >= 0, `hp went negative on ${damage} damage`)
    assert.ok(after.currentHp <= maxHp, 'damage raised hit points')
    assert.ok((after.arcaneWardHp ?? 0) >= 0, 'ward went negative')

    // The pool drains ward-first, and only ever loses what was there to lose.
    const pool = currentHp + ward
    const left = after.currentHp + (after.arcaneWardHp ?? 0)
    assert.equal(pool - left, Math.min(pool, damage), `conservation broke at damage=${damage}`)
  }
})

test('fuzz: a combatant with no ward is never given one', () => {
  const rng = createPrng(7)

  for (let i = 0; i < ITERATIONS; i += 1) {
    const currentHp = intBetween(rng, 0, 40)
    const after = applyDamage(subject({ currentHp, maxHp: 40 }), intBetween(rng, 0, 60))
    assert.equal('arcaneWardHp' in after, false, 'a ward appeared from nowhere')
  }
})

test('fuzz: the ward always absorbs before hit points do', () => {
  const rng = createPrng(2024)

  for (let i = 0; i < ITERATIONS; i += 1) {
    const hp = intBetween(rng, 0, 40)
    const ward = intBetween(rng, 0, 25)
    const damage = intBetween(rng, 0, 60)
    const result = applyDamageWithWard(damage, hp, ward)

    assert.equal(result.damageAbsorbed, Math.min(ward, damage))
    assert.equal(result.newWardHp, ward - result.damageAbsorbed)
    // Hit points only move once the ward is empty.
    if (damage <= ward) assert.equal(result.newHp, hp, 'hit points moved behind a full ward')
  }
})

// --- Healing --------------------------------------------------------------

test('fuzz: healing never overshoots the maximum or runs backwards', () => {
  const rng = createPrng(1337)

  for (let i = 0; i < ITERATIONS; i += 1) {
    const maxHp = intBetween(rng, 1, 30)
    const currentHp = intBetween(rng, 0, maxHp)
    const amount = intBetween(rng, -10, 40)

    const after = applyHealing(subject({ maxHp, currentHp }), amount)

    assert.ok(after.currentHp <= maxHp, `healed past the cap to ${after.currentHp}`)
    assert.ok(after.currentHp >= currentHp, 'healing removed hit points')
    // Negative healing is clamped rather than becoming damage.
    if (amount <= 0) assert.equal(after.currentHp, currentHp)
  }
})

test('fuzz: Disciple of Life adds exactly 2 + the spell level, and only to healing', () => {
  const rng = createPrng(5150)

  for (let i = 0; i < ITERATIONS; i += 1) {
    const level = intBetween(rng, 0, 3)
    const base = intBetween(rng, 0, 20)
    const isHealing = rng() > 0.5

    const carrier = {
      level: 1,
      intMod: 0,
      hasFeature: (id: string) => id === 'life_domain_disciple_of_life',
    }
    const outcome = resolveSpellCastHook(
      {
        casterId: 'c', targetId: 't', spellId: 's',
        school: 'evocation', level, isHealing, baseAmount: base,
      },
      carrier,
    )

    const expected = isHealing && level >= 1 ? base + 2 + level : base
    assert.equal(outcome.finalAmount, expected, `level=${level} healing=${isHealing}`)
  }
})

// --- Roll modes -----------------------------------------------------------

test('fuzz: combining roll modes is closed, cancelling, and order-independent', () => {
  const rng = createPrng(555)
  const modes: RollMode[] = ['advantage', 'disadvantage', 'normal']

  for (let i = 0; i < ITERATIONS; i += 1) {
    const list: RollMode[] = []
    for (let j = 0; j < intBetween(rng, 1, 5); j += 1) {
      list.push(modes[intBetween(rng, 0, 2)] as RollMode)
    }
    const combined = combineRollModes(list)

    assert.ok(modes.includes(combined), `produced ${combined}`)

    // The SRD's rule: any disadvantage cancels any amount of advantage.
    if (list.includes('advantage') && list.includes('disadvantage')) {
      assert.equal(combined, 'normal', `did not cancel: ${list.join(',')}`)
    }

    // Order cannot matter, or two features would stack differently by initiative.
    assert.equal(combineRollModes([...list].reverse()), combined, 'order changed the result')
  }
})

// --- Area saves -----------------------------------------------------------

test('fuzz: area damage stays within bounds and sculpting only ever spares allies', () => {
  const rng = createPrng(999)

  for (let i = 0; i < ITERATIONS; i += 1) {
    const rawDamage = intBetween(rng, 0, 40)
    const saveDc = intBetween(rng, 1, 25)
    const halfOnSuccess = rng() > 0.5
    const sculpts = rng() > 0.5
    const targetIsAlly = rng() > 0.5

    const caster = subject({ id: 'caster', team: 'party' })
    const target = subject({
      id: 'target',
      team: targetIsAlly ? 'party' : 'foes',
      scores: { str: 10, dex: intBetween(rng, 1, 20), con: 10, int: 10, wis: 10, cha: 10 },
    })

    const outcome = resolveAoeTargetSave({
      caster, target, saveAbility: 'dex', saveDc, rawDamage,
      halfOnSuccess, casterSculpts: sculpts, rng,
    })

    assert.ok(outcome.damageTaken >= 0, 'negative damage')
    assert.ok(outcome.damageTaken <= rawDamage, 'damage exceeded the roll')

    if (sculpts && targetIsAlly) {
      assert.equal(outcome.isSculpted, true)
      assert.equal(outcome.damageTaken, 0, 'a sculpted ally took damage')
    } else {
      assert.equal(outcome.isSculpted, false, 'an enemy was sculpted')
      const expected = outcome.saveSuccessful
        ? (halfOnSuccess ? Math.floor(rawDamage / 2) : 0)
        : rawDamage
      assert.equal(outcome.damageTaken, expected)
    }
  }
})

// --- Reactions ------------------------------------------------------------

test('fuzz: a warding flare can never help the attacker', () => {
  const rng = createPrng(31337)

  for (let i = 0; i < ITERATIONS; i += 1) {
    const attacker = subject({ id: 'attacker', team: 'foes' })
    const target = subject({ id: 'target', ac: intBetween(rng, 5, 25) })

    // A real attack first, so the flare has something genuine to work on.
    const natural = intBetween(rng, 1, 20)
    const attackRoll = roll('1d20', { rng: () => (natural - 0.5) / 20 })
    const outcome = {
      kind: 'hit' as const,
      breakdown: { natural, parts: [], total: natural + 3, targetAc: target.ac },
      attackRoll,
      damageRoll: roll('1d6', { rng }),
      damage: intBetween(rng, 1, 6),
    }

    const flare = resolveWardingFlare({ attacker, target, attack: SPEAR, outcome, rng })

    assert.ok(flare.keptNatural <= natural, 'disadvantage raised the roll')
    assert.ok(flare.keptNatural >= 1 && flare.keptNatural <= 20, 'kept an impossible die')
    assert.equal(flare.keptNatural, Math.min(natural, flare.flareRoll))
  }
})

// --- Criticals ------------------------------------------------------------

test('fuzz: a natural 1 is always a fumble and the threshold is always a hit', () => {
  const rng = createPrng(20)

  for (let i = 0; i < ITERATIONS; i += 1) {
    const critOn = intBetween(rng, 2, 20)
    const natural = intBetween(rng, 1, 20)
    const verdict = critFor(natural, critOn)

    if (natural === 1) {
      assert.equal(verdict, 'fumble', 'a natural 1 stopped being a fumble')
    } else if (natural >= critOn) {
      assert.equal(verdict, 'hit', `natural ${natural} missed a threshold of ${critOn}`)
    } else {
      assert.equal(verdict, null)
    }
  }
})
