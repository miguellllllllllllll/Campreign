import { roll } from './dice.ts'
import { CONDITIONS, addCondition } from './conditions.ts'
import { isDead, isDying, isStable, stabilise } from './dying.ts'
import { narrateAttackFully } from './narrate.ts'
import { hasSlot, spendSlot } from './slots.ts'
import { abilityModifier, formatModifier, proficiencyBonus } from './stats.ts'
import {
  applyDamage,
  applyHealing,
  effectiveAc,
  gridDistance,
  isDefeated,
  isInRange,
  resolveAttack,
} from './combat.ts'
import {
  FIRST_LEVEL_SLOTS,
  resolveSpellCastHook,
  type SpellCastEvent,
  type SubclassFeatureCarrier,
} from './spellcasting.ts'

export { FIRST_LEVEL_SLOTS }
import { SPELLS_BY_ID, type Spell } from '../../content/spells.ts'
import type { Combatant } from '../../types/combat.ts'
import type { AbilityName } from '../../types/character.ts'
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
 * Every spell this combatant could press, each marked with whether it can be
 * cast this instant.
 *
 * Returns the unusable ones too rather than filtering them out: a player who
 * cannot see Bless has no way to learn that they know it, and a greyed button
 * with a reason teaches more than an absent one.
 *
 * Cantrips are included, but only the ones that are not already an attack.
 * A damage cantrip arrives on the board as a weapon in `attacks` and would
 * otherwise print twice; a utility cantrip arrives nowhere at all, which is how
 * Spare the Dying sat in two starting loadouts with no way to cast it.
 *
 * `board` is optional and only ever narrows: without it a spell that needs a
 * particular kind of target is offered and refused on cast, with it the button
 * greys out and says why first.
 */
export function castableSpells(
  combatant: Combatant,
  board: readonly Combatant[] = [],
): CastableSpell[] {
  const utilityCantrips = (combatant.cantrips ?? []).filter((id) => {
    const spell = SPELLS_BY_ID[id]
    /*
     * Two exclusions, for opposite reasons. A cantrip with an `attack` is
     * already on the board as a weapon and would print twice. A cantrip with no
     * `effect` does nothing anywhere — Light and Thaumaturgy are flavour, and
     * Guidance is waiting on casting outside a fight — and a permanently greyed
     * button teaches a player nothing except that the bar is cluttered.
     */
    return (
      spell !== undefined
      && spell.attack === undefined
      && spell.effect !== undefined
      // Out-of-combat spells are offered where they work, not here.
      && spell.effect.kind !== 'guideCheck'
    )
  })

  return [...(combatant.preparedSpells ?? []), ...utilityCantrips].flatMap(
    (id): CastableSpell[] => {
      const spell = SPELLS_BY_ID[id]
      if (spell === undefined) return []
      if (spell.effect === undefined) {
        return [{ spell, castable: false, reason: 'This one is not ready to cast yet.' }]
      }
      if (spell.effect.kind === 'reactionSpell') {
        // Known and usable, just never from here — it fires when you are hit.
        return [
          { spell, castable: false, reason: 'Cast in reaction, when a blow is about to land.' },
        ]
      }
      // Cantrips never run out, so the slot count has no say over them. It used
      // to, harmlessly, because no cantrip could reach this function.
      if (!hasSlot(combatant.spellSlots, spell.level)) {
        return [
          {
            spell,
            castable: false,
            reason:
              spell.level > 1
                ? `No level ${spell.level} slots left until you rest.`
                : 'No spell slots left until you rest.',
          },
        ]
      }
      if (
        spell.effect.kind === 'stabilise'
        && !board.some((one) => one.team === combatant.team && isDying(one))
      ) {
        return [{ spell, castable: false, reason: 'Nobody is down and slipping away.' }]
      }
      return [{ spell, castable: true }]
    },
  )
}

/**
 * The spells a character can cast when there is no encounter.
 *
 * Takes a Character rather than a Combatant on purpose: outside a fight there
 * is no board and nothing has a position, hit points or a turn. That mismatch
 * is exactly why Guidance sat inert — every casting path ran through a token
 * that only exists once initiative has been rolled.
 *
 * Cantrips only, and only the ones whose effect means something here, which is
 * Guidance alone today. Spending a levelled slot outside a fight is a decision
 * worth having, and it is not this one.
 */
export function castableOutOfCombat(character: {
  cantrips?: readonly string[]
}): Spell[] {
  return (character.cantrips ?? []).flatMap((id) => {
    const spell = SPELLS_BY_ID[id]
    return spell?.effect?.kind === 'guideCheck' ? [spell] : []
  })
}

