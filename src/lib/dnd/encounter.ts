import type { AttackAction } from '../../types/action.ts'
import type { AttackOutcome, Combatant, GridPosition, Team } from '../../types/combat.ts'
import type { Rng } from '../../types/dice.ts'
import {
  applyDamage,
  canAct,
  gridDistance,
  initiativeOrder,
  isDefeated,
  isInRange,
  resolveAttack,
  rollInitiative,
} from './combat.ts'
import { addCondition, tickConditions } from './conditions.ts'
import { canSpendSuperiorityDie, resolveTripAttack, type TripAttackResult } from './maneuvers.ts'
import { canChannelDivinity, spendChannelDivinity } from './channelDivinity.ts'
import { narrateAttackFully } from './narrate.ts'

/** The tutorial board. Small enough to read at a glance on a phone. */
export const GRID_SIZE = 5

export interface Encounter {
  round: number
  /** Combatant ids, highest initiative first. */
  order: string[]
  activeIndex: number
  combatants: Record<string, Combatant>
  movementRemaining: number
  hasActed: boolean
  log: string[]
}

function byId(combatants: readonly Combatant[]): Record<string, Combatant> {
  return Object.fromEntries(combatants.map((combatant) => [combatant.id, combatant]))
}

export function createEncounter(roster: readonly Combatant[], rng: Rng = Math.random): Encounter {
  const rolled = roster.map((combatant) => ({
    ...combatant,
    initiative: rollInitiative(combatant, rng),
  }))
  const order = initiativeOrder(rolled)
  const combatants = byId(rolled)
  const first = order[0] === undefined ? undefined : combatants[order[0]]

  return {
    round: 1,
    order,
    activeIndex: 0,
    combatants,
    movementRemaining: first?.speedSquares ?? 0,
    hasActed: false,
    log: [
      `Initiative rolled. Turn order: ${order
        .map((id) => `${combatants[id]?.name} (${combatants[id]?.initiative})`)
        .join(', ')}.`,
    ],
  }
}

export function activeCombatant(encounter: Encounter): Combatant | undefined {
  const id = encounter.order[encounter.activeIndex]
  return id === undefined ? undefined : encounter.combatants[id]
}

/** Everyone in the fight, highest initiative first. */
export function turnOrder(encounter: Encounter): Combatant[] {
  return encounter.order
    .map((id) => encounter.combatants[id])
    .filter((combatant): combatant is Combatant => combatant !== undefined)
}

export function combatantsOf(encounter: Encounter, team: Team): Combatant[] {
  return turnOrder(encounter).filter((combatant) => combatant.team === team)
}

/** Returns the winning team once one side is entirely down, otherwise null. */
export function encounterWinner(encounter: Encounter): Team | null {
  const partyStanding = combatantsOf(encounter, 'party').some((one) => !isDefeated(one))
  const foesStanding = combatantsOf(encounter, 'foes').some((one) => !isDefeated(one))
  if (!foesStanding) return 'party'
  if (!partyStanding) return 'foes'
  return null
}

export function occupiedSquares(encounter: Encounter): GridPosition[] {
  return Object.values(encounter.combatants)
    .filter((combatant) => !isDefeated(combatant))
    .map((combatant) => combatant.position)
}

function isOccupied(encounter: Encounter, position: GridPosition, ignoreId: string): boolean {
  return Object.values(encounter.combatants).some(
    (combatant) =>
      combatant.id !== ignoreId
      && !isDefeated(combatant)
      && combatant.position.x === position.x
      && combatant.position.y === position.y,
  )
}

/** Every empty square the active combatant can still reach this turn. */
export function reachableSquares(encounter: Encounter): GridPosition[] {
  const active = activeCombatant(encounter)
  if (active === undefined || encounter.movementRemaining <= 0) return []

  const squares: GridPosition[] = []
  for (let x = 0; x < GRID_SIZE; x += 1) {
    for (let y = 0; y < GRID_SIZE; y += 1) {
      const position = { x, y }
      const distance = gridDistance(active.position, position)
      if (distance === 0 || distance > encounter.movementRemaining) continue
      if (isOccupied(encounter, position, active.id)) continue
      squares.push(position)
    }
  }
  return squares
}

/**
 * Whether the active combatant could still legally do anything this turn.
 *
 * A player who spends their movement walking away from the only enemy has not
 * chosen to pass — they are stranded, and the UI has to tell the two apart or
 * it leaves them holding a turn they cannot play.
 */
export function hasLegalAction(encounter: Encounter): boolean {
  const active = activeCombatant(encounter)
  if (active === undefined || !canAct(active)) return false
  if (reachableSquares(encounter).length > 0) return true
  if (encounter.hasActed) return false

  return combatantsOf(encounter, active.team === 'party' ? 'foes' : 'party')
    .filter((enemy) => !isDefeated(enemy))
    .some((enemy) => active.attacks.some((attack) => isInRange(active, enemy, attack)))
}

