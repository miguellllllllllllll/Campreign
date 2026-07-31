import { OG_SIZE, ogCard } from '../og.tsx'

export const alt = 'Practice arena — swing freely, the dummy forgives'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return ogCard('Practice arena', 'Swing freely. The dummy forgives.')
}
