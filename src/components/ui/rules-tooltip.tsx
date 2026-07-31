'use client'

import * as Popover from '@radix-ui/react-popover'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useSyncExternalStore, type ReactNode } from 'react'
import { cn } from '../../lib/utils.ts'

const TRIGGER_CLASS =
  'cursor-help font-medium text-parchment underline decoration-amber-torch/50 decoration-dotted '
  + 'decoration-from-font underline-offset-4 transition-colors '
  + 'hover:text-amber-torch hover:decoration-amber-torch focus-visible:decoration-amber-torch'

const PANEL_CLASS =
  'animate-scroll-unfurl z-50 max-w-72 rounded-md border border-gold-border/60 px-3.5 py-3 text-left '
  + 'bg-gradient-to-b from-[#1c2130] to-[#10131c] '
  + 'shadow-[inset_0_1px_0_rgb(244_232_193/0.1),0_0_24px_rgb(212_175_55/0.14),0_16px_36px_-12px_rgb(0_0_0/0.9)]'

/**
 * Touch devices get a tapped popover; everything else gets a tooltip on hover
 * and on keyboard focus. A modal on hover would trap focus and fire on
 * accidental pointer passes, so it is deliberately not used here.
 */
const HOVERLESS = '(hover: none)'

function useIsTouch(): boolean {
  /*
   * The server has no matchMedia, so the server snapshot is a flat `false`:
   * render the hover tooltip, and correct to the popover on the client if the
   * device turns out to be touch. Guessing the other way would show a tapped
   * popover to every mouse user for one frame.
   */
  return useSyncExternalStore(
    (onStoreChange) => {
      const query = window.matchMedia(HOVERLESS)
      query.addEventListener('change', onStoreChange)
      return () => query.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(HOVERLESS).matches,
    () => false,
  )
}

function Scroll({ title, body }: { title: string; body: ReactNode }) {
  return (
    <>
      <p className="font-serif text-sm font-semibold tracking-wide text-amber-torch">{title}</p>
      {/* The hairline stands in for the rod of a scroll. */}
      <span
        aria-hidden
        className="mt-1.5 mb-2 block h-px bg-gradient-to-r from-gold-border/70 via-gold-border/25 to-transparent"
      />
      <p className="text-sm leading-snug text-parchment/90">{body}</p>
    </>
  )
}

export interface RulesTooltipProps {
  /** The term being defined, e.g. "Armour Class". */
  title: string
  /** One or two sentences of plain English. */
  body: ReactNode
  children: ReactNode
  className?: string
}

/** A scroll-styled gloss on a rules term, on hover, on focus, or on tap. */
export function RulesTooltip({ title, body, children, className }: RulesTooltipProps) {
  const isTouch = useIsTouch()

  if (isTouch) {
    return (
      <Popover.Root>
        <Popover.Trigger className={cn(TRIGGER_CLASS, className)}>{children}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className={PANEL_CLASS} sideOffset={6} collisionPadding={12}>
            <Scroll title={title} body={body} />
            <Popover.Arrow className="fill-gold-border/60" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button type="button" className={cn(TRIGGER_CLASS, className)}>
            {children}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className={PANEL_CLASS} sideOffset={6} collisionPadding={12}>
            <Scroll title={title} body={body} />
            <Tooltip.Arrow className="fill-gold-border/60" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
