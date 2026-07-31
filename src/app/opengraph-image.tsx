import { ImageResponse } from 'next/og'

/**
 * The card that shows up when somebody pastes the link.
 *
 * Built rather than drawn, so it can never drift from the site: the same ink,
 * the same gold, the same d20, the same sentence off the tab title.
 *
 * One font, and that decides the layout. Satori has no font stack to fall
 * through — the single supplied face becomes the default for every glyph on the
 * card — and Cinzel Decorative is a title face that layout.tsx explicitly bans
 * at body sizes. Rather than ship a second ttf (the static ones large enough to
 * cover Latin are 440–650KB, and satori's whole bundle budget is 500KB), the
 * card says one short line and says it in the display face, which is what a
 * display face is for.
 *
 * The fetch is allowed to fail. If it does the card renders in satori's bundled
 * default and the build still succeeds; a social image is not worth a red
 * deploy.
 */

export const alt = 'Hero Step — learn D&D by playing it'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Only ttf and otf parse in satori, which rules out everything next/font holds. */
const CINZEL_DECORATIVE_BOLD =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzeldecorative/CinzelDecorative-Bold.ttf'

/** The same die as `icon.svg`, so the tab and the shared card are one mark. */
const D20_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="150" height="150">
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
            marginTop: 40,
            fontSize: 108,
            letterSpacing: 2,
            color: '#f0d68a',
          }}
        >
          HERO STEP
        </div>

        {/* The same hairline rule that divides the landing page. */}
        <div
          style={{
            display: 'flex',
            width: 560,
            height: 1,
            marginTop: 40,
            backgroundImage:
              'linear-gradient(90deg, rgba(212,175,55,0), rgba(212,175,55,0.85), rgba(212,175,55,0))',
          }}
        />

        <div
          style={{
            display: 'flex',
            marginTop: 38,
            fontSize: 38,
            letterSpacing: 3,
            color: '#a89f8d',
          }}
        >
          LEARN D&amp;D BY PLAYING IT
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
