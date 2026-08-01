import { Heart, Shield, Sparkles, Wind } from 'lucide-react'
import type { ReactNode } from 'react'
import { Explain } from '../Explain.tsx'
import { ResourceBar } from '../ui/resource-bar.tsx'
import { ABILITY_LABELS, ABILITY_NAMES, abilityModifier, formatModifier } from '../../lib/dnd/stats.ts'
import type { ExplainKey } from '../../lib/dnd/explanations.ts'
import type { Character } from '../../types/character.ts'

function StatTile({
  icon,
  label,
  value,
  explainKey,
  hint,
  bar,
}: {
  icon: ReactNode
  label: string
  value: string
  explainKey: ExplainKey
  hint?: string
  bar?: ReactNode
}) {
  return (
    <div className="group relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border border-edge bg-surface-raised/80 px-3 py-3 transition-colors hover:border-gold-border/50">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-border/50 to-transparent"
      />
      <span className="text-amber-torch">{icon}</span>
      <span className="font-mono text-2xl font-bold tabular-nums text-parchment">{value}</span>
      <span className="heading-small-caps text-center text-xs font-semibold">
        <Explain k={explainKey}>{label}</Explain>
      </span>
      {hint !== undefined && <span className="text-center text-[11px] text-muted">{hint}</span>}
      {bar !== undefined && <div className="mt-1 w-full">{bar}</div>}
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
          bar={
            <ResourceBar
              current={character.currentHp}
              max={character.maxHp}
              label={`${character.name} hit points`}
            />
          }
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
        <p className="heading-small-caps mb-2 text-xs font-semibold">
          <Explain k="abilityMod">Ability Scores</Explain>
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ABILITY_NAMES.map((ability) => {
            const score = character.scores[ability]
            return (
              <div
                key={ability}
                className="flex flex-col items-center rounded-lg border border-edge bg-surface-raised/80 py-2 transition-colors hover:border-gold-border/50"
              >
                <span className="heading-small-caps text-[11px] font-semibold">
                  <Explain k={ability} className="no-underline decoration-transparent">
                    {ability}
                  </Explain>
                </span>
                <span className="font-mono text-lg font-bold tabular-nums text-parchment">
                  {score}
                </span>
                <span className="font-mono text-xs text-amber-torch">
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
