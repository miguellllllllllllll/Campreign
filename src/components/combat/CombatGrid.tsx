'use client'

import { motion } from 'motion/react'
import { GRID_SIZE } from '../../lib/dnd/encounter.ts'
import { cn } from '../../lib/utils.ts'
import type { Combatant, GridPosition } from '../../types/combat.ts'

export interface CombatGridProps {
  combatants: readonly Combatant[]
  activeId: string | undefined
  reachable: readonly GridPosition[]
  onMove: (to: GridPosition) => void
  /** Movement squares are only offered while the step is teaching movement. */
  movementEnabled: boolean
}

function key(position: GridPosition): string {
  return `${position.x},${position.y}`
}

export function CombatGrid({
  combatants,
  activeId,
  reachable,
  onMove,
  movementEnabled,
}: CombatGridProps) {
  const reachableKeys = new Set(reachable.map(key))
  const standing = combatants.filter((combatant) => combatant.currentHp > 0)

  return (
    <div
      className="grid aspect-square w-full max-w-sm gap-1 rounded-card border border-edge bg-ink/70 p-2"
      style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
      role="grid"
      aria-label="Cellar floor, five squares by five"
    >
      {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
        const position = { x: index % GRID_SIZE, y: Math.floor(index / GRID_SIZE) }
        const occupant = standing.find(
          (combatant) =>
            combatant.position.x === position.x && combatant.position.y === position.y,
        )
        const canStepHere = movementEnabled && reachableKeys.has(key(position))

        return (
          <button
            key={key(position)}
            type="button"
            role="gridcell"
            disabled={!canStepHere}
            onClick={() => onMove(position)}
            aria-label={
              occupant !== undefined
                ? `${occupant.name}, row ${position.y + 1} column ${position.x + 1}`
                : canStepHere
                  ? `Move to row ${position.y + 1} column ${position.x + 1}`
                  : `Empty square, row ${position.y + 1} column ${position.x + 1}`
            }
            className={cn(
              'relative flex items-center justify-center rounded border text-lg transition-colors',
              canStepHere
                ? 'cursor-pointer border-gold/60 bg-gold/10 hover:bg-gold/25'
                : 'border-edge/60 bg-surface/40',
            )}
          >
            {canStepHere && occupant === undefined && (
              <span aria-hidden className="size-1.5 rounded-full bg-gold/70" />
            )}
            {occupant !== undefined && (
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                aria-hidden
                className={cn(
                  'flex size-full items-center justify-center rounded font-bold',
                  occupant.team === 'party'
                    ? 'bg-arcane/25 text-arcane'
                    : 'bg-blood/25 text-blood',
                  occupant.id === activeId && 'ring-2 ring-gold',
                )}
              >
                {occupant.name.slice(0, 1).toUpperCase()}
              </motion.span>
            )}
          </button>
        )
      })}
    </div>
  )
}
