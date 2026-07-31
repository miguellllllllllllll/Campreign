'use client'

import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildCharacter } from '../lib/dnd/characterBuilder.ts'
import type { Character, CreationAnswers } from '../types/character.ts'

interface CharacterStore {
  roster: Character[]
  activeId: string | null
  createCharacter: (answers: CreationAnswers, name: string) => Character
  setActive: (id: string) => void
  deleteCharacter: (id: string) => void
  clearRoster: () => void
}

export const useCharacterStore = create<CharacterStore>()(
  persist(
    (set) => ({
      roster: [],
      activeId: null,

      // The id and timestamp are generated here, at the edge, so
      // buildCharacter itself stays pure and testable.
      createCharacter: (answers, name) => {
        const hero = buildCharacter(answers, name, {
          id: crypto.randomUUID(),
          now: Date.now(),
        })
        set((state) => ({ roster: [...state.roster, hero], activeId: hero.id }))
        return hero
      },

      setActive: (id) => set({ activeId: id }),

      deleteCharacter: (id) =>
        set((state) => {
          const roster = state.roster.filter((hero) => hero.id !== id)
          const activeId = state.activeId === id ? (roster[0]?.id ?? null) : state.activeId
          return { roster, activeId }
        }),

      clearRoster: () => set({ roster: [], activeId: null }),
    }),
    {
      name: 'hero-step-roster',
      version: 3,
      /**
       * Version 2 added a background, a trinket, a personality and an aura.
       * Version 3 replaced the single chosen spell with a cantrip list and a
       * prepared list.
       *
       * Older heroes are discarded rather than backfilled, at both versions, for
       * the same reason: inventing a past or a spell list the player never chose
       * would put a guess on the sheet, and rebuilding a 1st-level character
       * takes a handful of clicks.
       */
      migrate: () => ({ roster: [], activeId: null }),
    },
  ),
)

export function useActiveCharacter(): Character | null {
  return useCharacterStore((state) => {
    if (state.activeId === null) return null
    return state.roster.find((hero) => hero.id === state.activeId) ?? null
  })
}

/**
 * False until localStorage has been read. Persisted data must not be rendered
 * before this flips, or the server and client markup disagree.
 */
export function useRosterHydrated(): boolean {
  /*
   * useSyncExternalStore rather than an effect that calls setState.
   *
   * The two are not interchangeable here: the server snapshot must be `false`
   * and the client snapshot must be whatever the store already knows, and this
   * hook is the one place that difference is allowed to exist. Reading
   * hasHydrated() during render instead would reintroduce exactly the mismatch
   * this guard was written to stop.
   */
  return useSyncExternalStore(
    (onStoreChange) => useCharacterStore.persist.onFinishHydration(onStoreChange),
    () => useCharacterStore.persist.hasHydrated(),
    () => false,
  )
}
