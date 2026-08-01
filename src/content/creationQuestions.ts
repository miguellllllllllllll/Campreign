import {
  AURA_PRESETS,
  BACKGROUND_PRESETS,
  CLASS_PRESETS,
  RACE_PRESETS,
  flawsFor,
} from '../lib/dnd/presets.ts'
import { magicStylesFor } from './spellPresets.ts'
import { FEATS, cantripChoicesFor } from './feats.ts'
import { SPELLS_BY_ID } from './spells.ts'
import { subclassesFor } from './subclasses.ts'
import type { BackgroundId, ClassId, CreationDraft } from '../types/character.ts'

/**
 * Character creation as data. Every question, every helper sentence and every
 * option label lives here; the wizard component only decides what a card looks
 * like. Adding a question means adding an entry, not editing JSX.
 */

export type CreationFieldId =
  | 'classId'
  | 'raceId'
  | 'backgroundId'
  | 'flawId'
  | 'equipmentChoice'
  | 'magicStyleId'
  | 'subclassId'
  | 'featId'
  | 'magicInitiateSpellId'
  | 'auraId'

export interface CreationChoice {
  id: string
  label: string
  tagline: string
  /** A second line, for options whose consequences need spelling out. */
  detail?: string
}

export interface CreationField {
  id: CreationFieldId
  question: string
  helper: string
  /** Absent for fields whose options depend on an earlier answer. */
  choices?: readonly CreationChoice[]
  /** A field nobody has to answer — the spell pick for non-casters. */
  optional?: boolean
  /** Narrow cards, for short options like a colour. */
  compact?: boolean
}

export interface CreationStepDef {
  id: string
  /** The chapter heading, in the game's voice. */
  title: string
  subtitle: string
  fields: readonly CreationField[]
}

const CLASS_CHOICES: readonly CreationChoice[] = Object.values(CLASS_PRESETS).map((preset) => ({
  id: preset.id,
  label: preset.label,
  tagline: preset.tagline,
  detail: preset.description,
}))

const RACE_CHOICES: readonly CreationChoice[] = Object.values(RACE_PRESETS).map((preset) => ({
  id: preset.id,
  label: preset.label,
  tagline: preset.tagline,
  detail: preset.trait,
}))

const BACKGROUND_CHOICES: readonly CreationChoice[] = Object.values(BACKGROUND_PRESETS).map(
  (preset) => ({
    id: preset.id,
    label: preset.label,
    tagline: preset.tagline,
    detail: preset.description,
  }),
)

const AURA_CHOICES: readonly CreationChoice[] = Object.values(AURA_PRESETS).map((preset) => ({
  id: preset.id,
  label: preset.label,
  tagline: preset.tagline,
}))

export const CREATION_STEPS: readonly CreationStepDef[] = [
  {
    id: 'calling',
    title: 'The Calling',
    subtitle: 'Something set you on this road. Start with how you handle trouble.',
    fields: [
      {
        id: 'classId',
        question: 'When trouble starts, what do you do?',
        helper: 'This decides your class — the shape of everything you can do.',
        choices: CLASS_CHOICES,
      },
    ],
  },
  {
    id: 'heritage',
    title: 'Ancestry & Heritage',
    subtitle: 'Where your body came from, and what it is quietly good at.',
    fields: [
      {
        id: 'raceId',
        question: 'What kind of person are you?',
        helper: 'This nudges your ability scores and sets how far you move.',
        choices: RACE_CHOICES,
      },
    ],
  },
  {
    id: 'history',
    title: 'Background & Personal Flaw',
    subtitle: 'The life you had before this one — and the part of it you are not proud of.',
    fields: [
      {
        id: 'backgroundId',
        question: 'What were you doing before all this?',
        helper: 'Your background trains two skills and hands you a keepsake from that life.',
        choices: BACKGROUND_CHOICES,
      },
      {
        id: 'flawId',
        question: 'And what is wrong with you?',
        helper:
          'Pick the flaw you will actually play. Nothing mechanical hangs on it — it is there to make you a person rather than a stat block.',
      },
    ],
  },
  {
    id: 'magic',
    title: 'Your Magic',
    subtitle: 'Pick the shape of your power. The individual spells are chosen for you.',
    fields: [
      {
        id: 'magicStyleId',
        question: 'Which magic is yours?',
        helper:
          'Choose a style and you get a legal, playable spell list straight away. You can open it up and swap spells afterwards if you want to.',
      },
    ],
  },
  {
    id: 'advanced',
    title: 'Specialisation',
    subtitle: 'The optional layer. Skip any of it and your hero is still complete.',
    fields: [
      {
        id: 'subclassId',
        question: 'How do you specialise?',
        helper:
          'A playstyle inside your class. It goes on your sheet and shapes how you describe yourself at the table.',
        optional: true,
      },
      {
        id: 'featId',
        question: 'Do you have a knack for anything?',
        helper: 'One extra talent, and the only thing here that changes your numbers.',
        optional: true,
      },
      {
        // Self-hides: with no choices it renders nothing and cannot block the
        // step, which is how it stays invisible unless Magic Initiate is taken.
        id: 'magicInitiateSpellId',
        question: 'Which spell did you pick up?',
        helper: 'Your one cantrip. You can cast it as often as you like, forever.',
        optional: true,
      },
    ],
  },
  {
    id: 'loadout',
    title: 'Loadout & Visual Identity',
    subtitle: 'What you carry and what colour you burn on the map.',
    fields: [
      {
        id: 'equipmentChoice',
        question: 'How do you want to be equipped?',
        helper: 'Survive longer or hit harder. This one changes your numbers.',
      },
      {
        id: 'auraId',
        question: 'What colour is your aura?',
        helper: 'Pure decoration: the glow on your token and on your sheet.',
        choices: AURA_CHOICES,
        compact: true,
      },
    ],
  },
]

