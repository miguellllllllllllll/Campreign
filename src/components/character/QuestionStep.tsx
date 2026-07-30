'use client'

import { Check } from 'lucide-react'
import { cn } from '../../lib/utils.ts'

export interface Choice<T extends string> {
  id: T
  label: string
  tagline: string
  detail?: string
}

export interface QuestionStepProps<T extends string> {
  question: string
  helper: string
  choices: readonly Choice<T>[]
  selected: T | null
  onSelect: (id: T) => void
}

export function QuestionStep<T extends string>({
  question,
  helper,
  choices,
  selected,
  onSelect,
}: QuestionStepProps<T>) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="flex flex-col gap-1">
        <span className="text-xl font-semibold text-parchment">{question}</span>
        <span className="text-sm text-muted">{helper}</span>
      </legend>

      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((choice) => {
          const isSelected = selected === choice.id
          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(choice.id)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-card border p-4 text-left transition-colors',
                isSelected
                  ? 'border-gold bg-gold/10'
                  : 'border-edge bg-surface hover:border-edge-bright hover:bg-surface-raised',
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-semibold text-parchment">{choice.label}</span>
                {isSelected && <Check size={16} className="shrink-0 text-gold" aria-hidden />}
              </span>
              <span className="text-sm text-muted">{choice.tagline}</span>
              {choice.detail !== undefined && (
                <span className="mt-1 text-xs leading-relaxed text-muted/80">{choice.detail}</span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
