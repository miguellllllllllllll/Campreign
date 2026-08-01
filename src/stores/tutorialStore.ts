'use client'

import { create } from 'zustand'
import { FIRST_STEP_ID, stepById } from '../content/goblinCellar.ts'
import { characterToCombatant } from '../lib/dnd/combatants.ts'
import { LOYAL_SQUIRE, spawnCompanion } from '../lib/dnd/data/companions.ts'
import { GIANT_BAT, GIANT_SPIDER, GOBLIN, SKELETON, spawnMonster } from '../lib/dnd/data/monsters.ts'
import { levelUp, spellSlotsAt, type LevelUpGains } from '../lib/dnd/leveling.ts'
import { arcaneRecoveryBudget, recoverSlots } from '../lib/dnd/arcaneRecovery.ts'
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

/**
 * The second encounter: two foes rather than a bigger one.
 *
 * Two is the lesson. One enemy has no target decision in it, and the whole of
 * the second fight is learning that dropping one of them halves the incoming
 * damage. They are deliberately unalike — the bat is fast and fragile, the
 * skeleton slow and durable — so "which one first" has an actual answer rather
 * than being a coin toss.
 */
const BAT_START = { x: 1, y: 0 }
const SKELETON_START = { x: 3, y: 0 }
/** Down the far wall, away from both start squares — it has to close the distance. */
const SPIDER_START = { x: 2, y: 0 }

interface TutorialStore {
  stepId: string
  finished: boolean
  /** The outcome prose for the check or choice just resolved on this step. */
  resolution: string | null
  /** Kept here so a startCombat effect can build the encounter itself. */
  roster: Combatant[] | null
  /**
   * The tutorial's working copy of the hero.
   *
   * Levelling up happens here rather than in `characterStore`, which is
   * persisted. The tutorial is a sandbox you can replay, and a level that
   * survived it would compound every time somebody pressed "Play it again" —
   * a level-6 hero after six runs of a fight against one goblin.
   */
  character: Character | null
  /**
   * The hero exactly as they walked in, kept so "Play it again" starts over
   * rather than continuing from whatever the last run left them at.
   */
  baseCharacter: Character | null
  /** What the last level-up changed, for the step that has to explain it. */
  levelGains: LevelUpGains | null
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
  character: null,
  baseCharacter: null,
  levelGains: null,
  concentratingOn: null,

