import { abilityModifier } from './stats.ts'
import type { AbilityName, AbilityScores, ClassId } from '../../types/character.ts'

/**
 * How much magic a class has at 1st level. Kept pure and separate from the spell
 * registry so the counts can be asserted without touching content.
 */
export interface SpellcastingLimits {
  cantripsCount: number
  preparedSpellsCount: number
  /**
   * Set when the class has no magic yet but will get it later, so the UI can say
   * "at level 2" instead of showing an empty picker.
   */
  unlocksAtLevel?: number
}

/**
 * A 1st-level wizard's prepared count, fixed by product spec.
 *
 * Note this is a deliberate divergence: the SRD prepares Intelligence modifier
 * + 1 spells, which is 3 for the standard array, not 4.
 */
const WIZARD_PREPARED_AT_LEVEL_1 = 4

const CANTRIPS_AT_LEVEL_1 = 3

/**
 * First-level spell slots a full caster has at 1st level.
 *
 * Lives here rather than in casting.ts because characterBuilder needs it and
 * casting.ts reaches combat.ts, which reaches characterBuilder — importing it
 * from there would close a cycle.
 */
export const FIRST_LEVEL_SLOTS = 1

/**
 * `_intMod` is accepted for a symmetrical call signature but unused: the wizard's
 * prepared count is a flat number at 1st level, not derived from Intelligence.
 */
export function getSpellcastingLimits(
  classId: ClassId,
  wisdomMod: number,
  _intMod: number,
): SpellcastingLimits {
  switch (classId) {
    case 'wizard':
      return {
        cantripsCount: CANTRIPS_AT_LEVEL_1,
        preparedSpellsCount: WIZARD_PREPARED_AT_LEVEL_1,
      }
    case 'cleric':
      return {
        cantripsCount: CANTRIPS_AT_LEVEL_1,
        // A negative Wisdom modifier must not leave a cleric with no magic at all.
        preparedSpellsCount: Math.max(1, 1 + wisdomMod),
      }
    case 'paladin':
      // SRD paladins are not spellcasters until 2nd level — no slots, no cantrips.
      return { cantripsCount: 0, preparedSpellsCount: 0, unlocksAtLevel: 2 }
    case 'fighter':
    case 'rogue':
      return { cantripsCount: 0, preparedSpellsCount: 0 }
  }
}

/** Which ability powers a class's magic, or null for the classes without any. */
export function spellcastingAbilityFor(classId: ClassId): AbilityName | null {
  switch (classId) {
    case 'wizard':
      return 'int'
    case 'cleric':
      return 'wis'
    case 'paladin':
      return 'cha'
    case 'fighter':
    case 'rogue':
      return null
  }
}

export interface SpellStats {
  spellcastingAbility: AbilityName
  /** 8 + proficiency + the casting ability modifier. */
  spellSaveDC: number
  spellAttackBonus: number
}

/** Null for classes that never cast, so callers cannot print a meaningless DC. */
export function calculateSpellStats(
  classId: ClassId,
  abilityScores: AbilityScores,
  profBonus: number,
): SpellStats | null {
  const ability = spellcastingAbilityFor(classId)
  if (ability === null) return null

  const mod = abilityModifier(abilityScores[ability])
  return {
    spellcastingAbility: ability,
    spellSaveDC: 8 + profBonus + mod,
    spellAttackBonus: profBonus + mod,
  }
}

export interface ClassFeature {
  id: string
  name: string
  type: string
  /** The number a player needs at the table, already formatted. */
  value: string
  description: string
}

/**
 * What a 1st-level paladin actually has instead of spells. Shown in place of a
 * spell picker so the step explains the class rather than skipping it.
 */
export const PALADIN_LEVEL_1_FEATURES: readonly ClassFeature[] = [
  {
    id: 'layOnHands',
    name: 'Lay on Hands',
    type: 'Healing Pool',
    value: '5 HP / Long Rest',
    description:
      'Touch a creature to restore hit points from your pool of divine energy. Spend it a point at a time or all at once.',
  },
  {
    id: 'divineSense',
    name: 'Divine Sense',
    type: 'Action',
    value: '1 + CHA Mod / Day',
    description:
      'Detect the presence of any celestial, fiend, or undead within 60 feet, even through a wall.',
  },
]

/**
 * A spell a paladin cannot cast yet, described well enough to render a real card.
 *
 * Deliberately not a `Spell` from the content registry: that type is indexed by
 * `'wizard' | 'cleric'` and every entry in it is castable now. These are neither,
 * and giving them their own shape keeps an unselectable preview from ever being
 * mistaken for something a level 1 character can put on a sheet.
 */
export interface PaladinSpellPreview {
  id: string
  name: string
  school: string
  /** The headline number or effect, in the register the spell registry uses. */
  effect: string
  description: string
  isConcentration: boolean
}

/**
 * The four 1st-level paladin spells previewed at level 1, one per pillar of the
 * class: smiting, healing, buffing, and staying on your feet.
 */
