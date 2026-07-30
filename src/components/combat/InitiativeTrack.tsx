'use client'

import { Explain } from '../Explain.tsx'
import { ResourceBar } from '../ui/resource-bar.tsx'
import { cn } from '../../lib/utils.ts'
import type { Combatant } from '../../types/combat.ts'

export interface InitiativeTrackProps {
  order: readonly Combatant[]
  activeId: string | undefined
  round: number
}

export function InitiativeTrack({ order, activeId, round }: InitiativeTrackProps) {
  return (
    <div className="rounded-card border border-edge bg-surface/70 p-4 backdrop-blur-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-sm font-semibold tracking-wide text-parchment">
          <Explain k="initiative">Turn order</Explain>
        </h3>
        <span className="font-serif text-xs text-muted">
          <Explain k="round">Round</Explain> {round}
        </span>
      </div>

      <ol className="mt-3 space-y-2">
        {order.map((combatant) => {
          const down = combatant.currentHp <= 0

          return (
            <li
              key={combatant.id}
              aria-current={combatant.id === activeId ? 'step' : undefined}
              className={cn(
                'rounded-lg border px-3 py-2 transition-all duration-300',
                combatant.id === activeId
                  ? 'border-amber-torch/70 bg-amber-torch/10 shadow-torch'
                  : 'border-edge/60 bg-ink/40',
                down && 'opacity-50 saturate-50',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-serif text-sm font-medium text-parchment">
                  {combatant.name}
                  {combatant.id === activeId && (
                    <span className="ml-2 text-xs font-normal text-amber-torch">acting now</span>
                  )}
                </span>
                <span className="font-mono text-xs text-muted">
                  {Math.max(0, combatant.currentHp)}/{combatant.maxHp}{' '}
                  <Explain k="hp">HP</Explain>
                </span>
              </div>

              <ResourceBar
                className="mt-1.5"
                current={combatant.currentHp}
                max={combatant.maxHp}
                tone={combatant.team === 'party' ? 'health' : 'foe'}
                label={`${combatant.name} hit points`}
              />
            </li>
          )
        })}
      </ol>
    </div>
  )
}
