'use client'

import { useEffect, useState } from 'react'
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
      version: 2,
      /**
       * Version 2 added a background, a trinket, a personality and an aura.
       * Older heroes are discarded rather than backfilled: inventing a past the
       * player never chose would put a guess on the sheet, and rebuilding a
       * 1st-level character takes six clicks.
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
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (useCharacterStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    return useCharacterStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])
  return hydrated
}
