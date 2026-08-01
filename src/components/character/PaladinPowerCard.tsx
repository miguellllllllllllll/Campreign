'use client'

import { ChevronDown, HandHeart, Lock, ScanEye, Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import { Explain } from '../Explain.tsx'
import { ParchmentCard, ParchmentCardContent } from '../ui/parchment-card.tsx'
import { SpellStatBar } from './SpellStatBar.tsx'
import {
  PALADIN_LEVEL_1_FEATURES,
  PALADIN_LEVEL_2_PREVIEW,
  type PaladinSpellPreview,
} from '../../lib/dnd/spellcasting.ts'
import { playSound } from '../../lib/sound.ts'
import { cn } from '../../lib/utils.ts'
import type { Spellcasting } from '../../types/character.ts'

export interface PaladinPowerCardProps {
  spellcasting: Spellcasting | undefined
}

/**
 * A spell the player cannot take yet.
 *
 * Rendered as a div rather than a disabled button on purpose: there is no action
 * to perform, and a focusable control that refuses every press is worse for a
 * screen reader than plain content carrying its own "Unlocks at Level 2" label.
 */
function LockedSpellCard({ spell }: { spell: PaladinSpellPreview }) {
  return (
    <div className="rounded-card flex flex-col gap-1 border border-edge border-dashed bg-surface-raised/20 p-3 opacity-70">
      <span className="flex items-start justify-between gap-2">
        <span className="font-serif text-sm font-semibold text-parchment">{spell.name}</span>
        <Lock size={13} aria-hidden className="mt-0.5 shrink-0 text-muted" />
      </span>

      <span className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="rounded-full border border-edge px-1.5 py-px font-serif text-muted">
          1st Level
        </span>
        <span className="rounded-full border border-edge px-1.5 py-px font-serif text-muted">
          {spell.school}
        </span>
        <span className="rounded-full bg-arcane/15 px-1.5 py-px font-mono text-arcane">
          {spell.effect}
        </span>
      </span>

      <span className="text-[11px] leading-snug text-muted">{spell.description}</span>

      <span className="flex flex-wrap items-center gap-2 text-[10px] text-muted">
        <span className="rounded-full border border-amber-torch/40 px-1.5 py-px font-serif text-amber-torch/90">
          Unlocks at Level 2
        </span>
        {spell.isConcentration && (
          <Explain k="concentration">
            <span className="text-amber-torch/80">Concentration</span>
          </Explain>
        )}
      </span>
    </div>
  )
}

/**
 * What a 1st-level paladin has instead of a spell picker.
 *
 * The step explains the class rather than skipping it: the two innate features
 * are the whole of the answer at level 1, and the spells that arrive at level 2
 * stay folded away until asked for, so a beginner is never handed four spells
 * they cannot cast.
 */
export function PaladinPowerCard({ spellcasting }: PaladinPowerCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const previewId = useId()

  function togglePreview() {
    playSound('press')
    setPreviewOpen((open) => !open)
  }

  return (
    <ParchmentCard>
      <ParchmentCardContent className="flex flex-col gap-3 pt-5">
        <div>
          <h2 className="font-serif text-base font-semibold text-parchment">Sacred Power</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Your oath begins in earnest at level 2, where you unlock 1st-level paladin spells. At
            level 1 your faith shows up as innate divine ability instead.
          </p>
        </div>

        {spellcasting !== undefined && <SpellStatBar spellcasting={spellcasting} />}

        <div className="grid gap-2 sm:grid-cols-2">
          {PALADIN_LEVEL_1_FEATURES.map((feature) => {
            // Both values read "<amount> / <period>", so the period can carry its
            // own tooltip without the copy being written out twice.
            const [amount, period] = feature.value.split(' / ')
            return (
              <div key={feature.id} className="rounded-card border border-edge p-3">
                <p className="flex items-center gap-2 font-serif text-sm font-semibold text-parchment">
                  {feature.id === 'layOnHands' ? (
                    <HandHeart size={15} aria-hidden className="text-amber-torch" />
                  ) : (
                    <ScanEye size={15} aria-hidden className="text-amber-torch" />
                  )}
                  {feature.name}
                </p>
                <p className="mt-1 font-mono text-xs text-amber-torch">
                  {amount}
                  {period !== undefined && (
                    <>
                      {' / '}
                      {period === 'Long Rest' ? (
                        <Explain k="longRest">Long Rest</Explain>
                      ) : (
                        period
                      )}
                    </>
                  )}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-muted">{feature.description}</p>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={togglePreview}
            aria-expanded={previewOpen}
            aria-controls={previewId}
            className={cn(
              'flex items-center gap-2 self-start rounded-lg px-1 py-0.5',
              'font-serif text-xs text-muted transition-colors hover:text-parchment',
              'focus-visible:ring-gold-border focus-visible:ring-2 focus-visible:outline-none',
            )}
          >
            <Sparkles size={13} aria-hidden className="text-amber-torch" />
            Preview Level 2 Spells
            <ChevronDown
              size={14}
              aria-hidden
              className={cn('transition-transform', previewOpen && 'rotate-180')}
            />
          </button>

          {previewOpen && (
            <div id={previewId} className="flex flex-col gap-2">
              <p className="text-[11px] leading-snug text-muted">
                You cannot cast these yet — they arrive with your first spell slots at level 2.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PALADIN_LEVEL_2_PREVIEW.map((spell) => (
                  <LockedSpellCard key={spell.id} spell={spell} />
                ))}
              </div>
            </div>
          )}
        </div>
      </ParchmentCardContent>
    </ParchmentCard>
  )
}