export function moveActive(encounter: Encounter, to: GridPosition): Encounter {
  const active = activeCombatant(encounter)
  if (active === undefined) return encounter

  const distance = gridDistance(active.position, to)
  if (distance === 0 || distance > encounter.movementRemaining) return encounter
  if (isOccupied(encounter, to, active.id)) return encounter

  return {
    ...encounter,
    combatants: { ...encounter.combatants, [active.id]: { ...active, position: to } },
    movementRemaining: encounter.movementRemaining - distance,
    log: [
      ...encounter.log,
      `${active.name} moves ${distance} ${distance === 1 ? 'square' : 'squares'}.`,
    ],
  }
}

export interface AttackResult {
  encounter: Encounter
  outcome: AttackOutcome | null
  /** Why the attack could not be made, for the guidance banner to relay. */
  refusal: string | null
  /** Present only when a manoeuvre was spent and the attack actually landed. */
  maneuver?: TripAttackResult
}

export function attackWith(
  encounter: Encounter,
  args: { targetId: string; attackId: string; maneuverId?: 'trip'; rng?: Rng },
): AttackResult {
  const attacker = activeCombatant(encounter)
  const target = encounter.combatants[args.targetId]

  if (attacker === undefined || target === undefined) {
    return { encounter, outcome: null, refusal: 'There is nobody there to attack.' }
  }
  if (encounter.hasActed) {
    return { encounter, outcome: null, refusal: 'You have already taken your action this turn.' }
  }
  if (isDefeated(target)) {
    return { encounter, outcome: null, refusal: `${target.name} is already down.` }
  }

  const attack = attacker.attacks.find((candidate) => candidate.id === args.attackId)
  if (attack === undefined) {
    return { encounter, outcome: null, refusal: 'You are not carrying that.' }
  }
  if (!isInRange(attacker, target, attack)) {
    return {
      encounter,
      outcome: null,
      refusal: `${target.name} is out of reach — move closer first.`,
    }
  }

  // Manoeuvres are checked before the die is thrown, so a refusal costs nothing.
  if (args.maneuverId !== undefined) {
    if (attack.kind !== 'weapon') {
      return { encounter, outcome: null, refusal: 'Manoeuvres go with a weapon, not a spell.' }
    }
    if (!canSpendSuperiorityDie(attacker)) {
      return { encounter, outcome: null, refusal: 'You have no superiority dice left.' }
    }
  }

  const outcome = resolveAttack({ attacker, target, attack, rng: args.rng })
  const landed = outcome.kind === 'hit' || outcome.kind === 'crit'

  /*
   * The die is only spent on a hit. The SRD lets a Battle Master decide after
   * they know they connected, and charging for a miss would make the manoeuvre
   * strictly worse than not declaring it.
   */
  const maneuver =
    args.maneuverId === undefined || !landed
      ? undefined
      : resolveTripAttack({ attacker, target, attack, rng: args.rng })

  const totalDamage = landed ? outcome.damage + (maneuver?.bonusDamage.total ?? 0) : 0
  let damaged = landed ? applyDamage(target, totalDamage) : target
  if (maneuver?.knockedProne === true && !isDefeated(damaged)) {
    damaged = { ...damaged, conditions: addCondition(damaged.conditions, 'prone') }
  }

  const spender =
    maneuver === undefined
      ? attacker
      : { ...attacker, superiorityDice: maneuver.diceRemaining }

  const log = [
    ...encounter.log,
    `${attacker.name} attacks with ${attack.name}. `
      + narrateAttackFully(outcome, target.name, attack.damageType),
  ]
  if (maneuver !== undefined) {
    log.push(
      `Trip Attack adds ${maneuver.bonusDamage.total} damage. `
        + `${target.name} rolls ${maneuver.save.total} against DC ${maneuver.save.dc} and `
        + (maneuver.knockedProne ? 'goes down.' : 'stays on their feet.'),
    )
  }
  if (isDefeated(damaged) && !isDefeated(target)) {
    log.push(`${damaged.name} drops to 0 hit points and is out of the fight.`)
  }

  return {
    encounter: {
      ...encounter,
      combatants: { ...encounter.combatants, [spender.id]: spender, [damaged.id]: damaged },
      hasActed: true,
      log,
    },
    outcome,
    refusal: null,
    ...(maneuver === undefined ? {} : { maneuver }),
  }
}

export interface ChannelResult {
  encounter: Encounter
  refusal: string | null
}

/**
 * Spends the active combatant's Channel Divinity charge.
 *
 * Costs no action in this build: at level 1 there is exactly one charge and one
 * fight, so making it compete with the attack would mean the feature is only
 * ever used on a turn the player gives up swinging — which is how a once-per-
 * rest power ends up never being pressed at all.
 *
 * `targetId` is required for a vow and ignored for a sacred weapon.
 */
