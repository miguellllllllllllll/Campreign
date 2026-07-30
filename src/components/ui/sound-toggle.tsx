'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useSoundStore } from '../../stores/soundStore.ts'
import { playSound } from '../../lib/sound.ts'

/**
 * Interface sound is on by default, which is only defensible if silencing it
 * takes one click from anywhere. Hence a fixed control rather than a settings page.
 */
export function SoundToggle() {
  const enabled = useSoundStore((state) => state.enabled)
  const toggle = useSoundStore((state) => state.toggle)

  return (
    <button
      type="button"
      onClick={() => {
        // Confirm the new state audibly, which only works on the way back on.
        if (!enabled) playSound('press')
        toggle()
      }}
      aria-pressed={enabled}
      title={enabled ? 'Mute interface sounds' : 'Unmute interface sounds'}
      className="fixed top-4 right-4 z-40 grid size-9 place-items-center rounded-full border border-edge bg-surface/80 text-muted backdrop-blur-sm transition-colors hover:border-gold-border/70 hover:text-amber-torch"
    >
      {enabled ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
      <span className="sr-only">{enabled ? 'Mute interface sounds' : 'Unmute interface sounds'}</span>
    </button>
  )
}
