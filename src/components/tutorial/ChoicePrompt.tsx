'use client'

import { useRef, useState } from 'react'
import { resolveCheck, type CheckResult } from '../../lib/dnd/checks.ts'
import { guidesChecks } from '../../lib/dnd/casting.ts'
import { useTutorialStore } from '../../stores/tutorialStore.ts'
import { CastBeforeRoll } from './CastBeforeRoll.tsx'
import { narrateCheckFully } from '../../lib/dnd/narrate.ts'
import { SKILL_LABELS } from '../../lib/dnd/stats.ts'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { RollBreakdown } from '../dice/RollBreakdown.tsx'
import { playSound } from '../../lib/sound.ts'
import type { Character } from '../../types/character.ts'
import type { TutorialChoice } from '../../types/tutorial.ts'

export interface ChoicePromptProps {
  character: Character
  choices: readonly TutorialChoice[]
  onResolved: (choiceId: string, success: boolean) => void
}

export function ChoicePrompt({ character, choices, onResolved }: ChoicePromptProps) {
  const [rolled, setRolled] = useState<{ choiceId: string; result: CheckResult } | null>(null)
  const [rolling, setRolling] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function pick(choice: TutorialChoice) {
    // An option with no check is pure narration — it can never be failed, which
    // is what stops a bad run of dice from stranding the player here.
    if (choice.check === undefined) {
      onResolved(choice.id, true)
      return
    }

    const held = useTutorialStore.getState().concentratingOn
    const result = resolveCheck({
      scores: character.scores,
      skill: choice.check.skill,
      level: character.level,
      proficientSkills: character.skillProficiencies,
      dc: choice.check.dc,
      guided: guidesChecks(held),
    })
    setRolled({ choiceId: choice.id, result })
    setRolling(true)
    playSound('roll')
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setRolling(false)
      playSound(result.success ? 'success' : 'failure')
    }, 550)
  }

  if (rolled !== null) {
    return (
      <div className="flex flex-col gap-3">
        <RollBreakdown
          diceRoll={rolled.result.diceRoll}
          natural={rolled.result.breakdown.natural}
          parts={rolled.result.breakdown.parts}
          total={rolled.result.breakdown.total}
          targetLabel="DC"
          targetValue={rolled.result.breakdown.dc}
          targetExplainKey="dc"
          verdict={rolled.result.success ? 'good' : 'bad'}
          verdictText={rolled.result.success ? 'SUCCESS!' : 'FAILED'}
          narration={narrateCheckFully(rolled.result)}
          rolling={rolling}
        />
        {!rolling && (
          <FantasyButton
            variant="iron"
            className="self-start"
            onClick={() => onResolved(rolled.choiceId, rolled.result.success)}
          >
            Continue
          </FantasyButton>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <CastBeforeRoll character={character} />

      {choices.map((choice) => (
        <FantasyButton
          key={choice.id}
          variant="iron"
          size="lg"
          className="h-auto justify-start gap-4 py-3 text-left whitespace-normal"
          onClick={() => pick(choice)}
        >
          <span className="text-parchment">{choice.label}</span>
          <span className="ml-auto shrink-0 rounded-md border border-gold-border/40 bg-ink/60 px-2 py-0.5 font-mono text-xs text-amber-torch">
            {choice.check === undefined
              ? 'no roll'
              : `${SKILL_LABELS[choice.check.skill]} DC ${choice.check.dc}`}
          </span>
        </FantasyButton>
      ))}
    </div>
  )
}
