'use client'

import { Slot, Slottable } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, MouseEvent, PointerEvent } from 'react'
import { playSound } from '../../lib/sound.ts'
import { cn } from '../../lib/utils.ts'

const fantasyButtonVariants = cva(
  'group relative inline-flex select-none items-center justify-center gap-2 overflow-hidden '
    + 'rounded-lg font-serif font-semibold tracking-wide '
    + 'transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out '
    + 'hover:-translate-y-px active:translate-y-0 active:scale-[0.98] '
    + 'disabled:pointer-events-none disabled:opacity-40 disabled:saturate-50 '
    + '[&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Struck brass: a light top edge, a dark underside, and a gold rim on hover.
        brass:
          'border border-gold-border/70 bg-gradient-to-b from-[#e2c05c] via-amber-torch to-[#a8842c] '
          + 'text-obsidian shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_2px_0_#6b5527,0_6px_14px_-6px_rgb(0_0_0/0.9)] '
          + 'hover:border-parchment/60 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_2px_0_#6b5527,0_0_22px_rgb(212_175_55/0.4)] '
          + 'active:shadow-[inset_0_2px_4px_rgb(0_0_0/0.4),0_0_14px_rgb(212_175_55/0.25)]',
        // Cold iron: the quieter sibling, for anything that is not the main path.
        iron:
          'border border-edge bg-gradient-to-b from-surface-raised to-[#12161f] text-parchment '
          + 'shadow-[inset_0_1px_0_rgb(244_232_193/0.06),0_4px_10px_-6px_rgb(0_0_0/0.9)] '
          + 'hover:border-gold-border/70 hover:text-amber-torch hover:shadow-torch '
          + 'active:shadow-[inset_0_2px_4px_rgb(0_0_0/0.5)]',
        ghost:
          'border border-transparent text-muted hover:border-edge hover:bg-surface-raised/70 '
          + 'hover:text-parchment',
        blood:
          'border border-blood/60 bg-gradient-to-b from-[#d4564a] to-[#8e2f27] text-parchment '
          + 'shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_2px_0_#5e1f19,0_6px_14px_-6px_rgb(0_0_0/0.9)] '
          + 'hover:border-parchment/50 hover:shadow-[0_0_22px_rgb(192_70_59/0.4)]',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'brass', size: 'md' },
  },
)

export type FantasyButtonProps = ComponentProps<'button'>
  & VariantProps<typeof fantasyButtonVariants>
  & { asChild?: boolean }

export function FantasyButton({
  className,
  variant,
  size,
  asChild = false,
  onClick,
  onPointerEnter,
  children,
  ...props
}: FantasyButtonProps) {
  const Component = asChild ? Slot : 'button'

  function handlePointerEnter(event: PointerEvent<HTMLButtonElement>) {
    // Pen and touch "enter" on the way to a tap, which would double up with press.
    if (event.pointerType === 'mouse') playSound('hover')
    onPointerEnter?.(event)
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    playSound('press')
    onClick?.(event)
  }

  return (
    <Component
      className={cn(fantasyButtonVariants({ variant, size }), className)}
      onPointerEnter={handlePointerEnter}
      onClick={handleClick}
      {...props}
    >
      {/* A highlight that wipes across the face on hover. Purely decorative. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full motion-reduce:hidden"
      />
      <Slottable>{children}</Slottable>
    </Component>
  )
}

export { fantasyButtonVariants }
