'use client'

import { create } from 'zustand'
import { FINAL_STEP_ID, FIRST_STEP_ID, stepById } from '../content/goblinCellar.ts'
import { characterToCombatant } from '../lib/dnd/combatants.ts'
import { LOYAL_SQUIRE, spawnCompanion } from '../lib/dnd/data/companions.ts'
import { GOBLIN, spawnMonster } from '../lib/dnd/data/monsters.ts'
import type { Character } from '../types/character.ts'
import type { Combatant } from '../types/combat.ts'
import { SPELLS_BY_ID } from '../content/spells.ts'
import type { EffectSpec, GameEvent, TutorialStep } from '../types/tutorial.ts'
import { useCombatStore } from './combatStore.ts'

/**
 * Both fighters start four squares apart on a 5x5 board, so the movement
 * lesson has somewhere to go. Three squares a turn keeps a 30 ft stride from
 * crossing the whole map in one move.
 */
const TUTORIAL_SPEED_SQUARES = 3
const HERO_START = { x: 2, y: 4 }
const GOBLIN_START = { x: 2, y: 0 }
const GOBLIN_ID = 'goblin'
/** Beside the hero, and inside a three-square blast from them. */
const SQUIRE_START = { x: 1, y: 4 }

interface TutorialStore {
  stepId: string
  finished: boolean
  /** The outcome prose for the check or choice just resolved on this step. */
  resolution: string | null
  /** Kept here so a startCombat effect can build the encounter itself. */
  roster: Combatant[] | null
  /** The combatant the player steers; everyone else on the board plays itself. */
  playerId: string | null
  /**
   * The spell being held together outside a fight, or null.
   *
   * Lives here rather than on `Character` deliberately. `characterStore` is
   * persisted, and a spell you are concentrating on is not a property of who
   * your hero is — it is a thing happening right now. Persisting it would mean
   * reloading the page and finding you had been holding Guidance for a week.
   */
  concentratingOn: string | null
  begin: (character: Character) => void
  dispatch: (event: GameEvent) => void
  /** Casts a cantrip outside combat. Refuses with a sentence, or returns null. */
  castOutOfCombat: (spellId: string) => string | null
  restart: () => void
}

function completes(step: TutorialStep, event: GameEvent): boolean {
  switch (step.completion.when) {
    case 'acknowledged':
      return event.type === 'acknowledged'
    case 'skillCheck':
      return event.type === 'skillCheck' && event.skill === step.completion.skill
    case 'choicePicked':
      return event.type === 'choicePicked'
    case 'moved':
      return event.type === 'moved'
    case 'attackResolved':
      return event.type === 'attackResolved'
    case 'turnEnded':
      return event.type === 'turnEnded'
    case 'enemyDefeated':
      return event.type === 'enemyDefeated'
  }
}

/**
 * Whether this event actually rolled a die that a held spell could have helped.
 *
 * A dialogue option with no `check` is pure narration and cannot be failed, so
 * it must not eat the Guidance the player is saving for the roll after it.
 */
function consumedConcentration(step: TutorialStep, event: GameEvent): boolean {
  if (event.type === 'skillCheck') return true
  if (event.type === 'choicePicked') {
    return step.choices?.find((one) => one.id === event.choiceId)?.check !== undefined
  }
  return false
}

/** The prose to read out once this event resolves the step, if the step has any. */
function resolutionFor(step: TutorialStep, event: GameEvent): string | null {
  if (event.type === 'skillCheck' && step.check !== undefined) {
    return event.success ? step.check.onSuccess : step.check.onFailure
  }
  if (event.type === 'choicePicked') {
    const choice = step.choices?.find((candidate) => candidate.id === event.choiceId)
    if (choice === undefined) return null
    return event.success ? choice.onSuccess : choice.onFailure
  }
  return null
}

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  stepId: FIRST_STEP_ID,
  finished: false,
  resolution: null,
  roster: null,
  playerId: null,
  concentratingOn: null,

  begin: (character) => {
    const roster = [
      characterToCombatant(character, {
        position: HERO_START,
        speedSquares: TUTORIAL_SPEED_SQUARES,
      }),
      // A second body on the player's side, so an area spell has somebody to
      // spare. It fights itself; the tutorial is teaching one hero's choices.
      spawnCompanion(LOYAL_SQUIRE, { position: SQUIRE_START }),
      spawnMonster(GOBLIN, { id: GOBLIN_ID, position: GOBLIN_START }),
    ]
    set({
      stepId: FIRST_STEP_ID,
      finished: false,
      resolution: null,
      roster,
      playerId: character.id,
      concentratingOn: null,
    })
  },

  castOutOfCombat: (spellId) => {
    const spell = SPELLS_BY_ID[spellId]
    if (spell?.effect?.kind !== 'guideCheck') {
      return 'That one does nothing out here.'
    }
    if (get().concentratingOn !== null) {
      return 'You are already holding a spell together.'
    }
    set({ concentratingOn: spellId })
    return null
  },

  dispatch: (event) => {
    const step = stepById(get().stepId)
    if (step === undefined || get().finished) return

    // A win ends the fight from whichever lesson is on screen. The goblin can
    // drop to a lucky first hit, and there is nothing left to practise the turn
    // loop on once it does.
    if (event.type === 'enemyDefeated' && step.phase === 'combat') {
      set({ stepId: FINAL_STEP_ID, finished: true, resolution: null })
      return
    }

    /*
     * A held spell is spent by the roll it helped, whether or not that roll
     * moved the tutorial on. Cleared before the advance rather than after, so
     * no path can leave Guidance hanging around for a second check.
     */
    const spent = consumedConcentration(step, event)

    if (!completes(step, event)) {
      if (spent) set({ concentratingOn: null })
      return
    }

    const next = step.next
    set({
      stepId: next ?? step.id,
      finished: next === null,
      resolution: resolutionFor(step, event),
      ...(spent ? { concentratingOn: null } : {}),
    })

    // Effects run after the state has settled, never inside the updater, so a
    // combat action can never see a half-advanced tutorial.
    const arrived = next === null ? undefined : stepById(next)
    for (const effect of arrived?.onEnter ?? []) {
      /*
       * Anything held outside a fight goes out when one starts. Guidance is
       * spent on an ability check and there are none once initiative is rolled,
       * so carrying it into combat would be carrying a number that can never
       * be added to anything.
       */
      if (effect.kind === 'startCombat') set({ concentratingOn: null })
      applyEffect(effect, get().roster, get().playerId)
    }
  },

  restart: () =>
    set({ stepId: FIRST_STEP_ID, finished: false, resolution: null, concentratingOn: null }),
}))

function applyEffect(
  effect: EffectSpec,
  roster: readonly Combatant[] | null,
  playerId: string | null,
): void {
  switch (effect.kind) {
    case 'startCombat':
      // The player steers exactly one of these; the squire and the goblin both
      // play themselves, so the loop needs to know which id to stop at.
      if (roster !== null && playerId !== null) {
        useCombatStore.getState().start(roster, playerId)
      }
      return
  }
}
