import type { ActiveCondition, ConditionId } from '../../types/combat.ts'
import type { RollMode } from '../../types/dice.ts'

export interface ConditionInfo {
  id: ConditionId
  label: string
  /** One or two sentences a first-time player can act on. */
  plain: string
  /** How this condition changes the sufferer's own attack rolls. */
  ownAttacks: RollMode
  /** How it changes attacks made against them. */
  incomingAttacks: RollMode
  preventsActions: boolean
  /**
   * Extra damage this condition adds to the sufferer's own weapon hits.
   *
   * The damage twin of `acBonus`, and carried the same way and for the same
   * reason: derived while the condition lasts rather than written into the
   * weapon, so losing it takes the die with it and nothing has to remember
   * what the weapon used to do.
   */
  damageDice?: string
  /**
   * Armour this condition lends while it lasts.
   *
   * Carried here rather than written into `ac` so that removing the condition
   * removes the armour with it. A spell that overwrote `ac` had no way back —
   * which is exactly why Shield of Faith could not be put under concentration
   * until now.
   */
  acBonus?: number
}

export const CONDITIONS: Record<ConditionId, ConditionInfo> = {
  warded: {
    id: 'warded',
    label: 'Warded',
    plain: 'A field of faith hangs between you and the next blow. Your Armour Class is 2 higher.',
    ownAttacks: 'normal',
    incomingAttacks: 'normal',
    preventsActions: false,
    acBonus: 2,
  },
  favoured: {
    id: 'favoured',
    label: 'Divine Favour',
    plain: 'Your weapon is burning with holy light. Every hit you land adds 1d4 radiant damage on top.',
    ownAttacks: 'normal',
    incomingAttacks: 'normal',
    preventsActions: false,
    damageDice: '1d4',
  },
  blessed: {
    id: 'blessed',
    label: 'Blessed',
    plain:
      'A little luck is riding with you. Add a d4 to every attack roll you make while it lasts.',
    ownAttacks: 'normal',
    incomingAttacks: 'normal',
    preventsActions: false,
  },
  dazzled: {
    id: 'dazzled',
    label: 'Dazzled',
    plain:
      'You are outlined in light and cannot help being seen. Attacks against you have advantage until the glow fades.',
    ownAttacks: 'normal',
    incomingAttacks: 'advantage',
    // Being lit up is embarrassing, not incapacitating.
    preventsActions: false,
  },
  poisoned: {
    id: 'poisoned',
    label: 'Poisoned',
    plain: 'Something toxic is in your blood, so you attack with disadvantage — you roll twice and take the worse result.',
    ownAttacks: 'disadvantage',
    incomingAttacks: 'normal',
    preventsActions: false,
  },
  prone: {
    id: 'prone',
    label: 'Prone',
    plain: 'You are flat on the ground. Your own attacks are worse, and enemies next to you find it easier to hit you.',
    ownAttacks: 'disadvantage',
    incomingAttacks: 'advantage',
    preventsActions: false,
  },
  frightened: {
    id: 'frightened',
    label: 'Frightened',
    plain: 'Fear makes your hands shake, so you attack with disadvantage while the source of your fear is in sight.',
    ownAttacks: 'disadvantage',
    incomingAttacks: 'normal',
    preventsActions: false,
  },
  restrained: {
    id: 'restrained',
    label: 'Restrained',
    plain: 'You are held fast. You cannot move, you attack with disadvantage, and enemies hit you more easily.',
    ownAttacks: 'disadvantage',
    incomingAttacks: 'advantage',
    preventsActions: false,
  },
  blinded: {
    id: 'blinded',
    label: 'Blinded',
    plain: 'You cannot see. You attack with disadvantage, and everyone attacking you has advantage.',
    ownAttacks: 'disadvantage',
    incomingAttacks: 'advantage',
    preventsActions: false,
  },
  unconscious: {
    id: 'unconscious',
    label: 'Unconscious',
    plain: 'You are out cold — you cannot move or act, and attacks against you have advantage.',
    ownAttacks: 'disadvantage',
    incomingAttacks: 'advantage',
    preventsActions: true,
  },
}

export function addCondition(
  existing: readonly ActiveCondition[],
  id: ConditionId,
  roundsRemaining: number | null = null,
  source?: string,
): ActiveCondition[] {
  const others = existing.filter((condition) => condition.id !== id)
  return [...others, { id, roundsRemaining, ...(source === undefined ? {} : { source }) }]
}

/**
 * Drops every condition a particular caster is responsible for.
 *
 * All of them, not one named kind. A concentration holds up whatever it
 * granted — a blessing, a ward, or both — and losing it has to take the lot.
 * Naming a single condition here meant a ward outliving the spell that made
 * it, which a test caught rather than a player.
 */
export function removeConditionsFrom(
  existing: readonly ActiveCondition[],
  source: string,
): ActiveCondition[] {
  return existing.filter((c) => c.source !== source)
}

export function removeCondition(
  existing: readonly ActiveCondition[],
  id: ConditionId,
): ActiveCondition[] {
  return existing.filter((condition) => condition.id !== id)
}

export function hasCondition(
  existing: readonly ActiveCondition[],
  id: ConditionId,
): boolean {
  return existing.some((condition) => condition.id === id)
}

/** Counts down timed conditions and drops the ones that have expired. */
export function tickConditions(existing: readonly ActiveCondition[]): ActiveCondition[] {
  return existing
    .map((condition) =>
      condition.roundsRemaining === null
        ? condition
        : { ...condition, roundsRemaining: condition.roundsRemaining - 1 },
    )
    .filter((condition) => condition.roundsRemaining === null || condition.roundsRemaining > 0)
}

export function blocksActions(existing: readonly ActiveCondition[]): boolean {
  return existing.some((condition) => CONDITIONS[condition.id].preventsActions)
}

/**
 * Advantage and disadvantage do not stack in 5e — any of each cancel out
 * entirely, leaving a straight roll.
 */
export function combineRollModes(modes: readonly RollMode[]): RollMode {
  const hasAdvantage = modes.includes('advantage')
  const hasDisadvantage = modes.includes('disadvantage')
  if (hasAdvantage && hasDisadvantage) return 'normal'
  if (hasAdvantage) return 'advantage'
  if (hasDisadvantage) return 'disadvantage'
  return 'normal'
}

/** The roll mode for an attack, accounting for both sides' conditions. */
export function attackRollMode(
  attackerConditions: readonly ActiveCondition[],
  targetConditions: readonly ActiveCondition[],
): RollMode {
  const modes: RollMode[] = [
    ...attackerConditions.map((condition) => CONDITIONS[condition.id].ownAttacks),
    ...targetConditions.map((condition) => CONDITIONS[condition.id].incomingAttacks),
  ]
  return combineRollModes(modes)
}
