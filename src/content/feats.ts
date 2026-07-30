/**
 * Origin feats, offered at level 1 behind the advanced toggle.
 *
 * Only feats the builder can genuinely apply are listed. Savage Attacker still
 * is not: rerolling a damage die means interrupting damage resolution, which
 * the engine has no seam for. A feat that silently does nothing is worse than a
 * feat that is not offered — the player spends a choice and gets a lie.
 *
 * Origin feats are a 2024 idea and this build is 2014 SRD, so this is a
 * divergence on purpose: it is the cheapest way to make two characters of the
 * same class feel different at level 1, which is the only level there is.
 */
export type FeatEffect =
  | { kind: 'maxHp'; amount: number }
  | { kind: 'initiative'; amount: number }
  /** Grants one cantrip, chosen separately because the feat does not name it. */
  | { kind: 'cantrip'; choices: readonly string[] }

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
  {
    id: 'magicInitiate',
    label: 'Magic Initiate',
    tagline: 'You picked up one real spell somewhere along the way.',
    description:
      'A dabbler rather than a caster. One cantrip, cast as often as you like, and nobody expects it from someone holding a sword.',
    effectLabel: 'one cantrip of your choice',
    // Fire Bolt is the wizard's attack cantrip and Guidance the cleric's
    // utility one, so a martial gets a genuine choice between a new button on
    // the action bar and a better chance on a skill check.
    effect: { kind: 'cantrip', choices: ['fireBolt', 'guidance'] },
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

/** The cantrips a feat lets you pick from, or none. */
export function cantripChoicesFor(id: string | undefined): readonly string[] {
  const effect = featById(id)?.effect
  return effect?.kind === 'cantrip' ? effect.choices : []
}

/**
 * The cantrip a feat actually granted.
 *
 * Returns undefined unless the chosen spell is one the feat offers, so a stale
 * or hand-edited id cannot smuggle an arbitrary spell onto a martial's sheet.
 */
export function grantedCantripId(
  featId: string | undefined,
  spellId: string | undefined,
): string | undefined {
  if (spellId === undefined) return undefined
  return cantripChoicesFor(featId).includes(spellId) ? spellId : undefined
}
