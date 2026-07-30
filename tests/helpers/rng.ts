import type { Rng } from '../../src/types/dice.ts'

/** Replays a fixed list of [0,1) values, cycling if the roller asks for more. */
export function sequenceRng(values: readonly number[]): Rng {
  if (values.length === 0) throw new Error('sequenceRng needs at least one value')
  let index = 0
  return () => {
    const value = values[index % values.length]
    index += 1
    return value as number
  }
}

export function constantRng(value: number): Rng {
  return () => value
}

/** Picks the [0,1) value that makes a die of `size` land exactly on `face`. */
export function faceValue(face: number, size: number): number {
  return (face - 1) / size + 1 / (size * 2)
}

/** Deterministic PRNG (mulberry32) for when a test needs many varied rolls. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
