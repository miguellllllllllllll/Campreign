'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setSoundEnabled } from '../lib/sound.ts'

interface SoundStore {
  enabled: boolean
  toggle: () => void
}

/**
 * The mute preference outlives the tab, because being asked to silence an
 * interface twice is worse than never having heard it.
 *
 * `sound.ts` keeps its own copy of the flag so a button can fire a sound without
 * subscribing to this store and re-rendering on every toggle.
 */
export const useSoundStore = create<SoundStore>()(
  persist(
    (set, get) => ({
      enabled: true,
      toggle: () => {
        const next = !get().enabled
        setSoundEnabled(next)
        set({ enabled: next })
      },
    }),
    {
      name: 'hero-step-sound',
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state !== undefined) setSoundEnabled(state.enabled)
      },
    },
  ),
)
