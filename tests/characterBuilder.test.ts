import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCharacter,
  previewCharacter,
  applyRacialBonuses,
  armorClass,
  maxHitPoints,
  attackBonus,
  damageNotation,
  spellAttackBonus,
  spellSaveDc,
  resolveSpellSelection,
} from '../src/lib/dnd/characterBuilder.ts'
import { ARMORS, BACKGROUND_PRESETS, CLASS_PRESETS } from '../src/lib/dnd/presets.ts'
import { magicStyleById } from '../src/content/spellPresets.ts'
import { SPELLS_BY_ID } from '../src/content/spells.ts'
import type { CreationAnswers } from '../src/types/character.ts'

const meta = { id: 'test-id', now: 1_700_000_000_000 }

/** The full set of answers, so each test only states the part it cares about. */
function answers(overrides: Partial<CreationAnswers> = {}): CreationAnswers {
  return {
    classId: 'fighter',
    raceId: 'human',
    backgroundId: 'guildArtisan',
    flawId: 'haggler',
    equipmentChoice: 'defensive',
    auraId: 'amber',
    ...overrides,
  }
}

test('racial bonuses are added per ability', () => {
  const base = { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }
  assert.deepEqual(applyRacialBonuses(base, { con: 2 }), {
    str: 15, dex: 13, con: 16, int: 8, wis: 12, cha: 10,
  })
  assert.deepEqual(applyRacialBonuses(base, { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }), {
    str: 16, dex: 14, con: 15, int: 9, wis: 13, cha: 11,
  })
  assert.deepEqual(applyRacialBonuses(base, { cha: 2, int: 1 }), {
    str: 15, dex: 13, con: 14, int: 9, wis: 12, cha: 12,
  })
})

test('armor class respects each armour category dex cap', () => {
  const noArmor = ARMORS.none
  const leather = ARMORS.leather
  const studded = ARMORS.studdedLeather
  const mageArmor = ARMORS.mageArmor
  const scale = ARMORS.scaleMail
  const chain = ARMORS.chainMail
  assert.ok(noArmor && leather && studded && mageArmor && scale && chain)

  assert.equal(armorClass(noArmor, 14, false), 12)
  assert.equal(armorClass(leather, 16, false), 14)
  assert.equal(armorClass(studded, 16, false), 15, 'studded leather is one better than leather')
  assert.equal(armorClass(mageArmor, 16, false), 16, 'the spell takes dexterity uncapped')
  assert.equal(armorClass(scale, 20, false), 16, 'medium armour caps dex at +2')
  assert.equal(armorClass(chain, 20, false), 16, 'heavy armour ignores dex entirely')
  assert.equal(armorClass(scale, 14, true), 18, 'shield adds +2')
})

test('first level hit points are max hit die plus constitution', () => {
  assert.equal(maxHitPoints(10, 16), 13)
  assert.equal(maxHitPoints(6, 13), 7)
  assert.equal(maxHitPoints(6, 6), 4)
  assert.equal(maxHitPoints(6, 1), 1, 'never drops below 1')
})

test('spell save DC and spell attack bonus follow the SRD formulas', () => {
  const scores = { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 }
  assert.equal(spellSaveDc(scores, 'int', 1), 13, '8 + 2 proficiency + 3 int')
  assert.equal(spellAttackBonus(scores, 'int', 1), 5, '2 proficiency + 3 int')
  assert.equal(spellSaveDc(scores, 'cha', 1), 10, 'a score of 10 adds nothing')
})

test('a dwarf fighter is fully statted from the creation answers', () => {
  const hero = buildCharacter(answers({ raceId: 'dwarf' }), 'Bruenna', meta)

  assert.equal(hero.name, 'Bruenna')
  assert.equal(hero.level, 1)
  assert.equal(hero.scores.con, 16, 'dwarf +2 constitution')
  assert.equal(hero.maxHp, 13, 'd10 hit die + 3 con')
  assert.equal(hero.currentHp, hero.maxHp)
  assert.equal(hero.speedFeet, 25)
  assert.equal(hero.proficiencyBonus, 2)
  assert.equal(hero.ac, 18, 'chain mail 16, no dex, +2 shield')
  assert.equal(hero.hasShield, true)
  assert.match(hero.armorName, /Chain Mail \+ Shield/)
  assert.equal(hero.spellcasting, undefined, 'fighters cast nothing')
  assert.ok(hero.attacks.length > 0)
})

