import type { ReactNode, SVGProps } from 'react'
import type { TokenId } from '../../types/combat.ts'

/**
 * The bodies on the battle map — one silhouette per thing that can stand in a
 * square.
 *
 * Filled shapes rather than the line work in `custom-icons.tsx`, and that is the
 * first design rule: a token is drawn at about forty pixels inside a lit square,
 * and a 1.5px stroke disappears at that size. Solid mass survives.
 *
 * The second rule was learned the hard way. These were first drawn as
 * head-and-shoulders busts distinguished by their headgear, and every one of
 * them read as the generic contact-avatar — the shoulders took the eye and the
 * hat was too small to argue with. So each shape now fills the frame and is
 * nothing but its own emblem: the fighter is a helm, the wizard is a hat, the
 * paladin is a shield. No bodies.
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

const SHAPES: Record<TokenId, ReactNode> = {
  /** A great helm, squared off, with a T of vision cut through it. */
  fighter: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.8 5.2a2.2 2.2 0 0 1 2.2-2.2h8a2.2 2.2 0 0 1 2.2 2.2v8.4c0 4.1-2.8 7.4-6.2 8.6-3.4-1.2-6.2-4.5-6.2-8.6V5.2ZM6.2 8.2h11.6v2.3H6.2V8.2Zm4.7 4.1h2.2v6.4h-2.2v-6.4Z"
    />
  ),

  /** The hat, and only the hat, with a star burned into the cone. */
  wizard: (
    <>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1.4c1.1 0 1.6 1.1 2 2.4l3.5 10.3H6.5L10 3.8c.4-1.3.9-2.4 2-2.4Zm0 4.6-.8 2-2 .8 2 .8.8 2 .8-2 2-.8-2-.8-.8-2Z"
      />
      <path d="M3.2 15.4h17.6c.6 0 1.1.5 1.1 1.1v1.2c0 .6-.5 1.1-1.1 1.1H3.2c-.6 0-1.1-.5-1.1-1.1v-1.2c0-.6.5-1.1 1.1-1.1Z" />
    </>
  ),

  /**
   * A hood over a cloak that flares out at the hem. The flare is load-bearing:
   * a cowl that tapered to a point underneath read as a map pin.
   */
  rogue: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1.8c4.4 0 7.2 3.3 7.2 7.7 0 2.4-.6 4.6-1.6 6.5l2.6 6H3.8l2.6-6c-1-1.9-1.6-4.1-1.6-6.5 0-4.4 2.8-7.7 7.2-7.7ZM8.3 8.6h7.4v2.5H8.3V8.6Z"
    />
  ),

  /**
   * A cross with the long stem of a real one. Drawn symmetrical first, which
   * was a mistake — an even-armed cross at icon size is the "add" button.
   */
  cleric: <path d="M10.6 2.2h2.8v5.4h6v2.8h-6v11.4h-2.8V10.4h-6V7.6h6V2.2Z" />,

  /** A shield, because a wall is what a paladin is. */
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
      <path d="M7.2 9.6 1.4 5.6l5.4-.6L7.2 9.6Z" />
      <path d="M16.8 9.6 22.6 5.6l-5.4-.6L16.8 9.6Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3.4c3.6 0 6.4 2.6 6.4 6.2 0 4-2.9 7.2-6.4 7.2s-6.4-3.2-6.4-7.2c0-3.6 2.8-6.2 6.4-6.2ZM8.6 9.2h2.1v2.1H8.6V9.2Zm4.7 0h2.1v2.1h-2.1V9.2Z"
      />
      <path d="M6.4 22c0-3 2.5-4.7 5.6-4.7s5.6 1.7 5.6 4.7H6.4Z" />
    </>
  ),

  /**
   * A straw head on a crossbar, standing on a base. The knobbed arm ends and
   * the base are not decoration — a bare post and crossbar is a crucifix, and
   * at icon size it was indistinguishable from the cleric.
   */
  dummy: (
    <>
      <circle cx="12" cy="4.6" r="3.4" />
      <path d="M10.6 7.4h2.8v11.8h-2.8V7.4Z" />
      <path d="M4.4 10.4h15.2v2.4H4.4v-2.4Z" />
      <circle cx="3.4" cy="11.6" r="2.2" />
      <circle cx="20.6" cy="11.6" r="2.2" />
      <path d="M7.4 22l2.2-2.8h4.8l2.2 2.8H7.4Z" />
    </>
  ),

  /**
   * The banner, which is the thing a squire is actually for.
   *
   * Drawn three times before this. Twice as a helm — wrong, because the fighter
   * owns that shape and the two of them stand on the same board — and once as
   * spear and buckler, which failed for a reason worth writing down: a diagonal
   * shaft with a point on the end reads as an arrow at forty pixels, and no
   * amount of shield behind it argues otherwise.
   *
   * A standard is the one silhouette nothing else here occupies, and the
   * swallowtail matters — a plain right-pointing pennant is the play button.
   */
  squire: (
    <>
      <circle cx="6.1" cy="2.2" r="1.5" />
      <path d="M5.2 3.4h1.9v18.8H5.2V3.4Z" />
      <path d="M7.1 4.6h12.7l-3.6 4.2 3.6 4.2H7.1V4.6Z" />
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
