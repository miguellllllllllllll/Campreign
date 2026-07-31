# Hero Step

A web app that teaches absolute beginners to play D&D 5e. It hides the arithmetic,
automates the SRD rules, and puts everything inside a story you play rather than a
manual you read.

Three things to do:

- **`/`** — what the app is for.
- **`/create`** — three plain-English questions produce a complete, statted level-1
  character. Every number on the card explains itself on hover or keyboard focus.
- **`/tutorial`** — *The Goblin in the Cellar*. Exploration (a Perception check),
  conversation (Persuasion / Intimidation / draw steel), then combat on a 5×5 grid
  that teaches movement, then action, then ending the turn.

## Running it

```bash
npm install
npm run dev
```

```bash
npm test
```

Tests run on Node's built-in runner with **zero test dependencies** — Node 24
executes TypeScript directly by stripping types. That imposes one rule on the whole
codebase: **no `enum`, no `namespace`, no decorators**, because type-stripping cannot
execute them. Discriminated unions instead, which is what we wanted anyway.

## How it is put together

```
src/
  types/        the shapes; unions wherever there are more than two states
  lib/dnd/      the rules engine — pure functions, no React, no globals
  stores/       zustand: characterStore (persisted), combatStore, tutorialStore
  content/      goblinCellar.ts — the tutorial, as data
  components/   ui primitives, character, dice, combat, tutorial
  app/          routes
```

### The engine is pure

Nothing in `src/lib/dnd/` reaches for ambient nondeterminism. No `Math.random()`
inside a calculation, no `Date.now()`, no `crypto.randomUUID()`. Randomness and
identity are **parameters**:

```ts
roll('1d20+5', { rng })                       // rng defaults to Math.random at the edge
buildCharacter(answers, name, { id, now })    // so "same answers ⇒ same character" is assertable
```

Tests pin the dice with `sequenceRng([0.95, 0.05])` and assert exact outcomes. This
is the only reason crits, fumbles, advantage keep-rules and AC boundaries are
testable at all.

`encounter.ts` extends the same idea to the whole fight: turn order, movement,
reachable squares, the enemy's turn and win detection are all pure functions over an
`Encounter` value. The store is a thin wrapper, so the interesting logic is tested
without rendering anything.

### Content is data, not JSX

The tutorial is an array of typed steps. A step declares *what completes it*; it
holds no logic:

```ts
{ id: 'move', phase: 'combat', completion: { when: 'moved' }, next: 'attack', ... }
```

The guidance banner renders `currentStep.guidance` **word for word** and never
recomputes it. Adding a beat to the tutorial means adding an entry to
`content/goblinCellar.ts` — never editing a component.

### Store direction is one-way

`tutorialStore` may call `combatStore`; **`combatStore` never calls
`tutorialStore`.** Effects (`onEnter: [{ kind: 'startCombat' }]`) are applied after
the tutorial's own `set()` has returned, never inside the updater, so a combat action
can never observe a half-advanced tutorial.

Completion events travel the other way, and the component mediates: `TutorialRunner`
calls the combat action, then dispatches the `GameEvent`. That keeps the back-edge
out of the stores. If you need a new effect, add it to `EffectSpec` and handle it in
`applyEffect` — don't open a second path.

### Explanations live in one file

`lib/dnd/explanations.ts` is an exhaustive `Record<ExplainKey, Explanation>`, so
adding a key without writing the beginner-facing copy is a compile error. Used as
`<Explain k="ac">AC 15</Explain>`.

This renders a **tooltip on hover and keyboard focus, and a popover on touch** — not
a modal. A modal that opens on hover traps focus, fires on accidental passes, and is
unusable on a phone; the tooltip carries the same sentence with `aria-describedby`
and none of that.

## Deliberate divergences from the SRD

Flagged rather than hidden, all of them in service of a first-time player:

- **The goblin has AC 12, not 15.** A level-1 hero lands roughly two swings in three
  instead of half, so the first fight teaches the loop rather than the frustration.
- **Movement is capped at 3 squares in the tutorial.** A real 30 ft stride is 6
  squares, which is wider than the whole 5×5 board. The banner says three, and the
  board agrees with the banner.
- **A win ends the fight from whichever lesson is on screen.** The goblin can drop to
  a lucky first hit, before the End Turn lesson is ever reached. There is nothing
  left to practise the turn loop on, so the tutorial finishes.
- **The player takes the first turn of the tutorial fight, whatever they rolled.**
  Everyone still rolls, and every round after the first is ordinary initiative — but a
  lesson that teaches "move, then attack" cannot teach it on a board the goblin has
  already crossed and bloodied. Losing initiative also meant the squire could be at
  4 of 12 hit points before the player pressed anything, which is a poor thing to
  hand somebody learning to aim a spell around them.
- **Foe turns are played out inside `combatStore`.** The goblin frequently wins
  initiative; if control were handed over mid-round the player would be staring at a
  board with nothing to press.

## Not in this build

Supabase, accounts, and multiplayer — nobody else is at the table, though the
tutorial does field one NPC ally so an area spell has somebody to spare.

Levels past 1, and spell slots past the single 1st-level one a full caster
starts with. Everything above that is out of scope, not merely unwritten.

Any monster beyond the goblin and the practice dummy.

Three 1st-level spells are known but not yet castable, and say so on the button
rather than failing quietly:

- **Magic Missile** — darts that hit automatically, with no attack roll to
  resolve them through.
- **Bless** — needs concentration and a buff that lands on several targets.
- **Shield** — needs to fire in reaction to an incoming attack. The interrupt
  seam exists now, so this is the nearest of the three.

## Licence

The code is MIT — see [LICENSE](LICENSE).

The rules are not the code. Spell text, the goblin, and the arithmetic all come
from Wizards of the Coast's System Reference Document 5.1, used under CC BY 4.0,
and that attribution travels with them wherever they go. It lives in
[NOTICE](NOTICE) along with the licences for the icons and fonts. The
divergences listed above are this project's, not the SRD's.
