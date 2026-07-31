import { OG_SIZE, ogCard } from '../og.tsx'

export const alt = 'The Goblin in the Cellar — your first fight, explained step by step'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return ogCard('The Goblin in the Cellar', 'Your first fight, explained step by step')
}
