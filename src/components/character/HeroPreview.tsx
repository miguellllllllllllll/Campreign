'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Explain } from '../Explain.tsx'
import { ResourceBar } from '../ui/resource-bar.tsx'
import { BACKGROUND_PRESETS, CLASS_PRESETS, RACE_PRESETS } from '../../lib/dnd/presets.ts'
import { spellsByIds } from '../../content/spells.ts'
import { SKILL_LABELS, formatModifier } from '../../lib/dnd/stats.ts'
import type { ExplainKey } from '../../lib/dnd/explanations.ts'
import type { Character, CreationDraft } from '../../types/character.ts'

/** A number that pops when it changes, so a new armour class is noticed. */
function LiveValue({ value }: { value: string }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 0.7, opacity: 0.4 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 460, damping: 16 }}
      className="font-mono text-xl font-bold tabular-nums text-parchment"
    >
      {value}
    </motion.span>
  )
}

function Tile({
  label,
  value,
  explainKey,
  hint,
  bar,
}: {
  label: string
  value: string
  explainKey: ExplainKey
  hint?: string
  bar?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-edge bg-surface-raised/70 px-2 py-2.5">
      <LiveValue value={value} />
      <span className="text-center font-serif text-[10px] font-semibold tracking-wide text-muted uppercase">
        <Explain k={explainKey}>{label}</Explain>
      </span>
      {hint !== undefined && (
        <span className="text-center text-[10px] leading-tight text-muted">{hint}</span>
      )}
      {bar !== undefined && <div className="mt-1 w-full">{bar}</div>}
    </div>
  )
}

function Entry({
  label,
  explainKey,
  children,
}: {
  label: string
  explainKey?: ExplainKey
  children: ReactNode
}) {
  return (
    <div>
      <p className="font-serif text-[10px] font-semibold tracking-wide text-muted uppercase">
        {explainKey === undefined ? label : <Explain k={explainKey}>{label}</Explain>}
      </p>
      <div className="mt-0.5 text-xs leading-relaxed text-parchment">{children}</div>
    </div>
  )
}

export interface HeroPreviewProps {
  hero: Character | null
  draft: CreationDraft
}

/**
 * The sheet filling itself in as the player answers. Fields the player has not
 * reached yet are held back rather than shown with a placeholder value, so no
 * number on screen is ever a guess.
 */
export function HeroPreview({ hero, draft }: HeroPreviewProps) {
  if (hero === null) {
    return (
      <div className="border-gold-ornate rounded-card p-5">
        <h2 className="font-display text-base text-parchment">Your sheet</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Answer the first two questions and this fills itself in — hit points, armour, skills, all
          of it. You will never have to add anything up.
        </p>
      </div>
    )
  }

  const klass = CLASS_PRESETS[hero.classId]
  const race = RACE_PRESETS[hero.raceId]
  const background = draft.backgroundId === undefined ? null : BACKGROUND_PRESETS[hero.backgroundId]
  const aura = draft.auraId === undefined ? null : hero.cosmetics
  const geared = draft.equipmentChoice !== undefined
  const spellNames = spellsByIds([
    ...(hero.cantrips ?? []),
    ...(hero.preparedSpells ?? []),
  ])
    .map((spell) => spell.name)
    .join(' · ')

  return (
    <div className="border-gold-ornate rounded-card flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        {/*
          The aura is a plain style with a CSS transition rather than a motion
          animation. A JS-driven animation needs animation frames to reach its
          target, so in a backgrounded tab the token would sit colourless.
        */}
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-full border font-display text-lg"
          style={{
            transition:
              'background-color 350ms, border-color 350ms, color 350ms, box-shadow 350ms',
            backgroundColor: aura === null ? 'rgb(26 30 43 / 0.8)' : `${aura.auraColor}26`,
            borderColor: aura === null ? '#2a231e' : aura.tokenBorder,
            color: aura === null ? '#a39b8b' : aura.auraColor,
            boxShadow: aura === null ? 'none' : `0 0 22px ${aura.auraColor}59`,
          }}
        >
          {hero.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-base text-parchment">{hero.name}</p>
          <p className="text-[11px] leading-snug text-muted">
            {race.label} · {klass.label}
            {background !== null && ` · ${background.label}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Tile
          label="AC"
          value={geared ? String(hero.ac) : '—'}
          explainKey="ac"
          hint={geared ? hero.armorName : 'Pick your gear'}
        />
        <Tile
          label="HP"
          value={String(hero.maxHp)}
          explainKey="hp"
          bar={
            <ResourceBar current={hero.currentHp} max={hero.maxHp} label="Preview hit points" />
          }
        />
        <Tile
          label="Speed"
          value={`${hero.speedFeet}`}
          explainKey="speed"
          hint={`${Math.floor(hero.speedFeet / 5)} squares`}
        />
      </div>

      {hero.spellcasting !== undefined && (
        <div className="grid grid-cols-2 gap-1.5">
          <Tile
            label="Spell DC"
            value={String(hero.spellcasting.saveDc)}
            explainKey="spellSaveDc"
          />
          <Tile
            label="Spell Attack"
            value={formatModifier(hero.spellcasting.attackBonus)}
            explainKey="spellAttack"
          />
        </div>
      )}

      {hero.spellcasting?.note !== undefined && (
        <p className="text-[11px] leading-relaxed text-muted italic">{hero.spellcasting.note}</p>
      )}

      <Entry label="Trained Skills" explainKey="skillCheck">
        {/* Until a background is picked, only the class's own training is real. */}
        {(background === null ? klass.skillProficiencies : hero.skillProficiencies)
          .map((skill) => SKILL_LABELS[skill])
          .join(' · ')}
        {background === null && (
          <span className="block text-muted">Your background will train two more.</span>
        )}
      </Entry>

      {geared && (
        <Entry label="Loadout" explainKey="loadout">
          {hero.loadoutName} — {hero.attacks.map((attack) => attack.name).join(', ')}
        </Entry>
      )}

      {spellNames.length > 0 && <Entry label="Signature Magic">{spellNames}</Entry>}

      {background !== null && (
        <Entry label="Trinket" explainKey="trinket">
          <span className="text-parchment">{hero.trinket.name}</span>
          <span className="block text-muted">{hero.trinket.description}</span>
        </Entry>
      )}

      {draft.flawId !== undefined && (
        <Entry label="Flaw" explainKey="personality">
          <span className="italic">“{hero.personality.flaw}”</span>
        </Entry>
      )}
    </div>
  )
}
