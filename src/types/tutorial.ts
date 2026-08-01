import type { SkillName } from './character.ts'

export type TutorialPhase = 'exploration' | 'social' | 'combat'

/** What the player has to do before the step advances. */
export type Completion =
  | { when: 'acknowledged' }
  | { when: 'skillCheck'; skill: SkillName }
  | { when: 'choicePicked' }
  | { when: 'moved' }
  | { when: 'attackResolved' }
  | { when: 'turnEnded' }
  | { when: 'enemyDefeated' }

/** Something the step does to the world on arrival. Interpreted by the UI, never by the data. */
export type EffectSpec =
  /**
   * Puts a roster on the board. `encounterId` names which one; absent means the
   * first, so the step that predates second encounters reads exactly as it did.
   */
  | { kind: 'startCombat'; encounterId?: string }
  /** Takes the hero up a level, and records what changed so a step can say so. */
  | { kind: 'levelUp' }
  /**
   * Hit points and spell slots back. Between two fights this is the difference
   * between a second encounter and an unwinnable one.
   */
  | { kind: 'shortRest' }

/** A dialogue option in the social phase. */
export interface TutorialChoice {
  id: string
  label: string
  /** Present when the option is resolved by a roll rather than just narrated. */
  check?: { skill: SkillName; dc: number }
  /** Read out whichever of these applies once the option resolves. */
  onSuccess: string
  onFailure: string
}

export interface TutorialCheck {
  skill: SkillName
  dc: number
  /** Why this roll matters, in one beginner-facing sentence. */
  reason: string
  onSuccess: string
  onFailure: string
}

export interface TutorialStep {
  id: string
  phase: TutorialPhase
  title: string
  narration: string
  /** Rendered verbatim in the guidance banner — never recomputed elsewhere. */
  guidance: string
  completion: Completion
  /**
   * Where to go if the fight is won while this step is on screen.
   *
   * A win can land on any lesson — the goblin can drop to a lucky first hit,
   * before End Turn has ever been taught. Steps name their own destination
   * because with two encounters there is no single one: winning the first fight
   * goes to the aftermath, winning the second ends the tutorial.
   */
  victory?: string
  onEnter?: EffectSpec[]
  check?: TutorialCheck
  choices?: TutorialChoice[]
  next: string | null
}

/** Dispatched by the UI after a player action resolves. */
export type GameEvent =
  | { type: 'acknowledged' }
  | { type: 'skillCheck'; skill: SkillName; success: boolean }
  | { type: 'choicePicked'; choiceId: string; success: boolean }
  | { type: 'moved' }
  | { type: 'attackResolved' }
  | { type: 'turnEnded' }
  | { type: 'enemyDefeated' }