test('the loadout choice is what moves armour class and damage', () => {
  const defensive = buildCharacter(answers({ equipmentChoice: 'defensive' }), 'Shield', meta)
  const offensive = buildCharacter(answers({ equipmentChoice: 'offensive' }), 'Greatsword', meta)

  assert.equal(defensive.ac, 18)
  assert.equal(offensive.ac, 16, 'no shield is two points of armour class')
  assert.equal(offensive.hasShield, false)
  assert.equal(defensive.loadoutName, 'Longsword & Shield')
  assert.equal(offensive.loadoutName, 'Greatsword')

  const swings = offensive.attacks.map((attack) => attack.name)
  assert.ok(swings.includes('Greatsword'))
  assert.ok(!swings.includes('Longsword'))
  assert.ok(swings.includes('Thrown Handaxe'), 'the class attack survives either choice')
})

test('a wizard has no armour training, so the defensive pick is a spell', () => {
  const defensive = buildCharacter(answers({ classId: 'wizard' }), 'Alarin', meta)
  const offensive = buildCharacter(
    answers({ classId: 'wizard', equipmentChoice: 'offensive' }),
    'Alarin',
    meta,
  )

  assert.equal(defensive.scores.int, 16, 'human +1 on top of 15')
  assert.equal(defensive.maxHp, 8, 'd6 + 2 con')
  assert.equal(defensive.armorName, 'Mage Armour')
  assert.equal(defensive.ac, 15, 'mage armour 13 + 2 dex')
  assert.equal(offensive.ac, 12, 'unarmoured 10 + 2 dex')
})

test('an elf rogue leans on dexterity', () => {
  const hero = buildCharacter(answers({ classId: 'rogue', raceId: 'elf' }), 'Sylvi', meta)

  assert.equal(hero.scores.dex, 17)
  assert.equal(hero.ac, 15, 'studded leather 12 + 3 dex')
  assert.equal(hero.maxHp, 10, 'd8 + 2 con')
  assert.equal(hero.hasShield, false, 'rogues have no shield proficiency')
})

test('a cleric carries a shield and casts with wisdom', () => {
  const hero = buildCharacter(answers({ classId: 'cleric' }), 'Doran', meta)

  assert.equal(hero.hasShield, true)
  assert.match(hero.armorName, /Shield/)
  assert.equal(hero.ac, 15, 'scale 14 - 1 dex (score 9) + 2 shield')
  assert.equal(hero.spellcasting?.ability, 'wis')
  assert.equal(hero.spellcasting?.saveDc, 13, '8 + 2 proficiency + 3 wis')
  assert.equal(hero.spellcasting?.attackBonus, 5)
})

test('a tiefling paladin has the numbers before it has the spells', () => {
  const hero = buildCharacter(answers({ classId: 'paladin', raceId: 'tiefling' }), 'Vex', meta)

  assert.equal(hero.scores.cha, 15, 'tiefling +2 charisma')
  assert.equal(hero.scores.int, 9)
  assert.equal(hero.maxHp, 12, 'd10 + 2 con')
  assert.equal(hero.ac, 18)
  assert.equal(hero.spellcasting?.ability, 'cha')
  assert.equal(hero.spellcasting?.saveDc, 12, '8 + 2 proficiency + 2 cha')
  assert.equal(hero.spellcasting?.attackBonus, 4)
  assert.ok(hero.spellcasting?.note !== undefined, 'the level-2 caveat is spelled out')
  assert.equal(hero.cantrips, undefined, 'a level 1 paladin has no cantrips at all')
  assert.equal(hero.preparedSpells, undefined, 'and no prepared spells either')
})

test('the background trains two skills and hands over a trinket', () => {
  const hero = buildCharacter(
    answers({ backgroundId: 'noble', flawId: 'appearances' }),
    'Cassia',
    meta,
  )

  assert.ok(hero.skillProficiencies.includes('history'))
  assert.ok(hero.skillProficiencies.includes('persuasion'))
  assert.ok(hero.skillProficiencies.includes('athletics'), 'the class skills are still there')
  assert.equal(hero.trinket.name, 'Signet ring of a fallen house')
  assert.ok(hero.trinket.description.length > 0)
  assert.equal(hero.backgroundId, 'noble')
})

test('the chosen flaw is the one that lands on the sheet', () => {
  const hero = buildCharacter(
    answers({ backgroundId: 'streetUrchin', flawId: 'suspicious' }),
    'Wren',
    meta,
  )
  const urchin = BACKGROUND_PRESETS.streetUrchin

  assert.equal(hero.personality.flaw, 'I assume kindness is a trick and wait for the price.')
  assert.equal(hero.personality.ideal, urchin.ideal)
  assert.equal(hero.personality.bond, urchin.bond)
})

