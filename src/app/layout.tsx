import type { Metadata } from 'next'
import {
  Alegreya,
  Cinzel,
  Cinzel_Decorative,
  Geist_Mono,
  Plus_Jakarta_Sans,
} from 'next/font/google'
import { PrintOverlay } from '../components/character/PrintOverlay.tsx'
import { CharacterHudModal } from '../components/nav/CharacterHudModal.tsx'
import { ReducedMotionProvider } from '../components/ui/reduced-motion.tsx'
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

/**
 * The rulebook voice. A warm literary serif for narrative and rules prose —
 * everything a player reads rather than scans. Italic is loaded because flavour
 * text is set in it throughout.
 */
const alegreya = Alegreya({
  variable: '--font-alegreya',
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
})

/** Kept for stat blocks and dice maths, where digits must not shift width. */
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  // Required for the generated social card to resolve to an absolute URL —
  // without it every share renders as a bare link.
  metadataBase: new URL('https://hero-step.vercel.app'),
  title: 'Hero Step — learn D&D by playing it',
  description:
    'Build a Dungeons & Dragons character in three plain-English questions, then fight your first goblin with every rule explained as you go.',
  openGraph: {
    type: 'website',
    siteName: 'Hero Step',
    title: 'Hero Step — learn D&D by playing it',
    description:
      'Build a Dungeons & Dragons character in three plain-English questions, then fight your first goblin with every rule explained as you go.',
  },
  // Images are inherited from openGraph, which opengraph-image.tsx supplies.
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${cinzelDecorative.variable} ${cinzel.variable} ${jakarta.variable} ${alegreya.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-torchlight relative flex min-h-full flex-col">
        <ReducedMotionProvider>
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
            <CharacterHudModal />
            {children}
          </div>
          <PrintOverlay />
        </ReducedMotionProvider>
      </body>
    </html>
  )
}
