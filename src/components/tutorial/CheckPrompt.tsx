'use client'

import { Dices } from 'lucide-react'
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
import type { TutorialCheck } from '../../types/tutorial.ts'

export interface CheckPromptProps {
  character: Character
  check: TutorialCheck
  onResolved: (success: boolean) => void
}

export function CheckPrompt({ character, check, onResolved }: CheckPromptProps) {
  const [result, setResult] = useState<CheckResult | null>(null)
  const [rolling, setRolling] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function rollIt() {
    // Read at the moment of the roll, not at render: the player may have cast
    // it a heartbeat ago and the die has to know.
    const held = useTutorialStore.getState().concentratingOn
    const resolved = resolveCheck({
      scores: character.scores,
      skill: check.skill,
      level: character.level,
      proficientSkills: character.skillProficiencies,
      dc: check.dc,
      guided: guidesChecks(held),
    })
    setResult(resolved)
    setRolling(true)
    playSound('roll')
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setRolling(false)
      playSound(resolved.success ? 'success' : 'failure')
    }, 550)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{check.reason}</p>

      <CastBeforeRoll character={character} hidden={result !== null} />

      {result === null ? (
        <FantasyButton size="lg" className="self-start" onClick={rollIt}>
          <Dices aria-hidden />
          Roll {SKILL_LABELS[check.skill]}
        </FantasyButton>
      ) : (
        <>
          <RollBreakdown
            diceRoll={result.diceRoll}
            natural={result.breakdown.natural}
            parts={result.breakdown.parts}
            total={result.breakdown.total}
            targetLabel="DC"
            targetValue={result.breakdown.dc}
            targetExplainKey="dc"
            verdict={result.success ? 'good' : 'bad'}
            verdictText={result.success ? 'SUCCESS!' : 'FAILED'}
            narration={narrateCheckFully(result)}
            rolling={rolling}
          />

          {!rolling && (
            <FantasyButton
              variant="iron"
              className="self-start"
              onClick={() => onResolved(result.success)}
            >
              Continue
            </FantasyButton>
          )}
        </>
      )}
    </div>
  )
}
