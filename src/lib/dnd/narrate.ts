import type { AttackOutcome, RollPart } from '../../types/combat.ts'
import type { DiceRoll } from '../../types/dice.ts'
import type { DamageType } from '../../types/items.ts'
import type { CheckResult } from './checks.ts'

/** " + 3 (STR)" or " - 1 (DEX)" — the sign is spelled out so the sum reads as arithmetic. */
function renderPart(part: RollPart): string {
  const sign = part.value < 0 ? '-' : '+'
  return ` ${sign} ${Math.abs(part.value)} (${part.label})`
}

/**
 * The arithmetic a beginner would otherwise have to do in their head:
 * "Rolled 14 + 3 (STR) + 2 (Prof) = 19".
 */
export function describeMath(
  natural: number,
  parts: readonly RollPart[],
  total: number,
): string {
  const head = `Rolled ${natural}`
  if (parts.length === 0) return head
  return `${head}${parts.map(renderPart).join('')} = ${total}`
}

/** Explains why two dice were thrown when only one counted. */
export function describeMode(roll: DiceRoll): string | null {
  if (roll.mode === 'normal') return null
  const group = roll.groups.find((candidate) => candidate.size === 20)
  const kept = group?.kept[0]
  if (group === undefined || kept === undefined || group.results.length < 2) return null
  const label = roll.mode === 'advantage' ? 'Advantage' : 'Disadvantage'
  const verb = roll.mode === 'advantage' ? 'higher' : 'lower'
  return `${label}: rolled ${group.results.join(' and ')}, kept the ${verb} (${kept}).`
}

const ATTACK_VERDICTS: Record<AttackOutcome['kind'], string> = {
  hit: 'HIT!',
  crit: 'CRITICAL HIT!',
  miss: 'MISS.',
  fumble: 'MISS.',
}

/**
 * The headline attack sentence, e.g.
 * "Rolled 14 + 3 (STR) + 2 (Prof) = 19 vs Goblin AC 12. HIT!"
 */
export function narrateAttack(outcome: AttackOutcome, targetName: string): string {
  const { natural, parts, total, targetAc } = outcome.breakdown
  const math = describeMath(natural, parts, total)
  return `${math} vs ${targetName} AC ${targetAc}. ${ATTACK_VERDICTS[outcome.kind]}`
}

/** "Damage: 5 + 2 = 7 slashing damage." */
export function narrateDamage(roll: DiceRoll, damageType?: DamageType): string {
  const dice = roll.groups.flatMap((group) => group.kept)
  const modifier =
    roll.modifier === 0 ? '' : ` ${roll.modifier < 0 ? '-' : '+'} ${Math.abs(roll.modifier)}`
  const expression = `${dice.join(' + ')}${modifier}`
  const flavour = damageType === undefined ? 'damage' : `${damageType} damage`
  const showsWorking = dice.length > 1 || roll.modifier !== 0
  return showsWorking
    ? `Damage: ${expression} = ${roll.total} ${flavour}.`
    : `Damage: ${roll.total} ${flavour}.`
}

/** Every sentence a player needs for one attack, in reading order. */
export function narrateAttackFully(
  outcome: AttackOutcome,
  targetName: string,
  damageType?: DamageType,
): string {
  const lines: string[] = []
  const mode = describeMode(outcome.attackRoll)
  if (mode !== null) lines.push(mode)
  lines.push(narrateAttack(outcome, targetName))

  if (outcome.kind === 'crit') {
    lines.push('A natural 20 always hits, and it doubles the damage dice.')
  }
  if (outcome.kind === 'fumble') {
    lines.push('A natural 1 always misses, however big the bonuses.')
  }
  if (outcome.kind === 'hit' || outcome.kind === 'crit') {
    lines.push(narrateDamage(outcome.damageRoll, damageType))
  }

  return lines.join(' ')
}

/**
 * "Rolled 14 + 3 (WIS) + 2 (Prof) = 19 vs DC 12. SUCCESS!"
 * DC is short for Difficulty Class — the number a check has to reach.
 */
export function narrateCheck(result: CheckResult): string {
  const { natural, parts, total, dc } = result.breakdown
  const math = describeMath(natural, parts, total)
  const verdict = result.success ? 'SUCCESS!' : 'FAILURE.'
  return `${result.label}: ${math} vs DC ${dc}. ${verdict}`
}

export function narrateCheckFully(result: CheckResult): string {
  const mode = describeMode(result.diceRoll)
  return mode === null ? narrateCheck(result) : `${mode} ${narrateCheck(result)}`
}
