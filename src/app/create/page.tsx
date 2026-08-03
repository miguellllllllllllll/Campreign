import type { Metadata } from 'next'
import { CreatorWizard } from '../../components/character/CreatorWizard.tsx'

export const metadata: Metadata = {
  title: 'Create your hero · Hero Step',
  description: 'Answer a handful of plain-English questions and get a complete D&D character sheet.',
}

export default function CreatePage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-5 pt-20 pb-10">
      <CreatorWizard />
    </main>
  )
}
