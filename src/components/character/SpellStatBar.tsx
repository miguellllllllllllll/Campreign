'use client'

import { Explain } from '../Explain.tsx'
import { D20Icon } from '../ui/custom-icons.tsx'
import { formatModifier } from '../../lib/dnd/stats.ts'
import type { Spellcasting } from '../../types/character.ts'

/**
 * The two live numbers a caster is really choosing between.
 *
 * Its own module because both the grimoire picker and the paladin's feature card
 * show it, and the paladin card is imported by the picker — sharing it from
 * either component would close a cycle.
 */
export function SpellStatBar({ spellcasting }: { spellcasting: Spellcasting }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold-border/40 bg-amber-torch/5 px-3 py-2">
      <D20Icon size={14} className="text-amber-torch" />
      <span className="font-serif text-xs text-muted">
        <Explain k="spellSaveDc">Spell Save DC</Explain>{' '}
        <span className="font-mono text-sm font-bold text-parchment">{spellcasting.saveDc}</span>
      </span>
      <span className="text-edge-bright">·</span>
      <span className="font-serif text-xs text-muted">
        <Explain k="spellAttack">Spell Attack</Explain>{' '}
        <span className="font-mono text-sm font-bold text-parchment">
          {formatModifier(spellcasting.attackBonus)}
        </span>
      </span>
    </div>
  )
}