export function channelDivinity(
  encounter: Encounter,
  args: { power: 'sacredWeapon' | 'vowOfEnmity'; targetId?: string },
): ChannelResult {
  const actor = activeCombatant(encounter)
  if (actor === undefined) return { encounter, refusal: 'It is nobody\'s turn.' }
  if (!canChannelDivinity(actor)) {
    return { encounter, refusal: 'You have already called on your oath.' }
  }
  if (actor.activeChannelDivinity !== undefined) {
    return { encounter, refusal: 'Your oath is already burning.' }
  }

  if (args.power === 'vowOfEnmity') {
    const target = args.targetId === undefined ? undefined : encounter.combatants[args.targetId]
    if (target === undefined) return { encounter, refusal: 'Swear at somebody in particular.' }
    if (isDefeated(target)) return { encounter, refusal: `${target.name} is already down.` }
  }

  const spent = spendChannelDivinity(actor, args.power, args.targetId)
  const sworn =
    args.targetId === undefined ? undefined : encounter.combatants[args.targetId]?.name

  return {
    encounter: {
      ...encounter,
      combatants: {
        ...encounter.combatants,
        [actor.id]: {
          ...actor,
          channelDivinityCharges: spent.chargesRemaining,
          activeChannelDivinity: spent.active,
        },
      },
      log: [
        ...encounter.log,
        args.power === 'sacredWeapon'
          ? `${actor.name} calls on their oath. Their weapon blazes — every attack is sharper now.`
          : `${actor.name} swears vengeance on ${sworn ?? 'their foe'}. Every blow against them comes with advantage.`,
      ],
    },
    refusal: null,
  }
}

/** Advances to the next combatant still standing, ticking conditions on a new round. */
export function endTurn(encounter: Encounter): Encounter {
  if (encounterWinner(encounter) !== null) return encounter

  let index = encounter.activeIndex
  let round = encounter.round
  let combatants = encounter.combatants

  // At most one full lap: someone on the board is always able to act here,
  // because encounterWinner already ruled out a wiped-out side.
  for (let step = 0; step < encounter.order.length; step += 1) {
    index += 1
    if (index >= encounter.order.length) {
      index = 0
      round += 1
      combatants = Object.fromEntries(
        Object.entries(combatants).map(([id, combatant]) => [
          id,
          { ...combatant, conditions: tickConditions(combatant.conditions) },
        ]),
      )
    }
    const nextId = encounter.order[index]
    const next = nextId === undefined ? undefined : combatants[nextId]
    if (next !== undefined && canAct(next)) {
      return {
        ...encounter,
        round,
        activeIndex: index,
        combatants,
        movementRemaining: next.speedSquares,
        hasActed: false,
        log:
          round === encounter.round
            ? encounter.log
            : [...encounter.log, `— Round ${round} —`],
      }
    }
  }

  return { ...encounter, round, combatants }
}

function nearestEnemy(encounter: Encounter, actor: Combatant): Combatant | undefined {
  return combatantsOf(encounter, actor.team === 'party' ? 'foes' : 'party')
    .filter((candidate) => !isDefeated(candidate))
    .sort(
      (a, b) =>
        gridDistance(actor.position, a.position) - gridDistance(actor.position, b.position),
    )[0]
}

/** One step of the shortest path toward a target, ignoring occupied squares. */
function stepToward(from: GridPosition, to: GridPosition): GridPosition {
  return {
    x: from.x + Math.sign(to.x - from.x),
    y: from.y + Math.sign(to.y - from.y),
  }
}

/**
 * The whole of one enemy turn: close the distance, then swing if it can. Kept
 * deliberately simple — the tutorial is teaching the player's turn, not
 * showing off tactics.
 */
export function takeEnemyTurn(
  encounter: Encounter,
  rng: Rng = Math.random,
): { encounter: Encounter; outcome: AttackOutcome | null } {
  const actor = activeCombatant(encounter)
  if (actor === undefined || !canAct(actor)) return { encounter, outcome: null }

  const attack: AttackAction | undefined = actor.attacks[0]
  const target = nearestEnemy(encounter, actor)
  if (attack === undefined || target === undefined) return { encounter, outcome: null }

  let current = encounter
  while (
    current.movementRemaining > 0
    && !isInRange(
      current.combatants[actor.id] ?? actor,
      current.combatants[target.id] ?? target,
      attack,
    )
  ) {
    const self = current.combatants[actor.id]
    if (self === undefined) break
    const next = stepToward(self.position, target.position)
    const moved = moveActive(current, next)
    if (moved === current) break
    current = moved
  }

  const result = attackWith(current, { targetId: target.id, attackId: attack.id, rng })
  if (result.refusal !== null) {
    return {
      encounter: { ...current, log: [...current.log, `${actor.name} cannot reach anyone.`] },
      outcome: null,
    }
  }
  return { encounter: result.encounter, outcome: result.outcome }
}
