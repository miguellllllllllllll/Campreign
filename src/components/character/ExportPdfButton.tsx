'use client'

import { Printer } from 'lucide-react'
import { FantasyButton, type FantasyButtonProps } from '../ui/fantasy-button.tsx'

/**
 * Hands the sheet to the browser's own print dialog, which is also where "Save
 * as PDF" lives. No PDF library ships to the client for this — the browser
 * already has a better renderer than anything we would bundle.
 */
export function ExportPdfButton({
  variant = 'iron',
  size = 'lg',
  ...props
}: Omit<FantasyButtonProps, 'onClick' | 'asChild'>) {
  return (
    <FantasyButton
      variant={variant}
      size={size}
      // The button must not appear on the sheet it prints.
      className="no-print"
      onClick={() => window.print()}
      {...props}
    >
      <Printer aria-hidden />
      Export printable sheet
    </FantasyButton>
  )
}
