'use client'

import { Hourglass, Swords } from 'lucide-react'
import { useState } from 'react'
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
  /** No movement and nothing in reach — say so, rather than leaving them hunting. */
  stranded?: boolean
  onAttack: (attackId: string, maneuverId?: 'trip') => void
  onEndTurn: () => void
}

export function ActionBar({
  active,
  target,
  movementRemaining,
  hasActed,
  attackEnabled,
  endTurnEnabled,
  stranded = false,
  onAttack,
  onEndTurn,
}: ActionBarProps) {
  /*
   * Armed before the swing, not chosen after it. The SRD lets a Battle Master
   * decide once they know they hit, but a second prompt mid-attack is the
   * reaction-shaped problem this slice exists to avoid — so the die is declared
   * up front and only actually spent if the attack lands.
   */
  const [tripArmed, setTripArmed] = useState(false)
  const dice = active.superiorityDice ?? 0
  const canTrip = dice > 0

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
              onClick={() => {
                onAttack(attack.id, tripArmed && attack.kind === 'weapon' ? 'trip' : undefined)
                setTripArmed(false)
              }}
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

        {canTrip && (
          <FantasyButton
            variant={tripArmed ? 'crimson' : 'iron'}
            disabled={hasActed}
            aria-pressed={tripArmed}
            onClick={() => setTripArmed((armed) => !armed)}
            title="Spend a superiority die: extra damage, and the target falls over unless it saves."
          >
            <Swords aria-hidden />
            Trip Attack
            <span className="font-mono text-xs font-normal">
              {dice}d6 left
            </span>
          </FantasyButton>
        )}

        <FantasyButton variant="iron" disabled={!endTurnEnabled} onClick={onEndTurn}>
          <Hourglass aria-hidden />
          End Turn
        </FantasyButton>
      </div>

      {stranded && (
        <p aria-live="polite" className="mt-3 text-xs leading-relaxed text-amber-torch">
          You have used all your movement and nothing is within reach. End your turn — your
          movement comes back next round.
        </p>
      )}
    </div>
  )
}
