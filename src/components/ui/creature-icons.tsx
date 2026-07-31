import type { ReactNode, SVGProps } from 'react'
import type { TokenId } from '../../types/combat.ts'

/**
 * The bodies on the battle map — one silhouette per thing that can stand in a
 * square.
 *
 * Filled shapes rather than the line work in `custom-icons.tsx`, and that is the
 * only real design rule here: a token is drawn at about forty pixels inside a
 * lit square, and a 1.5px stroke disappears at that size. Solid mass survives.
 *
 * Every humanoid is a head-and-shoulders bust on the same shoulder line, so the
 * set reads as one family and the differences land where a player looks first —
 * the headgear. The goblin gets ears, the dummy gets a post, the paladin is a
 * shield and no body at all, because a wall is what a paladin is.
 *
 * A `Record` lookup, unlike the named exports next door: `tokenId` arrives from
 * a combatant at runtime, so there is nothing to import by name. The exhaustive
 * `Record<TokenId, …>` buys back what named exports were protecting — a missing
 * shape and a misspelled id are both compile errors.
 */
export interface CreatureTokenProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  token: TokenId
  size?: number | string
}

/** Shared so every bust sits on the same line and the set reads as one hand. */
const SHOULDERS = 'M3.6 22c0-3.9 3.8-6.1 8.4-6.1s8.4 2.2 8.4 6.1Z'

const SHAPES: Record<TokenId, ReactNode> = {
  /** A great helm: square, banded, one vertical slit to see through. */
  fighter: (
    <>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.4 4.6A1.4 1.4 0 0 1 8.8 3.2h6.4a1.4 1.4 0 0 1 1.4 1.4v5.6a4.6 4.6 0 0 1-9.2 0V4.6Zm3.8 1.8h1.6v5.4h-1.6V6.4Z"
      />
      <path d={SHOULDERS} />
    </>
  ),

  /** The hat does the work; the face underneath is barely there, as intended. */
  wizard: (
    <>
      <path d="M12 1.4 16.8 9.4H7.2L12 1.4Z" />
      <path d="M5.6 9.6h12.8v1.8H5.6V9.6Z" />
      <path d="M9.2 11.6h5.6v1.8a2.8 2.8 0 0 1-5.6 0v-1.8Z" />
      <path d={SHOULDERS} />
    </>
  ),

  /** A hood pulled forward, with a horizontal gap where a face should be. */
  rogue: (
    <>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.2c4 0 6.6 3 6.6 7 0 3-1.3 5.4-3.2 6.6H8.6C6.7 14.6 5.4 12.2 5.4 9.2c0-4 2.6-7 6.6-7Zm-3 6.6h6v2.4H9V8.8Z"
      />
      <path d={SHOULDERS} />
    </>
  ),

  /** Bare head under a raised symbol — the power is borrowed, not worn. */
  cleric: (
    <>
      <path d="M11.1 1h1.8v2.1H15v1.8h-2.1V7h-1.8V4.9H9V3.1h2.1V1Z" />
      <circle cx="12" cy="11.4" r="3.6" />
      <path d={SHOULDERS} />
    </>
  ),

  /** No bust: the shield is the whole silhouette, which is the whole point. */
  paladin: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1.6 20 4.3v6c0 5-4.9 8.4-8 9.5-3.1-1.1-8-4.5-8-9.5v-6l8-2.7Zm-.9 5.2v2.9H8.2v1.8h2.9v2.9h1.8v-2.9h2.9V9.7h-2.9V6.8h-1.8Z"
    />
  ),

  /** Ears wider than the skull, and two mean little eyes. */
  goblin: (
    <>
      <path d="M7.9 8.4 2.6 5.2l4.9-.7L7.9 8.4Z" />
      <path d="M16.1 8.4 21.4 5.2l-4.9-.7L16.1 8.4Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 4.4c2.9 0 5.1 2.1 5.1 5 0 3.2-2.3 5.8-5.1 5.8s-5.1-2.6-5.1-5.8c0-2.9 2.2-5 5.1-5ZM9.4 9h1.7v1.7H9.4V9Zm3.5 0h1.7v1.7h-1.7V9Z"
      />
      <path d="M5.6 22c0-3.4 2.9-5.4 6.4-5.4s6.4 2 6.4 5.4H5.6Z" />
    </>
  ),

  /** A straw head on a crossbar. Nothing about it is alive. */
  dummy: (
    <>
      <circle cx="12" cy="5.4" r="3.4" />
      <path d="M10.9 8.4h2.2V22h-2.2V8.4Z" />
      <path d="M3 10.4h18v2.2H3v-2.2Z" />
    </>
  ),

  /** A plain kettle helm — a soldier, not a knight. */
  squire: (
    <>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3a4.8 4.8 0 0 0-4.8 4.8v3.4a4.8 4.8 0 0 0 9.6 0V7.8A4.8 4.8 0 0 0 12 3Zm-3 4.6h6v1.7H9V7.6Z"
      />
      <path d={SHOULDERS} />
    </>
  ),
}

export function CreatureToken({ token, size = 24, ...props }: CreatureTokenProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      {SHAPES[token]}
    </svg>
  )
}
