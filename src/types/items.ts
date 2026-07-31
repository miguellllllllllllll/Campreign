import type { AbilityName } from './character.ts'

export type ArmorCategory = 'none' | 'light' | 'medium' | 'heavy'

export interface Armor {
  id: string
  name: string
  category: ArmorCategory
  baseAc: number
  /** How much Dexterity the armor lets you use. null means uncapped. */
  dexCap: number | null
}

export type DamageType =
  | 'slashing'
  | 'piercing'
  | 'bludgeoning'
  | 'fire'
  | 'radiant'
  | 'cold'
  | 'lightning'
  | 'acid'
  /** Raw magical impact — Magic Missile's darts, and nothing else yet. */
  | 'force'

export interface Weapon {
  id: string
  name: string
  damage: string
  damageType: DamageType
  /** Finesse weapons let the wielder choose the better of Strength or Dexterity. */
  finesse: boolean
  ranged: boolean
  ability: AbilityName
}
