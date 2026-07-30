'use client'

import {
  ArrowLeft,
  ArrowRight,
  Clover,
  Coins,
  Compass,
  Crown,
  Dices,
  Feather,
  Footprints,
  HeartHandshake,
  KeyRound,
  Mountain,
  ShieldCheck,
  Swords,
  WandSparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { ParchmentCard, ParchmentCardContent } from '../ui/parchment-card.tsx'
import { CharacterCard } from './CharacterCard.tsx'
import { QuestionStep, type Choice } from './QuestionStep.tsx'
import { CLASS_PRESETS, MOTIVATION_PRESETS, RACE_PRESETS } from '../../lib/dnd/presets.ts'
import { useCharacterStore } from '../../stores/characterStore.ts'
import type { Character, ClassId, MotivationId, RaceId } from '../../types/character.ts'
import { cn } from '../../lib/utils.ts'

/** A sigil per option. Kept beside the choices, not in the rules data, which stays presentation-free. */
const CLASS_ICONS: Record<ClassId, LucideIcon> = {
  fighter: Swords,
  wizard: WandSparkles,
  rogue: Footprints,
  cleric: HeartHandshake,
}

const RACE_ICONS: Record<RaceId, LucideIcon> = {
  dwarf: Mountain,
  elf: Feather,
  human: Compass,
  halfling: Clover,
}

const MOTIVATION_ICONS: Record<MotivationId, LucideIcon> = {
  glory: Crown,
  secrets: KeyRound,
  protect: ShieldCheck,
  fortune: Coins,
}

const CLASS_CHOICES: readonly Choice<ClassId>[] = Object.values(CLASS_PRESETS).map((preset) => ({
  id: preset.id,
  label: preset.label,
  tagline: preset.tagline,
  detail: preset.description,
  icon: CLASS_ICONS[preset.id],
}))

const RACE_CHOICES: readonly Choice<RaceId>[] = Object.values(RACE_PRESETS).map((preset) => ({
  id: preset.id,
  label: preset.label,
  tagline: preset.tagline,
  detail: preset.trait,
  icon: RACE_ICONS[preset.id],
}))

const MOTIVATION_CHOICES: readonly Choice<MotivationId>[] = Object.values(MOTIVATION_PRESETS).map(
  (preset) => ({
    id: preset.id,
    label: preset.label,
    tagline: preset.tagline,
    icon: MOTIVATION_ICONS[preset.id],
  }),
)

const STEP_LABELS = ['How you fight', 'Who you are', 'Why you go'] as const

export function CreatorWizard() {
  const createCharacter = useCharacterStore((state) => state.createCharacter)

  const [step, setStep] = useState(0)
  const [classId, setClassId] = useState<ClassId | null>(null)
  const [raceId, setRaceId] = useState<RaceId | null>(null)
  const [motivationId, setMotivationId] = useState<MotivationId | null>(null)
  const [name, setName] = useState('')
  const [hero, setHero] = useState<Character | null>(null)

  const selections = [classId, raceId, motivationId]
  const canAdvance = selections[step] !== null
  const isLastQuestion = step === STEP_LABELS.length - 1

  function forge() {
    if (classId === null || raceId === null || motivationId === null) return
    setHero(createCharacter({ classId, raceId, motivationId }, name))
  }

  if (hero !== null) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="font-display bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 bg-clip-text text-3xl font-black text-transparent">
            Your hero is ready
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
              Play the tutorial
              <ArrowRight aria-hidden />
            </Link>
          </FantasyButton>
          <FantasyButton
            variant="ghost"
            size="lg"
            onClick={() => {
              setHero(null)
              setStep(0)
            }}
          >
            Start over
          </FantasyButton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 bg-clip-text text-3xl font-black text-transparent">
          Three questions
        </h1>
        <p className="mt-2 text-sm text-muted">
          Answer these and Hero Step fills in the entire character sheet — no dice notation, no
          arithmetic.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2" aria-label="Progress">
        {STEP_LABELS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? 'step' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 font-serif text-xs font-semibold tracking-wide transition-colors',
              index === step && 'border-amber-torch bg-amber-torch/10 text-amber-torch shadow-torch',
              index !== step && selections[index] !== null && 'border-moss/50 text-moss',
              index !== step && selections[index] === null && 'border-edge text-muted',
            )}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <ParchmentCard>
        <ParchmentCardContent className="pt-5">
          {step === 0 && (
            <QuestionStep
              question="When trouble starts, what do you do?"
              helper="This decides your class — the shape of everything you can do."
              choices={CLASS_CHOICES}
              selected={classId}
              onSelect={setClassId}
            />
          )}
          {step === 1 && (
            <QuestionStep
              question="What kind of person are you?"
              helper="This decides your race, which nudges your ability scores and your speed."
              choices={RACE_CHOICES}
              selected={raceId}
              onSelect={setRaceId}
            />
          )}
          {step === 2 && (
            <QuestionStep
              question="Why are you risking your neck?"
              helper="This decides your motivation, which trains you in one extra skill."
              choices={MOTIVATION_CHOICES}
              selected={motivationId}
              onSelect={setMotivationId}
            />
          )}
        </ParchmentCardContent>
      </ParchmentCard>

      {isLastQuestion && motivationId !== null && (
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
        {step > 0 && (
          <FantasyButton variant="ghost" onClick={() => setStep(step - 1)}>
            <ArrowLeft aria-hidden />
            Back
          </FantasyButton>
        )}
        {!isLastQuestion && (
          <FantasyButton disabled={!canAdvance} onClick={() => setStep(step + 1)}>
            Next
            <ArrowRight aria-hidden />
          </FantasyButton>
        )}
        {isLastQuestion && (
          <FantasyButton size="lg" disabled={!canAdvance} onClick={forge}>
            <Dices aria-hidden />
            Build my hero
          </FantasyButton>
        )}
      </div>
    </div>
  )
}
