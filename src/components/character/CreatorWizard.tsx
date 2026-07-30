'use client'

import {
  ArrowLeft,
  ArrowRight,
  Clover,
  Compass,
  Crown,
  Dices,
  Droplets,
  Feather,
  Flame,
  Footprints,
  Hammer,
  HeartHandshake,
  HeartPulse,
  KeyRound,
  Mountain,
  Shield,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sun,
  Swords,
  WandSparkles,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { useState } from 'react'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { ParchmentCard, ParchmentCardContent } from '../ui/parchment-card.tsx'
import { CharacterCard } from './CharacterCard.tsx'
import { ExportPdfButton } from './ExportPdfButton.tsx'
import { HeroPreview } from './HeroPreview.tsx'
import { QuestionStep, type Choice } from './QuestionStep.tsx'
import { CREATION_STEPS, choicesFor, stepAnswered } from '../../content/creationQuestions.ts'
import type { CreationField, CreationFieldId } from '../../content/creationQuestions.ts'
import { previewCharacter } from '../../lib/dnd/characterBuilder.ts'
import { AURA_PRESETS } from '../../lib/dnd/presets.ts'
import { useCharacterStore } from '../../stores/characterStore.ts'
import type { Character, CreationAnswers, CreationDraft } from '../../types/character.ts'
import { cn } from '../../lib/utils.ts'

/**
 * A sigil per option, keyed by the option's id. Kept here rather than in the
 * rules data, which stays presentation-free. Options with no entry — the flaws,
 * which are sentences — simply render without one.
 */
const OPTION_ICONS: Record<string, LucideIcon> = {
  fighter: Swords,
  wizard: WandSparkles,
  rogue: Footprints,
  cleric: HeartHandshake,
  paladin: ShieldCheck,

  dwarf: Mountain,
  elf: Feather,
  human: Compass,
  halfling: Clover,
  tiefling: Flame,

  guildArtisan: Hammer,
  streetUrchin: KeyRound,
  noble: Crown,

  defensive: Shield,
  offensive: Swords,

  rayOfFrost: Snowflake,
  shockingGrasp: Zap,
  acidSplash: Droplets,
  guidance: Sparkles,
  light: Sun,
  spareTheDying: HeartPulse,
}

/** The preview is recomputed on every keystroke, so its identity must be stable. */
const PREVIEW_META = { id: 'preview', now: 0 }

function isComplete(draft: CreationDraft): draft is CreationAnswers {
  return CREATION_STEPS.every((step) => stepAnswered(step, draft))
}

export function CreatorWizard() {
  const createCharacter = useCharacterStore((state) => state.createCharacter)

  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<CreationDraft>({})
  const [name, setName] = useState('')
  const [hero, setHero] = useState<Character | null>(null)

  const step = CREATION_STEPS[stepIndex]
  if (step === undefined) throw new Error(`No creation step at index ${stepIndex}`)

  const isLastStep = stepIndex === CREATION_STEPS.length - 1
  const canAdvance = stepAnswered(step, draft)
  const preview = previewCharacter(draft, name, PREVIEW_META)

  /**
   * Records an answer and drops any later answer it invalidates: a new class
   * offers different spells and loadouts, a new background different flaws.
   */
  function answer(fieldId: CreationFieldId, value: string) {
    setDraft((previous) => {
      const next = { ...previous, [fieldId]: value } as CreationDraft
      if (fieldId === 'classId') {
        delete next.spellId
        delete next.equipmentChoice
      }
      if (fieldId === 'backgroundId') delete next.flawId
      return next
    })
  }

  function forge() {
    if (!isComplete(draft)) return
    setHero(createCharacter(draft, name))
  }

  if (hero !== null) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="font-display bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 bg-clip-text text-3xl font-black text-transparent">
            {hero.name} is ready
          </h1>
          <p className="mt-2 text-sm text-muted">
            Every number below was worked out for you. Hover or tap any underlined label to find out
            what it means.
          </p>
        </div>

        <CharacterCard character={hero} />

        <div className="flex flex-wrap gap-2">
          <FantasyButton asChild size="lg">
            <Link href="/tutorial">
              Play the tutorial — The Goblin in the Cellar
              <ArrowRight aria-hidden />
            </Link>
          </FantasyButton>
          <FantasyButton asChild variant="ghost" size="lg">
            <Link href="/arena">Free play practice arena</Link>
          </FantasyButton>
          <ExportPdfButton />
          <FantasyButton
            variant="ghost"
            size="lg"
            onClick={() => {
              setHero(null)
              setDraft({})
              setName('')
              setStepIndex(0)
            }}
          >
            Build another
          </FantasyButton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 bg-clip-text text-3xl font-black text-transparent">
          {step.title}
        </h1>
        <p className="mt-2 text-sm text-muted">{step.subtitle}</p>
      </div>

      <ol className="flex flex-wrap gap-2" aria-label="Progress">
        {CREATION_STEPS.map((candidate, index) => (
          <li
            key={candidate.id}
            aria-current={index === stepIndex ? 'step' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 font-serif text-xs font-semibold tracking-wide transition-colors',
              index === stepIndex &&
                'border-amber-torch bg-amber-torch/10 text-amber-torch shadow-torch',
              index !== stepIndex && stepAnswered(candidate, draft) && 'border-moss/50 text-moss',
              index !== stepIndex && !stepAnswered(candidate, draft) && 'border-edge text-muted',
            )}
          >
            {index + 1}. {candidate.title}
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-5">
          {/*
            The key remounts the panel per step, so each one slides in. There is
            deliberately no exit animation: gating the incoming step on the
            outgoing one leaves the wizard blank whenever animation frames are
            not being delivered, such as in a backgrounded tab.
          */}
          <motion.div
            key={step.id}
            initial={{ x: 24 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="flex flex-col gap-5"
          >
            {step.fields.map((field) => (
              <FieldCard key={field.id} field={field} draft={draft} onAnswer={answer} />
            ))}
          </motion.div>

          {isLastStep && canAdvance && (
            <ParchmentCard>
              <ParchmentCardContent className="flex flex-col gap-2 pt-5">
                <label
                  htmlFor="hero-name"
                  className="font-serif text-sm font-semibold tracking-wide text-parchment"
                >
                  What are you called?
                </label>
                <input
                  id="hero-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Leave blank and we will call you Unnamed Hero"
                  maxLength={40}
                  className="h-10 rounded-lg border border-edge bg-ink/70 px-3 text-sm text-parchment transition-colors placeholder:text-muted/60 focus:border-gold-border/70"
                />
              </ParchmentCardContent>
            </ParchmentCard>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {stepIndex > 0 && (
              <FantasyButton variant="ghost" onClick={() => setStepIndex(stepIndex - 1)}>
                <ArrowLeft aria-hidden />
                Back
              </FantasyButton>
            )}
            {!isLastStep && (
              <FantasyButton disabled={!canAdvance} onClick={() => setStepIndex(stepIndex + 1)}>
                Next
                <ArrowRight aria-hidden />
              </FantasyButton>
            )}
            {isLastStep && (
              <FantasyButton size="lg" disabled={!isComplete(draft)} onClick={forge}>
                <Dices aria-hidden />
                Finalize hero
              </FantasyButton>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <HeroPreview hero={preview} draft={draft} />
        </div>
      </div>
    </div>
  )
}

function FieldCard({
  field,
  draft,
  onAnswer,
}: {
  field: CreationField
  draft: CreationDraft
  onAnswer: (fieldId: CreationFieldId, value: string) => void
}) {
  const choices = choicesFor(field, draft)
  if (choices.length === 0) return null

  const options: readonly Choice<string>[] = choices.map((choice) => {
    const icon = OPTION_ICONS[choice.id]
    const swatch = AURA_PRESETS[choice.id as keyof typeof AURA_PRESETS]?.cosmetics.auraColor
    return {
      id: choice.id,
      label: choice.label,
      tagline: choice.tagline,
      ...(choice.detail === undefined ? {} : { detail: choice.detail }),
      ...(icon === undefined ? {} : { icon }),
      ...(swatch === undefined ? {} : { swatch }),
    }
  })

  return (
    <ParchmentCard>
      <ParchmentCardContent className="pt-5">
        <QuestionStep
          question={field.question}
          helper={field.helper}
          choices={options}
          selected={draft[field.id] ?? null}
          onSelect={(value) => onAnswer(field.id, value)}
          {...(field.compact === true ? { compact: true } : {})}
        />
      </ParchmentCardContent>
    </ParchmentCard>
  )
}
