import type { AttackAction } from '../../types/action.ts'
import type {
  AbilityName,
  AbilityScores,
  Character,
  CreationAnswers,
  CreationDraft,
  SkillName,
  Spellcasting,
} from '../../types/character.ts'
import type { Armor } from '../../types/items.ts'
import { abilityModifier, proficiencyBonus } from './stats.ts'
import {
  ARMORS,
  AURA_PRESETS,
  BACKGROUND_PRESETS,
  CLASS_PRESETS,
  RACE_PRESETS,
  personalityOf,
  type ClassPreset,
  type ClassSpellcasting,
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

/** SRD: 8 + proficiency + the casting ability's modifier. */
export function spellSaveDc(
  scores: AbilityScores,
  ability: AbilityName,
  level: number,
): number {
  return 8 + proficiencyBonus(level) + abilityModifier(scores[ability])
}

export function spellAttackBonus(
  scores: AbilityScores,
  ability: AbilityName,
  level: number,
): number {
  return proficiencyBonus(level) + abilityModifier(scores[ability])
}

function spellcastingFor(
  casting: ClassSpellcasting | undefined,
  scores: AbilityScores,
  level: number,
): Spellcasting | undefined {
  if (casting === undefined) return undefined
  return {
    ability: casting.ability,
    saveDc: spellSaveDc(scores, casting.ability, level),
    attackBonus: spellAttackBonus(scores, casting.ability, level),
    ...(casting.note === undefined ? {} : { note: casting.note }),
  }
}

function uniqueSkills(...groups: readonly SkillName[][]): SkillName[] {
  return [...new Set(groups.flat())]
}

function chosenSpellOption(klass: ClassPreset, spellId: string | undefined) {
  if (spellId === undefined) return undefined
  return klass.spellcasting?.options.find((option) => option.id === spellId)
}

/**
 * Turns the creation answers into a complete 1st-level character.
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
  const background = BACKGROUND_PRESETS[answers.backgroundId]
  const aura = AURA_PRESETS[answers.auraId]
  const loadout = klass.loadouts[answers.equipmentChoice]

  const scores = applyRacialBonuses(klass.scores, race.bonuses)
  const armor = ARMORS[loadout.armorId]
  const level = 1

  if (armor === undefined) throw new Error(`Unknown armor "${loadout.armorId}"`)

  const maxHp = maxHitPoints(klass.hitDie, scores.con)
  const trimmedName = name.trim()
  const spell = chosenSpellOption(klass, answers.spellId)
  const spellcasting = spellcastingFor(klass.spellcasting, scores, level)

  return {
    id: meta.id,
    name: trimmedName.length > 0 ? trimmedName : 'Unnamed Hero',
    createdAt: meta.now,
    level,
    classId: klass.id,
    raceId: race.id,
    backgroundId: background.id,
    scores,
    maxHp,
    currentHp: maxHp,
    speedFeet: race.speedFeet,
    ac: armorClass(armor, scores.dex, loadout.hasShield),
    armorName: loadout.hasShield ? `${armor.name} + Shield` : armor.name,
    hasShield: loadout.hasShield,
    equipmentChoice: loadout.id,
    loadoutName: loadout.label,
    proficiencyBonus: proficiencyBonus(level),
    skillProficiencies: uniqueSkills(klass.skillProficiencies, background.skills),
    savingThrows: [...klass.savingThrows],
    attacks: [
      ...loadout.attacks.map((attack) => ({ ...attack })),
      ...klass.attacks.map((attack) => ({ ...attack })),
      ...(spell?.attack === undefined ? [] : [{ ...spell.attack }]),
    ],
    trinket: { ...background.trinket },
    personality: personalityOf(background, answers.flawId),
    cosmetics: { ...aura.cosmetics },
    ...(spellcasting === undefined ? {} : { spellcasting }),
    ...(spell === undefined ? {} : { chosenSpells: [spell.id] }),
    blurb: `${race.label.toLowerCase()} ${klass.label.toLowerCase()}, ${background.blurb}`,
  }
}

/**
 * The half-finished sheet the wizard shows while the player is still choosing.
 * Unanswered questions fall back to the first option so the numbers stay real;
 * the sidebar is what decides which of them are honest enough to show yet.
 */
export function previewCharacter(
  draft: CreationDraft,
  name: string,
  meta: { id: string; now: number },
): Character | null {
  if (draft.classId === undefined || draft.raceId === undefined) return null

  const backgroundId = draft.backgroundId ?? 'guildArtisan'
  const background = BACKGROUND_PRESETS[backgroundId]

  return buildCharacter(
    {
      classId: draft.classId,
      raceId: draft.raceId,
      backgroundId,
      flawId: draft.flawId ?? background.flaws[0]?.id ?? '',
      equipmentChoice: draft.equipmentChoice ?? 'defensive',
      auraId: draft.auraId ?? 'amber',
      ...(draft.spellId === undefined ? {} : { spellId: draft.spellId }),
    },
    name,
    meta,
  )
}
