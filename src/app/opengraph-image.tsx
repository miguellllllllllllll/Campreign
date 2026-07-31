import { OG_SIZE, ogCard } from './og.tsx'

/**
 * The root card. The design and its reasoning live in `og.tsx`, shared with
 * the per-route cards so none of them can drift from the others.
 */

export const alt = 'Hero Step — learn D&D by playing it'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return ogCard('Hero Step', 'Learn D&D by playing it')
}
