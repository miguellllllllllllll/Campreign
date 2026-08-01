import type { AttackAction } from '../../types/action.ts'
import type { ClassId } from '../../types/character.ts'
import type { Combatant } from '../../types/combat.ts'
import type { RollMode } from '../../types/dice.ts'

/**
 * Sneak Attack — the thing that makes a rogue a rogue.
 *
 * Its absence was not a gap in a table, it was the class having no identity:
 * the rogue and the fighter threw the same 1d6+2, the rogue had the smaller hit
 * die, and the fighter got a whole extra action at 2nd level while the rogue
 * got a bonus-action Dash. The class card promised "very good at hitting the one
 * spot that matters" and the engine had no such spot.
 *
 * The die count is the SRD's, which grows on odd levels — 1d6 at 1st and 2nd,
 * 2d6 at 3rd. This build stops at 3, so the table stops there too rather than
 * writing rows nobody can reach.
 */
const SNEAK_ATTACK_DICE_BY_LEVEL: readonly number[] = [0, 1, 1, 2]

/** How many d6 this class throws at `level`, which is none for four of five. */
export function sneakAttackDiceAt(classId: ClassId, level: number): number {
  if (classId !== 'rogue') return 0
  return SNEAK_ATTACK_DICE_BY_LEVEL[Math.min(level, SNEAK_ATTACK_DICE_BY_LEVEL.length - 1)] ?? 0
}

/**
 * Whether the weapon in hand is one a rogue can be precise with.
 *
 * The SRD says finesse or ranged. `AttackAction` carries no finesse flag — the
 * one in `types/items.ts` belongs to the equipment table, which these hand-built
 * presets do not come from — so this asks the question finesse actually answers:
 * may this be swung with Dexterity? Every rogue weapon here (shortsword, rapier,
 * shortbow) says yes and every heavy weapon says no, which is the same partition.
 *
 * `kind === 'weapon'` matters on its own. A rogue who took Magic Initiate has a
 * cantrip on the bar, and Sneak Attack must not ride on it.
 */
export function weaponAllowsSneakAttack(attack: AttackAction): boolean {
  return attack.kind === 'weapon' && (attack.ranged || attack.ability === 'dex')
}

/**
 * The dice Sneak Attack adds to this particular swing, or 0 for no sneak.
 *
 * Disadvantage cancels it outright even when an ally is adjacent, per the SRD —
 * and note that advantage is checked *after* the roll modes have been combined,
 * so a rogue who is prone beside their squire gets nothing. Combining first is
 * the only way that stays true.
 *
 * Once per turn is not enforced here, and deliberately: an attack costs the
 * action, one action is all a turn has, and no path in this build grants a rogue
 * a second one — Action Surge is the fighter's. `sneakAttackIsOncePerTurn` in
 * the tests pins that assumption so it fails loudly if Extra Attack ever lands.
 */
export function sneakAttackDiceFor(args: {
  attacker: Combatant
  attack: AttackAction
  mode: RollMode
  allyAdjacentToTarget: boolean
}): number {
  const { attacker, attack, mode, allyAdjacentToTarget } = args
  const dice = attacker.sneakAttackDice ?? 0
  if (dice === 0) return 0
  if (!weaponAllowsSneakAttack(attack)) return 0
  if (mode === 'disadvantage') return 0
  if (mode !== 'advantage' && !allyAdjacentToTarget) return 0
  return dice
}

/** The notation those dice add, appended to the damage expression. */
export function sneakAttackNotation(dice: number): string | null {
  return dice === 0 ? null : `${dice}d6`
}
