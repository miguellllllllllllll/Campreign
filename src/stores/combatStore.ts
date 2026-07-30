'use client'

import { create } from 'zustand'
import {
  attackWith,
  createEncounter,
  encounterWinner,
  endTurn,
  moveActive,
  takeEnemyTurn,
  type Encounter,
} from '../lib/dnd/encounter.ts'
import type { AttackOutcome, Combatant, GridPosition, Team } from '../types/combat.ts'

interface CombatStore {
  encounter: Encounter | null
  /** The last attack resolved by anyone, so the UI can show its breakdown. */
  lastOutcome: AttackOutcome | null
  /** Why the last attempted action was rejected, cleared as soon as one lands. */
  refusal: string | null
  start: (roster: readonly Combatant[]) => void
  move: (to: GridPosition) => boolean
  attack: (args: { targetId: string; attackId: string }) => AttackOutcome | null
  /** Ends the player's turn and plays out every enemy turn until it is the player's again. */
  finishTurn: () => void
  reset: () => void
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  encounter: null,
  lastOutcome: null,
  refusal: null,

  start: (roster) => {
    // The goblin can win initiative, so hand control back to the player before
    // the board is ever shown — otherwise there is nothing they can press.
    const played = playFoeTurns(createEncounter(roster))
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

  attack: ({ targetId, attackId }) => {
    const { encounter } = get()
    if (encounter === null) return null
    const result = attackWith(encounter, { targetId, attackId })
    set({
      encounter: result.encounter,
      lastOutcome: result.outcome ?? get().lastOutcome,
      refusal: result.refusal,
    })
    return result.outcome
  },

  finishTurn: () => {
    const { encounter } = get()
    if (encounter === null) return

    const played = playFoeTurns(endTurn(encounter))
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
function playFoeTurns(encounter: Encounter): {
  encounter: Encounter
  outcome: AttackOutcome | null
} {
  let current = encounter
  let outcome: AttackOutcome | null = null

  while (activeTeam(current) === 'foes' && encounterWinner(current) === null) {
    const enemy = takeEnemyTurn(current)
    outcome = enemy.outcome ?? outcome
    const after = endTurn(enemy.encounter)
    if (after === enemy.encounter) return { encounter: enemy.encounter, outcome }
    current = after
  }

  return { encounter: current, outcome }
}
