'use client'

import { isInRange } from '../../lib/dnd/combat.ts'
import { Button } from '../ui/button.tsx'
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
    <div className="rounded-card border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
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
            <Button
              key={attack.id}
              variant="primary"
              disabled={!usable}
              onClick={() => onAttack(attack.id)}
              title={attack.description}
            >
              {attack.name}
              {target !== undefined && !reachable && (
                <span className="text-xs font-normal">— too far, move closer</span>
              )}
            </Button>
          )
        })}

        <Button variant="secondary" disabled={!endTurnEnabled} onClick={onEndTurn}>
          End Turn
        </Button>
      </div>
    </div>
  )
}
