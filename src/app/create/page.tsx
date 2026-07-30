import type { Metadata } from 'next'
import { CreatorWizard } from '../../components/character/CreatorWizard.tsx'

export const metadata: Metadata = {
  title: 'Create your hero · Hero Step',
  description: 'Answer three plain-English questions and get a complete D&D character sheet.',
}

export default function CreatePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <CreatorWizard />
    </main>
  )
}
