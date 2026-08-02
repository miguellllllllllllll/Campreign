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
 * Mage Armor and Shield are in every wizard list, and that is a judgement
 * rather than an oversight. A 1st-level wizard without them is AC 12 on six
 * hit points, and a beginner who picked "Ember & Destruction" should not
 * discover that the style question quietly chose dying for them. The styles
 * spend their other two slots instead, which is where the character actually is.
 *
 * Until Ray of Sickness there were four spells and a cap of four, so all three
 * lists here were literally the same constant — the style question changed a
 * wizard's cantrips and nothing else. Five spells for four slots is the
 * smallest number that makes it a question.
 */
const WIZARD_CORE = ['mageArmor', 'shield'] as const

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
    // The burner: darts that never miss, and the spell that covers ground.
    preparedSpellIds: [...WIZARD_CORE, 'magicMissile', 'burningHands'],
  },
  {
    id: 'guardianMage',
    classId: 'wizard',
    title: 'Ward & Bulwark',
    description:
      'Defensive wards and protective shields. You are the fragile one, so you spend your magic on not being hit.',
    cantripIds: ['rayOfFrost', 'mageHand', 'light'],
    // Defence by subtraction — a poisoned enemy swings at disadvantage.
    preparedSpellIds: [...WIZARD_CORE, 'magicMissile', 'rayOfSickness'],
  },
  {
    id: 'arcaneUtility',
    classId: 'wizard',
    title: 'Trick & Misdirection',
    description:
      'Tricks, light, and battlefield control. You solve encounters before they turn into fights.',
    cantripIds: ['mageHand', 'light', 'fireBolt'],
    // Control: soften the board, then make what is left swing badly.
    preparedSpellIds: [...WIZARD_CORE, 'burningHands', 'rayOfSickness'],
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
    /*
     * Guiding Bolt sits third, and both facts matter.
     *
     * It is here because this was the only cleric style with nothing at all to
     * spend an action on but healing, and simulation says that loses: against
     * one enemy hitting as hard as the spider, a turn traded for hit points you
     * are about to lose again is worse than a turn traded for damage. It was the
     * weakest build in the last encounter by a wide margin, and the only one
     * that got *worse* when it started casting — 35% down to 32%.
     *
     * Third rather than last because the list is trimmed to 1 + Wisdom modifier
     * and the tail is what falls off. A cleric with Wisdom 14 keeps three, so an
     * offensive spell written fourth would be cut from precisely the cleric who
     * has the least of everything else. The two heals still lead, because they
     * are what makes this style itself.
     *
     * One, not two. `radiantWrath` carries Guiding Bolt *and* Inflict Wounds and
     * is meant to out-damage this; the point here is to stop a healer being
     * helpless, not to make the healer a second wrath cleric.
     */
    preparedSpellIds: ['healingWord', 'cureWounds', 'guidingBolt', 'bless', 'shieldOfFaith'],
  },
  {
    id: 'faithfulWard',
    classId: 'cleric',
    title: 'Shield of the Faithful',
    description:
      'Divine protection spread over your allies. You make the front line harder to kill and the whole party luckier.',
    cantripIds: ['sacredFlame', 'guidance', 'light'],
    /*
     * Guiding Bolt moved from fourth to third, which is a bug fix rather than a
     * balance tweak — it was being deleted from most of the clerics who chose
     * this style.
     *
     * The list is trimmed to 1 + Wisdom modifier. A human cleric reaches Wisdom
     * 16 and keeps four; a dwarf, elf, halfling or tiefling sits at 15, keeps
     * three, and lost the only offensive spell on the list. Four races out of
     * five got a protection style with literally nothing to attack with beyond
     * a cantrip, and nothing anywhere said so.
     *
     * Shield of Faith and Bless still lead — they are the style — and Cure
     * Wounds is now what the tail gives up instead.
     */
    preparedSpellIds: ['shieldOfFaith', 'bless', 'guidingBolt', 'cureWounds'],
  },
]

export function magicStylesFor(classId: 'wizard' | 'cleric'): readonly MagicStylePreset[] {
  return MAGIC_STYLE_PRESETS.filter((preset) => preset.classId === classId)
}

export function magicStyleById(id: string): MagicStylePreset | undefined {
  return MAGIC_STYLE_PRESETS.find((preset) => preset.id === id)
}