test('an unrecognised flaw falls back rather than leaving the sheet blank', () => {
  const hero = buildCharacter(answers({ flawId: 'no-such-flaw' }), 'Bruenna', meta)
  const artisan = BACKGROUND_PRESETS.guildArtisan

  assert.equal(hero.personality.flaw, artisan.flaws[0]?.text)
})

test('duplicate skills from class and background collapse', () => {
  const hero = buildCharacter(
    answers({ classId: 'rogue', backgroundId: 'streetUrchin', flawId: 'hoarder' }),
    'Wren',
    meta,
  )

  const unique = new Set(hero.skillProficiencies)
  assert.equal(unique.size, hero.skillProficiencies.length)
  assert.equal(
    hero.skillProficiencies.length,
    3,
    'the urchin trains the two skills the rogue already had',
  )
})

test('the aura is cosmetic and lands on the character as raw colour', () => {
  const hero = buildCharacter(answers({ auraId: 'violet' }), 'Bruenna', meta)

  assert.deepEqual(hero.cosmetics, { auraColor: '#9b6bd6', tokenBorder: '#6d45a6' })
})

test('a chosen attack cantrip becomes a usable attack', () => {
  const hero = buildCharacter(
    answers({ classId: 'wizard', cantripIds: ['rayOfFrost'] }),
    'Alarin',
    meta,
  )

  assert.deepEqual(hero.cantrips, ['rayOfFrost'])
  assert.ok(hero.attacks.some((attack) => attack.id === 'rayOfFrost'))
})

test('a chosen utility cantrip is remembered without becoming an attack', () => {
  const hero = buildCharacter(
    answers({ classId: 'cleric', cantripIds: ['guidance'] }),
    'Doran',
    meta,
  )

  assert.deepEqual(hero.cantrips, ['guidance'])
  assert.ok(!hero.attacks.some((attack) => attack.id === 'guidance'))
})

test('attack and damage bonuses use the right ability', () => {
  const fighter = buildCharacter(answers({ raceId: 'dwarf' }), 'Bruenna', meta)
  const longsword = CLASS_PRESETS.fighter.loadouts.defensive.attacks[0]
  assert.ok(longsword)
  assert.equal(attackBonus(longsword, fighter.scores, 1), 4, '+2 str, +2 proficiency')
  assert.equal(damageNotation(longsword, fighter.scores), '1d8+2')

  const wizard = buildCharacter(answers({ classId: 'wizard' }), 'Alarin', meta)
  // Fire Bolt now lives in the spell registry, not the class's granted attacks.
  const fireBolt = SPELLS_BY_ID.fireBolt?.attack
  assert.ok(fireBolt)
  assert.equal(attackBonus(fireBolt, wizard.scores, 1), 5, '+3 int, +2 proficiency')
  assert.equal(damageNotation(fireBolt, wizard.scores), '1d10', 'cantrips add no ability damage')
})

test('the same answers always build an identical character', () => {
  const same = answers({ classId: 'cleric', raceId: 'halfling', cantripIds: ['light'] })
  const first = buildCharacter(same, 'Pip', meta)
  const second = buildCharacter(same, 'Pip', meta)
  assert.deepEqual(first, second)
})

test('a blank name falls back rather than rendering empty', () => {
  const hero = buildCharacter(answers(), '   ', meta)
  assert.equal(hero.name, 'Unnamed Hero')
})

test('the preview stays empty until the first two questions are answered', () => {
  assert.equal(previewCharacter({}, '', meta), null)
  assert.equal(previewCharacter({ classId: 'fighter' }, '', meta), null)
  assert.ok(previewCharacter({ classId: 'fighter', raceId: 'dwarf' }, '', meta) !== null)
})

test('the preview shows real numbers, not placeholders', () => {
  const preview = previewCharacter({ classId: 'fighter', raceId: 'dwarf' }, 'Bruenna', meta)
  const built = buildCharacter(answers({ raceId: 'dwarf' }), 'Bruenna', meta)

  assert.equal(preview?.ac, built.ac)
  assert.equal(preview?.maxHp, built.maxHp)
})

test('a magic style fills the spell lists without being asked twice', () => {
  const hero = buildCharacter(answers({ classId: 'wizard', magicStyleId: 'pyromancer' }), 'Vae', meta)
  const style = magicStyleById('pyromancer')

  assert.deepEqual(hero.cantrips, [...(style?.cantripIds ?? [])])
  assert.deepEqual(hero.preparedSpells, [...(style?.preparedSpellIds ?? [])])
  assert.equal(hero.magicStyleId, 'pyromancer')
})