export const PALADIN_LEVEL_2_PREVIEW: readonly PaladinSpellPreview[] = [
  {
    id: 'divineFavor',
    name: 'Divine Favor',
    school: 'Evocation',
    effect: '+1d4 radiant',
    description:
      'Your weapon glows with holy power. Every hit you land adds radiant damage on top of the usual roll.',
    isConcentration: true,
  },
  {
    id: 'searingSmite',
    name: 'Searing Smite',
    school: 'Evocation',
    effect: '1d6 fire + burn',
    description:
      'Your next hit sets the target alight. It keeps burning on its own turns until someone puts it out.',
    isConcentration: true,
  },
  {
    id: 'cureWounds',
    name: 'Cure Wounds',
    school: 'Evocation',
    effect: 'Heal 1d8 + CHA',
    description:
      'Touch a wounded ally and close the wound. The single most useful thing you will learn to do.',
    isConcentration: false,
  },
  {
    id: 'heroism',
    name: 'Heroism',
    school: 'Enchantment',
    effect: 'Temp HP + no fear',
    description:
      'An ally becomes briefly fearless and gains a cushion of temporary hit points every turn.',
    isConcentration: true,
  },
]


/* ---------------------------------------------------------------------------
 * Spell-cast hooks
 *
 * The two subclass features that key off the moment a spell is cast rather than
 * off an attack roll: a Life cleric's healing landing heavier, and an Abjurer's
 * ward topping itself back up.
 *
 * These are pure and correct and currently have NO CALLER. Nothing in this
 * build can cast a levelled spell: only cantrips carrying an `attack` become
 * buttons, `applyHealing` is defined and never invoked, and Mage Armor, Shield,
 * Shield of Faith and Cure Wounds all sit on the sheet unpressable. So `life`
 * and `abjuration` stay marked inactive in the subclass data — "active" there
 * means the engine genuinely applies it today, and it does not. The missing
 * piece is a cast action, not this file.
 * ------------------------------------------------------------------------ */

/**
 * Schools as this hook spells them: lowercase, and its own vocabulary rather
 * than the registry's capitalised `SpellSchool`. Worth collapsing into one
 * union when a caster exists to produce these events.
 */
export type CastSchool =
  | 'abjuration'
  | 'evocation'
  | 'enchantment'
  | 'necromancy'
  | 'transmutation'
  | 'conjuration'
  | 'divination'
  | 'illusion'

export interface SpellCastEvent {
  casterId: string
  targetId: string
  spellId: string
  school: CastSchool
  /** 0 for cantrips, 1+ for levelled spells. */
  level: number
  isHealing: boolean
  baseAmount: number
}

export interface SubclassFeatureCarrier {
  level: number
  intMod: number
  currentWardHp?: number
  hasFeature: (featureId: string) => boolean
}

export interface SpellCastOutcome {
  finalAmount: number
  /** The ward after this cast — unchanged rather than absent when nothing fired. */
  updatedCasterWardHp?: number
  triggeredFeatures: string[]
}

const DISCIPLE_OF_LIFE = 'life_domain_disciple_of_life'
const ARCANE_WARD = 'abjuration_arcane_ward'

/**
 * Twice the caster's level plus Intelligence.
 *
 * Floored at 1: the SRD would hand a wizard with a negative Intelligence
 * modifier a ward of zero, which is a feature that does nothing. Unreachable
 * with the scores this build deals out, but stated rather than left to chance.
 */
export function maxArcaneWardHp(caster: SubclassFeatureCarrier): number {
  return Math.max(1, 2 * caster.level + caster.intMod)
}

export function resolveSpellCastHook(
  event: SpellCastEvent,
  caster: SubclassFeatureCarrier,
): SpellCastOutcome {
  let finalAmount = event.baseAmount
  let updatedCasterWardHp = caster.currentWardHp
  const triggeredFeatures: string[] = []

  // A cantrip is not a spell slot. Both features key off levelled casting, and
  // checking it once here keeps the rule in one place rather than in each arm.
  if (event.level < 1) {
    return { finalAmount, updatedCasterWardHp, triggeredFeatures }
  }

  if (event.isHealing && caster.hasFeature(DISCIPLE_OF_LIFE)) {
    finalAmount += 2 + event.level
    triggeredFeatures.push(DISCIPLE_OF_LIFE)
  }

  if (event.school === 'abjuration' && caster.hasFeature(ARCANE_WARD)) {
    const max = maxArcaneWardHp(caster)
    /*
     * `undefined` is the only thing that means "no ward yet". A ward sitting at
     * 0 still exists — the SRD says you simply take damage normally while it is
     * empty — so it recharges by twice the spell level like any other. Treating
     * 0 as absent would hand a wizard a full ward back for one 1st-level spell,
     * which is the difference between regaining 2 and regaining all 5.
     */
    updatedCasterWardHp =
      updatedCasterWardHp === undefined
        ? max
        : Math.min(max, updatedCasterWardHp + 2 * event.level)
    triggeredFeatures.push(ARCANE_WARD)
  }

  return { finalAmount, updatedCasterWardHp, triggeredFeatures }
}

/**
 * Resolves incoming damage against an optional ward before hit points.
 *
 * Hit points clamp at zero, matching applyDamage in combat.ts — a combatant
 * with no ward passes through this with identical arithmetic.
 */
export function applyDamageWithWard(
  incomingDamage: number,
  currentHp: number,
  currentWardHp = 0,
): { newHp: number; newWardHp: number; damageAbsorbed: number } {
  const ward = Math.max(0, currentWardHp)
  const damage = Math.max(0, incomingDamage)
  const damageAbsorbed = Math.min(ward, damage)

  return {
    newHp: Math.max(0, currentHp - (damage - damageAbsorbed)),
    newWardHp: ward - damageAbsorbed,
    damageAbsorbed,
  }
}
