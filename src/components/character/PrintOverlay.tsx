'use client'

import { PrintableCharacterSheet } from './PrintableCharacterSheet.tsx'
import { useActiveCharacter, useRosterHydrated } from '../../stores/characterStore.ts'

/**
 * The character sheet, mounted app-wide and invisible until the browser prints.
 *
 * Living at the root means any Export button anywhere can just call
 * `window.print()` — there is no sheet to route to and no state to hand over.
 *
 * Deliberately not absolutely positioned: the app's own chrome is hidden for
 * print instead, and taking the sheet out of flow tends to produce a trailing
 * blank page when content is taller than one sheet.
 */
export function PrintOverlay() {
  const hydrated = useRosterHydrated()
  const hero = useActiveCharacter()

  // Persisted data must not render before hydration, or the markup disagrees
  // with the server's.
  if (!hydrated || hero === null) return null

  return (
    <div className="hidden print:block">
      <PrintableCharacterSheet character={hero} />
    </div>
  )
}
