import { ImageResponse } from 'next/og'

/**
 * The card that shows up when somebody pastes the link.
 *
 * Built rather than drawn, so it can never drift from the site: the same ink,
 * the same gold, the same d20, the same sentence off the landing page.
 *
 * The wordmark wants Cinzel Decorative, which `next/font` only ever hands us as
 * woff2 — a format satori cannot parse — so the ttf is pulled at build time.
 * That fetch is allowed to fail. If it does the card renders in the bundled
 * default face, which is worse-looking and completely harmless; a social image
 * is not worth failing a deploy over.
 */

export const alt = 'Hero Step — learn D&D by playing it'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CINZEL_DECORATIVE_BOLD =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzeldecorative/CinzelDecorative-Bold.ttf'

const D20_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="150" height="150">
  <defs>
    <linearGradient id="gold" x1="16" y1="2.8" x2="16" y2="29.2" gradientUnits="userSpaceOnUse">
      <stop stop-color="#f4d97a"/><stop offset="1" stop-color="#c08b1f"/>
    </linearGradient>
  </defs>
  <path d="M16 2.8 28 9.6v12.8L16 29.2 4 22.4V9.6z" fill="url(#gold)"/>
  <path d="M16 9.4 23.2 22H8.8z" fill="#0d0b09"/>
</svg>`

async function displayFont(): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(CINZEL_DECORATIVE_BOLD)
    if (!response.ok) return null
    return await response.arrayBuffer()
  } catch {
    return null
  }
}

export default async function Image() {
  const font = await displayFont()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0d0b09',
          // The torch overhead, the same wash the landing page sits under.
          backgroundImage:
            'radial-gradient(900px 520px at 50% -10%, rgba(212,175,55,0.20), rgba(13,11,9,0) 70%)',
        }}
      >
        <img src={`data:image/svg+xml;base64,${btoa(D20_MARK)}`} width={150} height={150} alt="" />

        <div
          style={{
            display: 'flex',
            marginTop: 36,
            fontSize: 104,
            letterSpacing: 2,
            color: '#f0d68a',
            ...(font === null ? {} : { fontFamily: 'Cinzel Decorative' }),
          }}
        >
          HERO STEP
        </div>

        {/* The same hairline rule that divides the landing page. */}
        <div
          style={{
            display: 'flex',
            width: 520,
            height: 1,
            marginTop: 34,
            backgroundImage:
              'linear-gradient(90deg, rgba(212,175,55,0), rgba(212,175,55,0.85), rgba(212,175,55,0))',
          }}
        />

        <div
          style={{
            display: 'flex',
            marginTop: 34,
            maxWidth: 820,
            textAlign: 'center',
            fontSize: 34,
            lineHeight: 1.4,
            color: '#a89f8d',
          }}
        >
          Learn D&amp;D by actually playing it. Three questions build your hero, then every rule
          explains itself as you fight.
        </div>
      </div>
    ),
    {
      ...size,
      ...(font === null
        ? {}
        : { fonts: [{ name: 'Cinzel Decorative', data: font, weight: 700, style: 'normal' }] }),
    },
  )
}
