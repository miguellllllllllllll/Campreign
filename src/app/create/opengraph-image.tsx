import { OG_SIZE, ogCard } from '../og.tsx'

export const alt = 'Build your hero — three questions, a full character sheet'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return ogCard('Build your hero', 'Three questions. A full character sheet.')
}
