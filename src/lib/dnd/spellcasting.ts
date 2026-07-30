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
