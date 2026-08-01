'use client'

import { Heart, Hourglass, Swords } from 'lucide-react'
import { castableSpells } from '../../lib/dnd/casting.ts'
import { POTION_LABEL, hasPotion, resolveItemUseCost } from '../../lib/dnd/items.ts'
import {
  ChannelDivinityIcon,
  SpellFlareIcon,
  SuperiorityDieIcon,
  TripAttackIcon,
} from '../ui/custom-icons.tsx'
import { useState } from 'react'
import { isInRange } from '../../lib/dnd/combat.ts'
import { totalSlots } from '../../lib/dnd/slots.ts'
import { canActionSurge } from '../../lib/dnd/actionSurge.ts'
import { SMITE_SLOT_LEVEL, canSmite } from '../../lib/dnd/divineSmite.ts'
import { slotsAt } from '../../lib/dnd/slots.ts'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { HintTooltip } from '../ui/rules-tooltip.tsx'
import { Explain } from '../Explain.tsx'
import type { Combatant } from '../../types/combat.ts'

export interface ActionBarProps {
  active: Combatant
  target: Combatant | undefined
  movementRemaining: number
  hasActed: boolean
  attackEnabled: boolean
  endTurnEnabled: boolean
  /** No movement and nothing in reach — say so, rather than leaving them hunting. */
  stranded?: boolean
  onAttack: (attackId: string, maneuverId?: 'trip', smite?: boolean) => void
  /** Undefined when this hero prepares no spells at all. */
  onCast?: (spellId: string) => void
  /**
   * Everyone on the board, so a spell that needs a particular kind of target
   * can grey out with a reason instead of being pressed into nothing.
   */
  board?: readonly Combatant[]
  /** Whether the turn's bonus action is still available. */
  bonusActionSpent?: boolean
  onDrink?: () => void
  /** Which oath power this hero has, from their subclass. Absent for everyone else. */
  oathPower?: 'sacredWeapon' | 'vowOfEnmity'
  /** Undefined when this hero has no oath to call on. */
  onChannel?: (power: 'sacredWeapon' | 'vowOfEnmity') => void
  /** Undefined for everyone who cannot take a second action. */
  onSurge?: () => void
  onEndTurn: () => void
}

