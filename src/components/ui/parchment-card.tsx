'use client'

import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils.ts'

/**
 * Corner flourishes, drawn as four L-shaped brackets. Two borders on an absolutely
 * positioned box costs nothing and scales with the card; a corner image would be
 * four more requests and would blur when the card grows.
 */
function Flourishes() {
  const corner = 'pointer-events-none absolute size-3 border-amber-torch/50 transition-colors duration-300 group-hover:border-amber-torch'
  return (
    <span aria-hidden>
      <span className={cn(corner, '-top-px -left-px rounded-tl-[0.6rem] border-t border-l')} />
      <span className={cn(corner, '-top-px -right-px rounded-tr-[0.6rem] border-t border-r')} />
      <span className={cn(corner, '-bottom-px -left-px rounded-bl-[0.6rem] border-b border-l')} />
      <span className={cn(corner, '-right-px -bottom-px rounded-br-[0.6rem] border-r border-b')} />
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
        'group relative rounded-card border bg-surface/70 backdrop-blur-sm',
        'shadow-[0_10px_30px_-12px_rgb(0_0_0/0.8)] transition-all duration-300',
        selected
          ? 'border-amber-torch/80 bg-amber-torch/[0.07] shadow-torch'
          : 'border-edge',
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
