import type { AttackAction } from '../../types/action.ts'
import type {
  AbilityScores,
  Character,
  CreationAnswers,
  SkillName,
} from '../../types/character.ts'
import type { Armor } from '../../types/items.ts'
import { abilityModifier, proficiencyBonus } from './stats.ts'
import {
  ARMORS,
  CLASS_PRESETS,
  MOTIVATION_PRESETS,
  RACE_PRESETS,
} from './presets.ts'

export function applyRacialBonuses(
  base: AbilityScores,
  bonuses: Partial<AbilityScores>,
): AbilityScores {
  return {
    str: base.str + (bonuses.str ?? 0),
    dex: base.dex + (bonuses.dex ?? 0),
    con: base.con + (bonuses.con ?? 0),
    int: base.int + (bonuses.int ?? 0),
    wis: base.wis + (bonuses.wis ?? 0),
    cha: base.cha + (bonuses.cha ?? 0),
  }
}

export function armorClass(armor: Armor, dexScore: number, hasShield: boolean): number {
  const dexMod = abilityModifier(dexScore)
  const allowedDex = armor.dexCap === null ? dexMod : Math.min(dexMod, armor.dexCap)
  return armor.baseAc + allowedDex + (hasShield ? 2 : 0)
}

/** A 1st-level character gets the maximum roll on their hit die, plus Constitution. */
export function maxHitPoints(hitDie: number, conScore: number): number {
  return Math.max(1, hitDie + abilityModifier(conScore))
}

export function attackBonus(
  attack: AttackAction,
  scores: AbilityScores,
  level: number,
): number {
  const ability = abilityModifier(scores[attack.ability])
  return ability + (attack.proficient ? proficiencyBonus(level) : 0)
}

export function damageBonus(attack: AttackAction, scores: AbilityScores): number {
  return attack.addAbilityToDamage ? abilityModifier(scores[attack.ability]) : 0
}

/** Full damage notation including the ability modifier, e.g. "1d8+3". */
export function damageNotation(attack: AttackAction, scores: AbilityScores): string {
  const bonus = damageBonus(attack, scores)
  if (bonus === 0) return attack.damage
  return bonus > 0 ? `${attack.damage}+${bonus}` : `${attack.damage}${bonus}`
}

function uniqueSkills(...groups: readonly SkillName[][]): SkillName[] {
  return [...new Set(groups.flat())]
}

/**
 * Turns the three story answers into a complete 1st-level character.
 * `id` and `now` are injected so the same answers always produce the same
 * character — nothing here reaches for ambient randomness or the clock.
 */
export function buildCharacter(
  answers: CreationAnswers,
  name: string,
  meta: { id: string; now: number },
): Character {
  const klass = CLASS_PRESETS[answers.classId]
  const race = RACE_PRESETS[answers.raceId]
  const motivation = MOTIVATION_PRESETS[answers.motivationId]

  const scores = applyRacialBonuses(klass.scores, race.bonuses)
  const armor = ARMORS[klass.armorId] ?? ARMORS.none
  const level = 1

  if (armor === undefined) throw new Error(`Unknown armor "${klass.armorId}"`)

  const maxHp = maxHitPoints(klass.hitDie, scores.con)
  const trimmedName = name.trim()

  return {
    id: meta.id,
    name: trimmedName.length > 0 ? trimmedName : 'Unnamed Hero',
    createdAt: meta.now,
    level,
    classId: klass.id,
    raceId: race.id,
    motivationId: motivation.id,
    scores,
    maxHp,
    currentHp: maxHp,
    speedFeet: race.speedFeet,
    ac: armorClass(armor, scores.dex, klass.hasShield),
    armorName: klass.hasShield ? `${armor.name} + Shield` : armor.name,
    hasShield: klass.hasShield,
    proficiencyBonus: proficiencyBonus(level),
    skillProficiencies: uniqueSkills(klass.skillProficiencies, [motivation.skill]),
    savingThrows: [...klass.savingThrows],
    attacks: klass.attacks.map((attack) => ({ ...attack })),
    blurb: `${race.label.toLowerCase()} ${klass.label.toLowerCase()}, ${motivation.blurb}`,
  }
}
