'use client'

import { UserRound } from 'lucide-react'
import Link from 'next/link'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { CLASS_PRESETS, RACE_PRESETS } from '../../lib/dnd/presets.ts'
import { useCharacterStore, useRosterHydrated } from '../../stores/characterStore.ts'
import { cn } from '../../lib/utils.ts'

/** Only rendered once localStorage has been read, so saved heroes survive a reload. */
export function RosterStrip() {
  const hydrated = useRosterHydrated()
  const roster = useCharacterStore((state) => state.roster)
  const activeId = useCharacterStore((state) => state.activeId)
  const setActive = useCharacterStore((state) => state.setActive)

  if (!hydrated || roster.length === 0) return null

  return (
    <section className="flex flex-col gap-3 rounded-card border border-edge bg-surface/70 p-4 backdrop-blur-sm">
      <p className="font-serif text-xs font-semibold tracking-wide text-muted uppercase">
        Your heroes
      </p>
      <div className="flex flex-wrap gap-2">
        {roster.map((hero) => (
          <button
            key={hero.id}
            type="button"
            aria-pressed={hero.id === activeId}
            onClick={() => setActive(hero.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              hero.id === activeId
                ? 'border-amber-torch bg-amber-torch/10 text-parchment shadow-torch'
                : 'border-edge bg-surface-raised text-muted hover:border-gold-border/60',
            )}
          >
            <UserRound size={15} aria-hidden />
            <span className="font-medium">{hero.name}</span>
            <span className="text-xs text-muted">
              {RACE_PRESETS[hero.raceId].label} · {CLASS_PRESETS[hero.classId].label}
            </span>
          </button>
        ))}
      </div>
      <FantasyButton asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/tutorial">Take the selected hero into the tutorial</Link>
      </FantasyButton>
    </section>
  )
}
