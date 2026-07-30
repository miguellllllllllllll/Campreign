import { Heart, Shield, Sparkles, Wind } from 'lucide-react'
import type { ReactNode } from 'react'
import { Explain } from '../Explain.tsx'
import { ABILITY_LABELS, ABILITY_NAMES, abilityModifier, formatModifier } from '../../lib/dnd/stats.ts'
import type { ExplainKey } from '../../lib/dnd/explanations.ts'
import type { Character } from '../../types/character.ts'

function StatTile({
  icon,
  label,
  value,
  explainKey,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  explainKey: ExplainKey
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-edge bg-surface-raised px-3 py-3">
      <span className="text-gold">{icon}</span>
      <span className="font-mono text-2xl font-bold tabular-nums text-parchment">{value}</span>
      <span className="text-center text-xs font-medium uppercase tracking-wide text-muted">
        <Explain k={explainKey}>{label}</Explain>
      </span>
      {hint !== undefined && <span className="text-center text-[11px] text-muted/70">{hint}</span>}
    </div>
  )
}

export function StatBlock({ character }: { character: Character }) {
  const squares = Math.floor(character.speedFeet / 5)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          icon={<Shield size={18} />}
          label="Armour Class"
          value={String(character.ac)}
          explainKey="ac"
          hint={character.armorName}
        />
        <StatTile
          icon={<Heart size={18} />}
          label="Hit Points"
          value={`${character.currentHp}/${character.maxHp}`}
          explainKey="hp"
        />
        <StatTile
          icon={<Wind size={18} />}
          label="Speed"
          value={`${character.speedFeet} ft`}
          explainKey="speed"
          hint={`${squares} squares`}
        />
        <StatTile
          icon={<Sparkles size={18} />}
          label="Proficiency"
          value={formatModifier(character.proficiencyBonus)}
          explainKey="proficiency"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <Explain k="abilityMod">Ability Scores</Explain>
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ABILITY_NAMES.map((ability) => {
            const score = character.scores[ability]
            return (
              <div
                key={ability}
                className="flex flex-col items-center rounded-lg border border-edge bg-surface-raised py-2"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <Explain k={ability} className="no-underline decoration-transparent">
                    {ability}
                  </Explain>
                </span>
                <span className="font-mono text-lg font-bold tabular-nums text-parchment">
                  {score}
                </span>
                <span className="font-mono text-xs text-gold">
                  {formatModifier(abilityModifier(score))}
                </span>
                <span className="sr-only">{ABILITY_LABELS[ability]}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
