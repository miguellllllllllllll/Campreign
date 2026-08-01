'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { PartyPopper, Skull } from 'lucide-react'
import { stepById } from '../../content/goblinCellar.ts'
import {
  activeCombatant,
  combatantsOf,
  encounterWinner,
  hasLegalAction,
  reachableSquares,
  turnOrder,
} from '../../lib/dnd/encounter.ts'
import { spellTargetsDying, spellTargetsEnemies } from '../../lib/dnd/casting.ts'
import { isDead, isDying } from '../../lib/dnd/dying.ts'
import { LevelUpSummary } from './LevelUpSummary.tsx'
import { channelDivinityPowerFor } from '../../content/subclasses.ts'
import { useActiveCharacter, useRosterHydrated } from '../../stores/characterStore.ts'
import { useCombatStore } from '../../stores/combatStore.ts'
import { useTutorialStore } from '../../stores/tutorialStore.ts'
import { ActionBar } from '../combat/ActionBar.tsx'
import { CombatGrid } from '../combat/CombatGrid.tsx'
import { InitiativeTrack } from '../combat/InitiativeTrack.tsx'
import { ReactionBanner } from '../combat/ReactionBanner.tsx'
import { TurnBanner } from '../combat/TurnBanner.tsx'
import { FantasyButton } from '../ui/fantasy-button.tsx'
import { ParchmentCard, ParchmentCardContent } from '../ui/parchment-card.tsx'
import { CheckPrompt } from './CheckPrompt.tsx'
import { ChoicePrompt } from './ChoicePrompt.tsx'
import type { Character } from '../../types/character.ts'
import type { GridPosition, ReactionKind } from '../../types/combat.ts'
import type { GameEvent, TutorialStep } from '../../types/tutorial.ts'

interface StepPromptProps {
  step: TutorialStep
  character: Character
  dispatch: (event: GameEvent) => void
}

/**
 * The control that completes the current step. Combat steps are absent on
 * purpose: the board and the action bar complete those.
 */
function StepPrompt({ step, character, dispatch }: StepPromptProps) {
  switch (step.completion.when) {
    case 'acknowledged':
      return (
        <FantasyButton
          size="lg"
          className="self-start"
          onClick={() => dispatch({ type: 'acknowledged' })}
        >
          Continue
        </FantasyButton>
      )

    case 'skillCheck': {
      const check = step.check
      if (check === undefined) return null
      return (
        <CheckPrompt
          character={character}
          check={check}
          onResolved={(success) => dispatch({ type: 'skillCheck', skill: check.skill, success })}
        />
      )
    }

    case 'choicePicked': {
      const choices = step.choices
      if (choices === undefined) return null
      return (
        <ChoicePrompt
          character={character}
          choices={choices}
          onResolved={(choiceId, success) => dispatch({ type: 'choicePicked', choiceId, success })}
        />
      )
    }

    default:
      return null
  }
}

