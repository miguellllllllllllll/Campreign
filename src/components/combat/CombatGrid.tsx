'use client'

import { motion } from 'motion/react'
import { useRef, useState } from 'react'
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

function clamp(value: number): number {
  return Math.max(0, Math.min(GRID_SIZE - 1, value))
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

  /**
   * Which square the keyboard is standing on. A grid is one tab stop, not
   * twenty-five, so exactly one cell carries tabIndex 0 and the arrows move it
   * — the roving-tabindex pattern. Starting it on the active combatant means
   * the first Tab lands a player where they already are rather than in a
   * corner they have to walk out of.
   */
  const active = combatants.find((combatant) => combatant.id === activeId)
  const [cursor, setCursor] = useState<GridPosition>(active?.position ?? { x: 0, y: 0 })
  const cells = useRef(new Map<string, HTMLButtonElement | null>())

  /**
   * The cursor again, kept in a ref because the handler has to read it
   * synchronously. Holding an arrow key fires keydown faster than React
   * re-renders, and a handler closing over state would then compute every step
   * from the same stale square — the cursor sticks, or walks backwards off an
   * edge. State drives the rendered tabIndex; this drives the arithmetic.
   */
  const cursorRef = useRef(cursor)

  function focusCell(next: GridPosition) {
    cursorRef.current = next
    setCursor(next)
    cells.current.get(key(next))?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const { x, y } = cursorRef.current
    const next: GridPosition | null =
      event.key === 'ArrowLeft'
        ? { x: clamp(x - 1), y }
        : event.key === 'ArrowRight'
          ? { x: clamp(x + 1), y }
          : event.key === 'ArrowUp'
            ? { x, y: clamp(y - 1) }
            : event.key === 'ArrowDown'
              ? { x, y: clamp(y + 1) }
              : event.key === 'Home'
                ? event.ctrlKey
                  ? { x: 0, y: 0 }
                  : { x: 0, y }
                : event.key === 'End'
                  ? event.ctrlKey
                    ? { x: GRID_SIZE - 1, y: GRID_SIZE - 1 }
                    : { x: GRID_SIZE - 1, y }
                  : null

    // Enter and Space are handled rather than left to the button's native
    // activation. That default is real, but it is also invisible — it produces
    // no keydown of its own, so nothing downstream can confirm it fired, and a
    // single preventDefault anywhere above would remove the only way to move
    // without a mouse. preventDefault here is what stops a double-fire.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const at = cursorRef.current
      if (movementEnabled && reachableKeys.has(key(at))) onMove(at)
      return
    }

    if (next === null) return
    event.preventDefault()
    focusCell(next)
  }

  return (
    <div
      className="flex aspect-square w-full max-w-sm flex-col gap-1 rounded-card border border-gold-border/40 bg-ink/70 p-2 shadow-[inset_0_0_30px_rgb(0_0_0/0.6)]"
      role="grid"
      aria-label="Cellar floor, five squares by five. Use the arrow keys to read the board."
      onKeyDown={onKeyDown}
    >
      {Array.from({ length: GRID_SIZE }, (_, y) => (
        // Real rows, because `role="grid"` requires them and a flat list of
        // cells is not a grid to a screen reader. Flex rather than a CSS grid
        // with `display: contents`, which has a history of dropping rows out
        // of the accessibility tree.
        <div key={y} role="row" className="flex flex-1 gap-1">
          {Array.from({ length: GRID_SIZE }, (_, x) => {
            const position = { x, y }
            const occupant = present.find(
              (combatant) =>
                combatant.position.x === position.x && combatant.position.y === position.y,
            )
            const canStepHere = movementEnabled && reachableKeys.has(key(position))
            const isCursor = cursor.x === x && cursor.y === y

            return (
              <button
                key={key(position)}
                type="button"
                role="gridcell"
                // Never `disabled`. A disabled button leaves the tab order and
                // stops being announced, which meant the whole board — every
                // token, every empty square — was unreadable without a mouse.
                // The label already says whether a square can be stepped on.
                tabIndex={isCursor ? 0 : -1}
                ref={(node) => {
                  cells.current.set(key(position), node)
                }}
                onFocus={() => {
                  cursorRef.current = position
                  setCursor(position)
                }}
                onClick={() => {
                  if (canStepHere) onMove(position)
                }}
                aria-label={
                  occupant !== undefined
                    ? `${occupant.name}${describeFallen(occupant)}, row ${position.y + 1} column ${position.x + 1}`
                    : canStepHere
                      ? `Move to row ${position.y + 1} column ${position.x + 1}`
                      : `Empty square, row ${position.y + 1} column ${position.x + 1}`
                }
                className={cn(
                  'relative flex flex-1 items-center justify-center rounded border text-lg transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-parchment focus-visible:ring-offset-1 focus-visible:ring-offset-ink focus-visible:outline-none',
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
      ))}
    </div>
  )
}
