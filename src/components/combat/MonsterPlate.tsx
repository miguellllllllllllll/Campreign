import { CreatureToken } from '../ui/creature-icons.tsx'
import { Explain } from '../Explain.tsx'
import type { MonsterPreset } from '../../lib/dnd/data/monsters.ts'

/**
 * The thing being hit, drawn rather than described.
 *
 * The blurb has always existed on the preset and was only ever read aloud in
 * prose; a beginner swinging at "Practice Dummy AC 12" is swinging at a label.
 * The silhouette is the same one the creature wears on the battle map, so the
 * target here and the square there are recognisably the same body.
 */
export function MonsterPlate({ monster }: { monster: MonsterPreset }) {
  return (
    <div className="flex items-center gap-3.5 rounded-card border border-edge bg-surface/60 p-3.5">
      <span
        aria-hidden
        className="grid size-14 shrink-0 place-items-center rounded-lg border border-blood/40 bg-gradient-to-b from-blood/25 to-blood/5 text-blood shadow-[inset_0_0_14px_rgb(0_0_0/0.5)]"
      >
        <CreatureToken token={monster.tokenId} size={30} />
      </span>
      <div className="min-w-0">
        <p className="font-serif font-semibold tracking-wide text-parchment">{monster.name}</p>
        <p className="text-book mt-0.5 text-xs leading-relaxed text-muted">{monster.blurb}</p>
        <p className="mt-1 font-mono text-xs text-amber-torch">
          <Explain k="ac">AC</Explain> {monster.ac}
        </p>
      </div>
    </div>
  )
}
