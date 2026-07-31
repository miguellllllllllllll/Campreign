'use client'

import { Sparkles } from 'lucide-react'
import { castableOutOfCombat } from '../../lib/dnd/casting.ts'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { HintTooltip } from '../ui/rules-tooltip.tsx'
import { useTutorialStore } from '../../stores/tutorialStore.ts'
import { playSound } from '../../lib/sound.ts'
import type { Character } from '../../types/character.ts'

export interface CastBeforeRollProps {
  character: Character
  /** Hidden once the die is in the air — there is nothing left to help. */
  hidden?: boolean
}

/**
 * The chance to cast something before a roll, which is the whole of casting
 * outside a fight.
 *
 * Deliberately offered here rather than as a permanent bar somewhere: Guidance
 * is spent by the next check, so the only moment it is worth anything is the
 * moment a check is on screen and not yet rolled. Anywhere else it would be a
 * button that quietly wastes itself.
 *
 * Renders nothing at all for a hero who knows no such spell, which is four
 * classes out of five.
 */
export function CastBeforeRoll({ character, hidden = false }: CastBeforeRollProps) {
  const held = useTutorialStore((state) => state.concentratingOn)
  const cast = useTutorialStore((state) => state.castOutOfCombat)
  const available = castableOutOfCombat(character)

  if (hidden || available.length === 0) return null

  if (held !== null) {
    const spell = available.find((one) => one.id === held)
    return (
      <p className="flex items-center gap-2 font-serif text-sm text-amber-torch">
        <Sparkles aria-hidden className="size-4" />
        {spell === undefined
          ? 'You are holding a spell together.'
          : `${spell.name} is holding — you will add ${spell.effect?.kind === 'guideCheck'
              ? spell.effect.die
              : 'a die'} to this roll.`}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {available.map((spell) => (
        <HintTooltip key={spell.id} title={spell.name} body={spell.description}>
          <FantasyButton
            variant="iron"
            size="sm"
            onClick={() => {
              const refusal = cast(spell.id)
              if (refusal === null) playSound('roll')
            }}
          >
            <Sparkles aria-hidden />
            Cast {spell.name}
          </FantasyButton>
        </HintTooltip>
      ))}
    </div>
  )
}
