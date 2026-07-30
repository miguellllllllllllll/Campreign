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
import { BACKGROUND_PRESETS, CLASS_PRESETS, RACE_PRESETS } from '../../lib/dnd/presets.ts'
import { ABILITY_LABELS, SKILL_LABELS, formatModifier } from '../../lib/dnd/stats.ts'
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
  const background = BACKGROUND_PRESETS[character.backgroundId]

  return (
    <ParchmentCard className="shadow-torch-lg">
      <ParchmentCardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full border font-display text-base"
              style={{
                backgroundColor: `${character.cosmetics.auraColor}26`,
                borderColor: character.cosmetics.tokenBorder,
                color: character.cosmetics.auraColor,
                boxShadow: `0 0 20px ${character.cosmetics.auraColor}59`,
              }}
            >
              {character.name.slice(0, 1).toUpperCase()}
            </span>
            <ParchmentCardTitle className="font-display text-2xl text-parchment">
              {character.name}
            </ParchmentCardTitle>
          </div>
          <span className="rounded-full border border-gold-border/60 bg-amber-torch/10 px-2.5 py-0.5 font-serif text-xs font-semibold tracking-wide text-amber-torch">
            <Explain k="level">Level {character.level}</Explain>
          </span>
        </div>
        <ParchmentCardDescription>
          {race.label} · {klass.label} · <Explain k="background">{background.label}</Explain> —{' '}
          {character.blurb}
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 font-serif text-xs font-semibold tracking-wide text-muted uppercase">
              <Explain k="loadout">Loadout</Explain>
            </p>
            <p className="text-sm text-parchment">
              {/* A wizard's loadout *is* their armour, so it is not said twice. */}
              {character.loadoutName === character.armorName
                ? character.armorName
                : `${character.loadoutName} · ${character.armorName}`}
            </p>
          </div>
          {character.spellcasting !== undefined && (
            <div>
              <p className="mb-1.5 font-serif text-xs font-semibold tracking-wide text-muted uppercase">
                Magic
              </p>
              <p className="text-sm text-parchment">
                <Explain k="spellSaveDc">Save DC</Explain> {character.spellcasting.saveDc} ·{' '}
                <Explain k="spellAttack">Attack</Explain>{' '}
                {formatModifier(character.spellcasting.attackBonus)}
              </p>
              {character.spellcasting.note !== undefined && (
                <p className="mt-1 text-xs leading-relaxed text-muted/80 italic">
                  {character.spellcasting.note}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 font-serif text-xs font-semibold tracking-wide text-muted uppercase">
              <Explain k="trinket">Trinket</Explain>
            </p>
            <p className="text-sm text-parchment">{character.trinket.name}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted/80">
              {character.trinket.description}
            </p>
          </div>
          <div>
            <p className="mb-1.5 font-serif text-xs font-semibold tracking-wide text-muted uppercase">
              <Explain k="personality">Who you are</Explain>
            </p>
            <dl className="flex flex-col gap-1 text-xs leading-relaxed text-muted">
              <div>
                <dt className="inline text-parchment">Ideal. </dt>
                <dd className="inline italic">{character.personality.ideal}</dd>
              </div>
              <div>
                <dt className="inline text-parchment">Flaw. </dt>
                <dd className="inline italic">{character.personality.flaw}</dd>
              </div>
              <div>
                <dt className="inline text-parchment">Bond. </dt>
                <dd className="inline italic">{character.personality.bond}</dd>
              </div>
            </dl>
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
