import { BookOpen, Dices, Sparkles, Swords } from 'lucide-react'
import Link from 'next/link'
import { Button } from '../components/ui/button.tsx'
import { Card, CardContent } from '../components/ui/card.tsx'
import { RosterStrip } from '../components/character/RosterStrip.tsx'

const PROMISES = [
  {
    icon: Swords,
    title: 'No character sheet to fill in',
    body: 'Answer three questions in plain English. Armour Class, hit points, attacks and skills are all worked out for you.',
  },
  {
    icon: Dices,
    title: 'No dice notation to learn',
    body: 'Press a button. Hero Step picks the dice, rolls them, and shows the arithmetic so you can see exactly why you hit.',
  },
  {
    icon: BookOpen,
    title: 'No rulebook to read first',
    body: 'Every piece of jargon is underlined. Hover it or tap it and you get one sentence of explanation, right where you are.',
  },
]

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-5 py-16">
      <header className="flex flex-col gap-4">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-gold-dim bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
          <Sparkles size={13} aria-hidden />
          Dungeons &amp; Dragons for absolute beginners
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-parchment sm:text-5xl">
          Hero Step
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          Learn to play D&amp;D by actually playing it. Build a hero in three questions, then fight
          your first goblin with the rules explained one step at a time.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/create">
              Build my hero
              <Dices aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/tutorial">Play the tutorial</Link>
          </Button>
        </div>
      </header>

      <RosterStrip />

      <section className="grid gap-4 sm:grid-cols-3">
        {PROMISES.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardContent className="flex flex-col gap-2 pt-5">
              <Icon size={20} className="text-gold" aria-hidden />
              <h2 className="font-semibold text-parchment">{title}</h2>
              <p className="text-sm leading-relaxed text-muted">{body}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}
