'use client'

import Link from 'next/link'
import { CreatureToken } from '../ui/creature-icons.tsx'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { ParchmentCard, ParchmentCardContent } from '../ui/parchment-card.tsx'
import { CharacterCard } from './CharacterCard.tsx'
import { RosterStrip } from './RosterStrip.tsx'
import { useActiveCharacter, useRosterHydrated } from '../../stores/characterStore.ts'

/**
 * Somewhere to swing without dying. The dummy never fights back, so a beginner
 * can press the same attack twenty times and watch how the numbers move.
 */
export function PracticeArena() {
  const hydrated = useRosterHydrated()
  const hero = useActiveCharacter()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-table-ink text-3xl font-black drop-shadow-[0_1px_0_rgb(255_255_255/0.35)]">
          Practice arena
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-table-ink/80">
          A straw dummy that does not hit back. Attack it as often as you like and watch the roll
          break itself down — this is the fastest way to see what your bonuses actually do.
        </p>
      </div>

      <RosterStrip />

      {hydrated && hero !== null && <CharacterCard character={hero} />}

      {hydrated && hero === null && (
        <ParchmentCard>
          <ParchmentCardContent className="flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center">
            {/* The dummy is standing there either way — showing it makes the
                empty state a scene rather than a notice. */}
            <span
              aria-hidden
              className="grid size-24 shrink-0 place-items-center rounded-card border border-edge bg-ink/50 text-muted shadow-[inset_0_0_24px_rgb(0_0_0/0.6)]"
            >
              <CreatureToken token="dummy" size={58} />
            </span>
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm leading-relaxed text-muted">
                You have no hero yet, and the dummy needs someone to hit it.
              </p>
              <FantasyButton asChild>
                <Link href="/create">Build a hero first</Link>
              </FantasyButton>
            </div>
          </ParchmentCardContent>
        </ParchmentCard>
      )}
    </div>
  )
}
