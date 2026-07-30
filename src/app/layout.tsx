import type { Metadata } from 'next'
import { Cinzel, Cinzel_Decorative, Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { PrintOverlay } from '../components/character/PrintOverlay.tsx'
import { SoundToggle } from '../components/ui/sound-toggle.tsx'
import './globals.css'

/** Titles only — a decorative serif is unreadable at body sizes. */
const cinzelDecorative = Cinzel_Decorative({
  variable: '--font-cinzel-decorative',
  weight: ['700', '900'],
  subsets: ['latin'],
})

const cinzel = Cinzel({
  variable: '--font-cinzel',
  subsets: ['latin'],
})

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
})

/** Kept for stat blocks and dice maths, where digits must not shift width. */
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Hero Step — learn D&D by playing it',
  description:
    'Build a Dungeons & Dragons character in three plain-English questions, then fight your first goblin with every rule explained as you go.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${cinzelDecorative.variable} ${cinzel.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-torchlight relative flex min-h-full flex-col">
        {/*
          `contents` keeps this wrapper invisible to layout on screen, so the body's
          flex column still applies to the page itself. Printing collapses it to
          `display: none`, which is what clears the screen UI off the paper.
        */}
        <div className="contents print:hidden">
          {/* Drifting motes, behind everything and inert to the pointer. */}
          <div
            aria-hidden
            className="bg-motes animate-ember-drift pointer-events-none fixed inset-0 -z-10 opacity-60"
          />
          <SoundToggle />
          {children}
        </div>
        <PrintOverlay />
      </body>
    </html>
  )
}
