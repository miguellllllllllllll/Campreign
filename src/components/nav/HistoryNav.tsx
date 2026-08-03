'use client'

import { ArrowLeft, ArrowRight, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { playSound } from '../../lib/sound.ts'

/**
 * Back, forward and home, fixed to the corner opposite the sound toggle.
 *
 * Rendered from the root layout rather than page by page, because "every page
 * has one" is a promise a shared component can keep and four separate call
 * sites cannot — a fifth route would simply forget.
 *
 * The hard part is not the buttons, it is knowing whether they lead anywhere.
 * There is no browser API for "is there forward history": `history.length`
 * counts entries in the whole tab including ones from before this app, and
 * nothing reports the cursor's position within them. So this stamps its own
 * index onto each history entry and remembers the furthest one reached. An
 * entry that arrives without a stamp is a fresh push, which also truncates
 * anything that was ahead of it — the same thing the browser does to its own
 * forward stack.
 */
const INDEX_KEY = '__heroStepHistoryIndex'
const FURTHEST_KEY = 'heroStep.historyFurthest'

interface Position {
  index: number
  furthest: number
}

function readStampedIndex(): number | undefined {
  const state: unknown = window.history.state
  if (typeof state !== 'object' || state === null) return undefined
  const stamped = (state as Record<string, unknown>)[INDEX_KEY]
  return typeof stamped === 'number' ? stamped : undefined
}

function stamp(index: number): void {
  // Spread what is already there: Next.js keeps its own routing state on the
  // history entry, and replacing it wholesale breaks its navigation.
  const existing = typeof window.history.state === 'object' && window.history.state !== null
    ? (window.history.state as Record<string, unknown>)
    : {}
  window.history.replaceState({ ...existing, [INDEX_KEY]: index }, '')
}

export function HistoryNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [position, setPosition] = useState<Position>({ index: 0, furthest: 0 })
  /*
   * Mirrors `position.index` for the effect below, which must not re-run when
   * the position changes — only when the route does. Reading state there would
   * mean listing it as a dependency and re-stamping on our own update.
   */
  const indexRef = useRef(0)

  useEffect(() => {
    const stamped = readStampedIndex()
    const stored = Number(window.sessionStorage.getItem(FURTHEST_KEY) ?? '0')
    const furthest = Number.isFinite(stored) ? stored : 0

    if (stamped === undefined) {
      // A push. It becomes the newest entry, so nothing is ahead of it.
      const next = indexRef.current + 1
      // …unless it is the very first page of the session, which is index 0.
      const index = window.sessionStorage.getItem(FURTHEST_KEY) === null ? 0 : next
      stamp(index)
      indexRef.current = index
      window.sessionStorage.setItem(FURTHEST_KEY, String(index))
      setPosition({ index, furthest: index })
      return
    }

    indexRef.current = stamped
    setPosition({ index: stamped, furthest: Math.max(furthest, stamped) })
  }, [pathname])

  const canGoBack = position.index > 0
  const canGoForward = position.index < position.furthest

  return (
    <nav
      aria-label="Page history"
      className="fixed top-4 left-4 z-40 flex items-center gap-1.5 print:hidden"
    >
      <HistoryButton
        label="Go back"
        enabled={canGoBack}
        disabledReason="You are at the first page you opened"
        onActivate={() => router.back()}
      >
        <ArrowLeft size={15} aria-hidden />
      </HistoryButton>
      <HistoryButton
        label="Go forward"
        enabled={canGoForward}
        disabledReason="Nothing to go forward to — this is the newest page"
        onActivate={() => router.forward()}
      >
        <ArrowRight size={15} aria-hidden />
      </HistoryButton>
      <HistoryButton
        label="Go to the front page"
        enabled={pathname !== '/'}
        disabledReason="You are already on the front page"
        onActivate={() => router.push('/')}
      >
        <Home size={15} aria-hidden />
      </HistoryButton>
    </nav>
  )
}

function HistoryButton({
  label,
  enabled,
  disabledReason,
  onActivate,
  children,
}: {
  label: string
  enabled: boolean
  disabledReason: string
  onActivate: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      /*
       * `aria-disabled` rather than `disabled`, matching FantasyButton and for
       * the same stated reason: an unavailable control here carries the sentence
       * explaining why, and `disabled` takes it out of the tab order where
       * nobody using a keyboard will ever hear it.
       */
      aria-disabled={!enabled}
      title={enabled ? label : disabledReason}
      onClick={() => {
        if (!enabled) return
        playSound('press')
        onActivate()
      }}
      className={
        'grid size-9 place-items-center rounded-full border border-edge bg-surface/80 '
        + 'text-muted backdrop-blur-sm transition-colors '
        + 'hover:border-gold-border/70 hover:text-amber-torch '
        + 'aria-disabled:cursor-not-allowed aria-disabled:opacity-40 '
        + 'aria-disabled:hover:border-edge aria-disabled:hover:text-muted'
      }
    >
      {children}
      <span className="sr-only">{enabled ? label : disabledReason}</span>
    </button>
  )
}
