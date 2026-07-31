import { roll } from './dice.ts'
import { abilityModifier } from './stats.ts'
import { applyHealing } from './combat.ts'
import {
  FIRST_LEVEL_SLOTS,
  resolveSpellCastHook,
  type SpellCastEvent,
  type SubclassFeatureCarrier,
} from './spellcasting.ts'

export { FIRST_LEVEL_SLOTS }
import { SPELLS_BY_ID, type Spell } from '../../content/spells.ts'
import type { Combatant } from '../../types/combat.ts'
import type { Rng } from '../../types/dice.ts'

/**
 * Casting a prepared spell — the primitive the spell registry has been waiting
 * on since it was written.
 *
 * Until now only cantrips carrying an `attack` were pressable, which left every
 * levelled spell sitting on the sheet as decoration and `applyHealing` defined
 * with no caller at all. This is what gives both a shape.
 *
 * Pure like the rest of the layer: takes combatants, returns new ones. Nothing
 * here mutates, so zustand still sees a fresh reference and React still
 * re-renders.
 *
 * Deliberately partial. A spell without a structured `effect` cannot be cast,
 * which currently leaves Bless, Burning Hands, Magic Missile and Shield out —
 * Bless needs concentration and multi-target buffs, Shield needs reaction
 * timing on an incoming attack. They stay unpressable rather than half-working.
 */

/** The feature ids the spell-cast hooks key off. */
const FEATURE_BY_SUBCLASS: Record<string, string> = {
  life: 'life_domain_disciple_of_life',
  abjuration: 'abjuration_arcane_ward',
}

export interface CastableSpell {
  spell: Spell
  /** False when it is known but cannot be paid for or resolved right now. */
  castable: boolean
  /** Why not, for the button's tooltip. Absent when it is castable. */
  reason?: string
}

/**
 * Every prepared spell, each marked with whether it can be cast this instant.
 *
 * Returns the unusable ones too rather than filtering them out: a player who
 * cannot see Bless has no way to learn that they know it, and a greyed button
 * with a reason teaches more than an absent one.
 */
export function castableSpells(combatant: Combatant): CastableSpell[] {
  return (combatant.preparedSpells ?? []).flatMap((id): CastableSpell[] => {
    const spell = SPELLS_BY_ID[id]
    if (spell === undefined) return []
    if (spell.effect === undefined) {
      return [{ spell, castable: false, reason: 'This one is not ready to cast yet.' }]
    }
    if ((combatant.spellSlots ?? 0) <= 0) {
      return [{ spell, castable: false, reason: 'No spell slots left until you rest.' }]
    }
    return [{ spell, castable: true }]
  })
}

export interface CastResult {
  caster: Combatant
  target: Combatant
  /** Prose for the encounter log, in the same register as the attack lines. */
  lines: string[]
  refusal: string | null
}

function carrierFor(caster: Combatant, subclassId: string | undefined): SubclassFeatureCarrier {
  const feature = subclassId === undefined ? undefined : FEATURE_BY_SUBCLASS[subclassId]
  return {
    level: caster.level,
    intMod: abilityModifier(caster.scores.int),
    ...(caster.arcaneWardHp === undefined ? {} : { currentWardHp: caster.arcaneWardHp }),
    hasFeature: (id) => id === feature,
  }
}

/**
 * Resolves one cast, returning new combatants rather than touching the old.
 *
 * `subclassId` is passed in rather than read off the combatant because a
 * Combatant is a board token and does not know what a subclass is — the same
 * reason critOn and superiorityDice arrive as plain numbers.
 */
export function castSpell(args: {
  caster: Combatant
  target: Combatant
  spellId: string
  subclassId?: string
  rng?: Rng
}): CastResult {
  const { caster, target, spellId } = args
  const rng = args.rng ?? Math.random
  const spell = SPELLS_BY_ID[spellId]

  if (spell === undefined) {
    return { caster, target, lines: [], refusal: 'You do not know that spell.' }
  }
  if (spell.effect === undefined) {
    return { caster, target, lines: [], refusal: `${spell.name} is not ready to cast yet.` }
  }
  if (spell.level >= 1 && (caster.spellSlots ?? 0) <= 0) {
    return { caster, target, lines: [], refusal: 'No spell slots left until you rest.' }
  }

  const effect = spell.effect
  const lines: string[] = []
  let nextTarget = target

  // The base number before any subclass gets a say.
  const healRoll = effect.kind === 'heal' ? roll(effect.dice, { rng }) : undefined
  const abilityBonus =
    effect.kind === 'heal' && effect.addsAbility && caster.castingAbility !== undefined
      ? abilityModifier(caster.scores[caster.castingAbility])
      : 0
  const baseAmount = healRoll === undefined ? 0 : healRoll.total + abilityBonus

  const event: SpellCastEvent = {
    casterId: caster.id,
    targetId: target.id,
    spellId: spell.id,
    school: spell.school.toLowerCase() as SpellCastEvent['school'],
    level: spell.level,
    isHealing: effect.kind === 'heal',
    baseAmount,
  }
  const outcome = resolveSpellCastHook(event, carrierFor(caster, args.subclassId))

  lines.push(`${caster.name} casts ${spell.name}${target.id === caster.id ? '' : ` on ${target.name}`}.`)

  if (effect.kind === 'heal') {
    nextTarget = applyHealing(target, outcome.finalAmount)
    const restored = nextTarget.currentHp - target.currentHp
    lines.push(`Restored ${restored} hit ${restored === 1 ? 'point' : 'points'}.`)
    if (outcome.triggeredFeatures.includes('life_domain_disciple_of_life')) {
      lines.push(`Disciple of Life added ${2 + spell.level} on top.`)
    }
  } else {
    const ac =
      effect.kind === 'setAc'
        ? effect.base + (effect.addsDex ? abilityModifier(target.scores.dex) : 0)
        : target.ac + effect.amount
    nextTarget = { ...target, ac }
    lines.push(`${target.name}'s Armour Class is now ${ac}.`)
  }

  // The ward belongs to the caster, not the target, even when they are the same
  // combatant — resolving it after the target keeps that unambiguous.
  const warded =
    outcome.updatedCasterWardHp === undefined
      ? undefined
      : outcome.updatedCasterWardHp
  if (warded !== undefined && outcome.triggeredFeatures.includes('abjuration_arcane_ward')) {
    lines.push(`Arcane Ward holds at ${warded} hit points.`)
  }

  const spent = spell.level >= 1 ? (caster.spellSlots ?? 0) - 1 : (caster.spellSlots ?? 0)
  let nextCaster: Combatant = {
    ...caster,
    ...(caster.spellSlots === undefined ? {} : { spellSlots: Math.max(0, spent) }),
    ...(warded === undefined ? {} : { arcaneWardHp: warded }),
  }

  // Healing yourself means the caster and target are one combatant; the target
  // copy is the one carrying the new hit points, so it wins.
  if (target.id === caster.id) {
    nextCaster = { ...nextTarget, ...nextCaster, currentHp: nextTarget.currentHp, ac: nextTarget.ac }
    return { caster: nextCaster, target: nextCaster, lines, refusal: null }
  }

  return { caster: nextCaster, target: nextTarget, lines, refusal: null }
}
