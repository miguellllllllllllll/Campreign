'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Explain } from '../Explain.tsx'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { ParchmentCard, ParchmentCardContent } from '../ui/parchment-card.tsx'
import { PaladinPowerCard } from './PaladinPowerCard.tsx'
import { SpellStatBar } from './SpellStatBar.tsx'
import { SPELLS_BY_ID, spellsByIds, spellsFor } from '../../content/spells.ts'
import type { Spell } from '../../content/spells.ts'
import { getSpellcastingLimits } from '../../lib/dnd/spellcasting.ts'
import { abilityModifier } from '../../lib/dnd/stats.ts'
import { playSound } from '../../lib/sound.ts'
import { cn } from '../../lib/utils.ts'
import type { AbilityScores, ClassId, Spellcasting } from '../../types/character.ts'

export interface SpellSelection {
  cantripIds: string[]
  preparedSpellIds: string[]
}

export interface SpellSelectionWizardProps {
  classId: ClassId
  cantripIds: readonly string[]
  preparedSpellIds: readonly string[]
  scores: AbilityScores
  spellcasting: Spellcasting | undefined
  onChange: (next: SpellSelection) => void
}

function Counter({ label, taken, of }: { label: React.ReactNode; taken: number; of: number }) {
  const full = taken === of
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 font-serif text-xs font-semibold',
        full ? 'border-moss/60 text-moss' : 'border-amber-torch/60 text-amber-torch',
      )}
    >
      {label} {taken}/{of}
    </span>
  )
}

