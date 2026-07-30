'use client'

import { create } from 'zustand'
import { FINAL_STEP_ID, FIRST_STEP_ID, stepById } from '../content/goblinCellar.ts'
import { characterToCombatant } from '../lib/dnd/combatants.ts'
import { GOBLIN, spawnMonster } from '../lib/dnd/data/monsters.ts'
import type { Character } from '../types/character.ts'
import type { Combatant } from '../types/combat.ts'
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

interface TutorialStore {
  stepId: string
  finished: boolean
  /** The outcome prose for the check or choice just resolved on this step. */
  resolution: string | null
  /** Kept here so a startCombat effect can build the encounter itself. */
  roster: Combatant[] | null
  begin: (character: Character) => void
  dispatch: (event: GameEvent) => void
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

  begin: (character) => {
    const roster = [
      characterToCombatant(character, {
        position: HERO_START,
        speedSquares: TUTORIAL_SPEED_SQUARES,
      }),
      spawnMonster(GOBLIN, { id: GOBLIN_ID, position: GOBLIN_START }),
    ]
    set({ stepId: FIRST_STEP_ID, finished: false, resolution: null, roster })
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

    if (!completes(step, event)) return

    const next = step.next
    set({
      stepId: next ?? step.id,
      finished: next === null,
      resolution: resolutionFor(step, event),
    })

    // Effects run after the state has settled, never inside the updater, so a
    // combat action can never see a half-advanced tutorial.
    const arrived = next === null ? undefined : stepById(next)
    for (const effect of arrived?.onEnter ?? []) applyEffect(effect, get().roster)
  },

  restart: () => set({ stepId: FIRST_STEP_ID, finished: false, resolution: null }),
}))

function applyEffect(effect: EffectSpec, roster: readonly Combatant[] | null): void {
  switch (effect.kind) {
    case 'startCombat':
      if (roster !== null) useCombatStore.getState().start(roster)
      return
  }
}
