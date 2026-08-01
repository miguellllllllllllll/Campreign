/**
 * High-level "magic style" answers that stand in front of the spell list.
 *
 * A beginner picks one of these and gets a legal, playable spell allocation
 * without reading sixteen spell descriptions. The detailed picker stays available
 * behind a "Customize" toggle for anyone who wants it.
 *
 * Ids are camelCase to match every other id registry in the app (raceId,
 * backgroundId, auraId), not the kebab-case in the original brief.
 */
export interface MagicStylePreset {
  id: string
  classId: 'wizard' | 'cleric'
  title: string
  description: string
  cantripIds: readonly string[]
  preparedSpellIds: readonly string[]
}

/**
 * Every wizard style prepares the same four spells because the SRD list for a
 * 1st-level wizard holds exactly four and the spec prepares four. The styles
 * differ in their cantrips, which are the spells a wizard actually casts most.
 */
const WIZARD_FIRST_LEVEL = ['magicMissile', 'mageArmor', 'shield', 'burningHands'] as const

/*
 * Every cleric style carries an attack cantrip, and the reason is measured
 * rather than felt.
 *
 * Mercy & Mending used to hold Spare the Dying, Guidance and Light — no attack
 * cantrip at all, so its only reach was a mace. Three thousand simulated runs
 * of the second encounter put it at a 53% chance of ending the fight
 * unconscious against 22% for the other two cleric styles and 3% for a paladin.
 * Reach is the variable that matters on a five-square board: holding damage
 * constant and changing only range took the same cleric from 53% to 19%.
 *
 * Which forces an awkward trade, written down because it is a real cost. Only
 * three cleric cantrips here do anything — Sacred Flame, Guidance and Spare the
 * Dying — and there are three styles wanting three each. Once Sacred Flame is
 * compulsory, giving every style the other two working ones would make all
 * three the same character. So Shield of the Faithful carries Light, whose
 * identity lives in its Shield of Faith rather than its cantrips. The honest
 * fix is more working cleric cantrips, not a cleverer shuffle of five.
 */

/*
 * A cleric at level 1 prepares 1 + their Wisdom modifier, which is three or four
 * depending on ancestry. There are now six 1st-level cleric spells, so for the
 * first time the styles differ by what they prepare rather than only by their
 * cantrips — picking one is a real choice about what your cleric is for.
 *
 * This is not tidiness. A preset short of the cap left the creation wizard's
 * Next button disabled with "1st Level 3/4" and no way forward but the
 * customise panel — every cleric, every background. The promise one screen
 * earlier is "a legal, playable spell list straight away", and it was not true.
 * `spellPresets.test.ts` holds every preset to its caps so it cannot drift back.
 */
export const MAGIC_STYLE_PRESETS: readonly MagicStylePreset[] = [
  {
    id: 'pyromancer',
    classId: 'wizard',
    title: 'Ember & Destruction',
    description:
      'Master of fire and raw force. You answer most problems by burning them, and you are very good at it.',
    cantripIds: ['fireBolt', 'rayOfFrost', 'light'],
    preparedSpellIds: WIZARD_FIRST_LEVEL,
  },
  {
    id: 'guardianMage',
    classId: 'wizard',
    title: 'Ward & Bulwark',
    description:
      'Defensive wards and protective shields. You are the fragile one, so you spend your magic on not being hit.',
    cantripIds: ['rayOfFrost', 'mageHand', 'light'],
    preparedSpellIds: WIZARD_FIRST_LEVEL,
  },
  {
    id: 'arcaneUtility',
    classId: 'wizard',
    title: 'Trick & Misdirection',
    description:
      'Tricks, light, and battlefield control. You solve encounters before they turn into fights.',
    cantripIds: ['mageHand', 'light', 'fireBolt'],
    preparedSpellIds: WIZARD_FIRST_LEVEL,
  },

  {
    id: 'radiantWrath',
    classId: 'cleric',
    title: 'Radiance & Wrath',
    description:
      'Your faith burns. You call down light on anything that deserves it and hit surprisingly hard for a healer.',
    cantripIds: ['sacredFlame', 'light', 'thaumaturgy'],
    preparedSpellIds: ['guidingBolt', 'inflictWounds', 'cureWounds', 'bless'],
  },
  {
    id: 'healersMercy',
    classId: 'cleric',
    title: 'Mercy & Mending',
    description:
      'You keep everyone standing. The least glamorous role at the table and the one nobody wants to be without.',
    cantripIds: ['spareTheDying', 'guidance', 'sacredFlame'],
    preparedSpellIds: ['healingWord', 'cureWounds', 'bless', 'shieldOfFaith'],
  },
  {
    id: 'faithfulWard',
    classId: 'cleric',
    title: 'Shield of the Faithful',
    description:
      'Divine protection spread over your allies. You make the front line harder to kill and the whole party luckier.',
    cantripIds: ['sacredFlame', 'guidance', 'light'],
    preparedSpellIds: ['shieldOfFaith', 'bless', 'cureWounds', 'guidingBolt'],
  },
]

export function magicStylesFor(classId: 'wizard' | 'cleric'): readonly MagicStylePreset[] {
  return MAGIC_STYLE_PRESETS.filter((preset) => preset.classId === classId)
}

export function magicStyleById(id: string): MagicStylePreset | undefined {
  return MAGIC_STYLE_PRESETS.find((preset) => preset.id === id)
}
