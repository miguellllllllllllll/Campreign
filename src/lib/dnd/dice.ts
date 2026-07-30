import type { DiceRoll, DiceTerm, DieGroup, DieSize, Rng, RollMode } from '../../types/dice.ts'

const VALID_SIZES: readonly number[] = [4, 6, 8, 10, 12, 20, 100]

const MAX_DICE = 100

function isDieSize(value: number): value is DieSize {
  return VALID_SIZES.includes(value)
}

export function parseNotation(notation: string): DiceTerm[] {
  const cleaned = notation.replace(/\s+/g, '').toLowerCase()
  if (cleaned.length === 0) throw new Error(`Empty dice notation`)

  const signed = /^[+-]/.test(cleaned) ? cleaned : `+${cleaned}`
  const chunks = signed.match(/[+-][^+-]+/g)
  if (chunks === null || chunks.join('') !== signed) {
    throw new Error(`Could not parse dice notation: "${notation}"`)
  }

  return chunks.map((chunk) => {
    const sign: 1 | -1 = chunk.startsWith('-') ? -1 : 1
    const body = chunk.slice(1)

    if (!body.includes('d')) {
      const value = Number(body)
      if (!Number.isInteger(value)) {
        throw new Error(`Invalid modifier "${body}" in "${notation}"`)
      }
      return { kind: 'flat', sign, value }
    }

    const [countPart, sizePart, ...rest] = body.split('d')
    if (rest.length > 0 || sizePart === undefined || sizePart === '') {
      throw new Error(`Invalid dice term "${body}" in "${notation}"`)
    }

    const count = countPart === '' ? 1 : Number(countPart)
    const size = Number(sizePart)

    if (!Number.isInteger(count) || count < 1 || count > MAX_DICE) {
      throw new Error(`Invalid dice count "${countPart}" in "${notation}"`)
    }
    if (!isDieSize(size)) {
      throw new Error(`Unsupported die "d${sizePart}" in "${notation}"`)
    }

    return { kind: 'dice', sign, count, size }
  })
}

export function rollDie(size: DieSize, rng: Rng = Math.random): number {
  const raw = Math.floor(rng() * size) + 1
  return Math.min(size, Math.max(1, raw))
}

/**
 * Advantage and disadvantage are only meaningful on a single d20, so we apply
 * them exclusively when the notation contains exactly one such die.
 */
function isSingleD20(terms: DiceTerm[]): boolean {
  const diceTerms = terms.filter((term) => term.kind === 'dice')
  const first = diceTerms[0]
  return diceTerms.length === 1 && first !== undefined && first.size === 20 && first.count === 1
}

/**
 * The natural roll at or above which a d20 is a critical hit.
 *
 * A parameter rather than the constant 20 because a Champion crits on 19. It
 * defaults everywhere, so every existing call — and every test that pins an
 * exact sequence — behaves exactly as it did.
 */
export const DEFAULT_CRIT_ON = 20

export function roll(
  notation: string,
  opts: { rng?: Rng; mode?: RollMode; critOn?: number } = {},
): DiceRoll {
  const rng = opts.rng ?? Math.random
  const requestedMode = opts.mode ?? 'normal'
  const critOn = opts.critOn ?? DEFAULT_CRIT_ON
  const terms = parseNotation(notation)
  const mode = isSingleD20(terms) ? requestedMode : 'normal'

  const groups: DieGroup[] = []
  let modifier = 0
  let total = 0

  for (const term of terms) {
    if (term.kind === 'flat') {
      modifier += term.sign * term.value
      total += term.sign * term.value
      continue
    }

    const rolls: number[] = []
    const rollCount = mode === 'normal' ? term.count : 2
    for (let i = 0; i < rollCount; i += 1) {
      rolls.push(rollDie(term.size, rng))
    }

    const kept =
      mode === 'normal'
        ? [...rolls]
        : [mode === 'advantage' ? Math.max(...rolls) : Math.min(...rolls)]

    groups.push({ size: term.size, sign: term.sign, results: rolls, kept })
    total += term.sign * kept.reduce((sum, value) => sum + value, 0)
  }

  return { notation, groups, modifier, total, mode, crit: detectCrit(groups, critOn) }
}

function detectCrit(groups: DieGroup[], critOn: number): 'hit' | 'fumble' | null {
  const d20s = groups.filter((group) => group.size === 20)
  const only = d20s[0]
  if (d20s.length !== 1 || only === undefined || only.kept.length !== 1) return null

  const natural = only.kept[0]
  if (natural === undefined) return null
  // A natural 1 stays a fumble even for a Champion: widening the crit range
  // never narrows the fumble range, and a threshold of 1 would make every roll
  // both at once.
  if (natural === 1) return 'fumble'
  if (natural >= critOn) return 'hit'
  return null
}

/** SRD critical hits double the damage dice but not the flat modifier. */
export function toCriticalNotation(notation: string): string {
  return parseNotation(notation)
    .map((term) => {
      const sign = term.sign === -1 ? '-' : '+'
      return term.kind === 'dice'
        ? `${sign}${term.count * 2}d${term.size}`
        : `${sign}${term.value}`
    })
    .join('')
    .replace(/^\+/, '')
}

/** Flattens a roll into the dice actually shown to the player. */
export function keptDice(roll: DiceRoll): number[] {
  return roll.groups.flatMap((group) => group.kept)
}
