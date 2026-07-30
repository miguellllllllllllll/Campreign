'use client'

import { Settings2 } from 'lucide-react'
import { cn } from '../../lib/utils.ts'

export interface AdvancedToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

/**
 * The opt-in switch for the advanced layer.
 *
 * Sits under the step tabs rather than inside a step, because it changes how
 * many steps there are — putting it in a step would let a player toggle it and
 * watch the ground move beneath the question they were reading.
 *
 * A real checkbox input rather than a styled div: it arrives with a role, a
 * checked state, space-bar handling and a label association already correct.
 */
export function AdvancedToggle({ enabled, onChange }: AdvancedToggleProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
        enabled
          ? 'border-gold-border/60 bg-amber-torch/5'
          : 'border-edge hover:border-gold-border/40',
      )}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-amber-torch size-4 shrink-0"
      />
      <Settings2 size={15} aria-hidden className="text-amber-torch shrink-0" />
      <span className="flex flex-col">
        <span className="font-serif text-xs font-semibold text-parchment">
          Advanced options
        </span>
        <span className="text-[11px] leading-snug text-muted">
          Adds a specialisation and a knack. Everything else stays exactly as it is.
        </span>
      </span>
    </label>
  )
}
