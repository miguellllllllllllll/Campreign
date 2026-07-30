'use client'

import Link from 'next/link'
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
        <h1 className="font-display bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 bg-clip-text text-3xl font-black text-transparent">
          Practice arena
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          A straw dummy that does not hit back. Attack it as often as you like and watch the roll
          break itself down — this is the fastest way to see what your bonuses actually do.
        </p>
      </div>

      <RosterStrip />

      {hydrated && hero !== null && <CharacterCard character={hero} />}

      {hydrated && hero === null && (
        <ParchmentCard>
          <ParchmentCardContent className="flex flex-col items-start gap-3 pt-6">
            <p className="text-sm leading-relaxed text-muted">
              You have no hero yet, and the dummy needs someone to hit it.
            </p>
            <FantasyButton asChild>
              <Link href="/create">Build a hero first</Link>
            </FantasyButton>
          </ParchmentCardContent>
        </ParchmentCard>
      )}
    </div>
  )
}
