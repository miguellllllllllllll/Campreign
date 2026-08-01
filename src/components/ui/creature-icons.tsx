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
 * The third rule is that legible is not the same as distinct, and it costs a
 * redraw to learn. The dummy was a straw head on a crossbar and read perfectly
 * well as a straw head on a crossbar — but the cleric is a cross, they stand on
 * the same board, and at forty pixels there was nothing to tell them apart.
 * Judge a shape against the rest of the set, never on its own: the check is a
 * contact sheet of all of them at token size, not one drawing blown up.
 *
 * A fourth, narrower one, from the spider: evenly radiating limbs read as an
 * asterisk rather than an animal, however well drawn each limb is. The fix is
 * asymmetry the eye can catch — an arch, a knee, a taper — not more detail.
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

  /**
   * Ears wider than the skull, a narrowing jaw, and a mouthful of teeth.
   *
   * The shoulders are gone. This had a body under the head, which is the bust
   * the file warns about three paragraphs up — the emblem is the face, and the
   * blob beneath it only ever added contact-avatar.
   *
   * A head that tapers to a chin is a map pin, which is the failure recorded on
   * the rogue, so the features are load-bearing here rather than decorative:
   * two slanted eyes and a grin are what make the taper a face. The ears leave
   * the skull below their widest point so they read as swept back rather than
   * balanced on top.
   */
  goblin: (
    <>
      <path d="M6.6 6.6.9 3.2l1.3 7 4.4 1.2V6.6Z" />
      <path d="M17.4 6.6 23.1 3.2l-1.3 7-4.4 1.2V6.6Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.8c4 0 6.8 2.6 6.8 6.5 0 3.9-2.1 7.7-4.4 10.1-.8.9-1.6 1.4-2.4 1.4s-1.6-.5-2.4-1.4C7.3 17 5.2 13.2 5.2 9.3c0-3.9 2.8-6.5 6.8-6.5ZM7.6 8.8l3.3 1.8-.5 1.6-3-1.4V8.8Zm8.8 0-3.3 1.8.5 1.6 3-1.4V8.8Zm-7.2 5.4h5.6l-.9 2.2-.9-1.2-1 1.4-1-1.4-.9 1.2-.9-2.2Z"
      />
    </>
  ),

  /**
   * A bound sack on a stand — the thing you hit, rather than a figure of one.
   *
   * It was a straw head on a crossbar, and the knobbed arm ends and the base
   * were there to stop that reading as a crucifix. Rendered at token size they
   * did not: a post plus a crossbar is a cross, the cleric is a cross, and the
   * two stand on the same board. Nothing with a thin stem and horizontal arms
   * was going to win that argument, so the arms are gone rather than fixed.
   *
   * The cinch and its two corners are what make the mass a sack rather than an
   * egg, and the band across the middle keeps it from reading as a torso. No
   * head on top: a ball above a body is the contact-avatar failure again.
   */
  dummy: (
    <>
      <path d="M7.6 1.8h8.8l-1.2 3.8H8.8L7.6 1.8Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.2 5.4h5.6c0 1.6-.4 2.6-1.2 3.2 4.6 1.2 7.6 4.6 7.6 8 0 3.2-4.2 5.2-9.2 5.2s-9.2-2-9.2-5.2c0-3.4 3-6.8 7.6-8-.8-.6-1.2-1.6-1.2-3.2Zm-5.4 9.4h16.4v1.5H3.8v-1.5Z"
      />
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
      <path d="M7.1 4.4c3.5-.8 7.5.8 12.6-.2l-3.2 4.2 3.2 4.4c-5.1-1-9.1.6-12.6-.2V4.4Z" />
    </>
  ),

  /**
   * Wings edge to edge, which no other token here does — that span is the whole
   * identification, and it survives being shrunk further than any of the others.
   *
   * Drawn as a rat first, and it failed twice for the reason recorded above: an
   * ear circle on top of a body blob reads as a second head, and a tail thin
   * enough to be a tail is thin enough to vanish. Rodent and goblin also compete
   * for the same silhouette, and the goblin was here first.
   *
   * The wings were then a row of small notches, which at token size smeared into
   * a dark bar — legible as *something* spread wide, not as a bat. They are now
   * two scallops apiece, each one big enough to survive the shrink, and the ears
   * are what carry the animal once the wings are just a span.
   */
  bat: (
    <>
      <path d="M10.6 9.2Q6.2 6.2 1 6Q4.2 8.4 2.4 12.4Q5 12.6 6.6 16.4Q8.6 13.6 10.8 14.4Z" />
      <path d="M13.4 9.2Q17.8 6.2 23 6Q19.8 8.4 21.6 12.4Q19 12.6 17.4 16.4Q15.4 13.6 13.2 14.4Z" />
      <path d="M9 3.4 11.6 7.6l-2 .6L9 3.4Z" />
      <path d="M15 3.4 12.4 7.6l2 .6L15 3.4Z" />
      <ellipse cx="12" cy="12.4" rx="2.3" ry="4.2" />
      <circle cx="12" cy="8.8" r="2.6" />
    </>
  ),

  /**
   * A skull: round sockets, a triangular nose, a jaw with two teeth cut out of
   * it. Nothing else on the board is a skull, and at token size the two black
   * sockets do all the work on their own.
   */
  skeleton: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2.2c5 0 8.6 3.6 8.6 8.4 0 3-1.4 5.4-3.4 6.8v3.2A1.4 1.4 0 0 1 15.8 22H8.2a1.4 1.4 0 0 1-1.4-1.4v-3.2c-2-1.4-3.4-3.8-3.4-6.8 0-4.8 3.6-8.4 8.6-8.4ZM8.4 8.2a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Zm7.2 0a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4ZM12 14.6l-1.6 2.8h3.2L12 14.6Zm-2.8 4.2h1.2V22H9.2v-3.2Zm4.4 0h1.2V22h-1.2v-3.2Z"
    />
  ),

  /**
   * Eight legs off a body, and the legs are the whole problem. Straight spokes
   * were wedges rather than sticks, which was the right instinct for the reason
   * this file opens with, but they radiated evenly and the thing read as an
   * asterisk — a sparkle, not an animal.
   *
   * What fixes it is the arch. Each leg leaves the body, rises above it, and
   * comes down to a point outside it, so the silhouette has a knee line rather
   * than a star's even spokes. The legs are also drawn first and run under the
   * body: a leg that stops short of the abdomen leaves a gap, and eight gaps
   * read as a halo.
   */
  spider: (
    <>
      <path d="M14.9 9.1Q18.7 4.2 22.3 6.4Q18.5 3 13.5 7.7ZM10.5 7.7Q5.5 3 1.7 6.4Q5.3 4.2 9.1 9.1ZM15.3 10.5Q20.3 7 23 11.2Q20.5 5.8 14.3 8.7ZM9.7 8.7Q3.5 5.8 1 11.2Q3.7 7 8.7 10.5ZM14.9 12Q20.5 10.7 22.6 16Q21.1 9.7 14.7 10ZM9.3 10Q2.9 9.7 1.4 16Q3.5 10.7 9.1 12ZM13.9 13.3Q18.9 14.6 20.6 20.4Q19.9 13.8 14.5 11.5ZM9.5 11.5Q4.1 13.8 3.4 20.4Q5.1 14.6 10.1 13.3Z" />
      <ellipse cx="12" cy="9.4" rx="3.3" ry="2.9" />
      <ellipse cx="12" cy="15.4" rx="4.6" ry="5.1" />
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
