'use client'

import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils.ts'

/**
 * Corner filigree, masked out of one CC0 frame — see NOTICE and the
 * `corner-filigree` utility.
 *
 * These were four L-shaped brackets built from CSS borders, and the note here
 * said a corner image would be four more requests and would blur as the card
 * grew. Both objections are answered rather than ignored: it is one request,
 * not four, because a single 48×48 frame is held at its native size and each
 * corner shows a different window into it; and nothing blurs, because the
 * corners stay 16px however large the card gets — filigree is a fixed detail
 * on a panel, not something that scales with it.
 */
function Flourishes() {
  const corner = 'pointer-events-none absolute size-4 corner-filigree text-amber-torch/60 transition-colors duration-300 group-hover:text-amber-torch'
  return (
    <span aria-hidden>
      <span className={cn(corner, 'corner-at-tl -top-px -left-px')} />
      <span className={cn(corner, 'corner-at-tr -top-px -right-px')} />
      <span className={cn(corner, 'corner-at-bl -bottom-px -left-px')} />
      <span className={cn(corner, 'corner-at-br -right-px -bottom-px')} />
    </span>
  )
}

export interface ParchmentCardProps extends ComponentProps<'div'> {
  /** Adds a torchlit lift on hover. Off for static panels that are not interactive. */
  interactive?: boolean
  /** Marks the card as chosen: a full gold rim and a warm inner wash. */
  selected?: boolean
}

export function ParchmentCard({
  className,
  interactive = false,
  selected = false,
  children,
  ...props
}: ParchmentCardProps) {
  return (
    <div
      className={cn(
        'group relative rounded-card border-2 bg-surface/70 texture-grain panel-carved backdrop-blur-sm',
        'transition-all duration-300',
        selected
          ? 'border-amber-torch/80 bg-amber-torch/[0.07] shadow-torch'
          : 'border-edge-bright',
        interactive && !selected && 'hover:-translate-y-0.5 hover:border-gold-border/70 hover:shadow-torch',
        className,
      )}
      {...props}
    >
      {/* A soft gradient sheen so the surface reads as glass, not flat fill. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-card bg-gradient-to-br from-parchment/[0.04] via-transparent to-transparent"
      />
      <Flourishes />
      {children}
    </div>
  )
}

export function ParchmentCardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('relative flex flex-col gap-1 p-5 pb-3', className)} {...props} />
}

export function ParchmentCardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('font-serif text-lg font-semibold tracking-wide text-parchment', className)}
      {...props}
    />
  )
}

export function ParchmentCardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm leading-relaxed text-muted', className)} {...props} />
}

export function ParchmentCardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('relative p-5 pt-0', className)} {...props} />
}

export function ParchmentCardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('relative flex items-center gap-2 p-5 pt-0', className)} {...props} />
  )
}
