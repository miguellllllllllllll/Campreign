import type { Metadata } from 'next'
import { TutorialRunner } from '../../components/tutorial/TutorialRunner.tsx'

export const metadata: Metadata = {
  title: 'The Goblin in the Cellar · Hero Step',
  description: 'Learn exploration, conversation and combat in one short adventure.',
}

export default function TutorialPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-5 pt-20 pb-10">
      <TutorialRunner />
    </main>
  )
}
