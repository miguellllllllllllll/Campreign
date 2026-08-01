import { BookOpen, Dices, Shield, Sparkles, Swords } from 'lucide-react'
import Link from 'next/link'
import { FantasyButton } from '../components/ui/fantasy-button.tsx'
import {
  ParchmentCard,
  ParchmentCardContent,
} from '../components/ui/parchment-card.tsx'
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
    <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-5 py-16">
      {/* The torch itself: a warm bloom behind the title that breathes. */}
      <div
        aria-hidden
        className="animate-torch-flicker pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-amber-torch/12 blur-[90px]"
      />

      <header className="flex flex-col items-start gap-5">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full banner-dnd-red ribbon-tail-right border border-gold-border/60 px-4 py-1 font-serif text-xs font-semibold tracking-widest uppercase">
          <Sparkles size={13} className="animate-rune-pulse" aria-hidden />
          D&amp;D for absolute beginners
        </span>

        <h1 className="font-display text-table-ink text-5xl leading-tight font-black drop-shadow-[0_1px_0_rgb(255_255_255/0.35)] sm:text-6xl">
          Hero Step
        </h1>

        {/* A divider with an ornament at its centre, the way a rulebook breaks a
            section. The ornament is masked rather than drawn as an image, so it
            takes `text-gold-border` the same way the hand-drawn icons do.

            Two copies, the second mirrored: the source art is a half-divider
            running into a terminal at one end, so a single copy sits lopsided
            between the two rules. Butted together, the terminals meet and make
            one symmetrical medallion. */}
        <div aria-hidden className="flex w-full max-w-md items-center gap-3 text-edge">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-edge/70" />
          <span className="flex shrink-0 items-center">
            <span className="rule-ornament h-5 w-20" />
            <span className="rule-ornament h-5 w-20 -scale-x-100" />
          </span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-edge/70" />
        </div>

        <p className="max-w-2xl font-serif text-lg leading-relaxed text-table-ink/85">
          Learn to play D&amp;D by actually playing it. Build a hero in three questions, then fight
          your first goblin with the rules explained one step at a time.
        </p>

        <div className="flex flex-wrap gap-3">
          <FantasyButton asChild size="lg">
            <Link href="/create">
              Build my hero
              <Dices aria-hidden />
            </Link>
          </FantasyButton>
          <FantasyButton asChild variant="iron" size="lg">
            <Link href="/tutorial">
              Play the tutorial
              <Shield aria-hidden />
            </Link>
          </FantasyButton>
        </div>
      </header>

      <RosterStrip />

      <section className="grid gap-4 sm:grid-cols-3">
        {PROMISES.map(({ icon: Icon, title, body }) => (
          <ParchmentCard key={title} interactive>
            <ParchmentCardContent className="flex flex-col gap-2.5 pt-6">
              <span className="grid size-10 place-items-center rounded-lg border border-gold-border/40 bg-amber-torch/10 text-amber-torch transition-all duration-300 group-hover:border-gold-border group-hover:shadow-torch">
                <Icon size={19} aria-hidden />
              </span>
              <h2 className="font-serif font-semibold tracking-wide text-parchment">{title}</h2>
              <p className="text-sm leading-relaxed text-muted">{body}</p>
            </ParchmentCardContent>
          </ParchmentCard>
        ))}
      </section>
    </main>
  )
}
