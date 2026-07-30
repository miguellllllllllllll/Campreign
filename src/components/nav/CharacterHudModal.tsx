'use client'

import * as Dialog from '@radix-ui/react-dialog'
import {
  Footprints,
  HeartHandshake,
  ShieldCheck,
  Swords,
  WandSparkles,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CharacterCard } from '../character/CharacterCard.tsx'
import { ExportPdfButton } from '../character/ExportPdfButton.tsx'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { ResourceBar } from '../ui/resource-bar.tsx'
import { CLASS_PRESETS } from '../../lib/dnd/presets.ts'
import { useActiveCharacter, useRosterHydrated } from '../../stores/characterStore.ts'
import type { ClassId } from '../../types/character.ts'

/** Only the five classes, so this stays exhaustive where the wizard's map cannot. */
const CLASS_ICONS: Record<ClassId, LucideIcon> = {
  fighter: Swords,
  wizard: WandSparkles,
  rogue: Footprints,
  cleric: HeartHandshake,
  paladin: ShieldCheck,
}

/**
 * A standing badge for whoever you are playing, reachable from every page.
 *
 * The badge itself is the "view sheet" control rather than a bar carrying a
 * separate button: at the size this sits next to the sound toggle, a second
 * target inside the first would be a worse tap target, not a better one.
 */
export function CharacterHudModal() {
  const hydrated = useRosterHydrated()
  const hero = useActiveCharacter()

  if (!hydrated || hero === null) return null

  const Icon = CLASS_ICONS[hero.classId]
  const klass = CLASS_PRESETS[hero.classId]

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          title={`${hero.name} — view character sheet`}
          className="fixed top-4 right-16 z-40 flex max-w-[13rem] items-center gap-2 rounded-full border border-edge bg-surface/80 py-1.5 pr-3 pl-2 text-left backdrop-blur-sm transition-colors hover:border-gold-border/70"
        >
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full border"
            style={{
              backgroundColor: `${hero.cosmetics.auraColor}26`,
              borderColor: hero.cosmetics.tokenBorder,
              color: hero.cosmetics.auraColor,
            }}
          >
            <Icon size={13} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-serif text-[11px] leading-tight font-semibold text-parchment">
              {hero.name}
            </span>
            <span className="mt-0.5 block w-20">
              <ResourceBar current={hero.currentHp} max={hero.maxHp} label="Hit points" />
            </span>
          </span>
          <span className="sr-only">View character sheet</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        {/*
          Radix portals to <body>, which escapes the layout's print:hidden
          wrapper — so the dialog has to opt out of printing itself, or an open
          sheet would print on top of the printable one.
        */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-obsidian/80 backdrop-blur-sm print:hidden" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[88vh] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto print:hidden">
          <Dialog.Title className="sr-only">
            {hero.name}, level {hero.level} {klass.label}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Your full character sheet. Every underlined label explains itself, and you can export
            the sheet for printing.
          </Dialog.Description>

          <CharacterCard character={hero} showPractice={false} />

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <ExportPdfButton size="md" />
            <Dialog.Close asChild>
              <FantasyButton variant="ghost" size="md">
                <X aria-hidden />
                Close
              </FantasyButton>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