  begin: (character) => {
    set({
      stepId: FIRST_STEP_ID,
      finished: false,
      resolution: null,
      roster: rosterFor('cellar', character),
      playerId: character.id,
      character,
      baseCharacter: character,
      levelGains: null,
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

    /*
     * A win ends the fight from whichever lesson is on screen — the goblin can
     * drop to a lucky first hit, before End Turn has ever been taught.
     *
     * Where it goes is the step's business now rather than always the end. With
     * two encounters "somebody won" and "the tutorial is over" stopped being the
     * same event, and a step with no `victory` is one where winning is not a
     * thing that can happen.
     */
    if (event.type === 'enemyDefeated') {
      const destination = step.victory
      if (destination === undefined) return
      const arrived = stepById(destination)
      set({ stepId: destination, finished: arrived?.next === null, resolution: null })
      if (arrived?.onEnter?.some((effect) => effect.kind === 'levelUp') === true) {
        set({ levelGains: null })
      }
      for (const effect of arrived?.onEnter ?? []) applyEffect(effect, set, get)
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
    // A new level-up moment starts from nothing; only levels gained *here*
    // accumulate, so gains cannot leak from an earlier step into this panel.
    if (arrived?.onEnter?.some((effect) => effect.kind === 'levelUp') === true) {
      set({ levelGains: null })
    }
    for (const effect of arrived?.onEnter ?? []) applyEffect(effect, set, get)
  },

  restart: () => {
    /*
     * Clearing the board is the whole of the fix for a stuck restart. The
     * runner shows the defeat panel whenever the encounter says the party lost,
     * so leaving the lost fight in place meant "Try again" reset the script and
     * then immediately rendered the same panel again — with the only way out
     * being the button that had just failed.
     *
     * tutorialStore is allowed to call combatStore; the arrow never points the
     * other way.
     */
    useCombatStore.getState().reset()

    // Back to the character they walked in with, so replaying cannot stack
    // levels a goblin never justified.
    const original = get().baseCharacter
    set({
      stepId: FIRST_STEP_ID,
      finished: false,
      resolution: null,
      levelGains: null,
      concentratingOn: null,
      ...(original === null ? {} : { character: original, roster: rosterFor('cellar', original) }),
    })
  },
}))

/**
 * Who is on the board for a given encounter, built from the hero as they are
 * *now* rather than as they started.
 *
 * That distinction is the whole reason this is a function. The second fight has
 * to spawn a level-2 hero with the hit points and slots they just earned, and
 * a roster stored once at the beginning cannot know about them.
 */
function rosterFor(encounterId: string, character: Character): Combatant[] {
  const hero = characterToCombatant(character, {
    position: HERO_START,
    speedSquares: TUTORIAL_SPEED_SQUARES,
  })
  // A second body on the player's side, so an area spell has somebody to
  // spare. It fights itself; the tutorial is teaching one hero's choices.
  const squire = spawnCompanion(LOYAL_SQUIRE, { position: SQUIRE_START })

  if (encounterId === 'deeper') {
    return [
      hero,
      squire,
      spawnMonster(GIANT_BAT, { id: 'giantBat', position: BAT_START }),
      spawnMonster(SKELETON, { id: 'skeleton', position: SKELETON_START }),
    ]
  }
  /*
   * One enemy, and the hardest one written. Simulated over 600 auto-played runs
   * at level 2: the party wins 59% against the spider alone, 96% against the
   * bat and skeleton it follows. Pairing it with either of them dropped the
   * party under 40%, and all three together to 31% — so it fights alone.
   *
   * Those numbers are a floor rather than a forecast: the simulation plays the
   * hero automatically, so it never casts, drinks or spends an Action Surge.
   * A player holding the same character does better than 59%.
   */
  if (encounterId === 'rafters') {
    return [hero, squire, spawnMonster(GIANT_SPIDER, { id: 'giantSpider', position: SPIDER_START })]
  }
  return [hero, squire, spawnMonster(GOBLIN, { id: GOBLIN_ID, position: GOBLIN_START })]
}

/**
 * Folds a second level-up into the first, so one panel can report both.
 *
 * Hit points add up because the player wants the total they gained; the level,
 * maximum and slots are simply the latest; features accumulate, because a
 * feature earned at 2nd level is not less earned for having 3rd arrive in the
 * same breath.
 */
function mergeGains(
  previous: LevelUpGains | null,
  next: LevelUpGains | null,
): LevelUpGains | null {
  if (next === null) return previous
  if (previous === null) return next
  return {
    ...next,
    hitPointsGained: previous.hitPointsGained + next.hitPointsGained,
    features: [...previous.features, ...next.features],
  }
}

type Setter = (partial: Partial<TutorialStore>) => void
type Getter = () => TutorialStore

function applyEffect(effect: EffectSpec, set: Setter, get: Getter): void {
  switch (effect.kind) {
    case 'startCombat': {
      /*
       * Anything held outside a fight goes out when one starts. Guidance is
       * spent on an ability check and there are none once initiative is rolled,
       * so carrying it in would be carrying a number with nothing to add to.
       */
      set({ concentratingOn: null })

      const character = get().character
      if (character === null) return
      const roster = rosterFor(effect.encounterId ?? 'cellar', character)
      set({ roster })
      // The player steers exactly one of these; the squire and the monsters
      // play themselves, so the loop needs to know which id to stop at.
      useCombatStore.getState().start(roster, character.id)
      return
    }

    case 'levelUp': {
      const character = get().character
      if (character === null) return
      const result = levelUp(character)
      // Refuses at the cap rather than clamping, so a second run of this effect
      // leaves the hero alone instead of quietly doing nothing twice.
      if (result.refusal !== null) return
      /*
       * Merged rather than replaced, because a step can level more than once.
       * The tutorial jumps from 1 to 3 in a single beat, and replacing meant
       * the panel showed only what third level gave — so a fighter gained
       * Action Surge and a rogue gained Cunning Action, and neither was told.
       * Everything earned on the way has to survive the trip.
       */
      set({ character: result.character, levelGains: mergeGains(get().levelGains, result.gains) })
      return
    }

    case 'shortRest': {
      const character = get().character
      if (character === null) return

      /*
       * Hit points come back; spells do not. That is the SRD's short rest, and
       * the difference is the lesson — what you spent in the first fight is
       * gone in the second, so spending it was a decision.
       *
       * Hit points are restored because the alternative is an unwinnable second
       * encounter for anybody who finished the first at two of them, which
       * teaches nothing except that the tutorial is unfair. Slots carry no such
       * risk: the second fight was measured at a 90% win with no spells cast
       * at all.
       */
      const recovered = recoverSlots(
        character.spellSlots,
        spellSlotsAt(character.classId, character.level),
        arcaneRecoveryBudget(character.classId, character.level),
      )
      set({
        character: {
          ...character,
          currentHp: character.maxHp,
          ...(recovered === undefined ? {} : { spellSlots: recovered }),
        },
      })
      return
    }
  }
}
