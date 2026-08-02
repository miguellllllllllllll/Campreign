import {
  activeCombatant,
  castFromActive,
  combatantsOf,
  createEncounter,
  encounterWinner,
  endTurn,
  resolveReaction,
  takeAutomaticTurn,
} from '../../src/lib/dnd/encounter.ts'
import { castableSpells } from '../../src/lib/dnd/casting.ts'
import { gridDistance, isDefeated } from '../../src/lib/dnd/combat.ts'
import type { Combatant, Team } from '../../src/types/combat.ts'
import type { Encounter } from '../../src/lib/dnd/encounter.ts'
import type { Rng } from '../../src/types/dice.ts'
import { seededRng } from './rng.ts'

/**
 * Plays a whole fight with nobody steering, and reports who was left standing.
 *
 * This exists because the balance numbers written into `tutorialStore` were
 * measured by a script that was never committed. They are load-bearing — "the
 * party wins 59% against the spider alone" is the reason the spider fights
 * alone — and nothing could re-check them after the monster changed. A stale
 * note in this same bestiary went on claiming the spider had no venom for
 * several commits after it grew one, which is what that failure looks like
 * when it is only a comment. On a number that decides an encounter it would be
 * worse and just as quiet.
 *
 * `takeAutomaticTurn` drives both sides, which is not a shortcut — it is the
 * documented methodology. The hero never casts, drinks, or spends a feature, so
 * every figure this produces is a floor rather than a forecast.
 */

/** Reactions are declined: the auto-played hero has nobody to press the button. */
function settleReaction(encounter: ReturnType<typeof createEncounter>, rng: Rng) {
  return encounter.pendingReaction === undefined
    ? encounter
    : resolveReaction(encounter, 'pass', rng).encounter
}

/**
 * A caster's turn, or null if this actor has nothing worth casting right now.
 *
 * Deliberately meagre. The default floor plays nobody's spells at all, which is
 * honest but flattens the classes whose whole kit is spells — a life cleric
 * measured that way is a mace with a holy symbol. This exists to put a number
 * beside that one, not to play well:
 *
 *   - heal yourself when under half, because the alternative is dying
 *   - otherwise throw the biggest damaging spell that will resolve
 *   - otherwise hand back to the ordinary attack turn
 *
 * It never moves before casting and never repositions to get range. A refusal
 * is taken as "not now" and falls through, rather than reimplementing the range
 * and slot rules the engine already owns — asking and being told no is cheaper
 * than predicting the answer, and cannot drift from it.
 */
function castingTurn(encounter: Encounter, rng: Rng): Encounter | null {
  const actor = activeCombatant(encounter)
  if (actor === undefined || actor.team !== 'party') return null

  const board = Object.values(encounter.combatants)
  const options = castableSpells(actor, board).filter((one) => one.castable)
  if (options.length === 0) return null

  const wounded = actor.currentHp / actor.maxHp < 0.5
  const heal = options.find((one) => one.spell.effect?.kind === 'heal')
  if (wounded && heal !== undefined) {
    const healed = castFromActive(encounter, {
      spellId: heal.spell.id,
      targetId: actor.id,
      rng,
    })
    if (healed.refusal === null) return healed.encounter
  }

  const foes = combatantsOf(encounter, 'foes').filter((one) => !isDefeated(one))
  const target = foes
    .slice()
    .sort(
      (a, b) =>
        gridDistance(actor.position, a.position) - gridDistance(actor.position, b.position),
    )[0]
  if (target === undefined) return null

  for (const option of options) {
    const kind = option.spell.effect?.kind
    if (kind !== 'autoHit' && kind !== 'spellAttack' && kind !== 'aoeSave') continue
    const cast = castFromActive(encounter, {
      spellId: option.spell.id,
      targetId: target.id,
      rng,
    })
    if (cast.refusal === null) return cast.encounter
  }
  return null
}

/**
 * One fight, start to finish.
 *
 * The round cap is a deadlock guard rather than a rule. Two combatants who can
 * never reach each other would otherwise spin forever, and a hung test suite
 * reports nothing at all; `null` says "undecided" and lets the caller count it.
 */
export function playOut(
  roster: readonly Combatant[],
  rng: Rng,
  maxTurns = 400,
  casts = false,
): Team | null {
  let encounter = createEncounter(roster, rng)

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const winner = encounterWinner(encounter)
    if (winner !== null) return winner

    const cast = casts ? castingTurn(encounter, rng) : null
    encounter = settleReaction(
      cast ?? takeAutomaticTurn(encounter, rng).encounter,
      rng,
    )
    // Checked again before ending the turn: `endTurn` refuses to advance a
    // decided fight, so asking it to would spin the loop rather than stop it.
    if (encounterWinner(encounter) !== null) return encounterWinner(encounter)
    encounter = endTurn(encounter, rng)
  }
  return null
}

export interface WinRate {
  /** Fraction of decided fights the party took, 0 to 1. */
  party: number
  runs: number
  /** Fights that hit the turn cap. Any at all means the numbers are suspect. */
  undecided: number
}

/**
 * The same fight many times over, on a fixed seed.
 *
 * Seeded rather than random so a failure is reproducible: a flaky balance test
 * that reports a different number each run teaches a reader to ignore it, which
 * is the state these numbers were already in.
 */
export function winRate(
  rosterFor: () => readonly Combatant[],
  runs: number,
  seed = 1,
  casts = false,
): WinRate {
  const rng = seededRng(seed)
  let wins = 0
  let undecided = 0

  for (let run = 0; run < runs; run += 1) {
    const winner = playOut(rosterFor(), rng, 400, casts)
    if (winner === null) undecided += 1
    else if (winner === 'party') wins += 1
  }
  const decided = runs - undecided
  return { party: decided === 0 ? 0 : wins / decided, runs, undecided }
}
