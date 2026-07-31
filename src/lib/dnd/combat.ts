import type { AttackAction } from '../../types/action.ts'
import type {
  AttackBreakdown,
  AttackOutcome,
  Combatant,
  GridPosition,
  RollPart,
} from '../../types/combat.ts'
import type { Rng, RollMode } from '../../types/dice.ts'
import { roll, toCriticalNotation } from './dice.ts'
import { abilityModifier, formatModifier, proficiencyBonus } from './stats.ts'
import { attackRollMode, blocksActions, combineRollModes } from './conditions.ts'
import { channelDivinityAttackBonus, hasVowAgainst } from './channelDivinity.ts'
import { applyDamageWithWard } from './spellcasting.ts'
import { damageNotation } from './characterBuilder.ts'

/** Dexterity decides who acts first, plus whatever a feat is worth. */
export function rollInitiative(combatant: Combatant, rng: Rng = Math.random): number {
  const bonus = abilityModifier(combatant.scores.dex) + (combatant.initiativeBonus ?? 0)
  return roll(`1d20${formatModifier(bonus)}`, { rng }).total
}

/** Highest initiative first; ties break on Dexterity, then name for stability. */
export function initiativeOrder(combatants: readonly Combatant[]): string[] {
  return [...combatants]
    .sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative
      const dexDelta = abilityModifier(b.scores.dex) - abilityModifier(a.scores.dex)
      if (dexDelta !== 0) return dexDelta
      return a.name.localeCompare(b.name)
    })
    .map((combatant) => combatant.id)
}

export function attackBonusFor(attacker: Combatant, attack: AttackAction): number {
  const ability = abilityModifier(attacker.scores[attack.ability])
  // Sacred Weapon is worth nothing to anyone who has not spent the charge, so
  // this stays a no-op for every combatant without an active oath.
  return (
    ability
    + (attack.proficient ? proficiencyBonus(attacker.level) : 0)
    + channelDivinityAttackBonus(attacker)
  )
}

function breakdownParts(attacker: Combatant, attack: AttackAction): RollPart[] {
  const parts: RollPart[] = []
  const ability = abilityModifier(attacker.scores[attack.ability])
  if (ability !== 0) {
    parts.push({ label: attack.ability.toUpperCase(), value: ability })
  }
  if (attack.proficient) {
    parts.push({ label: 'Prof', value: proficiencyBonus(attacker.level) })
  }
  // Named in the breakdown rather than folded silently into the total: the
  // whole point of the roll panel is that no number appears unexplained.
  const sacred = channelDivinityAttackBonus(attacker)
  if (sacred !== 0) parts.push({ label: 'Sacred Weapon', value: sacred })
  return parts
}

export function resolveAttack(args: {
  attacker: Combatant
  target: Combatant
  attack: AttackAction
  rng?: Rng
  /** Forces a roll mode; otherwise it is derived from both sides' conditions. */
  mode?: RollMode
}): AttackOutcome {
  const { attacker, target, attack } = args
  const rng = args.rng ?? Math.random
  const conditionMode = attackRollMode(attacker.conditions, target.conditions)
  /*
   * A vow grants advantage, but it is combined with the conditions rather than
   * overriding them: swearing at a foe must not cancel out the disadvantage of
   * being prone. combineRollModes already knows advantage and disadvantage
   * annihilate, which is the SRD's rule and the one players expect.
   */
  const vowMode: RollMode = hasVowAgainst(attacker, target.id) ? 'advantage' : 'normal'
  const mode = args.mode ?? combineRollModes([conditionMode, vowMode])

  const bonus = attackBonusFor(attacker, attack)
  // The attacker's own crit range, so a Champion swinging is not the same roll
  // as anybody else swinging. Absent for everyone who has not widened it.
  const attackRoll = roll(`1d20${formatModifier(bonus)}`, {
    rng,
    mode,
    ...(attacker.critOn === undefined ? {} : { critOn: attacker.critOn }),
  })
  const natural = attackRoll.groups[0]?.kept[0] ?? 0

  const breakdown: AttackBreakdown = {
    natural,
    parts: breakdownParts(attacker, attack),
    total: attackRoll.total,
    targetAc: target.ac,
  }

  // A natural 1 always misses and a natural 20 always hits, whatever the maths say.
  if (attackRoll.crit === 'fumble') {
    return { kind: 'fumble', breakdown, attackRoll }
  }

  const baseDamage = damageNotation(attack, attacker.scores)

  if (attackRoll.crit === 'hit') {
    const damageRoll = roll(toCriticalNotation(baseDamage), { rng })
    return {
      kind: 'crit',
      breakdown,
      attackRoll,
      damageRoll,
      damage: Math.max(0, damageRoll.total),
    }
  }

  if (attackRoll.total >= target.ac) {
    const damageRoll = roll(baseDamage, { rng })
    return {
      kind: 'hit',
      breakdown,
      attackRoll,
      damageRoll,
      damage: Math.max(0, damageRoll.total),
    }
  }

  return { kind: 'miss', breakdown, attackRoll }
}

export function applyDamage(combatant: Combatant, amount: number): Combatant {
  /*
   * An Arcane Ward soaks what it can before hit points move. Everyone else has
   * no ward, so applyDamageWithWard reduces to the same subtraction this always
   * was — which is why every existing caller is untouched.
   */
  const { newHp, newWardHp } = applyDamageWithWard(amount, combatant.currentHp, combatant.arcaneWardHp)

  return {
    ...combatant,
    currentHp: newHp,
    // A depleted ward stays at 0 rather than vanishing: 0 means "broken and
    // rechargeable", undefined means "never raised", and the hooks tell them apart.
    ...(combatant.arcaneWardHp === undefined ? {} : { arcaneWardHp: newWardHp }),
  }
}

export function applyHealing(combatant: Combatant, amount: number): Combatant {
  const currentHp = Math.min(combatant.maxHp, combatant.currentHp + Math.max(0, amount))
  return { ...combatant, currentHp }
}

export function isDefeated(combatant: Combatant): boolean {
  return combatant.currentHp <= 0
}

export function canAct(combatant: Combatant): boolean {
  return !isDefeated(combatant) && !blocksActions(combatant.conditions)
}

/** Diagonals count as one square, matching the simplified grid the tutorial teaches. */
export function gridDistance(a: GridPosition, b: GridPosition): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

export function isInRange(attacker: Combatant, target: Combatant, attack: AttackAction): boolean {
  return gridDistance(attacker.position, target.position) <= attack.rangeSquares
}
