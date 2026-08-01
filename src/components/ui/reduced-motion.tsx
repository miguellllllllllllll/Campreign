'use client'

import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Honours "reduce motion" for the half of this app that CSS cannot reach.
 *
 * `globals.css` already flattens `animation-duration` and `transition-duration`
 * under the media query, which covers the drifting motes, the rune pulse and
 * every hover transition. It cannot touch the springs: `motion/react` animates
 * transforms frame by frame in JavaScript, so a token sliding across the board,
 * a die tumbling and a bar draining all ran at full swing no matter what the
 * reader had asked their system for. Those are exactly the movements the
 * setting exists to stop.
 *
 * `reducedMotion="user"` follows the system preference and, when set, drops
 * transform and layout animations while leaving opacity and colour alone —
 * so a die still fades its result in rather than snapping, and nothing that
 * carried meaning is lost with the movement.
 *
 * A client boundary of its own so the root layout stays a server component.
 */
export function ReducedMotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
