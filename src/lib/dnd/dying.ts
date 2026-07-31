import type { Combatant, DeathSaves } from '../../types/combat.ts'
import type { Rng } from '../../types/dice.ts'
import { roll } from './dice.ts'

/**
 * Dropping to 0 is not the end for everyone.
 *
 * A goblin at 0 hit points is dead and the fight moves on. A hero at 0 is
 * *dying*: unconscious, unable to act, and rolling a flat d20 at the start of
 * each of their turns to see which way it goes. Three good rolls and they hold
 * on; three bad ones and they do not.
 *
 * Which of the two you are is decided by whether you carry `deathSaves` at all,
 * set once when the combatant is built. Absent means "dies outright", which is
 * every monster, and no caller ever has to ask what something is.
 */

/** A death save succeeds on 10 or better. Nothing modifies it — that is the point. */
export const DEATH_SAVE_DC = 10

/** Three of either ends it, one way or the other. */
export const DEATH_SAVES_NEEDED = 3

/** At 0 hit points, whatever comes next. */
export function isDown(combatant: Combatant): boolean {
  return combatant.currentHp <= 0
}

/** Down, and no longer slipping — either three successes or somebody's hand. */
export function isStable(combatant: Combatant): boolean {
  return (
    isDown(combatant)
    && combatant.deathSaves !== undefined
    && combatant.deathSaves.successes >= DEATH_SAVES_NEEDED
  )
}

/**
 * Down for good.
 *
 * A monster is dead the moment it drops, because it never had saves to roll.
 * Anyone who does is dead only after failing three of them.
 */
export function isDead(combatant: Combatant): boolean {
  if (!isDown(combatant)) return false
  if (combatant.deathSaves === undefined) return true
  return combatant.deathSaves.failures >= DEATH_SAVES_NEEDED
}

/** Down, still rolling: not yet stable and not yet dead. */
export function isDying(combatant: Combatant): boolean {
  return isDown(combatant) && !isStable(combatant) && !isDead(combatant)
}

export type DeathSaveOutcome = 'success' | 'failure' | 'stabilised' | 'died' | 'revived'

export interface DeathSaveResult {
  combatant: Combatant
  /** The face on the d20, so the log can show the roll and not just the verdict. */
  natural: number
  outcome: DeathSaveOutcome
}

/**
 * One death save, at the start of a dying creature's turn.
 *
 * The two natural results are not flavour — a 20 puts them back on their feet
 * at a single hit point, and a 1 costs two failures. They are the reason this
 * roll is tense rather than arithmetic, and a beginner meeting death saves for
 * the first time should meet the real ones.
 */
export function rollDeathSave(args: { combatant: Combatant; rng?: Rng }): DeathSaveResult {
  const { combatant } = args
  const saves = combatant.deathSaves ?? { successes: 0, failures: 0 }
  const natural = roll('1d20', { rng: args.rng ?? Math.random }).total

  if (natural === 20) {
    return {
      combatant: { ...combatant, currentHp: 1, deathSaves: { successes: 0, failures: 0 } },
      natural,
      outcome: 'revived',
    }
  }

  const next: DeathSaves =
    natural === 1
      ? { ...saves, failures: saves.failures + 2 }
      : natural >= DEATH_SAVE_DC
        ? { ...saves, successes: saves.successes + 1 }
        : { ...saves, failures: saves.failures + 1 }

  const settled = { ...combatant, deathSaves: next }
  if (next.failures >= DEATH_SAVES_NEEDED) {
    return { combatant: settled, natural, outcome: 'died' }
  }
  if (next.successes >= DEATH_SAVES_NEEDED) {
    return { combatant: settled, natural, outcome: 'stabilised' }
  }
  return { combatant: settled, natural, outcome: natural >= DEATH_SAVE_DC ? 'success' : 'failure' }
}

/**
 * Stops someone slipping away without healing them, which is Spare the Dying.
 *
 * Recorded as three successes rather than a separate `stable` flag: it is the
 * state the rules already have a name for, `isStable` already reads it, and one
 * fewer field is one fewer way for two of them to disagree.
 */
export function stabilise(combatant: Combatant): Combatant {
  return {
    ...combatant,
    deathSaves: { successes: DEATH_SAVES_NEEDED, failures: 0 },
  }
}

/**
 * Wipes the slate when someone is brought back above 0.
 *
 * Healing in the SRD ends the dying state outright — the saves already rolled
 * do not carry over to the next time they drop. A hero patched up at 1 hit
 * point starts the count fresh, which is the difference between a close call
 * and a death sentence deferred.
 */
export function clearDeathSaves(combatant: Combatant): Combatant {
  if (combatant.deathSaves === undefined) return combatant
  if (combatant.deathSaves.successes === 0 && combatant.deathSaves.failures === 0) {
    return combatant
  }
  return { ...combatant, deathSaves: { successes: 0, failures: 0 } }
}

/** How a death save reads in the combat log. */
export function narrateDeathSave(name: string, result: DeathSaveResult): string {
  const rolled = `${name} rolls ${result.natural} against Death Save DC ${DEATH_SAVE_DC}`
  switch (result.outcome) {
    case 'revived':
      return `${name} rolls a natural 20 — and opens their eyes at 1 hit point.`
    case 'died':
      return `${rolled} and does not get up again.`
    case 'stabilised':
      return `${rolled} — three successes. ${name} is stable, and stops rolling.`
    case 'failure':
      return result.natural === 1
        ? `${name} rolls a natural 1 — that is two failures at once.`
        : `${rolled} and slips further.`
    case 'success':
      return `${rolled} and holds on.`
  }
}
