import type { Combatant } from '../../types/combat.ts'

/**
 * Spell slots, indexed by the spell level they cast.
 *
 * A plain array rather than a number, and index 0 is deliberately unused so a
 * slot's index reads as its own level: `slots[1]` is first-level, `slots[2]` is
 * second. Cantrips never consume one, so nothing ever asks for index 0.
 *
 * This replaced a single `number` meaning "first-level slots". That worked
 * exactly as long as first level was the only level there was — the moment a
 * 3rd-level caster gained second-level slots, the field could not say so, and
 * the level cap sat at 2 for that reason alone.
 *
 * Every read goes through the helpers below rather than indexing directly, so
 * the shape can change again without hunting twenty call sites a second time.
 */
export type SpellSlots = readonly number[]

/** How many slots of exactly this level remain. */
export function slotsAt(slots: SpellSlots | undefined, spellLevel: number): number {
  if (slots === undefined || spellLevel <= 0) return 0
  return slots[spellLevel] ?? 0
}

/** Whether a spell of this level can be paid for right now. */
export function hasSlot(slots: SpellSlots | undefined, spellLevel: number): boolean {
  // Cantrips are free, and answering "yes" for them keeps every caller from
  // having to special-case level 0 before it asks.
  return spellLevel <= 0 || slotsAt(slots, spellLevel) > 0
}

/**
 * Spends one slot of the given level, returning the new array.
 *
 * Deliberately no upcasting: a 1st-level spell cast from a 2nd-level slot is a
 * real rule and a real decision, and it is not this one. Adding it later means
 * changing this function and the button that calls it, not the shape.
 */
export function spendSlot(slots: SpellSlots | undefined, spellLevel: number): SpellSlots | undefined {
  if (slots === undefined || spellLevel <= 0) return slots
  const next = [...slots]
  next[spellLevel] = Math.max(0, (next[spellLevel] ?? 0) - 1)
  return next
}

/** Total slots left across every level, for "have you anything to cast" checks. */
export function totalSlots(slots: SpellSlots | undefined): number {
  return (slots ?? []).reduce((sum, count) => sum + count, 0)
}

/** The slots a combatant has, whatever shape the combatant is. */
export function slotsOf(combatant: Pick<Combatant, 'spellSlots'>): SpellSlots | undefined {
  return combatant.spellSlots
}
