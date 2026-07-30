'use client'

import { Swords } from 'lucide-react'
import { useRef, useState } from 'react'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { Explain } from '../Explain.tsx'
import { RollBreakdown, type Verdict } from '../dice/RollBreakdown.tsx'
import { playSound } from '../../lib/sound.ts'
import { characterToCombatant } from '../../lib/dnd/combatants.ts'
import { resolveAttack } from '../../lib/dnd/combat.ts'
import { TRAINING_DUMMY, spawnMonster } from '../../lib/dnd/data/monsters.ts'
import { narrateAttackFully } from '../../lib/dnd/narrate.ts'
import { attackBonus, damageNotation } from '../../lib/dnd/characterBuilder.ts'
import { formatModifier } from '../../lib/dnd/stats.ts'
import type { AttackAction } from '../../types/action.ts'
import type { Character } from '../../types/character.ts'
import type { AttackOutcome } from '../../types/combat.ts'

const VERDICTS: Record<AttackOutcome['kind'], { verdict: Verdict; text: string }> = {
  crit: { verdict: 'great', text: 'CRITICAL HIT!' },
  hit: { verdict: 'good', text: 'HIT!' },
  miss: { verdict: 'bad', text: 'MISS' },
  fumble: { verdict: 'awful', text: 'CRITICAL MISS' },
}

interface Attempt {
  attack: AttackAction
  outcome: AttackOutcome
}

export function AttackPractice({ character }: { character: Character }) {
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [rolling, setRolling] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function swing(attack: AttackAction) {
    const attacker = characterToCombatant(character, { position: { x: 0, y: 0 } })
    const dummy = spawnMonster(TRAINING_DUMMY, { id: 'dummy', position: { x: 1, y: 0 } })
    const outcome = resolveAttack({ attacker, target: dummy, attack })

    setAttempt({ attack, outcome })
    setRolling(true)
    playSound('roll')
    if (timer.current !== null) clearTimeout(timer.current)
    // The verdict chime waits for the dice to settle, so it reads as the result
    // of the roll rather than part of the throw.
    timer.current = setTimeout(() => {
      setRolling(false)
      playSound(outcome.kind === 'hit' || outcome.kind === 'crit' ? 'success' : 'failure')
    }, 550)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-serif text-xs font-semibold tracking-wide text-muted uppercase">
        Try an <Explain k="action">Action</Explain> against a practice dummy
      </p>

      <div className="flex flex-wrap gap-2">
        {character.attacks.map((attack) => (
          <FantasyButton
            key={attack.id}
            variant="iron"
            onClick={() => swing(attack)}
            title={attack.description}
          >
            <Swords aria-hidden />
            {attack.name}
            <span className="font-mono text-xs text-amber-torch">
              {formatModifier(attackBonus(attack, character.scores, character.level))} to hit,{' '}
              {damageNotation(attack, character.scores)} dmg
            </span>
          </FantasyButton>
        ))}
      </div>

      {attempt !== null && (
        <RollBreakdown
          diceRoll={attempt.outcome.attackRoll}
          natural={attempt.outcome.breakdown.natural}
          parts={attempt.outcome.breakdown.parts}
          total={attempt.outcome.breakdown.total}
          targetLabel="Practice Dummy AC"
          targetValue={attempt.outcome.breakdown.targetAc}
          targetExplainKey="ac"
          verdict={VERDICTS[attempt.outcome.kind].verdict}
          verdictText={VERDICTS[attempt.outcome.kind].text}
          narration={narrateAttackFully(
            attempt.outcome,
            'Practice Dummy',
            attempt.attack.damageType,
          )}
          rolling={rolling}
        />
      )}
    </div>
  )
}
