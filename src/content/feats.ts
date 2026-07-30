/**
 * Origin feats, offered at level 1 behind the advanced toggle.
 *
 * Only feats whose whole effect is a flat number the builder can apply are
 * listed. Savage Attacker (reroll a damage die) and Magic Initiate (a cantrip
 * for a class the spell registry does not index) both need engine work that
 * does not exist yet, and a feat that silently does nothing is worse than a
 * feat that is not offered — the player spends a choice and gets a lie.
 *
 * Origin feats are a 2024 idea and this build is 2014 SRD, so this is a
 * divergence on purpose: it is the cheapest way to make two characters of the
 * same class feel different at level 1, which is the only level there is.
 */
export type FeatEffect =
  | { kind: 'maxHp'; amount: number }
  | { kind: 'initiative'; amount: number }

export interface Feat {
  id: string
  label: string
  tagline: string
  description: string
  /** What the number actually does, phrased for the sheet. */
  effectLabel: string
  effect: FeatEffect
}

export const FEATS: readonly Feat[] = [
  {
    id: 'tough',
    label: 'Tough',
    tagline: 'You take more killing than you look like you should.',
    description:
      'Whatever you were doing before this, it left you durable. You start every fight with a deeper reserve than the rest of your class.',
    effectLabel: '+2 maximum hit points',
    effect: { kind: 'maxHp', amount: 2 },
  },
  {
    id: 'alert',
    label: 'Alert',
    tagline: 'You are already moving when everyone else is still reacting.',
    description:
      'You do not get caught out. When a fight starts you act early, often before the other side has understood that it started.',
    effectLabel: '+5 initiative',
    effect: { kind: 'initiative', amount: 5 },
  },
]

const BY_ID = new Map(FEATS.map((feat) => [feat.id, feat]))

/** Undefined rather than a throw, so a stale saved id degrades to "no feat". */
export function featById(id: string | undefined): Feat | undefined {
  return id === undefined ? undefined : BY_ID.get(id)
}

/** The hit point bump a feat grants, or zero. Kept separate so the builder can
 * add it without knowing which feats exist. */
export function bonusMaxHp(id: string | undefined): number {
  const effect = featById(id)?.effect
  return effect?.kind === 'maxHp' ? effect.amount : 0
}

/** The initiative bump a feat grants, or zero. */
export function bonusInitiative(id: string | undefined): number {
  const effect = featById(id)?.effect
  return effect?.kind === 'initiative' ? effect.amount : 0
}