export function loadoutChoices(classId: ClassId | undefined): readonly CreationChoice[] {
  if (classId === undefined) return []
  return Object.values(CLASS_PRESETS[classId].loadouts).map((loadout) => ({
    id: loadout.id,
    label: loadout.label,
    tagline: loadout.id === 'defensive' ? 'Harder to hit.' : 'Hits harder.',
    detail: loadout.description,
  }))
}

export function flawChoices(backgroundId: BackgroundId | undefined): readonly CreationChoice[] {
  if (backgroundId === undefined) return []
  const background = BACKGROUND_PRESETS[backgroundId]
  /*
   * The background's own three first, then the ones anyone can own. Order is
   * the whole of the guidance here: a player who wants the obvious answer finds
   * it at the top, and a player who wants to build somebody specific reads on.
   */
  return flawsFor(background).map((flaw) => ({
    id: flaw.id,
    label: flaw.text,
    tagline: background.flaws.some((own) => own.id === flaw.id) ? '' : 'Anyone can carry this one.',
  }))
}

export function magicStyleChoices(classId: ClassId | undefined): readonly CreationChoice[] {
  if (classId !== 'wizard' && classId !== 'cleric') return []
  return magicStylesFor(classId).map((style) => ({
    id: style.id,
    label: style.title,
    tagline: style.description,
  }))
}

/**
 * Whether the magic step has anything to say to this class. Paladins are
 * included deliberately: they get no spells at 1st level, and the step exists to
 * explain that rather than to vanish and leave them wondering.
 */
export function hasMagicStep(classId: ClassId | undefined): boolean {
  return classId === 'wizard' || classId === 'cleric' || classId === 'paladin'
}

/**
 * The steps this particular character actually walks through. Fighters and rogues
 * never see the magic step at all.
 */
export function stepsFor(draft: CreationDraft): readonly CreationStepDef[] {
  return CREATION_STEPS.filter((step) => {
    if (step.id === 'magic') return hasMagicStep(draft.classId)
    // The advanced layer is opt-in: absent entirely until the player asks, so
    // the fast-track road is exactly as long as it was before.
    if (step.id === 'advanced') return draft.advanced === true
    return true
  })
}

/** The specialisations on offer, or none when the class is not yet chosen. */
export function subclassChoices(classId: ClassId | undefined): readonly CreationChoice[] {
  if (classId === undefined) return []
  return subclassesFor(classId).map((subclass) => ({
    id: subclass.id,
    label: subclass.label,
    tagline: subclass.tagline,
    detail: subclass.description,
  }))
}

/**
 * The cantrips Magic Initiate offers, or none for every other feat — which is
 * what keeps the question invisible unless it has been earned.
 */
export function magicInitiateChoices(featId: string | undefined): readonly CreationChoice[] {
  return cantripChoicesFor(featId).flatMap((id) => {
    const spell = SPELLS_BY_ID[id]
    if (spell === undefined) return []
    return [{
      id: spell.id,
      label: spell.name,
      tagline: spell.damageOrEffect,
      detail: spell.description,
    }]
  })
}

/** Origin feats. The same short list for every class, by design. */
export function featChoices(): readonly CreationChoice[] {
  return FEATS.map((feat) => ({
    id: feat.id,
    label: feat.label,
    tagline: feat.tagline,
    detail: `${feat.description} (${feat.effectLabel})`,
  }))
}

/** The options a field is currently offering, static or derived. */
export function choicesFor(
  field: CreationField,
  draft: CreationDraft,
): readonly CreationChoice[] {
  if (field.choices !== undefined) return field.choices
  switch (field.id) {
    case 'flawId':
      return flawChoices(draft.backgroundId)
    case 'equipmentChoice':
      return loadoutChoices(draft.classId)
    case 'magicStyleId':
      return magicStyleChoices(draft.classId)
    case 'subclassId':
      return subclassChoices(draft.classId)
    case 'featId':
      return featChoices()
    case 'magicInitiateSpellId':
      return magicInitiateChoices(draft.featId)
    default:
      return []
  }
}

/**
 * Whether the step has everything it asked for. A field with no options left to
 * offer — the spell pick for a fighter — cannot block progress.
 */
export function stepAnswered(step: CreationStepDef, draft: CreationDraft): boolean {
  return step.fields.every((field) => {
    if (field.optional === true) return true
    if (choicesFor(field, draft).length === 0) return true
    return draft[field.id] !== undefined
  })
}