/** Whether the spell being held lends a die to an ability check. */
export function guidesChecks(spellId: string | null): boolean {
  return spellId !== null && SPELLS_BY_ID[spellId]?.effect?.kind === 'guideCheck'
}

/**
 * Whether a spell is aimed at somebody you would rather were hurt.
 *
 * Derived from the effect rather than stored, so a new spell cannot forget to
 * declare it: anything that rolls to hit or covers an area points outward, and
 * everything else lands on you or an ally.
 */
export function spellTargetsEnemies(spellId: string): boolean {
  const kind = SPELLS_BY_ID[spellId]?.effect?.kind
  return kind === 'spellAttack' || kind === 'aoeSave' || kind === 'autoHit'
}

/**
 * Whether a spell is only ever aimed at somebody who has already dropped.
 *
 * Asked because the alternative is a caller hard-coding a spell id. Spare the
 * Dying is the only one today, and the point of asking the registry is that the
 * second one costs nothing.
 */
export function spellTargetsDying(spellId: string): boolean {
  return SPELLS_BY_ID[spellId]?.effect?.kind === 'stabilise'
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
  if (!hasSlot(caster.spellSlots, spell.level)) {
    return { caster, target, lines: [], refusal: 'No spell slots left until you rest.' }
  }

  const effect = spell.effect
  const lines: string[] = []
  let nextTarget = target
  /** Set when the spell has to be held together to keep working. */
  let concentrating: string | undefined

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
  } else if (effect.kind === 'spellAttack') {
    const attack = spell.attack
    if (attack === undefined) {
      return { caster, target, lines: [], refusal: `${spell.name} has nothing to aim.` }
    }
    if (!isInRange(caster, target, attack)) {
      return { caster, target, lines: [], refusal: `${target.name} is out of range.` }
    }

    const outcome = resolveAttack({ attacker: caster, target, attack, rng })
    const landed = outcome.kind === 'hit' || outcome.kind === 'crit'
    nextTarget = landed ? applyDamage(target, outcome.damage) : target

    lines.push(narrateAttackFully(outcome, target.name, attack.damageType))

    // The rider only lands with the beam.
    if (landed && effect.conditionOnHit !== undefined && !isDefeated(nextTarget)) {
      nextTarget = {
        ...nextTarget,
        conditions: addCondition(
          nextTarget.conditions,
          effect.conditionOnHit,
          effect.conditionRounds ?? 1,
        ),
      }
      lines.push(`${target.name} is left glowing — the next blow lands easier.`)
    }
  } else if (effect.kind === 'stabilise') {
    /*
     * Touch range, and the only spell that cares whether the target is already
     * down. Refusing it on somebody standing is not pedantry — a cantrip spent
     * on a conscious ally does nothing at all, and saying so is the difference
     * between a rule taught and a click wasted.
     */
    if (!isDying(target)) {
      return {
        caster,
        target,
        lines: [],
        refusal: isDead(target)
          ? `It is too late for ${target.name}.`
          : isStable(target)
            ? `${target.name} has already stopped slipping.`
            : `${target.name} is still on their feet.`,
      }
    }
    if (gridDistance(caster.position, target.position) > 1) {
      return { caster, target, lines: [], refusal: `${target.name} is out of reach.` }
    }
    nextTarget = stabilise(target)
    lines.push(
      `${target.name} stops slipping away. Still down, still at 0 hit points — but no `
        + 'longer rolling.',
    )
  } else if (effect.kind === 'wardTarget') {
    nextTarget = {
      ...target,
      conditions: addCondition(target.conditions, effect.condition, null, caster.id),
    }
    concentrating = spellId
    lines.push(
      `${target.name} is warded — Armour Class ${effectiveAc(nextTarget)} `
        + `for as long as ${caster.name} holds the spell.`,
    )
  } else if (effect.kind === 'blessAllies') {
    // Lands on a side, not a target — castBlessing has the whole party.
    return { caster, target, lines: [], refusal: `${spell.name} blesses your side — cast it with castBlessing.` }
  } else if (effect.kind === 'autoHit') {
    /*
     * No roll to make and none to miss with. Each dart is thrown on its own so
     * the log can show three small numbers rather than one large one, which is
     * what the spell actually does and what makes it feel different from a
     * beam.
     */
    const darts = Array.from({ length: effect.darts }, () => roll(effect.dice, { rng }))
    const total = darts.reduce((sum, dart) => sum + dart.total, 0)
    nextTarget = applyDamage(target, total)

    lines.push(
      `${effect.darts} darts strike ${target.name} without a roll to stop them — `
        + `${darts.map((d) => d.total).join(' + ')} = ${total} ${effect.damageType} damage.`,
    )
    if (isDefeated(nextTarget) && !isDefeated(target)) {
      lines.push(`${target.name} drops to 0 hit points and is out of the fight.`)
    }
  } else if (effect.kind === 'reactionSpell') {
    return { caster, target, lines: [], refusal: `${spell.name} is cast in reaction, not on your turn.` }
  } else if (effect.kind === 'aoeSave') {
    // Areas go through castAreaSpell, which has more than one target to return.
    return { caster, target, lines: [], refusal: `${spell.name} covers an area — aim it with castAreaSpell.` }
  } else if (effect.kind === 'guideCheck') {
    /*
     * There is nothing to guide in a fight. Ability checks belong to exploration
     * and conversation, so this one is cast through the tutorial's own path and
     * never from the action bar — see `castableOutOfCombat`.
     */
    return {
      caster,
      target,
      lines: [],
      refusal: `${spell.name} helps with a skill check, and there are none in a fight.`,
    }
  } else if (effect.kind === 'saveOrCondition') {
    /*
     * The target's own roll, and the only spell here that deals nothing. A
     * failure lands the condition for a fixed number of rounds; a success is
     * the whole spell wasted, which is the risk that makes it a decision.
     */
    const mod = abilityModifier(target.scores[effect.saveAbility])
    const save = roll(`1d20${formatModifier(mod)}`, { rng })
    const dc = spellSaveDcFor(caster)
    if (save.total >= dc) {
      lines.push(
        `${target.name} rolls ${save.total} against DC ${dc} and shakes it off — nothing happens.`,
      )
    } else {
      nextTarget = {
        ...target,
        conditions: addCondition(target.conditions, effect.condition, effect.rounds, caster.id),
      }
      lines.push(
        `${target.name} rolls ${save.total} against DC ${dc} and fails — `
          + `${CONDITIONS[effect.condition].label} for ${effect.rounds} rounds.`,
      )
    }
  } else {
    /*
     * Mage Armor replaces the armour outright rather than lending a bonus, and
     * it is not a concentration spell — eight hours in the SRD, which outlasts
     * anything that happens here. Writing to `ac` is correct for it in a way it
     * was never correct for Shield of Faith.
     */
    const ac = effect.base + (effect.addsDex ? abilityModifier(target.scores.dex) : 0)
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

  const spent = spendSlot(caster.spellSlots, spell.level)
  let nextCaster: Combatant = {
    ...caster,
    ...(concentrating === undefined ? {} : { concentratingOn: concentrating }),
    ...(spent === undefined ? {} : { spellSlots: spent }),
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


/* ---------------------------------------------------------------------------
 * Area spells
 * ------------------------------------------------------------------------ */

export interface AoeSaveOutcome {
  targetId: string
  saveTotal: number
  saveSuccessful: boolean
  /** True when a subclass waived the save rather than the die winning it. */
  isSculpted: boolean
  damageTaken: number
}

/**
 * One target's saving throw against an area spell.
 *
 * The Sculpt Spells branch is written and wired, and cannot currently fire:
 * every roster in this build is one hero and one monster, so the set of allies
 * is always empty. The subclass stays inactive in the data for exactly that
 * reason — the blocker is a second party member, not this function.
 */
export function resolveAoeTargetSave(args: {
  caster: Combatant
  target: Combatant
  saveAbility: AbilityName
  saveDc: number
  rawDamage: number
  halfOnSuccess: boolean
  casterSculpts: boolean
  rng?: Rng
}): AoeSaveOutcome {
  const { caster, target, saveDc, rawDamage, halfOnSuccess } = args
  const rng = args.rng ?? Math.random

  const isAlly = target.team === caster.team && target.id !== caster.id
  if (args.casterSculpts && isAlly) {
    return {
      targetId: target.id,
      saveTotal: saveDc,
      saveSuccessful: true,
      isSculpted: true,
      damageTaken: 0,
    }
  }

  const mod = abilityModifier(target.scores[args.saveAbility])
  const save = roll(`1d20${formatModifier(mod)}`, { rng })
  const saveSuccessful = save.total >= saveDc

  return {
    targetId: target.id,
    saveTotal: save.total,
    saveSuccessful,
    isSculpted: false,
    damageTaken: saveSuccessful ? (halfOnSuccess ? Math.floor(rawDamage / 2) : 0) : rawDamage,
  }
}

export interface AreaCastResult {
  caster: Combatant
  /** Every combatant the blast touched, already damaged. */
  affected: Combatant[]
  lines: string[]
  refusal: string | null
}

/** The spell save DC this combatant imposes. */
export function spellSaveDcFor(caster: Combatant): number {
  const ability = caster.castingAbility
  const mod = ability === undefined ? 0 : abilityModifier(caster.scores[ability])
  return 8 + proficiencyBonus(caster.level) + mod
}

/**
 * Casts an area spell, rolling damage once and letting every caught combatant
 * save against it separately — which is what the SRD does, and why a single
 * bad save hurts more than a good one.
 */
export function castAreaSpell(args: {
  caster: Combatant
  candidates: readonly Combatant[]
  spellId: string
  subclassId?: string
  rng?: Rng
}): AreaCastResult {
  const { caster, candidates, spellId } = args
  const rng = args.rng ?? Math.random
  const spell = SPELLS_BY_ID[spellId]

  if (spell?.effect === undefined || spell.effect.kind !== 'aoeSave') {
    return { caster, affected: [], lines: [], refusal: 'That spell does not cover an area.' }
  }
  if (!hasSlot(caster.spellSlots, spell.level)) {
    return { caster, affected: [], lines: [], refusal: 'No spell slots left until you rest.' }
  }

  const effect = spell.effect
  const caught = candidates.filter(
    (c) =>
      c.id !== caster.id
      && c.currentHp > 0
      && gridDistance(caster.position, c.position) <= effect.radiusSquares,
  )
  if (caught.length === 0) {
    return { caster, affected: [], lines: [], refusal: 'Nothing is close enough to catch the blast.' }
  }

  // Rolled once for the whole blast, per the SRD.
  const damageRoll = roll(effect.dice, { rng })
  const saveDc = spellSaveDcFor(caster)
  const sculpts = args.subclassId === 'evocation'

  const lines = [
    `${caster.name} casts ${spell.name}. `
      + `${damageRoll.total} ${effect.damageType} damage, `
      + `${effect.saveAbility.toUpperCase()} save against DC ${saveDc}.`,
  ]

  const affected = caught.map((target) => {
    const outcome = resolveAoeTargetSave({
      caster,
      target,
      saveAbility: effect.saveAbility,
      saveDc,
      rawDamage: damageRoll.total,
      halfOnSuccess: effect.halfOnSuccess,
      casterSculpts: sculpts,
      rng,
    })

    lines.push(
      outcome.isSculpted
        ? `${target.name} is sculpted clear of the flames and takes nothing.`
        : `${target.name} rolls ${outcome.saveTotal} and `
          + `${outcome.saveSuccessful ? 'takes half' : 'is caught full'} — `
          + `${outcome.damageTaken} damage.`,
    )
    return applyDamage(target, outcome.damageTaken)
  })

  return {
    caster: {
      ...caster,
      ...(spendSlot(caster.spellSlots, spell.level) === undefined
        ? {}
        : { spellSlots: spendSlot(caster.spellSlots, spell.level) }),
    },
    affected,
    lines,
    refusal: null,
  }
}


export interface BlessingResult {
  caster: Combatant
  blessed: Combatant[]
  lines: string[]
  refusal: string | null
}

/**
 * Blesses your own side, and starts concentrating on it.
 *
 * Everyone on the party side up to the spell's limit, in turn order, because
 * with a hero and a squire the limit of three has nobody to exclude — the same
 * reason Sculpt Spells does not ask which ally to spare.
 */
export function castBlessing(args: {
  caster: Combatant
  party: readonly Combatant[]
  spellId: string
}): BlessingResult {
  const { caster, party, spellId } = args
  const spell = SPELLS_BY_ID[spellId]

  if (spell?.effect === undefined || spell.effect.kind !== 'blessAllies') {
    return { caster, blessed: [], lines: [], refusal: 'That spell does not bless anybody.' }
  }
  if (!hasSlot(caster.spellSlots, spell.level)) {
    return { caster, blessed: [], lines: [], refusal: 'No spell slots left until you rest.' }
  }

  const chosen = party.filter((c) => c.currentHp > 0).slice(0, spell.effect.maxTargets)
  if (chosen.length === 0) {
    return { caster, blessed: [], lines: [], refusal: 'There is nobody left to bless.' }
  }

  const blessed = chosen.map((c) => ({
    ...c,
    conditions: addCondition(c.conditions, 'blessed', null, caster.id),
  }))

  return {
    caster: {
      ...caster,
      ...(spendSlot(caster.spellSlots, spell.level) === undefined
        ? {}
        : { spellSlots: spendSlot(caster.spellSlots, spell.level) }),
      concentratingOn: spellId,
    },
    blessed,
    lines: [
      `${caster.name} casts ${spell.name}. `
        + `${chosen.map((c) => c.name).join(' and ')} will add a d4 to every attack `
        + 'for as long as the concentration holds.',
    ],
    refusal: null,
  }
}
