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
  that teaches movement, then action, then ending the turn. Winning levels you to
  2 and opens a second fight against two foes at once, which is where choosing a
  target becomes a decision.

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

### Armour is derived, never written back

`combatant.ac` is the gear. Anything lending armour on top of it — Shield of
Faith's ward today — is a condition, and `effectiveAc()` adds the two up at the
moment of the roll. Nothing overwrites `ac`, so nothing has to remember how to
put it back: the ward ends, the condition goes, and the number follows.

This is what let Shield of Faith join concentration. Breaking a caster's
concentration drops **every** condition they were sourcing, blessing and ward
alike, and a second caster's blessing on the same target survives it — the
condition carries who cast it.

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
- **Shield protects against the triggering blow rather than lasting a round.**
  The SRD's +5 runs until the start of your next turn. The goblin swings once a
  round, so on this board the two are the same, and carrying a timed armour
  bonus would be machinery for a case that cannot arise here.
- **Mage Armor lasts the fight rather than eight hours.** It is not a
  concentration spell in the SRD either; it simply runs longer than any board
  here, so setting an Armour Class and leaving it set is the whole of it.
- **Concentration outside a fight is session state, not character state.**
  It lives in `tutorialStore`, which is not persisted. A spell you are holding
  is a thing happening right now rather than a property of who your hero is, and
  putting it in the persisted `characterStore` would mean closing the tab and
  coming back a week later still holding Guidance.
- **Guidance is spent by the next skill check, and drawing steel puts it out.**
  The SRD gives it a minute of concentration. Here there are no ability checks
  once initiative is rolled, so carrying it onto the board would be carrying a
  number with nothing left to add itself to.
- **A magic style is trimmed to fit whoever picked it.** A cleric prepares
  1 + their Wisdom modifier, which racial bonuses move between three and four,
  so no single written-down list fits every cleric. Styles are written at the
  larger size and cut to the cap in `resolveSpellSelection`, leading with the
  spells that make them that style. A hand-picked list is never trimmed.
- **The giant bat has 11 hit points, not the SRD's 22.** At 22 it was sturdier
  than the skeleton standing next to it, while the step's own narration called
  it fragile — and the second encounter became a coin toss that wiped a level-2
  hero and their squire. Halved, so the numbers say what the prose does.
- **A short rest between the two fights restores everything.** Hit points and
  spell slots both. A player who finished the goblin at 2 hit points would
  otherwise meet the second encounter with no way to win it, which teaches
  nothing except that the tutorial is unfair.
- **The hero dying ends the lesson even if their side wins.** The squire can
  finish the last enemy while you are on the floor; if you were only *dying*
  the rest brings you back, and that is a good story. If you are dead, the
  tutorial stops rather than marching a corpse into a harder fight.
- **A monster at 0 hit points is dead; a hero at 0 is dying.** The SRD says the
  same, and the difference is the single most important thing a beginner can
  learn about dropping. Death saves are the real ones — a flat d20 at the start
  of each of your turns, three either way, a natural 20 putting you back up at 1
  and a natural 1 costing two.
- **Damage taken while down does not count as a failed death save.** It does in
  the SRD. Here nothing can hit a downed creature: attacks refuse them by name
  and area spells skip anyone at 0, so the rule has no case to apply to.
- **A fight already decided rolls no more death saves.** If the whole party is
  down the encounter is lost, and three failures confirming it in silence is a
  wait, not a lesson.
- **Foe turns are played out inside `combatStore`.** The goblin frequently wins
  initiative; if control were handed over mid-round the player would be staring at a
  board with nothing to press.

## Not in this build

Supabase, accounts, and multiplayer — nobody else is at the table, though the
tutorial does field one NPC ally so an area spell has somebody to spare.

Levels past 2. The rules for taking a level live in `lib/dnd/leveling.ts` and
stop there for a specific reason: at 3rd level a full caster gains **2nd-level
spell slots**, and `Character.spellSlots` is a single number meaning first-level
slots. A level-3 wizard here would be missing half their magic. The slot table
is written out past the cap because the rules are correct further than the app
can play them — lifting it means giving slots a table, then one constant.

The bestiary is the goblin, the practice dummy, a giant bat, a skeleton and a
giant spider. The giant spider is the only one that does not appear yet — it is
the hardest thing written and there is nothing hard enough to need it.

Levelling is milestone-based and lives in the tutorial only: beating the goblin
takes you to 2, and it is scoped to that run. `characterStore` is persisted, and
a level that survived a replay would stack every time somebody pressed "Play it
again" — a level-6 hero after six runs of one goblin fight.

Every 1st-level spell in the registry now does something. Shield is castable, but never on your own turn: it appears in the reaction
prompt when a blow is about to land, alongside Warding Flare if you have both.

Light and Thaumaturgy still do nothing — neither has a combat effect to have.
They are deliberately kept off the action bar rather than shown greyed out; a
button that will never work teaches nothing.

Guidance works, and is the only spell cast outside a fight. It appears beside a
skill check that has not been rolled yet, because that is the only moment it is
worth anything — it lends 1d4 to the next check and is spent by it.

Magic Missile hits one target with all three darts. Splitting them between
creatures is a real choice in the SRD and a click with no decision in it here,
where there is one enemy on the board.

## Licence

The code is MIT — see [LICENSE](LICENSE).

The rules are not the code. Spell text, the goblin, and the arithmetic all come
from Wizards of the Coast's System Reference Document 5.1, used under CC BY 4.0,
and that attribution travels with them wherever they go. It lives in
[NOTICE](NOTICE) along with the licences for the icons and fonts. The
divergences listed above are this project's, not the SRD's.
