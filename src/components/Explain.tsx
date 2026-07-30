'use client'

import * as Popover from '@radix-ui/react-popover'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useEffect, useState, type ReactNode } from 'react'
import { EXPLANATIONS, type ExplainKey } from '../lib/dnd/explanations.ts'
import { cn } from '../lib/utils.ts'

const TRIGGER_CLASS =
  'cursor-help underline decoration-gold/50 decoration-dotted decoration-from-font '
  + 'underline-offset-4 hover:decoration-gold focus-visible:decoration-gold'

const PANEL_CLASS =
  'z-50 max-w-72 rounded-lg border border-edge-bright bg-surface-raised px-3.5 py-2.5 '
  + 'text-left shadow-xl shadow-black/60'

function Panel({ explainKey }: { explainKey: ExplainKey }) {
  const { title, plain } = EXPLANATIONS[explainKey]
  return (
    <>
      <p className="text-sm font-semibold text-gold">{title}</p>
      <p className="mt-1 text-sm leading-snug text-parchment">{plain}</p>
    </>
  )
}

/**
 * Touch devices get a tapped popover; everything else gets a tooltip on hover
 * and on keyboard focus. A modal on hover would trap focus and fire on
 * accidental pointer passes, so it is deliberately not used here.
 */
function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(hover: none)')
    setIsTouch(query.matches)
    const onChange = (event: MediaQueryListEvent) => setIsTouch(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return isTouch
}

export interface ExplainProps {
  k: ExplainKey
  children: ReactNode
  className?: string
}

export function Explain({ k, children, className }: ExplainProps) {
  const isTouch = useIsTouch()

  if (isTouch) {
    return (
      <Popover.Root>
        <Popover.Trigger className={cn(TRIGGER_CLASS, className)}>{children}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className={PANEL_CLASS} sideOffset={6} collisionPadding={12}>
            <Panel explainKey={k} />
            <Popover.Arrow className="fill-edge-bright" />
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
            <Panel explainKey={k} />
            <Tooltip.Arrow className="fill-edge-bright" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
