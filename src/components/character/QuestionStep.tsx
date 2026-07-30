'use client'

import { Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { playSound } from '../../lib/sound.ts'
import { cn } from '../../lib/utils.ts'

export interface Choice<T extends string> {
  id: T
  label: string
  tagline?: string
  detail?: string
  icon?: LucideIcon
  /**
   * A class-accent utility for the icon when the card is not selected. Selected
   * cards stay gold, so the wax-seal treatment reads the same for every option.
   */
  accentClass?: string
  /** A colour to show instead of an icon, for purely cosmetic options. */
  swatch?: string
}

export interface QuestionStepProps<T extends string> {
  question: string
  helper: string
  choices: readonly Choice<T>[]
  selected: T | null
  onSelect: (id: T) => void
  /** Two-line options that do not need half the row each. */
  compact?: boolean
}

export function QuestionStep<T extends string>({
  question,
  helper,
  choices,
  selected,
  onSelect,
  compact = false,
}: QuestionStepProps<T>) {
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="flex w-full flex-col gap-1">
        <span className="rule-crimson font-serif text-xl font-semibold tracking-wide text-parchment">
          {question}
        </span>
        <span className="text-book mt-1 text-sm text-muted">{helper}</span>
      </legend>

      <div className={cn('grid gap-3.5', compact ? 'sm:grid-cols-4' : 'sm:grid-cols-2')}>
        {choices.map((choice) => {
          const isSelected = selected === choice.id
          const Icon = choice.icon

          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={isSelected}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') playSound('hover')
              }}
              onClick={() => {
                playSound('press')
                onSelect(choice.id)
              }}
              className={cn(
                'group relative flex flex-col items-start gap-2 overflow-hidden rounded-card border p-4 pt-5 text-left',
                'transition-all duration-300 ease-out',
                isSelected
                  ? 'border-amber-torch/80 bg-amber-torch/[0.07] shadow-torch'
                  : 'border-edge bg-surface/70 hover:-translate-y-0.5 hover:border-gold-border/70 hover:shadow-torch',
              )}
            >
              {/* The card's top band, the way a tarot card is headed. */}
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 h-px transition-opacity duration-300',
                  isSelected
                    ? 'bg-gradient-to-r from-transparent via-amber-torch to-transparent opacity-100'
                    : 'bg-gradient-to-r from-transparent via-gold-border/60 to-transparent opacity-40 group-hover:opacity-100',
                )}
              />
              {/* A wash rising from the base, so the card has a lit floor. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-amber-torch/[0.06] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />

              <span className="relative flex w-full items-start justify-between gap-2">
                {choice.swatch !== undefined && (
                  <span
                    aria-hidden
                    className="size-9 shrink-0 rounded-lg border"
                    style={{
                      backgroundColor: choice.swatch,
                      borderColor: choice.swatch,
                      boxShadow: `0 0 16px ${choice.swatch}66`,
                    }}
                  />
                )}
                {choice.swatch === undefined && Icon !== undefined && (
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-lg border transition-all duration-300',
                      isSelected
                        ? 'border-amber-torch/70 bg-amber-torch/15 text-amber-torch'
                        : cn(
                            'border-edge bg-ink/50 group-hover:border-gold-border/60',
                            choice.accentClass ?? 'text-muted group-hover:text-amber-torch',
                          ),
                    )}
                  >
                    <Icon size={17} aria-hidden />
                  </span>
                )}
                {isSelected && (
                  // A wax seal, so the chosen card is unmistakable at a glance.
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-amber-torch/70 bg-amber-torch text-obsidian shadow-torch">
                    <Check size={13} strokeWidth={3} aria-hidden />
                  </span>
                )}
              </span>

              <span
                className={cn(
                  'relative font-serif font-semibold tracking-wide transition-colors',
                  isSelected ? 'text-amber-torch' : 'text-parchment',
                )}
              >
                {choice.label}
              </span>
              {choice.tagline !== undefined && choice.tagline.length > 0 && (
                <span className="relative text-sm leading-snug text-muted">{choice.tagline}</span>
              )}
              {choice.detail !== undefined && (
                <span className="relative mt-0.5 text-xs leading-relaxed text-muted/75">
                  {choice.detail}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
