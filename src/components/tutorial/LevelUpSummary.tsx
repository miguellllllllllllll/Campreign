'use client'

import { ChevronsUp, Heart, Sparkles, Star } from 'lucide-react'
import type { LevelUpGains } from '../../lib/dnd/leveling.ts'

export interface LevelUpSummaryProps {
  gains: LevelUpGains
}

/**
 * What changed, in the order a beginner cares about it.
 *
 * Every number here is one the player has already watched do something: hit
 * points came off them during the fight, the spell slot was the thing they had
 * to decide whether to spend. Levelling up is only meaningful if it moves
 * numbers you have felt, so this shows the delta rather than the new total —
 * "+6 hit points" teaches what "16 hit points" does not.
 */
export function LevelUpSummary({ gains }: LevelUpSummaryProps) {
  return (
    <div className="rounded-card border border-amber-torch/50 bg-amber-torch/10 p-5 shadow-[0_0_30px_rgb(212_175_55/0.15)]">
      <h2 className="flex items-center gap-2 font-display text-lg text-amber-torch">
        <ChevronsUp aria-hidden className="size-5" />
        Level {gains.level}
      </h2>

      <dl className="mt-3 flex flex-col gap-2 text-sm text-parchment">
        <div className="flex items-center gap-2">
          <Heart aria-hidden className="size-4 shrink-0 text-blood" />
          <dt className="text-muted">Hit points</dt>
          <dd className="font-mono">
            +{gains.hitPointsGained} <span className="text-muted">(now {gains.maxHp})</span>
          </dd>
        </div>

        {gains.spellSlots !== undefined && (
          <div className="flex items-center gap-2">
            <Sparkles aria-hidden className="size-4 shrink-0 text-arcane" />
            <dt className="text-muted">Spell slots</dt>
            <dd className="font-mono">{gains.spellSlots}</dd>
          </div>
        )}

        {gains.proficiencyBonus !== undefined && (
          <div className="flex items-center gap-2">
            <Star aria-hidden className="size-4 shrink-0 text-amber-torch" />
            <dt className="text-muted">Proficiency</dt>
            <dd className="font-mono">+{gains.proficiencyBonus}</dd>
          </div>
        )}
      </dl>

      {gains.features.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3 border-t border-gold-border/30 pt-3">
          {gains.features.map((feature) => (
            <li key={feature.id}>
              <p className="font-display text-sm text-parchment">{feature.name}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{feature.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
