'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { PartyPopper, Skull } from 'lucide-react'
import { stepById } from '../../content/goblinCellar.ts'
import {
  activeCombatant,
  combatantsOf,
  encounterWinner,
  reachableSquares,
  turnOrder,
} from '../../lib/dnd/encounter.ts'
import { useActiveCharacter, useRosterHydrated } from '../../stores/characterStore.ts'
import { useCombatStore } from '../../stores/combatStore.ts'
import { useTutorialStore } from '../../stores/tutorialStore.ts'
import { ActionBar } from '../combat/ActionBar.tsx'
import { CombatGrid } from '../combat/CombatGrid.tsx'
import { InitiativeTrack } from '../combat/InitiativeTrack.tsx'
import { TurnBanner } from '../combat/TurnBanner.tsx'
import { Button } from '../ui/button.tsx'
import { CheckPrompt } from './CheckPrompt.tsx'
import { ChoicePrompt } from './ChoicePrompt.tsx'
import type { Character } from '../../types/character.ts'
import type { GridPosition } from '../../types/combat.ts'
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
        <Button size="lg" className="self-start" onClick={() => dispatch({ type: 'acknowledged' })}>
          Continue
        </Button>
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

  // The engine decides the fight is over; the tutorial hears about it here.
  useEffect(() => {
    if (winner === 'party') dispatch({ type: 'enemyDefeated' })
  }, [winner, dispatch])

  if (!hydrated) {
    return <p className="text-sm text-muted">Loading your hero…</p>
  }

  if (character === null) {
    return (
      <div className="rounded-card border border-edge bg-surface p-6">
        <h1 className="text-xl font-semibold text-parchment">You need a hero first</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The tutorial hands you the character you built, so it can show you your own numbers
          rather than someone else&rsquo;s. Answer three questions and come back.
        </p>
        <Button asChild className="mt-4">
          <Link href="/create">Create a hero</Link>
        </Button>
      </div>
    )
  }

  const step = stepById(stepId)
  if (step === undefined) return null

  const hero = encounter === null ? undefined : combatantsOf(encounter, 'party')[0]
  const foe = encounter === null ? undefined : combatantsOf(encounter, 'foes')[0]
  const active = encounter === null ? undefined : activeCombatant(encounter)
  const playerTurn = active?.team === 'party'

  // Every combat step past the initiative roll hands the board over.
  const inCombat = encounter !== null && step.phase === 'combat' && step.id !== 'initiative'
  const boardLive = inCombat && playerTurn && winner === null

  function move(to: GridPosition) {
    if (useCombatStore.getState().move(to)) dispatch({ type: 'moved' })
  }

  function attack(attackId: string) {
    if (foe === undefined) return
    const outcome = useCombatStore.getState().attack({ targetId: foe.id, attackId })
    if (outcome !== null) dispatch({ type: 'attackResolved' })
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
          {resolution !== null && (
            <p className="rounded-card border-l-2 border-gold/60 bg-surface/60 p-4 text-sm italic leading-relaxed text-parchment">
              {resolution}
            </p>
          )}

          <p className="text-sm leading-relaxed text-muted">{step.narration}</p>

          {finished ? (
            <div className="rounded-card border border-moss/50 bg-moss/10 p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-moss">
                <PartyPopper aria-hidden className="size-5" />
                The cellar is yours
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-parchment">
                You explored, you talked, and you fought — that is the whole game. Every table
                you sit at from here is those three things, with bigger numbers.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={restart}>
                  Play it again
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/create">Build another hero</Link>
                </Button>
              </div>
            </div>
          ) : winner === 'foes' ? (
            <div className="rounded-card border border-blood/50 bg-blood/10 p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-blood">
                <Skull aria-hidden className="size-5" />
                You went down
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-parchment">
                Dropping to zero hit points is not the end of a character at a real table, but
                it is the end of this lesson. Take it from the top.
              </p>
              <Button variant="secondary" className="mt-4" onClick={restart}>
                Try again
              </Button>
            </div>
          ) : (
            <StepPrompt step={step} character={character} dispatch={dispatch} />
          )}

          {inCombat && hero !== undefined && winner === null && (
            <ActionBar
              active={hero}
              target={foe}
              movementRemaining={playerTurn ? encounter.movementRemaining : 0}
              hasActed={encounter.hasActed}
              attackEnabled={boardLive && step.id !== 'move'}
              endTurnEnabled={boardLive && (step.id === 'endTurn' || step.id === 'finish')}
              onAttack={attack}
              onEndTurn={endTurn}
            />
          )}
        </div>

        {encounter !== null && (
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

            <div className="rounded-card border border-edge bg-surface p-4">
              <h3 className="text-sm font-semibold text-parchment">What just happened</h3>
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
