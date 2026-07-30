'use client'

import type { ReactNode } from 'react'
import { EXPLANATIONS, type ExplainKey } from '../lib/dnd/explanations.ts'
import { RulesTooltip } from './ui/rules-tooltip.tsx'

export interface ExplainProps {
  k: ExplainKey
  children: ReactNode
  className?: string
}

/**
 * Binds a rules term to its entry in the explanation registry. Presentation and
 * the hover/focus/tap behaviour live in RulesTooltip; this only resolves copy,
 * so there is exactly one place a beginner-facing sentence can come from.
 */
export function Explain({ k, children, className }: ExplainProps) {
  const { title, plain } = EXPLANATIONS[k]
  return (
    <RulesTooltip title={title} body={plain} className={className}>
      {children}
    </RulesTooltip>
  )
}
