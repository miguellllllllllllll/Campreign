import type { SVGProps } from 'react'

/**
 * Hand-drawn icons for the things no icon set has a glyph for — a superiority
 * die, a channelled oath, a trip that puts somebody on the floor.
 *
 * Inline SVG rather than files in `public/`, which is the whole point: an
 * `<img>` is a separate document and cannot be recoloured by the page around
 * it, so `currentColor` here is what lets `text-amber-torch` reach the strokes.
 * Being hand-drawn, they also carry no attribution — see NOTICE for why that
 * mattered.
 *
 * Named exports rather than a `<FantasyIcon name="…" />` lookup: a typo in a
 * string prop is a runtime blank, a typo in an import is a compile error.
 */
export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string
}

/**
 * Shared so every icon lines up on the same grid and stroke weight.
 *
 * 1.8 rather than the 1.5 these were drawn at. Nothing here is ever rendered at
 * the 24 the viewBox implies — the call sites ask for 12 to 18, and at 16 a 1.5
 * stroke lands on one device pixel and greys out. The grid is 24 and the icons
 * are not: everything below is drawn for two thirds of it.
 */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/**
 * A d20 — attacks, saves and checks.
 *
 * The six faces it used to draw all met at the centre, and five lines
 * converging inside a ten-pixel hexagon is a knot, not a die. One inscribed
 * triangle says icosahedron on its own, and it is the only interior mark that
 * still has room to be seen at 14.
 */
export function D20Icon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden {...base} {...props}>
      <polygon points="12 2 21 7.25 21 16.75 12 22 3 16.75 3 7.25" />
      <polygon points="12 6.6 17.4 15.6 6.6 15.6" />
    </svg>
  )
}

/**
 * The Battle Master's spendable die — a d8 on its point.
 *
 * It had a full cross through it and a pip in each half, and at the 12 the
 * ActionBar asks for, the pips sat on the crossbar and the whole interior went
 * solid. The horizontal alone is what makes a rhombus read as a die; the
 * vertical was drawing the one edge you cannot see from this angle anyway.
 */
export function SuperiorityDieIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden {...base} {...props}>
      <polygon points="12 2.5 20 12 12 21.5 4 12" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  )
}

/**
 * A paladin's oath, channelled.
 *
 * This was the worst of them. Eight dashed rays crossed the whole grid at
 * stroke 1, and a 1-unit dash with a 2-unit gap is a third of a pixel at the
 * size it ships — not faint, but a grey haze over everything, and the cross at
 * the middle was lost inside it.
 *
 * The rays are now four, short, outside the disc and at full weight, so they
 * fade out cleanly at 12 instead of muddying what they surround. The cross and
 * the disc are the icon; the rays are what it gains when there is room.
 */
export function ChannelDivinityIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden {...base} {...props}>
      <circle cx="12" cy="12" r="6.2" className="fill-current/15" />
      <path d="M12 8.6v6.8M9.2 11.2h5.6" strokeWidth={2.2} />
      <path d="M17.7 6.3 19.5 4.5M6.3 6.3 4.5 4.5M17.7 17.7l1.8 1.8M6.3 17.7l-1.8 1.8" />
    </svg>
  )
}

/**
 * A warded shield — defensive magic and reactions.
 *
 * The star inside was five-pointed and outlined, which is five concavities in
 * about six pixels; it filled in solid and the shield read as having a smudge
 * in it. A boss is one closed curve and degrades to a dot, which is still a
 * shield with something lit in the middle of it.
 *
 * Deliberately not a four-point sparkle, tempting as that was — SpellFlare is
 * already that shape, and two icons in one bar cannot share a silhouette.
 */
export function WardingShieldIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden {...base} {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <circle cx="12" cy="11.2" r="2.9" className="fill-current/25" />
    </svg>
  )
}

/**
 * A sweep along the floor — Trip Attack.
 *
 * The old one drew a blade and its two motion marks as four near-parallel
 * diagonals, and at 16 they merged into a single stroke: it read as a pencil,
 * and at 12 as a tick. Nothing about it said the target ends up prone.
 *
 * What carries that is the ground, so the ground is now in the icon — a bar
 * along the bottom with the sweep curving into it and a head on the end to say
 * which way it travels. The floor line is also what keeps the arc from being
 * the undo arrow, which is what it is without one.
 *
 * Two things tried on the way, both rendered before being believed. A bar
 * toppling onto the floor reads as a tick at 14, which is worse than vague. A
 * boot — the obvious answer to "trip", and the reason to write this down — is
 * a lab flask in outline: shaft, shoulder, splayed foot, and nothing in the
 * silhouette that says the wearer is upright. A solid triangle for the blade
 * tip is also out; at this weight it merges into the floor bar and the whole
 * lower left goes to mass.
 */
export function TripAttackIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden {...base} {...props}>
      <path d="M19.6 4.4c0 7.4-3.6 11.6-9.8 12.8" strokeWidth={2.2} />
      <path d="M12.6 13.4 8.6 17.2l4 2.6" strokeWidth={2.2} />
      <path d="M3 22h18" strokeWidth={2.4} />
    </svg>
  )
}

/** A burst of cantrip light. */
export function SpellFlareIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden {...base} {...props}>
      <path
        d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2z"
        className="fill-current/20"
      />
    </svg>
  )
}
