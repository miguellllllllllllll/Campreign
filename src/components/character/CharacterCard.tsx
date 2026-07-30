import {
  ParchmentCard,
  ParchmentCardContent,
  ParchmentCardDescription,
  ParchmentCardHeader,
  ParchmentCardTitle,
} from '../ui/parchment-card.tsx'
import { Explain } from '../Explain.tsx'
import { StatBlock } from './StatBlock.tsx'
import { AttackPractice } from './AttackPractice.tsx'
import { CLASS_PRESETS, RACE_PRESETS } from '../../lib/dnd/presets.ts'
import { ABILITY_LABELS, SKILL_LABELS } from '../../lib/dnd/stats.ts'
import type { Character } from '../../types/character.ts'

export function CharacterCard({
  character,
  showPractice = true,
}: {
  character: Character
  showPractice?: boolean
}) {
  const klass = CLASS_PRESETS[character.classId]
  const race = RACE_PRESETS[character.raceId]

  return (
    <ParchmentCard className="shadow-torch-lg">
      <ParchmentCardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <ParchmentCardTitle className="font-display text-2xl text-parchment">
            {character.name}
          </ParchmentCardTitle>
          <span className="rounded-full border border-gold-border/60 bg-amber-torch/10 px-2.5 py-0.5 font-serif text-xs font-semibold tracking-wide text-amber-torch">
            <Explain k="level">Level {character.level}</Explain>
          </span>
        </div>
        <ParchmentCardDescription>
          {race.label} · {klass.label} — {character.blurb}
        </ParchmentCardDescription>
      </ParchmentCardHeader>

      <ParchmentCardContent className="flex flex-col gap-5">
        <StatBlock character={character} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 font-serif text-xs font-semibold tracking-wide text-muted uppercase">
              <Explain k="skillCheck">Trained Skills</Explain>
            </p>
            <p className="text-sm text-parchment">
              {character.skillProficiencies.map((skill) => SKILL_LABELS[skill]).join(' · ')}
            </p>
          </div>
          <div>
            <p className="mb-1.5 font-serif text-xs font-semibold tracking-wide text-muted uppercase">
              <Explain k="savingThrow">Strong Saves</Explain>
            </p>
            <p className="text-sm text-parchment">
              {character.savingThrows.map((ability) => ABILITY_LABELS[ability]).join(' · ')}
            </p>
          </div>
        </div>

        <p className="rounded-lg border-l-2 border-gold-border/50 bg-ink/40 p-3 text-sm leading-relaxed text-muted italic">
          {race.trait}
        </p>

        {showPractice && <AttackPractice character={character} />}
      </ParchmentCardContent>
    </ParchmentCard>
  )
}