export function ActionBar({
  active,
  target,
  movementRemaining,
  hasActed,
  attackEnabled,
  endTurnEnabled,
  stranded = false,
  onAttack,
  onCast,
  board = [],
  bonusActionSpent = false,
  onDrink,
  oathPower,
  onChannel,
  onSurge,
  onEndTurn,
}: ActionBarProps) {
  /*
   * Armed before the swing, not chosen after it. The SRD lets a Battle Master
   * decide once they know they hit, but a second prompt mid-attack is the
   * reaction-shaped problem this slice exists to avoid — so the die is declared
   * up front and only actually spent if the attack lands.
   */
  const [tripArmed, setTripArmed] = useState(false)
  /*
   * Armed before the swing like the superiority die beside it, and for the same
   * reason: the SRD lets a paladin decide once they know they hit, but a second
   * prompt mid-attack is the reaction-shaped problem that machinery avoids.
   * The slot is only actually spent if the blow lands.
   */
  const [smiteArmed, setSmiteArmed] = useState(false)
  const dice = active.superiorityDice ?? 0
  const canTrip = dice > 0

  const charges = active.channelDivinityCharges ?? 0
  const oath = active.activeChannelDivinity
  const spells = onCast === undefined ? [] : castableSpells(active, board)
  const potions = active.potions ?? 0
  const drinkCost = resolveItemUseCost(active)
  const drinkBlocked = drinkCost === 'action' ? hasActed : bonusActionSpent
  const canDrink = onDrink !== undefined && hasPotion(active) && !drinkBlocked
  const slots = active.spellSlots ?? []
  /*
   * The count beside Divine Smite is first-level slots specifically, because
   * that is what a smite spends. The button rendered `slots` itself, which put
   * the raw table on it — "02 left", the leading zero being the cantrip index
   * nobody spends. The readout above already formats the table properly.
   */
  const smiteSlots = slotsAt(active.spellSlots, SMITE_SLOT_LEVEL)

  const canChannel =
    onChannel !== undefined && oathPower !== undefined && charges > 0 && oath === undefined

  /*
   * Offered only once the action is gone, which is the whole point of it. A
   * surge spent to recover an action you still had would be the player paying a
   * once-per-rest resource for nothing.
   */
  const surges = active.actionSurges ?? 0
  const canSurge = onSurge !== undefined && canActionSurge(active, hasActed) && attackEnabled

  // `canSmite` carries both halves — the feature and a slot to spend — so this
  // never has to ask what class or subclass anybody picked.
  const canSmiteNow = canSmite(active) && attackEnabled

  return (
    <div className="border-gold-ornate rounded-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-serif text-xs text-muted">
        <span>
          <Explain k="movement">Movement</Explain> left:{' '}
          <span className="font-mono text-parchment">
            {movementRemaining} {movementRemaining === 1 ? 'square' : 'squares'}
          </span>
        </span>
        {drinkCost === 'bonusAction' && (
          <span>
            Bonus action:{' '}
            <span className="font-mono text-parchment">
              {bonusActionSpent ? 'used' : 'ready'}
            </span>
          </span>
        )}
        {totalSlots(slots) > 0 && (
          <span>
            <Explain k="preparedSpell">Spell slots</Explain>:{' '}
            {/* One figure per level once a caster has more than one kind. */}
            <span className="font-mono text-parchment">
              {slots.length > 2
                ? slots
                    .map((count, level) => (level === 0 ? null : `L${level} ${count}`))
                    .filter(Boolean)
                    .join(' · ')
                : (slots[1] ?? 0)}
            </span>
          </span>
        )}
        <span>
          <Explain k="action">Action</Explain>:{' '}
          <span className="font-mono text-parchment">{hasActed ? 'used' : 'ready'}</span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {active.attacks.map((attack) => {
          const reachable = target !== undefined && isInRange(active, target, attack)
          const usable = attackEnabled && !hasActed && target !== undefined && reachable

          return (
            <HintTooltip key={attack.id} title={attack.name} body={attack.description}>
            <FantasyButton
              variant="brass"
              aria-disabled={!usable}
              onClick={() => {
                onAttack(
                  attack.id,
                  tripArmed && attack.kind === 'weapon' ? 'trip' : undefined,
                  smiteArmed && attack.kind === 'weapon' ? true : undefined,
                )
                setTripArmed(false)
              }}
            >
              {attack.kind === 'spell' ? (
                <SpellFlareIcon size={16} className="text-gold-bright" />
              ) : (
                <Swords aria-hidden />
              )}
              {attack.name}
              {target !== undefined && !reachable && (
                <span className="text-xs font-normal">— too far, move closer</span>
              )}
            </FantasyButton>
            </HintTooltip>
          )
        })}

        {canTrip && (
          <HintTooltip
            title="Trip Attack"
            body="Spend a superiority die: extra damage, and the target falls over unless it saves."
          >
          <FantasyButton
            variant={tripArmed ? 'crimson' : 'iron'}
            aria-disabled={hasActed}
            aria-pressed={tripArmed}
            onClick={() => setTripArmed((armed) => !armed)}
          >
            <TripAttackIcon size={16} className="text-amber-torch" />
            Trip Attack
            <span className="flex items-center gap-1 font-mono text-xs font-normal">
              <SuperiorityDieIcon size={12} />
              {dice} left
            </span>
          </FantasyButton>
          </HintTooltip>
        )}

        {canChannel && (
          <HintTooltip
            title={oathPower === 'sacredWeapon' ? 'Sacred Weapon' : 'Vow of Enmity'}
            body="Call on your oath. It costs no action, and lasts the rest of the fight."
          >
          <FantasyButton variant="crimson" onClick={() => onChannel(oathPower)}>
            <ChannelDivinityIcon size={16} />
            {oathPower === 'sacredWeapon' ? 'Sacred Weapon' : 'Vow of Enmity'}
            <span className="font-mono text-xs font-normal">{charges} left</span>
          </FantasyButton>
          </HintTooltip>
        )}

        {canSmiteNow && (
          <HintTooltip
            title="Divine Smite"
            body="Burn a spell slot as you strike for 2d8 radiant damage — and an extra die against the undead. Armed before the swing; the slot is only spent if it lands."
          >
            <FantasyButton
              variant={smiteArmed ? 'crimson' : 'iron'}
              aria-pressed={smiteArmed}
              onClick={() => setSmiteArmed((armed) => !armed)}
            >
              <ChannelDivinityIcon size={16} />
              {smiteArmed ? 'Smite armed' : 'Divine Smite'}
              <span className="font-mono text-xs font-normal">{smiteSlots} left</span>
            </FantasyButton>
          </HintTooltip>
        )}

        {canSurge && (
          <HintTooltip
            title="Action Surge"
            body="A second action, right now. Once between rests — and the only thing here that gives a turn back rather than making one bigger."
          >
            <FantasyButton variant="crimson" onClick={onSurge}>
              <ChannelDivinityIcon size={16} />
              Action Surge
              <span className="font-mono text-xs font-normal">{surges} left</span>
            </FantasyButton>
          </HintTooltip>
        )}

        {spells.map(({ spell, castable, reason }) => {
          /*
           * A bonus-action spell spends a different budget, so it stays live
           * after you have attacked — greying out Healing Word because you
           * already swung would contradict the only reason it exists beside
           * Cure Wounds.
           */
          const onBonus = spell.castingCost === 'bonusAction'
          const budgetSpent = onBonus ? bonusActionSpent : hasActed
          return (
            // The reason is already on the face of the button when it applies, so
            // the scroll carries what the spell actually does either way.
            <HintTooltip
              key={spell.id}
              title={spell.name}
              body={
                onBonus
                  ? `${spell.description} Casting it costs only a bonus action.`
                  : spell.description
              }
            >
              <FantasyButton
                variant="iron"
                aria-disabled={!castable || budgetSpent || !attackEnabled}
                onClick={() => onCast?.(spell.id)}
              >
                <SpellFlareIcon size={16} className="text-gold-bright" />
                {spell.name}
                {onBonus && (
                  <span className="text-xs font-normal text-muted">— bonus action</span>
                )}
                {!castable && <span className="text-xs font-normal">— {reason}</span>}
              </FantasyButton>
            </HintTooltip>
          )
        })}

        {onDrink !== undefined && potions > 0 && (
          <HintTooltip
            title={POTION_LABEL}
            body={
              drinkCost === 'bonusAction'
                ? 'Fast Hands: drinking costs only a bonus action, so you can still attack.'
                : 'Drinking takes your whole action for the turn.'
            }
          >
          <FantasyButton
            variant="iron"
            aria-disabled={!canDrink || !attackEnabled}
            onClick={onDrink}
          >
            <Heart aria-hidden />
            Drink {POTION_LABEL}
            <span className="font-mono text-xs font-normal">
              {potions} left{drinkCost === 'bonusAction' ? ' · bonus' : ''}
            </span>
          </FantasyButton>
          </HintTooltip>
        )}

        <FantasyButton variant="iron" aria-disabled={!endTurnEnabled} onClick={onEndTurn}>
          <Hourglass aria-hidden />
          End Turn
        </FantasyButton>
      </div>

      {oath !== undefined && (
        <p className="mt-3 font-serif text-xs text-amber-torch">
          <ChannelDivinityIcon size={12} className="mr-1 inline text-amber-torch" />
          {oath.type === 'sacredWeapon'
            ? 'Sacred Weapon is burning — your Charisma is added to every attack roll.'
            : 'Your vow is sworn — you strike that foe with '}
          {oath.type === 'vowOfEnmity' && <Explain k="advantage">advantage</Explain>}
          {oath.type === 'vowOfEnmity' && '.'}
        </p>
      )}

      {stranded && (
        <p aria-live="polite" className="mt-3 text-xs leading-relaxed text-amber-torch">
          You have used all your movement and nothing is within reach. End your turn — your
          movement comes back next round.
        </p>
      )}
    </div>
  )
}
