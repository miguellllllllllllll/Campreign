'use client'

import { create } from 'zustand'
import {
  attackWith,
  createEncounter,
  encounterWinner,
  castFromActive,
  drinkPotion,
  channelDivinity,
  endTurn,
  resolveReaction,
  moveActive,
  takeEnemyTurn,
  type Encounter,
} from '../lib/dnd/encounter.ts'
import type { AttackOutcome, Combatant, GridPosition, Team } from '../types/combat.ts'
import type { Rng } from '../types/dice.ts'

interface CombatStore {
  encounter: Encounter | null
  /** The last attack resolved by anyone, so the UI can show its breakdown. */
  lastOutcome: AttackOutcome | null
  /** Why the last attempted action was rejected, cleared as soon as one lands. */
  refusal: string | null
  /** `rng` is injectable so a test can pin initiative and the foe's swing. */
  start: (roster: readonly Combatant[], rng?: Rng) => void
  move: (to: GridPosition) => boolean
  attack: (args: { targetId: string; attackId: string; maneuverId?: 'trip' }) => AttackOutcome | null
  /** Spends the paladin's oath charge. Costs no action, so the turn continues. */
  channel: (args: { power: 'sacredWeapon' | 'vowOfEnmity'; targetId?: string }) => void
  /** Casts a prepared spell, spending the action and a slot. */
  cast: (args: { spellId: string; targetId: string; subclassId?: string }) => void
  /** Drinks a potion, spending an action or a bonus action as the hero allows. */
  drink: () => void
  /** Commits a paused attack, with or without the reaction. */
  dispatchReaction: (choice: 'flare' | 'pass', rng?: Rng) => void
  /** Ends the player's turn and plays out every enemy turn until it is the player's again. */
  finishTurn: (rng?: Rng) => void
  reset: () => void
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  encounter: null,
  lastOutcome: null,
  refusal: null,

  start: (roster, rng = Math.random) => {
    // The goblin can win initiative, so hand control back to the player before
    // the board is ever shown — otherwise there is nothing they can press.
    const played = playFoeTurns(createEncounter(roster, rng), rng)
    set({ encounter: played.encounter, lastOutcome: played.outcome, refusal: null })
  },

  move: (to) => {
    const { encounter } = get()
    if (encounter === null) return false
    const moved = moveActive(encounter, to)
    if (moved === encounter) {
      set({ refusal: 'That square is too far away, or something is standing in it.' })
      return false
    }
    set({ encounter: moved, refusal: null })
    return true
  },

  attack: ({ targetId, attackId, maneuverId }) => {
    const { encounter } = get()
    if (encounter === null) return null
    const result = attackWith(encounter, {
      targetId,
      attackId,
      ...(maneuverId === undefined ? {} : { maneuverId }),
    })
    set({
      encounter: result.encounter,
      lastOutcome: result.outcome ?? get().lastOutcome,
      refusal: result.refusal,
    })
    return result.outcome
  },

  channel: ({ power, targetId }) => {
    const { encounter } = get()
    if (encounter === null) return
    const result = channelDivinity(encounter, {
      power,
      ...(targetId === undefined ? {} : { targetId }),
    })
    set({ encounter: result.encounter, refusal: result.refusal })
  },

  cast: ({ spellId, targetId, subclassId }) => {
    const { encounter } = get()
    if (encounter === null) return
    const result = castFromActive(encounter, {
      spellId,
      targetId,
      ...(subclassId === undefined ? {} : { subclassId }),
    })
    set({ encounter: result.encounter, refusal: result.refusal })
  },

  drink: () => {
    const { encounter } = get()
    if (encounter === null) return
    const result = drinkPotion(encounter)
    set({ encounter: result.encounter, refusal: result.refusal })
  },

  dispatchReaction: (choice, rng = Math.random) => {
    const { encounter } = get()
    if (encounter === null) return

    const result = resolveReaction(encounter, choice, rng)
    if (result.refusal !== null) {
      set({ refusal: result.refusal })
      return
    }

    /*
     * Resuming is the other half of the pause. The foe was mid-turn when the
     * board froze, so answering the prompt has to hand the rest of the round
     * back — otherwise the player is left looking at a foe's turn that never
     * ends. Only resume if the fight is still going: a flare that failed to
     * save the hero ends it here.
     */
    const settled =
      encounterWinner(result.encounter) === null
        ? playFoeTurns(endTurn(result.encounter), rng)
        : { encounter: result.encounter, outcome: null }

    set({
      encounter: settled.encounter,
      lastOutcome: settled.outcome ?? result.outcome ?? get().lastOutcome,
      refusal: null,
    })
  },

  finishTurn: (rng = Math.random) => {
    const { encounter } = get()
    if (encounter === null) return

    const played = playFoeTurns(endTurn(encounter), rng)
    set({
      encounter: played.encounter,
      lastOutcome: played.outcome ?? get().lastOutcome,
      refusal: null,
    })
  },

  reset: () => set({ encounter: null, lastOutcome: null, refusal: null }),
}))

function activeTeam(encounter: Encounter): Team | undefined {
  const id = encounter.order[encounter.activeIndex]
  return id === undefined ? undefined : encounter.combatants[id]?.team
}

/**
 * Runs every foe turn back to back until the player is up again. Done in the
 * store rather than the component so the player never sees a board they cannot
 * act on.
 */
function playFoeTurns(
  encounter: Encounter,
  rng: Rng = Math.random,
): {
  encounter: Encounter
  outcome: AttackOutcome | null
} {
  let current = encounter
  let outcome: AttackOutcome | null = null

  while (activeTeam(current) === 'foes' && encounterWinner(current) === null) {
    const enemy = takeEnemyTurn(current, rng)
    outcome = enemy.outcome ?? outcome

    /*
     * A pause stops the loop dead. The foe's turn is rolled but uncommitted,
     * and running the next one would resolve attacks on top of a blow the
     * player has not answered yet. The turn is finished by dispatchReaction,
     * which resumes from here.
     */
    if (enemy.encounter.pendingReaction !== undefined) {
      return { encounter: enemy.encounter, outcome }
    }

    const after = endTurn(enemy.encounter)
    // endTurn refuses to advance once the fight is decided, which is how a foe
    // can still be the active combatant here: it just killed the hero. There is
    // no turn to hand back, and the UI shows the defeat rather than a board.
    if (after === enemy.encounter) return { encounter: enemy.encounter, outcome }
    current = after
  }

  return { encounter: current, outcome }
}