test('hand-picked spells override the style they came from', () => {
  const hero = buildCharacter(
    answers({ classId: 'cleric', magicStyleId: 'healersMercy', cantripIds: ['sacredFlame'] }),
    'Doran',
    meta,
  )

  assert.deepEqual(hero.cantrips, ['sacredFlame'], 'the explicit list wins')
  // The prepared list was never touched, so it still comes from the style.
  assert.deepEqual(hero.preparedSpells, [...(magicStyleById('healersMercy')?.preparedSpellIds ?? [])])
})

test('picking a cantrip the class already grants does not double the attack', () => {
  const hero = buildCharacter(answers({ classId: 'wizard', cantripIds: ['fireBolt'] }), 'Vae', meta)
  const fireBolts = hero.attacks.filter((attack) => attack.id === 'fireBolt')

  assert.equal(fireBolts.length, 1, 'Fire Bolt appears once, not twice')
})

test('every attack on a built character has a unique id', () => {
  const hero = buildCharacter(
    answers({ classId: 'cleric', magicStyleId: 'radiantWrath' }),
    'Doran',
    meta,
  )
  const ids = hero.attacks.map((attack) => attack.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('resolving a selection prefers explicit lists, then the style, then nothing', () => {
  assert.deepEqual(resolveSpellSelection({}), { cantripIds: [], preparedSpellIds: [] })
  assert.deepEqual(resolveSpellSelection({ magicStyleId: 'nonsense' }), {
    cantripIds: [],
    preparedSpellIds: [],
  })
  assert.deepEqual(resolveSpellSelection({ cantripIds: ['light'] }).cantripIds, ['light'])
})

test('a caster is granted no spell attack they did not choose', () => {
  const bare = buildCharacter(answers({ classId: 'wizard' }), 'Alarin', meta)
  assert.ok(
    !bare.attacks.some((attack) => attack.kind === 'spell'),
    'no cantrips chosen means no spell on the bar',
  )

  const chosen = buildCharacter(
    answers({ classId: 'wizard', cantripIds: ['rayOfFrost'] }),
    'Alarin',
    meta,
  )
  assert.deepEqual(
    chosen.attacks.filter((attack) => attack.kind === 'spell').map((attack) => attack.id),
    ['rayOfFrost'],
  )
})

// --- Ids the registry does not recognise ------------------------------------

/*
 * None of this is reachable from the creation flow, which offers only ids it
 * read out of the registries. It is here because a fixture in
 * `tests/balance.test.ts` asked for `battleMaster` — one capital letter wrong —
 * got a subclass-less fighter without complaint, and every Battle Master figure
 * measured from it was a plain fighter's. The interesting part was what turned
 * up next to it: the three sibling fields did not agree on what to do.
 */

const CASTER = {
  classId: 'wizard',
  raceId: 'human',
  backgroundId: 'noble',
  flawId: 'obeyed',
  equipmentChoice: 'offensive',
  auraId: 'amber',
  magicStyleId: 'pyromancer',
} as CreationAnswers

test('an unrecognised id is dropped rather than stored, whichever field it is', () => {
  for (const [field, bad] of [
    ['subclassId', 'evocationn'],
    ['featId', 'nonsense'],
    ['magicStyleId', 'pyromancerr'],
  ] as const) {
    const hero = buildCharacter({ ...CASTER, [field]: bad }, 'S', { id: 's', now: 0 })
    assert.equal(
      hero[field],
      undefined,
      `${field} kept "${bad}", so the sheet claims something the registry has never heard of`,
    )
  }
})

test('a caster never ends up displaying magic it does not have', () => {
  /*
   * The one that mattered. An unknown subclass or feat leaves a character who is
   * plainer than intended and entirely playable; an unknown *style* resolved to
   * no cantrips and no prepared spells, so the wizard kept the style on their
   * sheet and had nothing at all to cast — a caster reduced to hitting things
   * with a stick, with no error anywhere.
   */
  const broken = buildCharacter({ ...CASTER, magicStyleId: 'pyromancerr' }, 'S', {
    id: 's',
    now: 0,
  })
  assert.equal(broken.magicStyleId, undefined)
  assert.equal(
    (broken.cantrips ?? []).length,
    0,
    'the premise of this test is that the style granted nothing',
  )

  // And the working case still works, so the check did not cost anybody magic.
  const whole = buildCharacter(CASTER, 'S', { id: 's', now: 0 })
  assert.equal(whole.magicStyleId, 'pyromancer')
  assert.ok((whole.cantrips ?? []).length > 0)
  assert.ok((whole.preparedSpells ?? []).length > 0)
})
