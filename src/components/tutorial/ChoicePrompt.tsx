'use client'

import { useRef, useState } from 'react'
import { resolveCheck, type CheckResult } from '../../lib/dnd/checks.ts'
import { narrateCheckFully } from '../../lib/dnd/narrate.ts'
import { SKILL_LABELS } from '../../lib/dnd/stats.ts'
import { Button } from '../ui/button.tsx'
import { RollBreakdown } from '../dice/RollBreakdown.tsx'
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

    const result = resolveCheck({
      scores: character.scores,
      skill: choice.check.skill,
      level: character.level,
      proficientSkills: character.skillProficiencies,
      dc: choice.check.dc,
    })
    setRolled({ choiceId: choice.id, result })
    setRolling(true)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => setRolling(false), 550)
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
          <Button
            variant="secondary"
            className="self-start"
            onClick={() => onResolved(rolled.choiceId, rolled.result.success)}
          >
            Continue
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice) => (
        <Button
          key={choice.id}
          variant="secondary"
          size="lg"
          className="h-auto justify-start whitespace-normal py-3 text-left"
          onClick={() => pick(choice)}
        >
          <span>{choice.label}</span>
          <span className="ml-auto shrink-0 font-mono text-xs text-gold">
            {choice.check === undefined
              ? 'no roll'
              : `${SKILL_LABELS[choice.check.skill]} DC ${choice.check.dc}`}
          </span>
        </Button>
      ))}
    </div>
  )
}
