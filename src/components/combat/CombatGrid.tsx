'use client'

import { motion } from 'motion/react'
import { CreatureToken } from '../ui/creature-icons.tsx'
import { GRID_SIZE } from '../../lib/dnd/encounter.ts'
import { isDead, isDown, isStable } from '../../lib/dnd/dying.ts'
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

/** Everyone on their feet reads as nothing; the fallen say which kind. */
function describeFallen(combatant: Combatant): string {
  if (!isDown(combatant)) return ''
  return isStable(combatant) ? ', down but stable' : ', down and dying'
}

export function CombatGrid({
  combatants,
  activeId,
  reachable,
  onMove,
  movementEnabled,
}: CombatGridProps) {
  const reachableKeys = new Set(reachable.map(key))
  /*
   * The dead leave the board; the dying stay on it, lying where they fell.
   * Filtering on hit points alone made a downed hero vanish, which read as
   * "gone" when the whole point of the new rule is that they are still there
   * and can still be reached.
   */
  const present = combatants.filter((combatant) => !isDead(combatant))

  return (
    <div
      className="grid aspect-square w-full max-w-sm gap-1 rounded-card border border-gold-border/40 bg-ink/70 p-2 shadow-[inset_0_0_30px_rgb(0_0_0/0.6)]"
      style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
      role="grid"
      aria-label="Cellar floor, five squares by five"
    >
      {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
        const position = { x: index % GRID_SIZE, y: Math.floor(index / GRID_SIZE) }
        const occupant = present.find(
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
                ? `${occupant.name}${describeFallen(occupant)}, row ${position.y + 1} `
                  + `column ${position.x + 1}`
                : canStepHere
                  ? `Move to row ${position.y + 1} column ${position.x + 1}`
                  : `Empty square, row ${position.y + 1} column ${position.x + 1}`
            }
            className={cn(
              'relative flex items-center justify-center rounded border text-lg transition-colors',
              canStepHere
                ? 'cursor-pointer border-amber-torch/60 bg-amber-torch/10 shadow-[inset_0_0_12px_rgb(212_175_55/0.2)] hover:bg-amber-torch/25'
                : 'border-edge/60 bg-surface/40 shadow-[inset_0_1px_0_rgb(244_232_193/0.04)]',
            )}
          >
            {canStepHere && occupant === undefined && (
              <span
                aria-hidden
                className="animate-rune-pulse size-1.5 rounded-full bg-amber-torch shadow-[0_0_8px_rgb(212_175_55/0.8)]"
              />
            )}
            {occupant !== undefined && (
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                aria-hidden
                className={cn(
                  'flex size-full items-center justify-center rounded font-display',
                  // Only the unpainted fall back to team colour. A hero brings
                  // the aura they chose in creation, which is what the loadout
                  // step promised when it asked what colour they burn on the map.
                  occupant.cosmetics === undefined &&
                    (occupant.team === 'party'
                      ? 'bg-gradient-to-b from-arcane/35 to-arcane/10 text-arcane'
                      : 'bg-gradient-to-b from-blood/35 to-blood/10 text-blood'),
                  occupant.id === activeId && 'ring-2 ring-amber-torch shadow-torch',
                  // Face down and drained of colour. Legible at a glance as
                  // "still here, not up", which is the whole state.
                  isDown(occupant) && 'rotate-90 opacity-45 grayscale',
                )}
                style={
                  occupant.cosmetics === undefined
                    ? undefined
                    : {
                        backgroundColor: `${occupant.cosmetics.auraColor}2e`,
                        color: occupant.cosmetics.auraColor,
                        boxShadow: `inset 0 0 14px ${occupant.cosmetics.auraColor}47`,
                      }
                }
              >
                {occupant.tokenId === undefined ? (
                  occupant.name.slice(0, 1).toUpperCase()
                ) : (
                  <CreatureToken token={occupant.tokenId} className="size-[68%]" />
                )}
              </motion.span>
            )}
          </button>
        )
      })}
    </div>
  )
}