function SpellCard({
  spell,
  selected,
  disabled,
  onToggle,
}: {
  spell: Spell
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  /*
   * Full means "you cannot take another", not "you may not read this one".
   * `disabled` would say both: once the last cantrip slot was filled every
   * remaining card left the tab order, so a player choosing without a mouse
   * lost the ability to compare what they had passed over.
   */
  const full = disabled && !selected

  return (
    <button
      type="button"
      onClick={() => {
        if (!full) onToggle()
      }}
      aria-pressed={selected}
      aria-disabled={full}
      className={cn(
        'rounded-card flex flex-col gap-1 border p-3 text-left transition-colors',
        'aria-disabled:cursor-not-allowed aria-disabled:opacity-40',
        selected
          ? 'border-gold-ornate shadow-torch'
          : 'border-edge bg-surface-raised/40 hover:border-gold-border/60',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="font-serif text-sm font-semibold text-parchment">{spell.name}</span>
        {selected && <Check size={14} aria-hidden className="mt-0.5 shrink-0 text-amber-torch" />}
      </span>

      <span className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="rounded-full border border-edge px-1.5 py-px font-serif text-muted">
          {spell.level === 0 ? 'Cantrip' : '1st Level'}
        </span>
        <span className="rounded-full border border-edge px-1.5 py-px font-serif text-muted">
          {spell.school}
        </span>
        <span className="rounded-full bg-arcane/15 px-1.5 py-px font-mono text-arcane">
          {spell.damageOrEffect}
        </span>
      </span>

      <span className="text-[11px] leading-snug text-muted">{spell.description}</span>

      <span className="flex flex-wrap gap-2 text-[10px] text-muted/80">
        <span>Range: {spell.range}</span>
        {spell.isConcentration && <span className="text-amber-torch/80">Concentration</span>}
      </span>
    </button>
  )
}

/**
 * Progressive disclosure. The style question upstream already produced a legal
 * spell list, so this step shows what a player got and only unfolds the full
 * grid when they ask for it. A beginner never has to read sixteen spells; someone
 * who wants to is one click away.
 */
export function SpellSelectionWizard({
  classId,
  cantripIds,
  preparedSpellIds,
  scores,
  spellcasting,
  onChange,
}: SpellSelectionWizardProps) {
  const [customizing, setCustomizing] = useState(false)

  if (classId === 'paladin') return <PaladinPowerCard spellcasting={spellcasting} />


  if (classId !== 'wizard' && classId !== 'cleric') return null

  const wisMod = abilityModifier(scores.wis)
  const intMod = abilityModifier(scores.int)
  const limits = getSpellcastingLimits(classId, wisMod, intMod)

  const chosenCantrips = spellsByIds(cantripIds)
  const chosenPrepared = spellsByIds(preparedSpellIds)

  /** Toggling respects the cap: a full list refuses rather than silently swapping. */
  function toggle(spell: Spell) {
    const isCantrip = spell.level === 0
    const current = isCantrip ? [...cantripIds] : [...preparedSpellIds]
    const cap = isCantrip ? limits.cantripsCount : limits.preparedSpellsCount
    const at = current.indexOf(spell.id)

    if (at >= 0) current.splice(at, 1)
    else if (current.length < cap) current.push(spell.id)
    else return

    playSound('press')
    onChange({
      cantripIds: isCantrip ? current : [...cantripIds],
      preparedSpellIds: isCantrip ? [...preparedSpellIds] : current,
    })
  }

  const cantripsFull = cantripIds.length >= limits.cantripsCount
  const preparedFull = preparedSpellIds.length >= limits.preparedSpellsCount

  return (
    <ParchmentCard>
      <ParchmentCardContent className="flex flex-col gap-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-base font-semibold text-parchment">
            Your Prepared Grimoire
          </h2>
          <span className="flex flex-wrap gap-1.5">
            <Counter
              label={<Explain k="cantrip">Cantrips</Explain>}
              taken={cantripIds.length}
              of={limits.cantripsCount}
            />
            <Counter
              label={<Explain k="preparedSpell">1st Level</Explain>}
              taken={preparedSpellIds.length}
              of={limits.preparedSpellsCount}
            />
          </span>
        </div>

        {spellcasting !== undefined && <SpellStatBar spellcasting={spellcasting} />}

        {!customizing && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {[...chosenCantrips, ...chosenPrepared].map((spell) => (
                <span
                  key={spell.id}
                  className="flex items-center gap-1.5 rounded-full border border-gold-border/50 bg-surface-raised/60 px-2.5 py-1 text-xs text-parchment"
                >
                  <Check size={12} aria-hidden className="text-moss" />
                  {spell.name}
                  <span className="text-[10px] text-muted">
                    {spell.level === 0 ? 'Cantrip' : '1st'}
                  </span>
                </span>
              ))}
            </div>
            <FantasyButton variant="ghost" size="sm" onClick={() => setCustomizing(true)}>
              <ChevronDown aria-hidden />
              Customize spells
            </FantasyButton>
          </>
        )}

        {customizing && (
          <div className="flex flex-col gap-3">
            {([0, 1] as const).map((level) => (
              <div key={level}>
                <p className="mb-1.5 font-serif text-xs font-semibold tracking-wide text-muted uppercase">
                  {level === 0 ? (
                    <Explain k="cantrip">Cantrips</Explain>
                  ) : (
                    <Explain k="preparedSpell">1st-Level Spells</Explain>
                  )}
                </p>
                {spellsFor(classId, level).some((spell) => spell.isConcentration) && (
                  <p className="mb-1.5 text-[10px] leading-snug text-muted/80">
                    Some of these need <Explain k="concentration">Concentration</Explain>.
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  {spellsFor(classId, level).map((spell) => (
                    <SpellCard
                      key={spell.id}
                      spell={spell}
                      selected={
                        level === 0
                          ? cantripIds.includes(spell.id)
                          : preparedSpellIds.includes(spell.id)
                      }
                      disabled={level === 0 ? cantripsFull : preparedFull}
                      onToggle={() => toggle(spell)}
                    />
                  ))}
                </div>
              </div>
            ))}
            <FantasyButton variant="ghost" size="sm" onClick={() => setCustomizing(false)}>
              Done customizing
            </FantasyButton>
          </div>
        )}
      </ParchmentCardContent>
    </ParchmentCard>
  )
}

/** Named export kept for the sheet, which prints spells by id. */
export function spellNames(ids: readonly string[]): string {
  return ids
    .map((id) => SPELLS_BY_ID[id]?.name)
    .filter((name): name is string => name !== undefined)
    .join(', ')
}
