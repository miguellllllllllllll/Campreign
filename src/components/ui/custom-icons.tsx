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

/** Shared so every icon lines up on the same grid and stroke weight. */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** A d20 — attacks, saves and checks. */
export function D20Icon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden {...base} {...props}>
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
      <polyline points="12 2 12 22" />
      <polyline points="12 12 22 8.5" />
      <polyline points="12 12 2 8.5" />
      <polyline points="12 12 22 15.5" />
      <polyline points="12 12 2 15.5" />
    </svg>
  )
}

/** The Battle Master's spendable die. */
export function SuperiorityDieIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden {...base} {...props}>
      <polygon points="12 2 20 12 12 22 4 12" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="12" cy="7" r="1" fill="currentColor" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  )
}

/** A paladin's oath, channelled. */
export function ChannelDivinityIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden {...base} {...props}>
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" strokeWidth={1} strokeDasharray="1 2" />
      <circle cx="12" cy="12" r="5" className="fill-current/10" />
      <path d="M12 7v10M9 10h6" strokeWidth={2} />
    </svg>
  )
}

/** A warded shield — defensive magic and reactions. */
export function WardingShieldIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden {...base} {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path
        d="M12 6l1.5 3.5L17 10l-2.5 2.5.5 3.5-3-1.8-3 1.8.5-3.5L7 10l3.5-.5L12 6z"
        className="fill-current/20"
      />
    </svg>
  )
}

/** A blade sweeping low — Trip Attack. */
export function TripAttackIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} aria-hidden {...base} {...props}>
      <path d="M14.5 17.5L6.5 9.5M6.5 9.5V6.5h3L17.5 14.5" />
      <path d="M4 19l4-2M16 21l3-5" strokeWidth={2} />
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
