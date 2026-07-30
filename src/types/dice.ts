/** Returns a float in [0, 1). Injected so every roll is reproducible under test. */
export type Rng = () => number

export type RollMode = 'normal' | 'advantage' | 'disadvantage'

export type DieSize = 4 | 6 | 8 | 10 | 12 | 20 | 100

export type DiceTerm =
  | { kind: 'dice'; sign: 1 | -1; count: number; size: DieSize }
  | { kind: 'flat'; sign: 1 | -1; value: number }

export interface DieGroup {
  size: DieSize
  sign: 1 | -1
  /** Every die that hit the table, including ones dropped by advantage. */
  results: number[]
  /** The subset that counted toward the total. */
  kept: number[]
}

export type CritKind = 'hit' | 'fumble'

export interface DiceRoll {
  notation: string
  groups: DieGroup[]
  modifier: number
  total: number
  mode: RollMode
  /** Only ever set for a single d20 — the natural 20 / natural 1 rule. */
  crit: CritKind | null
}
