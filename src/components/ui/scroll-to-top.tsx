'use client'

import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { playSound } from '../../lib/sound.ts'

/**
 * A way back to the top of a long page.
 *
 * Earned rather than decorative: character creation runs to several screens,
 * and the summary of what you have built so far sits at the top of it. Reading
 * back over your own choices meant a long drag every time.
 *
 * Hidden until there is something to scroll back from, so it never covers
 * content on the pages that fit — which is most of them.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    /*
     * Two screens' worth: far enough that the top is genuinely out of reach,
     * near enough that it appears before anyone starts hunting for it. Floored
     * at 480 because a viewport height of zero is not hypothetical — the
     * preview harness reports exactly that — and `0 * 1.5` would put the button
     * on screen at the first pixel of scroll.
     */
    const threshold = () => Math.max(window.innerHeight * 1.5, 480)
    const update = () => setVisible(window.scrollY > threshold())
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => {
        playSound('press')
        /*
         * Asked at the moment of the click rather than held in state, because
         * there is no reduced-motion hook here to read — `ReducedMotionProvider`
         * configures `motion/react` and exposes nothing. Honouring it matters:
         * a smooth scroll travelling several screens is exactly the movement
         * the preference exists to stop.
         */
        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' })
      }}
      title="Back to the top of the page"
      className={
        'fixed right-4 bottom-4 z-40 grid size-11 place-items-center rounded-full '
        + 'border border-edge bg-surface/85 text-muted backdrop-blur-sm '
        + 'shadow-[0_4px_16px_-4px_rgb(0_0_0/0.6)] transition-colors '
        + 'hover:border-gold-border/70 hover:text-amber-torch print:hidden'
      }
    >
      <ArrowUp size={17} aria-hidden />
      <span className="sr-only">Back to the top of the page</span>
    </button>
  )
}
