'use client'

import { ArrowLeft, ArrowRight, Dices } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '../ui/button.tsx'
import { Card, CardContent } from '../ui/card.tsx'
import { CharacterCard } from './CharacterCard.tsx'
import { QuestionStep, type Choice } from './QuestionStep.tsx'
import { CLASS_PRESETS, MOTIVATION_PRESETS, RACE_PRESETS } from '../../lib/dnd/presets.ts'
import { useCharacterStore } from '../../stores/characterStore.ts'
import type { Character, ClassId, MotivationId, RaceId } from '../../types/character.ts'
import { cn } from '../../lib/utils.ts'

const CLASS_CHOICES: readonly Choice<ClassId>[] = Object.values(CLASS_PRESETS).map((preset) => ({
  id: preset.id,
  label: preset.label,
  tagline: preset.tagline,
  detail: preset.description,
}))

const RACE_CHOICES: readonly Choice<RaceId>[] = Object.values(RACE_PRESETS).map((preset) => ({
  id: preset.id,
  label: preset.label,
  tagline: preset.tagline,
  detail: preset.trait,
}))

const MOTIVATION_CHOICES: readonly Choice<MotivationId>[] = Object.values(MOTIVATION_PRESETS).map(
  (preset) => ({ id: preset.id, label: preset.label, tagline: preset.tagline }),
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
          <h1 className="text-2xl font-bold text-parchment">Your hero is ready</h1>
          <p className="mt-1 text-sm text-muted">
            Every number below was worked out for you. Hover or tap any underlined label to find out
            what it means.
          </p>
        </div>

        <CharacterCard character={hero} />

        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/tutorial">
              Play the tutorial
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setHero(null)
              setStep(0)
            }}
          >
            Start over
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-parchment">Three questions</h1>
        <p className="mt-1 text-sm text-muted">
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
              'rounded-full border px-3 py-1 text-xs font-medium',
              index === step && 'border-gold bg-gold/10 text-gold',
              index !== step && selections[index] !== null && 'border-moss/50 text-moss',
              index !== step && selections[index] === null && 'border-edge text-muted',
            )}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="pt-5">
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
        </CardContent>
      </Card>

      {isLastQuestion && motivationId !== null && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-5">
            <label htmlFor="hero-name" className="text-sm font-semibold text-parchment">
              What are you called?
            </label>
            <input
              id="hero-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Leave blank and we will call you Unnamed Hero"
              maxLength={40}
              className="h-10 rounded-lg border border-edge bg-ink px-3 text-sm text-parchment placeholder:text-muted/60"
            />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            <ArrowLeft aria-hidden />
            Back
          </Button>
        )}
        {!isLastQuestion && (
          <Button disabled={!canAdvance} onClick={() => setStep(step + 1)}>
            Next
            <ArrowRight aria-hidden />
          </Button>
        )}
        {isLastQuestion && (
          <Button size="lg" disabled={!canAdvance} onClick={forge}>
            <Dices aria-hidden />
            Build my hero
          </Button>
        )}
      </div>
    </div>
  )
}
