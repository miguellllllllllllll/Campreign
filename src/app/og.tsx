import { ImageResponse } from 'next/og'

/**
 * The one social card, parameterised. Every route's opengraph-image.tsx calls
 * this with its own two lines, so the cards can never drift from each other —
 * same ink, same gold, same die, same face.
 *
 * Not a route file itself: only the metadata file conventions become routes,
 * so a plain module can live in `app/` beside them.
 *
 * Satori only parses ttf/otf, which rules out everything next/font holds, so
 * the display face is pulled at build time. The fetch is allowed to fail — the
 * card degrades to satori's default face rather than failing the build.
 */

export const OG_SIZE = { width: 1200, height: 630 }

const CINZEL_DECORATIVE_BOLD =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzeldecorative/CinzelDecorative-Bold.ttf'

/** The same die as `icon.svg`, so the tab and every shared card are one mark. */
const D20_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="140" height="140">
  <defs>
    <linearGradient id="gold" x1="16" y1="2.4" x2="16" y2="29.6" gradientUnits="userSpaceOnUse">
      <stop stop-color="#f4d97a"/><stop offset="1" stop-color="#c08b1f"/>
    </linearGradient>
  </defs>
  <g stroke="url(#gold)" fill="none" stroke-linejoin="round" stroke-linecap="round">
    <path d="M16 2.6 27.6 9.4v13.2L16 29.4 4.4 22.6V9.4z" stroke-width="2.2" fill="#d4af37" fill-opacity="0.16"/>
    <path d="M16 9.2 22.9 21.4H9.1z" stroke-width="1.9"/>
    <path d="M16 9.2V2.6M9.1 21.4 4.4 22.6M22.9 21.4l4.7 1.2" stroke-width="1.7"/>
  </g>
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

export async function ogCard(title: string, subtitle: string): Promise<ImageResponse> {
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
        {/* Satori JSX, not the DOM: next/image cannot render here, and the src
            is an inline data URI with nothing for a loader to optimise. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;base64,${btoa(D20_MARK)}`} width={140} height={140} alt="" />

        <div
          style={{
            display: 'flex',
            marginTop: 36,
            // The route titles vary from nine letters to twenty-four; one size
            // would either shout the short ones or wrap the long ones.
            fontSize: title.length > 16 ? 72 : 104,
            letterSpacing: 2,
            color: '#f0d68a',
            textAlign: 'center',
            maxWidth: 1080,
          }}
        >
          {title.toUpperCase()}
        </div>

        {/* The same hairline rule that divides the landing page. */}
        <div
          style={{
            display: 'flex',
            width: 560,
            height: 1,
            marginTop: 36,
            backgroundImage:
              'linear-gradient(90deg, rgba(212,175,55,0), rgba(212,175,55,0.85), rgba(212,175,55,0))',
          }}
        />

        <div
          style={{
            display: 'flex',
            marginTop: 34,
            fontSize: 34,
            letterSpacing: 3,
            color: '#a89f8d',
            textAlign: 'center',
            maxWidth: 1000,
          }}
        >
          {subtitle.toUpperCase()}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      ...(font === null
        ? {}
        : { fonts: [{ name: 'Cinzel Decorative', data: font, weight: 700, style: 'normal' }] }),
    },
  )
}
