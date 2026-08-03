import type { Metadata } from 'next'
import { PracticeArena } from '../../components/character/PracticeArena.tsx'

export const metadata: Metadata = {
  title: 'Practice arena · Hero Step',
  description: 'Swing at a training dummy and watch every roll explain itself.',
}

export default function ArenaPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 pt-20 pb-10">
      <PracticeArena />
    </main>
  )
}
