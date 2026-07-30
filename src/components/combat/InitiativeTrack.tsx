'use client'

import { Explain } from '../Explain.tsx'
import { cn } from '../../lib/utils.ts'
import type { Combatant } from '../../types/combat.ts'

export interface InitiativeTrackProps {
  order: readonly Combatant[]
  activeId: string | undefined
  round: number
}

export function InitiativeTrack({ order, activeId, round }: InitiativeTrackProps) {
  return (
    <div className="rounded-card border border-edge bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-parchment">
          <Explain k="initiative">Turn order</Explain>
        </h3>
        <span className="text-xs text-muted">
          <Explain k="round">Round</Explain> {round}
        </span>
      </div>

      <ol className="mt-3 space-y-2">
        {order.map((combatant) => {
          const down = combatant.currentHp <= 0
          const fraction = Math.max(0, combatant.currentHp) / combatant.maxHp

          return (
            <li
              key={combatant.id}
              aria-current={combatant.id === activeId ? 'step' : undefined}
              className={cn(
                'rounded-lg border px-3 py-2',
                combatant.id === activeId
                  ? 'border-gold/70 bg-gold/10'
                  : 'border-edge/60 bg-ink/40',
                down && 'opacity-50',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-parchment">
                  {combatant.name}
                  {combatant.id === activeId && (
                    <span className="ml-2 text-xs font-normal text-gold">acting now</span>
                  )}
                </span>
                <span className="font-mono text-xs text-muted">
                  {Math.max(0, combatant.currentHp)}/{combatant.maxHp}{' '}
                  <Explain k="hp">HP</Explain>
                </span>
              </div>

              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-edge/60"
                role="progressbar"
                aria-label={`${combatant.name} hit points`}
                aria-valuenow={Math.max(0, combatant.currentHp)}
                aria-valuemin={0}
                aria-valuemax={combatant.maxHp}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500',
                    combatant.team === 'party' ? 'bg-moss' : 'bg-blood',
                  )}
                  style={{ width: `${fraction * 100}%` }}
                />
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
