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
import { choicesFor, stepAnswered, stepsFor } from '../../content/creationQuestions.ts'
import type { CreationField, CreationFieldId } from '../../content/creationQuestions.ts'
import { SpellSelectionWizard, type SpellSelection } from './SpellSelectionWizard.tsx'
import { AdvancedToggle } from './AdvancedToggle.tsx'
import { magicStyleById } from '../../content/spellPresets.ts'
import { previewCharacter, resolveSpellSelection } from '../../lib/dnd/characterBuilder.ts'
import { getSpellcastingLimits } from '../../lib/dnd/spellcasting.ts'
import { abilityModifier } from '../../lib/dnd/stats.ts'
import { AURA_PRESETS } from '../../lib/dnd/presets.ts'
import { useCharacterStore } from '../../stores/characterStore.ts'
import type { Character, CreationAnswers, CreationDraft } from '../../types/character.ts'
import { cn } from '../../lib/utils.ts'

/**
 * A sigil per option, keyed by the option's id. Kept here rather than in the
 * rules data, which stays presentation-free. Options with no entry — the flaws,
 * which are sentences — simply render without one.
 */
/**
 * The one place a class is allowed a colour of its own. Written as whole class
 * strings because Tailwind resolves utilities statically — an interpolated
 * `text-class-${id}` would be scanned as a literal and dropped from the build.
 */
const CLASS_ACCENTS: Record<string, string> = {
  fighter: 'text-class-fighter',
  wizard: 'text-class-wizard',
  rogue: 'text-class-rogue',
  cleric: 'text-class-cleric',
  paladin: 'text-class-paladin',
}

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
  return stepsFor(draft).every((step) => stepAnswered(step, draft))
}

export function CreatorWizard() {
  const createCharacter = useCharacterStore((state) => state.createCharacter)

  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<CreationDraft>({})
  const [name, setName] = useState('')
  const [hero, setHero] = useState<Character | null>(null)

  // Fighters and rogues have no magic step, so the sequence depends on the draft.
  // Changing class can shorten it under our feet; clamp rather than crash.
  const steps = stepsFor(draft)
  const safeIndex = Math.min(stepIndex, steps.length - 1)
  const step = steps[safeIndex]
  if (step === undefined) throw new Error(`No creation step at index ${safeIndex}`)

  const isLastStep = safeIndex === steps.length - 1
  const preview = previewCharacter(draft, name, PREVIEW_META)
  const selection = resolveSpellSelection(draft)
  const onMagicStep = step.id === 'magic'

  const limits =
    preview === null || draft.classId === undefined
      ? null
      : getSpellcastingLimits(
          draft.classId,
          abilityModifier(preview.scores.wis),
          abilityModifier(preview.scores.int),
        )

  /**
   * The magic step is only satisfied once the spell lists are actually legal, so
   * nobody can half-customise and walk away holding two cantrips. A paladin's
   * limits are zero, which passes without asking them for anything.
   */
  const spellsComplete =
    !onMagicStep
    || limits === null
    || (selection.cantripIds.length === limits.cantripsCount
      && selection.preparedSpellIds.length === limits.preparedSpellsCount)

  const canAdvance = stepAnswered(step, draft) && spellsComplete

  /**
   * Records an answer and drops any later answer it invalidates: a new class
   * offers different spells and loadouts, a new background different flaws.
   */
  function answer(fieldId: CreationFieldId, value: string) {
    setDraft((previous) => {
      const next = { ...previous, [fieldId]: value } as CreationDraft
      if (fieldId === 'classId') {
        delete next.magicStyleId
        delete next.cantripIds
        delete next.preparedSpellIds
        delete next.equipmentChoice
      }
      if (fieldId === 'backgroundId') delete next.flawId
      // Subclasses belong to a class, so a new class invalidates the old pick.
      // Feats are class-agnostic and survive.
      if (fieldId === 'classId') delete next.subclassId
      // Choosing a style is what fills the spell lists in. Any earlier
      // hand-picked list is dropped, or the new style would not take effect.
      if (fieldId === 'magicStyleId') {
        const style = magicStyleById(value)
        if (style === undefined) {
          delete next.cantripIds
          delete next.preparedSpellIds
        } else {
          next.cantripIds = [...style.cantripIds]
          next.preparedSpellIds = [...style.preparedSpellIds]
        }
      }
      return next
    })
  }

  /**
   * Turning the layer off discards its answers rather than remembering them.
   * A hidden subclass that silently reappears on re-toggling is a worse
   * surprise than having to pick again, and it would otherwise reach the
   * builder while the player believed they were on the fast track.
   */
  function setAdvanced(enabled: boolean) {
    setDraft((previous) => {
      const next = { ...previous, advanced: enabled }
      if (!enabled) {
        delete next.subclassId
        delete next.featId
      }
      return next
    })
    setStepIndex(0)
  }

  function changeSpells(next: SpellSelection) {
    setDraft((previous) => ({
      ...previous,
      cantripIds: next.cantripIds,
      preparedSpellIds: next.preparedSpellIds,
    }))
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
        {steps.map((candidate, index) => (
          <li
            key={candidate.id}
            aria-current={index === safeIndex ? 'step' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 font-serif text-xs font-semibold tracking-wide transition-colors',
              // The current step is a filled crimson ribbon rather than another
              // gold outline: crimson cannot carry text on leather, but it can
              // sit under parchment at 7.49:1, which is the one high-contrast
              // way this palette gets to shout.
              index === safeIndex && 'banner-dnd-red border-gold-border/60 rounded-full',
              index !== safeIndex && stepAnswered(candidate, draft) && 'border-moss/50 text-moss',
              index !== safeIndex && !stepAnswered(candidate, draft) && 'border-edge text-muted',
            )}
          >
            {index + 1}. {candidate.title}
          </li>
        ))}
      </ol>

      <AdvancedToggle enabled={draft.advanced === true} onChange={setAdvanced} />

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

            {/* Step 3b: what the chosen style actually got you, and a way in. */}
            {onMagicStep && preview !== null && draft.classId !== undefined
              && (draft.classId === 'paladin' || draft.magicStyleId !== undefined) && (
              <SpellSelectionWizard
                classId={draft.classId}
                cantripIds={selection.cantripIds}
                preparedSpellIds={selection.preparedSpellIds}
                scores={preview.scores}
                spellcasting={preview.spellcasting}
                onChange={changeSpells}
              />
            )}
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
            {safeIndex > 0 && (
              <FantasyButton variant="ghost" onClick={() => setStepIndex(safeIndex - 1)}>
                <ArrowLeft aria-hidden />
                Back
              </FantasyButton>
            )}
            {!isLastStep && (
              <FantasyButton disabled={!canAdvance} onClick={() => setStepIndex(safeIndex + 1)}>
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
    const accentClass = CLASS_ACCENTS[choice.id]
    const swatch = AURA_PRESETS[choice.id as keyof typeof AURA_PRESETS]?.cosmetics.auraColor
    return {
      id: choice.id,
      label: choice.label,
      tagline: choice.tagline,
      ...(choice.detail === undefined ? {} : { detail: choice.detail }),
      ...(icon === undefined ? {} : { icon }),
      ...(accentClass === undefined ? {} : { accentClass }),
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
