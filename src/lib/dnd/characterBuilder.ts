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
import { magicStyleById } from '../../content/spellPresets.ts'
import { spellsByIds } from '../../content/spells.ts'
import { bonusInitiative, bonusMaxHp, featById, grantedCantripId } from '../../content/feats.ts'
import {
  channelDivinityFor,
  critThresholdFor,
  hasAmbushFor,
  hasFastHandsFor,
  hasReactionFor,
  subclassById,
  superiorityDiceFor,
} from '../../content/subclasses.ts'
import { STARTING_POTIONS } from './items.ts'
import { FIRST_LEVEL_SLOTS } from './spellcasting.ts'
import { abilityModifier, proficiencyBonus } from './stats.ts'
import {
  ARMORS,
  AURA_PRESETS,
  BACKGROUND_PRESETS,
  CLASS_PRESETS,
  RACE_PRESETS,
  personalityOf,
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

/**
 * The spells a set of answers actually amounts to.
 *
 * Explicit lists win, because they only exist when the player hand-picked them;
 * otherwise the chosen style supplies them. Reads spell data from content, which
 * is pure data like the presets beside it — no side effects cross the boundary.
 */
export function resolveSpellSelection(answers: CreationDraft): {
  cantripIds: readonly string[]
  preparedSpellIds: readonly string[]
} {
  const style = answers.magicStyleId === undefined ? undefined : magicStyleById(answers.magicStyleId)
  return {
    cantripIds: answers.cantripIds ?? style?.cantripIds ?? [],
    preparedSpellIds: answers.preparedSpellIds ?? style?.preparedSpellIds ?? [],
  }
}

/**
 * Whether these answers amount to a caster with levelled spells.
 *
 * Checks the class as well as the list. resolveSpellSelection will happily
 * return a cleric's prepared spells for a fighter carrying a stale style id —
 * the wizard clears it on a class change so it cannot happen through the UI,
 * but the builder is a pure function and should not hand out spell slots on
 * the strength of an id nobody validated.
 */
function selectionHasLeveledSpells(
  answers: CreationDraft,
  casts: boolean,
): boolean {
  return casts && resolveSpellSelection(answers).preparedSpellIds.length > 0
}

/**
 * Keeps the first attack of each id. A wizard's class list already carries Fire
 * Bolt, so choosing it as a cantrip would otherwise print the same button twice.
 */
function dedupeAttacks(attacks: readonly AttackAction[]): AttackAction[] {
  const seen = new Set<string>()
  const kept: AttackAction[] = []
  for (const attack of attacks) {
    if (seen.has(attack.id)) continue
    seen.add(attack.id)
    kept.push({ ...attack })
  }
  return kept
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

  // A feat's hit points are added to the class total rather than folded into
  // maxHitPoints, so the base calculation stays the one the sheet explains.
  const maxHp = maxHitPoints(klass.hitDie, scores.con) + bonusMaxHp(answers.featId)
  const initiativeBonus = bonusInitiative(answers.featId)
  const critOn = critThresholdFor(answers.subclassId)
  const superiorityDice = superiorityDiceFor(answers.subclassId)
  const channelDivinityCharges = channelDivinityFor(answers.subclassId)
  const hasReaction = hasReactionFor(answers.subclassId)
  const hasAmbush = hasAmbushFor(answers.subclassId)
  const hasFastHands = hasFastHandsFor(answers.subclassId)
  // One 1st-level slot for anyone who prepares spells at all.
  const spellSlots = selectionHasLeveledSpells(answers, klass.spellcasting !== undefined)
    ? FIRST_LEVEL_SLOTS
    : undefined
  const trimmedName = name.trim()
  const spellcasting = spellcastingFor(klass.spellcasting, scores, level)
  const selection = resolveSpellSelection(answers)
  // Magic Initiate's cantrip joins the class list rather than replacing it, and
  // dedupeAttacks below stops a wizard who also took the feat printing Fire
  // Bolt on the bar twice.
  const featCantripId = grantedCantripId(answers.featId, answers.magicInitiateSpellId)
  const cantripIds =
    featCantripId === undefined || selection.cantripIds.includes(featCantripId)
      ? selection.cantripIds
      : [...selection.cantripIds, featCantripId]
  const cantrips = spellsByIds(cantripIds)

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
    attacks: dedupeAttacks([
      ...loadout.attacks,
      ...klass.attacks,
      // An aimed cantrip becomes a real button; utility magic stays off the bar.
      ...cantrips.flatMap((cantrip) => (cantrip.attack === undefined ? [] : [cantrip.attack])),
    ]),
    trinket: { ...background.trinket },
    personality: personalityOf(background, answers.flawId),
    cosmetics: { ...aura.cosmetics },
    ...(spellcasting === undefined ? {} : { spellcasting }),
    ...(cantripIds.length === 0 ? {} : { cantrips: [...cantripIds] }),
    ...(selection.preparedSpellIds.length === 0
      ? {}
      : { preparedSpells: [...selection.preparedSpellIds] }),
    ...(answers.magicStyleId === undefined ? {} : { magicStyleId: answers.magicStyleId }),
    // Only written when advanced mode actually produced a pick, so a fast-track
    // character serialises exactly as it did before the feature existed.
    ...(subclassById(answers.subclassId) === undefined ? {} : { subclassId: answers.subclassId }),
    ...(featById(answers.featId) === undefined ? {} : { featId: answers.featId }),
    ...(featCantripId === undefined ? {} : { magicInitiateSpellId: featCantripId }),
    ...(initiativeBonus === 0 ? {} : { initiativeBonus }),
    ...(critOn === undefined ? {} : { critOn }),
    ...(superiorityDice === undefined ? {} : { superiorityDice }),
    ...(channelDivinityCharges === undefined ? {} : { channelDivinityCharges }),
    ...(hasReaction ? { hasReaction } : {}),
    ...(hasAmbush ? { hasAmbush } : {}),
    ...(hasFastHands ? { hasFastHands } : {}),
    // Everyone walks in with one, so the Thief's bonus action has something
    // to be quicker than.
    potions: STARTING_POTIONS,
    ...(spellSlots === undefined ? {} : { spellSlots }),
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
      // Spells pass through as chosen; the preview shows an empty list honestly
      // rather than inventing a spell nobody picked.
      ...(draft.magicStyleId === undefined ? {} : { magicStyleId: draft.magicStyleId }),
      // The sidebar must show the feat's hit points the moment it is picked,
      // so advanced answers pass straight through to the same builder.
      ...(draft.subclassId === undefined ? {} : { subclassId: draft.subclassId }),
      ...(draft.featId === undefined ? {} : { featId: draft.featId }),
      ...(draft.magicInitiateSpellId === undefined
        ? {}
        : { magicInitiateSpellId: draft.magicInitiateSpellId }),
      ...(draft.cantripIds === undefined ? {} : { cantripIds: draft.cantripIds }),
      ...(draft.preparedSpellIds === undefined
        ? {}
        : { preparedSpellIds: draft.preparedSpellIds }),
    },
    name,
    meta,
  )
}
