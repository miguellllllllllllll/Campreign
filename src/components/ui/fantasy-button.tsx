'use client'

import { Slot, Slottable } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, MouseEvent, PointerEvent } from 'react'
import { playSound } from '../../lib/sound.ts'
import { cn } from '../../lib/utils.ts'

const fantasyButtonVariants = cva(
  'group relative inline-flex select-none items-center justify-center gap-2 overflow-hidden '
    + 'rounded-xl font-serif font-semibold tracking-wide '
    + 'transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out '
    // Pressed rather than shrunk. Each variant carries a hard offset underside,
    // so travelling down by exactly that offset reads as the button meeting the
    // surface — a scale on its own reads as the whole control getting smaller.
    + 'hover:-translate-y-px active:translate-y-[3px] '
    + 'disabled:pointer-events-none disabled:opacity-40 disabled:saturate-50 '
    // `aria-disabled` looks identical but stays in the tab order, which is the
    // whole reason it exists here: an unavailable button in this app carries
    // the reason it is unavailable — "too far, move closer" — and `disabled`
    // hides that sentence from anyone not using a mouse.
    + 'aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:saturate-50 '
    + 'aria-disabled:hover:translate-y-0 aria-disabled:active:translate-y-0 '
    + '[&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Struck brass: a light top edge, a dark underside, and a gold rim on hover.
        brass:
          'border-2 border-[#ffdc7a] bg-gradient-to-b from-[#ffdc7a] via-amber-torch to-[#e8a41f] '
          + 'text-obsidian shadow-[inset_0_2px_0_rgb(255_255_255/0.45),0_4px_0_#a8701a,0_8px_16px_-6px_rgb(0_0_0/0.6)] '
          + 'hover:brightness-105 hover:shadow-[inset_0_2px_0_rgb(255_255_255/0.5),0_4px_0_#a8701a,0_0_24px_rgb(255_198_63/0.45)] '
          + 'active:shadow-[inset_0_2px_5px_rgb(0_0_0/0.35),0_1px_0_#a8701a]',
        // Cold iron: the quieter sibling, for anything that is not the main path.
        iron:
          'border-2 border-edge-bright bg-gradient-to-b from-[#7b502a] to-[#4a2c14] text-parchment '
          + 'shadow-[inset_0_2px_0_rgb(253_243_218/0.14),0_4px_0_#2b1a09,0_8px_16px_-6px_rgb(0_0_0/0.6)] '
          + 'hover:border-gold-border hover:text-amber-torch '
          + 'hover:shadow-[inset_0_2px_0_rgb(253_243_218/0.18),0_4px_0_#2b1a09,0_0_20px_rgb(255_198_63/0.3)] '
          + 'active:shadow-[inset_0_2px_5px_rgb(0_0_0/0.5),0_1px_0_#2b1a09]',
        ghost:
          'border border-transparent text-muted hover:border-edge hover:bg-surface-raised/70 '
          + 'hover:text-parchment',
        // Bright paint with dark lettering, which is the casual-kit pairing and
        // also the only one that clears AA: a red light enough to look pressed
        // out of plastic cannot carry parchment — #e05a48 under pale text is
        // 3.22:1 — but it carries the teal of the room at better than 5.
        blood:
          'border-2 border-[#ffab9b] bg-gradient-to-b from-[#ffab9b] to-[#f8806c] text-obsidian '
          + 'shadow-[inset_0_2px_0_rgb(255_255_255/0.4),0_4px_0_#b8503f,0_8px_16px_-6px_rgb(0_0_0/0.6)] '
          + 'hover:brightness-105 hover:shadow-[inset_0_2px_0_rgb(255_255_255/0.45),0_4px_0_#b8503f,0_0_22px_rgb(255_147_133/0.45)] '
          + 'active:shadow-[inset_0_2px_5px_rgb(0_0_0/0.3),0_1px_0_#b8503f]',
        // Rulebook crimson, for the ribbon-and-seal look: structure rather than
        // action, which is why it stays dark while `blood` went bright. It is
        // also the one red here a pale letter still clears — 4.73:1 on the
        // base, 4.58:1 on the hover.
        crimson:
          'border-2 border-gold-border/70 bg-gradient-to-b from-dnd-red to-dnd-red-hover text-parchment '
          + 'shadow-[inset_0_2px_0_rgb(255_255_255/0.18),0_4px_0_#8a2118,0_8px_16px_-6px_rgb(0_0_0/0.6)] '
          + 'hover:border-gold-border '
          + 'hover:shadow-[inset_0_2px_0_rgb(255_255_255/0.22),0_4px_0_#8a2118,0_0_22px_rgb(200_54_43/0.5)] '
          + 'active:shadow-[inset_0_2px_5px_rgb(0_0_0/0.35),0_1px_0_#8a2118]',
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
  'aria-disabled': ariaDisabled,
  ...props
}: FantasyButtonProps) {
  const Component = asChild ? Slot : 'button'

  /** ARIA takes the string form as readily as the boolean, so both count. */
  const inert = ariaDisabled === true || ariaDisabled === 'true'

  function handlePointerEnter(event: PointerEvent<HTMLButtonElement>) {
    // Pen and touch "enter" on the way to a tap, which would double up with press.
    if (event.pointerType === 'mouse' && !inert) playSound('hover')
    onPointerEnter?.(event)
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // `aria-disabled` is a claim, not an enforcement — the browser still
    // delivers the click, so the refusal has to be written out. Silently, too:
    // a press sound on a button that does nothing reads as a bug.
    if (inert) {
      event.preventDefault()
      return
    }
    playSound('press')
    onClick?.(event)
  }

  return (
    <Component
      className={cn(fantasyButtonVariants({ variant, size }), className)}
      onPointerEnter={handlePointerEnter}
      onClick={handleClick}
      aria-disabled={ariaDisabled}
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
