'use client'

import { Hourglass, Swords } from 'lucide-react'
import { isInRange } from '../../lib/dnd/combat.ts'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { Explain } from '../Explain.tsx'
import type { Combatant } from '../../types/combat.ts'

export interface ActionBarProps {
  active: Combatant
  target: Combatant | undefined
  movementRemaining: number
  hasActed: boolean
  attackEnabled: boolean
  endTurnEnabled: boolean
  onAttack: (attackId: string) => void
  onEndTurn: () => void
}

export function ActionBar({
  active,
  target,
  movementRemaining,
  hasActed,
  attackEnabled,
  endTurnEnabled,
  onAttack,
  onEndTurn,
}: ActionBarProps) {
  return (
    <div className="border-gold-ornate rounded-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-serif text-xs text-muted">
        <span>
          <Explain k="movement">Movement</Explain> left:{' '}
          <span className="font-mono text-parchment">
            {movementRemaining} {movementRemaining === 1 ? 'square' : 'squares'}
          </span>
        </span>
        <span>
          <Explain k="action">Action</Explain>:{' '}
          <span className="font-mono text-parchment">{hasActed ? 'used' : 'ready'}</span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {active.attacks.map((attack) => {
          const reachable = target !== undefined && isInRange(active, target, attack)
          const usable = attackEnabled && !hasActed && target !== undefined && reachable

          return (
            <FantasyButton
              key={attack.id}
              variant="brass"
              disabled={!usable}
              onClick={() => onAttack(attack.id)}
              title={attack.description}
            >
              <Swords aria-hidden />
              {attack.name}
              {target !== undefined && !reachable && (
                <span className="text-xs font-normal">— too far, move closer</span>
              )}
            </FantasyButton>
          )
        })}

        <FantasyButton variant="iron" disabled={!endTurnEnabled} onClick={onEndTurn}>
          <Hourglass aria-hidden />
          End Turn
        </FantasyButton>
      </div>
    </div>
  )
}
