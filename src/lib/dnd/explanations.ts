/**
 * Every sentence of beginner-facing jargon-busting copy lives here. The
 * `Record` is exhaustive on purpose: adding a key without writing the copy is
 * a compile error, so no tooltip can ever ship empty.
 */
export type ExplainKey =
  | 'ac'
  | 'hp'
  | 'speed'
  | 'initiative'
  | 'proficiency'
  | 'abilityMod'
  | 'advantage'
  | 'disadvantage'
  | 'skillCheck'
  | 'dc'
  | 'action'
  | 'movement'
  | 'turn'
  | 'round'
  | 'attackRoll'
  | 'damage'
  | 'crit'
  | 'fumble'
  | 'savingThrow'
  | 'level'
  | 'hitDie'
  | 'cantrip'
  | 'background'
  | 'trinket'
  | 'personality'
  | 'spellSaveDc'
  | 'spellAttack'
  | 'loadout'
  | 'concentration'
  | 'preparedSpell'
  | 'str'
  | 'dex'
  | 'con'
  | 'int'
  | 'wis'
  | 'cha'

export interface Explanation {
  title: string
  /** One or two sentences, no jargon, addressed to the player as "you". */
  plain: string
}

export const EXPLANATIONS: Record<ExplainKey, Explanation> = {
  ac: {
    title: 'Armour Class',
    plain: 'How hard you are to hit. An attacker has to roll this number or higher to land a blow, so bigger is better.',
  },
  hp: {
    title: 'Hit Points',
    plain: 'How much punishment you can absorb. Damage subtracts from it, and at zero you drop out of the fight.',
  },
  speed: {
    title: 'Speed',
    plain: 'How far you can move on your turn. Every 5 feet is one square on the map.',
  },
  initiative: {
    title: 'Initiative',
    plain: 'The turn order for a fight. Everyone rolls a d20 and adds their Dexterity, and the highest goes first.',
  },
  proficiency: {
    title: 'Proficiency Bonus',
    plain: 'A bonus you add to anything you have been trained in — your weapons, your spells, and your best skills. It starts at +2.',
  },
  abilityMod: {
    title: 'Ability Modifier',
    plain: 'The number an ability score is actually worth. A score of 10 is average and adds nothing; every 2 points above that adds +1.',
  },
  advantage: {
    title: 'Advantage',
    plain: 'Something is working in your favour, so you roll two d20s and keep the higher one. It is the single best thing that can happen to a roll.',
  },
  disadvantage: {
    title: 'Disadvantage',
    plain: 'Something is working against you, so you roll two d20s and keep the lower one. One advantage and one disadvantage cancel out completely.',
  },
  skillCheck: {
    title: 'Skill Check',
    plain: 'When the outcome is uncertain, you roll a d20 and add the relevant skill bonus. Reach the target number and you succeed.',
  },
  dc: {
    title: 'Difficulty Class',
    plain: 'The number a check has to reach. Around 10 is an everyday task, 15 is genuinely tricky, and 20 is remarkable.',
  },
  action: {
    title: 'Action',
    plain: 'The one significant thing you do on your turn — usually an attack or a spell. You get exactly one.',
  },
  movement: {
    title: 'Movement',
    plain: 'Walking on your turn, measured in squares. It does not use up your action, so you can move and then attack.',
  },
  turn: {
    title: 'Your Turn',
    plain: 'Your slot in the order. On it you may move and take one action, in whichever order you like, then the next character goes.',
  },
  round: {
    title: 'Round',
    plain: 'One pass through the whole turn order — roughly six seconds of story time. Then it starts again from the top.',
  },
  attackRoll: {
    title: 'Attack Roll',
    plain: 'A d20 plus your ability modifier and proficiency bonus. Match or beat the target’s Armour Class and you hit.',
  },
  damage: {
    title: 'Damage',
    plain: 'How much you take off the target’s hit points. Your weapon decides which dice you roll, and Strength or Dexterity adds to it.',
  },
  crit: {
    title: 'Critical Hit',
    plain: 'Rolling a natural 20 on the die always hits, no matter the target’s armour, and you roll the damage dice twice.',
  },
  fumble: {
    title: 'Critical Miss',
    plain: 'Rolling a natural 1 on the die always misses, however large your bonuses are.',
  },
  savingThrow: {
    title: 'Saving Throw',
    plain: 'A roll to resist something happening to you — a poison, a spell, a trap. Your two best saves come from your class.',
  },
  level: {
    title: 'Level',
    plain: 'How experienced your character is. Everyone starts at level 1, which is where the rules are simplest.',
  },
  hitDie: {
    title: 'Hit Die',
    plain: 'The die that decides how tough your class is. At level 1 you get the highest possible result, plus your Constitution.',
  },
  cantrip: {
    title: 'Cantrip',
    plain: 'A small spell you can cast as often as you like. It never runs out, which is why it does not add your ability modifier to damage.',
  },
  background: {
    title: 'Background',
    plain: 'What you did before you started adventuring. It trains you in two skills and hands you something small from that old life.',
  },
  trinket: {
    title: 'Trinket',
    plain: 'A keepsake you carry that has no rules attached. It exists so you have something to talk about that is not a number.',
  },
  personality: {
    title: 'Ideal, Flaw and Bond',
    plain: 'Three sentences about who you are: what you believe, where you fall short, and who you would come back for. They guide how you play, not what you roll.',
  },
  spellSaveDc: {
    title: 'Spell Save DC',
    plain: 'The number your enemies must beat when they try to resist your magic. It is 8, plus your proficiency bonus, plus your casting ability.',
  },
  spellAttack: {
    title: 'Spell Attack Bonus',
    plain: 'What you add to the die when you aim a spell at something, exactly like a weapon attack. It is your proficiency bonus plus your casting ability.',
  },
  concentration: {
    title: 'Concentration',
    plain: 'You have to keep your mind on this spell for it to keep working. You can only concentrate on one at a time, and taking a bad hit can break it.',
  },
  preparedSpell: {
    title: 'Prepared Spell',
    plain: 'A spell you chose in advance and can cast today. Unlike a cantrip it uses up a slot, so you only get a couple of casts before you need a long rest.',
  },
  loadout: {
    title: 'Loadout',
    plain: 'The gear you walk in with. A shield buys you Armour Class, while a two-handed weapon buys you damage — you cannot have both.',
  },
  str: {
    title: 'Strength',
    plain: 'Raw physical power. It drives melee weapons, shoving, climbing and lifting.',
  },
  dex: {
    title: 'Dexterity',
    plain: 'Agility and reflexes. It sets your initiative, helps your armour, and powers bows and light blades.',
  },
  con: {
    title: 'Constitution',
    plain: 'Stamina and health. It is the only ability that directly increases your hit points.',
  },
  int: {
    title: 'Intelligence',
    plain: 'Reasoning and recall. Wizards cast with it, and it covers knowledge and deduction.',
  },
  wis: {
    title: 'Wisdom',
    plain: 'Perceptiveness and judgement. Clerics cast with it, and it covers noticing things and reading people.',
  },
  cha: {
    title: 'Charisma',
    plain: 'Force of personality. It covers persuading, deceiving and intimidating anyone you talk to.',
  },
}

export function explain(key: ExplainKey): Explanation {
  return EXPLANATIONS[key]
}