export function TutorialRunner() {
  const hydrated = useRosterHydrated()
  const character = useActiveCharacter()

  const stepId = useTutorialStore((state) => state.stepId)
  const finished = useTutorialStore((state) => state.finished)
  const resolution = useTutorialStore((state) => state.resolution)
  const roster = useTutorialStore((state) => state.roster)
  const begin = useTutorialStore((state) => state.begin)
  const dispatch = useTutorialStore((state) => state.dispatch)

  const encounter = useCombatStore((state) => state.encounter)
  const refusal = useCombatStore((state) => state.refusal)

  useEffect(() => {
    if (character !== null && roster === null) begin(character)
  }, [character, roster, begin])

  const winner = encounter === null ? null : encounterWinner(encounter)

  /*
   * Whether the hero is gone for good, rather than merely down.
   *
   * `encounterWinner` answers "is either side wiped out", which is not the same
   * question. The squire can finish the last enemy while the player's own hero
   * is on the floor — and if they were only dying, that is a fine story and the
   * rest between fights brings them back. If they are dead, marching a corpse
   * into a harder encounter is not a story, so the lesson ends here instead.
   */
  const heroOnBoard =
    encounter === null || character === null ? undefined : encounter.combatants[character.id]
  const heroDead = heroOnBoard !== undefined && isDead(heroOnBoard)

  // The engine decides the fight is over; the tutorial hears about it here.
  useEffect(() => {
    if (winner === 'party' && !heroDead) dispatch({ type: 'enemyDefeated' })
  }, [winner, heroDead, dispatch])

  const levelGains = useTutorialStore((state) => state.levelGains)

  if (!hydrated) {
    return <p className="text-sm text-muted">Loading your hero…</p>
  }

  if (character === null) {
    return (
      <ParchmentCard>
        <ParchmentCardContent className="pt-6">
          <h1 className="font-display text-xl text-parchment">You need a hero first</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The tutorial hands you the character you built, so it can show you your own numbers
            rather than someone else&rsquo;s. Answer three questions and come back.
          </p>
          <FantasyButton asChild className="mt-4">
            <Link href="/create">Create a hero</Link>
          </FantasyButton>
        </ParchmentCardContent>
      </ParchmentCard>
    )
  }

  const step = stepById(stepId)
  if (step === undefined) return null

  /*
   * By id, not by team index. There are two combatants on the party side now,
   * and "the first one" would be whoever happened to roll higher initiative —
   * so the action bar would occasionally be driving the squire.
   */
  const hero = encounter === null ? undefined : encounter.combatants[character.id]
  const foe = encounter === null ? undefined : combatantsOf(encounter, 'foes')[0]
  /** Whoever on the party's side is on the floor and still slipping. */
  const fallen =
    encounter === null ? undefined : combatantsOf(encounter, 'party').find(isDying)
  const active = encounter === null ? undefined : activeCombatant(encounter)
  // The player's own turn, not merely their side's — the squire is on their
  // team and plays itself.
  const playerTurn = active?.id === character.id

  /*
   * A step that puts a roster on the board does not also hand it over — the
   * player is meant to read the turn order first. Asked of the step's effects
   * rather than matched against the id 'initiative', because there are two of
   * these now and the second one is not called that.
   */
  const startsFight = step.onEnter?.some((effect) => effect.kind === 'startCombat') === true
  const inCombat = encounter !== null && step.phase === 'combat' && !startsFight
  /*
   * The steps that just say "keep going until you win" rather than teaching one
   * move. They are exactly the steps that complete on a win, so ask that — the
   * previous test for `id === 'finish'` silently stopped matching the moment
   * that step was renamed, taking End Turn off the bar with it.
   */
  const freeFight = step.completion.when === 'enemyDefeated'
  /*
   * The beat between the two fights. The board is hidden here on purpose: it
   * still holds the finished encounter, where the hero may well be lying at 0
   * hit points, and showing that beside a panel reading "+7 (now 17)" tells the
   * player two contradictory things at the moment they are meant to learn what
   * levelling up means.
   */
  const levelsUp = step.onEnter?.some((effect) => effect.kind === 'levelUp') === true
  const boardLive = inCombat && playerTurn && winner === null
  // Out of movement and out of reach: ending the turn is the only move left, so
  // it has to be offered even though this step was teaching something else.
  const stranded = boardLive && !hasLegalAction(encounter)
  // Absent for everyone without a paladin oath, which is what keeps the button off
  // the bar for every other hero.
  const oathPower = channelDivinityPowerFor(character.subclassId)
  // Captured here because `cast` below is a hoisted declaration, and narrowing
  // of `character` does not reach inside one.
  const subclassId = character.subclassId
  // A pause outranks everything: the board is frozen until it is answered.
  const pending = encounter?.pendingReaction

  function move(to: GridPosition) {
    if (useCombatStore.getState().move(to)) dispatch({ type: 'moved' })
  }

  function attack(attackId: string, maneuverId?: 'trip') {
    if (foe === undefined) return
    const outcome = useCombatStore.getState().attack({
      targetId: foe.id,
      attackId,
      ...(maneuverId === undefined ? {} : { maneuverId }),
    })
    // The tutorial only cares that an attack resolved; a manoeuvre rides along
    // with it rather than being a second beat the script has to know about.
    if (outcome !== null) dispatch({ type: 'attackResolved' })
  }

  /**
   * The vow always names the goblin: there is exactly one enemy on this board,
   * so asking the player to pick a target would be a click with no decision in
   * it. A wider encounter would want a targeting step here.
   */
  function channel(power: 'sacredWeapon' | 'vowOfEnmity') {
    useCombatStore.getState().channel({
      power,
      ...(power === 'vowOfEnmity' && foe !== undefined ? { targetId: foe.id } : {}),
    })
  }

  /**
   * Spells say where they go rather than asking.
   *
   * Beams and blasts point at the goblin, heals and wards land on the caster,
   * and Spare the Dying finds whoever is on the floor — it cannot work on
   * anybody else, so offering a picker would be offering one answer.
   *
   * Cure Wounds still lands on the caster even with a dying squire beside them.
   * Choosing between healing yourself and reaching your ally is a real decision
   * and deserves a real targeting step, which this is not.
   */
  function cast(spellId: string) {
    if (hero === undefined) return
    const aimed = spellTargetsEnemies(spellId)
      ? foe
      : spellTargetsDying(spellId)
        ? fallen
        : hero
    if (aimed === undefined) return
    useCombatStore.getState().cast({
      spellId,
      targetId: aimed.id,
      ...(subclassId === undefined ? {} : { subclassId }),
    })
  }

  function drink() {
    useCombatStore.getState().drink()
  }

  function react(choice: ReactionKind | 'pass') {
    useCombatStore.getState().dispatchReaction(choice)
  }

  function endTurn() {
    useCombatStore.getState().finishTurn()
    dispatch({ type: 'turnEnded' })
  }

  const restart = () => {
    useCombatStore.getState().reset()
    begin(character)
  }

  return (
    <div className="flex flex-col gap-5">
      <TurnBanner
        phase={step.phase}
        title={step.title}
        guidance={step.guidance}
        refusal={boardLive ? refusal : null}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          {pending !== undefined && encounter !== null && (
            <ReactionBanner
              pending={pending}
              attacker={encounter.combatants[pending.attackerId]}
              target={encounter.combatants[pending.targetId]}
              onReact={(choice) => react(choice)}
              onPass={() => react('pass')}
            />
          )}

          {resolution !== null && (
            <p className="rounded-card text-book border-l-2 border-amber-torch/60 bg-surface/60 p-4 text-base text-parchment italic">
              {resolution}
            </p>
          )}

          <p className="text-sm leading-relaxed text-muted">{step.narration}</p>

          {/*
            * Shown on whichever step levelled the hero, asked of the step's own
            * data rather than matched by id — adding a beat to this tutorial is
            * supposed to mean editing content, never a component.
            */}
          {levelGains !== null && levelsUp && <LevelUpSummary gains={levelGains} />}

          {finished ? (
            <div className="rounded-card border border-moss/50 bg-moss/10 p-5 shadow-[0_0_30px_rgb(122_163_95/0.15)]">
              <h2 className="flex items-center gap-2 font-display text-lg text-moss">
                <PartyPopper aria-hidden className="size-5" />
                The cellar is yours
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-parchment">
                You explored, you talked, and you fought — that is the whole game. Every table
                you sit at from here is those three things, with bigger numbers.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <FantasyButton variant="iron" onClick={restart}>
                  Play it again
                </FantasyButton>
                <FantasyButton asChild variant="ghost">
                  <Link href="/create">Build another hero</Link>
                </FantasyButton>
              </div>
            </div>
          ) : winner === 'foes' || heroDead ? (
            <div className="rounded-card border border-blood/50 bg-blood/10 p-5 shadow-[0_0_30px_rgb(192_70_59/0.15)]">
              <h2 className="flex items-center gap-2 font-display text-lg text-blood">
                <Skull aria-hidden className="size-5" />
                You went down
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-parchment">
                {heroDead
                  ? 'Three failed death saves is the end of a character, at this table and at any other. It is not the end of you — take it from the top.'
                  : 'Everyone on your side is on the floor. At a real table somebody would be rolling death saves right now and the story would go on; here it is the end of the lesson. Take it from the top.'}
              </p>
              <FantasyButton variant="iron" className="mt-4" onClick={restart}>
                Try again
              </FantasyButton>
            </div>
          ) : (
            <StepPrompt step={step} character={character} dispatch={dispatch} />
          )}

          {inCombat && hero !== undefined && winner === null && (
            <ActionBar
              active={hero}
              target={foe}
              board={turnOrder(encounter)}
              movementRemaining={playerTurn ? encounter.movementRemaining : 0}
              hasActed={encounter.hasActed}
              attackEnabled={boardLive && step.id !== 'move'}
              endTurnEnabled={boardLive && (step.id === 'endTurn' || freeFight || stranded)}
              stranded={stranded}
              onAttack={attack}
              onCast={cast}
              onDrink={drink}
              bonusActionSpent={encounter?.bonusActionSpent ?? false}
              {...(oathPower === undefined ? {} : { oathPower, onChannel: channel })}
              onEndTurn={endTurn}
            />
          )}
        </div>

        {encounter !== null && !levelsUp && (
          <aside className="flex flex-col gap-4">
            <CombatGrid
              combatants={Object.values(encounter.combatants)}
              activeId={active?.id}
              reachable={reachableSquares(encounter)}
              onMove={move}
              movementEnabled={boardLive}
            />

            <InitiativeTrack
              order={turnOrder(encounter)}
              activeId={active?.id}
              round={encounter.round}
            />

            <div className="rounded-card border border-edge bg-surface/70 p-4 backdrop-blur-sm">
              <h3 className="font-serif text-sm font-semibold tracking-wide text-parchment">
                What just happened
              </h3>
              <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
                {encounter.log.slice(-6).map((line, index) => (
                  <li key={`${index}-${line.slice(0, 12)}`}>{line}</li>
                ))}
              </ol>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
