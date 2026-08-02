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
  that teaches movement, then action, then ending the turn. Winning opens a second
  fight against two foes at once, which is where choosing a target becomes a
  decision, and then a third against the one thing down there that bites back.

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

## Who you were, and what is wrong with you

Six backgrounds — Guild Artisan, Street Urchin, Noble, Acolyte, Soldier,
Outlander — each training two skills and carrying three weaknesses of its own.

**Or you can write your own.** Below the pickable weaknesses is a box: one
sentence in your own words, and it is used instead of anything selected above.
Clearing it hands you back to the list. Safe to be free text because nothing
mechanical hangs off a flaw — `Personality.flaw` is a plain string that reaches
the sheet and the printed page and stops there — so the only rules are "not
empty" and a 140-character ceiling the engine enforces itself rather than
trusting the field to.

**And you can pick the two skills yourself.** The background offers "the usual
two" or "choose my own", and choosing your own replaces its pair with any two of
the eighteen. Only the training changes — the trinket, the ideal and the bond
still come from the life you picked, because a soldier who learned medicine
instead of intimidation is still a soldier.

Safe for the same reason the free-text weakness is: a background's skills were
never load-bearing anywhere else. `Character.skillProficiencies` is a resolved
list that the sheet, the printed page and every check read directly, so nothing
downstream has to learn that the pair was swapped. The class's own training is
merged on top and cannot be traded away — a fighter keeps athletics whatever the
background does, which is why swapping a soldier's pair drops intimidation and
leaves athletics standing.

The two questions are invisible until you ask for them. An empty choice list is
how a field hides itself here, and it is also how the step decides it has been
answered — so the fast path costs a beginner nothing, and the second list drops
whatever the first one took rather than offering a choice that cannot be made.

**A weakness is not chained to a background.** Each background's own three come
first, because they are the obvious answer and a beginner should find it at the
top. After them sit eight anyone can carry, marked as such. Nothing mechanical
hangs off a flaw — it is pure personality — so there was never a reason a street
urchin could not also be a coward, and chaining them kept the whole cast to nine
possible people. It is sixty-six now, and none of it needed a new mechanic.

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
- **A paladin's spell slots buy spells *and* Divine Smite.** They gain two at
  2nd level along with a short prepared list — Charisma modifier plus half
  level, which is the SRD's. Before either existed the slots arrived with
  nothing at all to spend them on, which is the inert-resource failure this
  project keeps catching, and it shipped once.

  A paladin has no magic at 1st level, so there is no creation step in which to
  choose a list; levelling hands them one. Given rather than chosen, matching
  the fast-track ethos the creation flow already uses.

  **Searing Smite and Heroism are not here, and the level-1 preview no longer
  claims them.** One needs damage that keeps ticking on later turns and the
  other needs temporary hit points; neither subsystem exists, so writing them
  would have put two inert spells on the sheet to keep a promise that was itself
  the mistake. That preview is now derived from the registry rather than
  hand-written beside it, so it cannot drift again.

  The smite is armed *before* the swing and spent only if it lands, which
  diverges from the SRD's decide-after-you-know. It follows the Trip Attack
  precedent beside it: a second prompt in the middle of an attack is the
  reaction-shaped problem that machinery exists to avoid.
- **Your specialisation switches on at 2nd level, not at creation.** You pick it
  during creation and the choice is remembered; the numbers arrive when you
  level. Everything used to work from level 1, which handed a beginner the whole
  kit before they had swung once and left the level-up with nothing to give them
  but hit points.

  One level for all ten rather than the SRD's spread, which puts a cleric's
  domain at 1, a wizard's school at 2 and a fighter's archetype at 3. Two of
  those sit past this build's cap of 2, so honouring the spread would mean three
  classes whose specialisation could never turn on at all — a simplification
  beats permanently dead choices. Every feature description names the level it
  starts, because the sheet and the print view render that text verbatim.
- **Every caster style carries an attack cantrip, chosen for reach rather than
  flavour.** Reach is the variable that decides the second encounter on a
  five-square board: 3000 simulated runs per build put Mercy & Mending — which
  had no attack cantrip and therefore no range beyond a mace — at a 53% chance
  of ending the fight unconscious, against 22% for the other cleric styles and
  3% for a paladin. Holding damage constant and changing only range took the
  same cleric from 53% to 19%.

  The cost is written down in `spellPresets.ts`: only three cleric cantrips here
  do anything, and there are three styles wanting three each, so once Sacred
  Flame is compulsory one style must carry a flavour cantrip. The honest fix is
  more working cleric cantrips rather than a cleverer shuffle of five.
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
- **A short rest gives hit points back and spells not at all.** That is the
  SRD's rule and the lesson is the point: what you spend in the first fight is
  gone in the second, so spending it was a decision. Hit points *are* restored,
  because the alternative is an unwinnable encounter for anyone who finished the
  last one at two of them. Slots carry no such risk — the second fight was
  measured at a 90% win with no spells cast at all.

  A wizard is the exception, which is what Arcane Recovery is for. Before this
  the rest returned every slot to everybody, so the feature described something
  the game already did for free, for every class.
- **Cunning Action is Dash, and only Dash.** The SRD adds Disengage and Hide;
  nothing on a five-square board threatens an opportunity attack and there is
  nothing to hide behind, so both would be buttons that change no number.
  Shipping three options where two do nothing teaches a beginner that most of
  their class feature is decoration.
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

Levels past 3. Third level is the cap now, and the reason moved rather than
vanished. It used to be that `Character.spellSlots` was a single number meaning
first-level slots, so a 3rd-level caster could not be represented; slots are a
table indexed by spell level now, and both casting classes have a second-level
spell to spend one on — Shatter for the wizard, Blindness for either.

Four is out because 4th level is an ability score improvement, which is a
question about the creation flow rather than about a fight, and nothing in the
tutorial knows how to ask it. `SPELL_SLOTS_BY_LEVEL` is still written past the
cap for the same reason as before: the rules are correct further than the app
can play them.

The bestiary is the goblin, the practice dummy, a giant bat, a skeleton and a
giant spider, and all five now appear. The spider closes the tutorial on its
own: it is the hardest thing written, and its bite is the only attack that makes
the player roll a saving throw rather than an enemy.

Levelling is milestone-based and lives in the tutorial only. Both levels land
together, before the spider: the goblin is worth nothing, because one cornered
goblin is not worth as much as the rest of the cellar, and because a full caster
needs third level for the second-tier slots that Shatter and Blindness are cast
from. A level granted after that fight would arrive with nothing to spend it on.

Scoped to the run, and deliberately. `characterStore` is persisted, and a level
that survived a replay would stack every time somebody pressed "Play it again" —
a level-6 hero after six runs of one goblin fight.

Every 1st-level spell in the registry now does something. Shield is castable, but never on your own turn: it appears in the reaction
prompt when a blow is about to land, alongside Warding Flare if you have both.

Light and Thaumaturgy still do nothing — neither has a combat effect to have.
They are deliberately kept off the action bar rather than shown greyed out; a
button that will never work teaches nothing.

### The balance numbers run themselves now

Sentences like "the party wins 59% against the spider alone" decide things — that
one is the reason the spider fights without company. They were all measured by
scripts that were run once and thrown away, so nothing could re-check them after
a monster changed, and one note in the bestiary went on claiming the giant spider
had no venom for several commits after it grew a 2d8 one.

`tests/balance.test.ts` plays each tutorial encounter 600 times on a fixed seed
and asserts the documented shape still holds. It imports `rosterFor` from the
store rather than rebuilding the roster, which is the point: a copy would measure
the fight somebody remembered writing, and would stay green through exactly the
change the test exists to catch. Adding a second monster to the rafters drops the
party to 38% and turns it red.

It also covers all five classes, which turned out to matter. The figures were
measured on a fighter and written down as "the party", and running the rest
found a defect in the simulation rather than the design: `takeAutomaticTurn`
swung `attacks[0]`, always the melee weapon, so an auto-played wizard walked
across the cellar holding Fire Bolt to hit things with a stick. It won 17% of
the rafters. Choosing by reach and damage instead puts it at 54%.

That fix is a provable no-op for the shipped game — every monster and the squire
carry exactly one attack, and a test asserts it, so the choice can only start
deciding real fights if somebody gives a monster a bow. It did move the
documented numbers, because a fighter now throws its handaxe while closing
instead of arriving empty-handed: 59% became 67%.

What survives is a real spread. A fighter takes the rafters about twice as often
as a life cleric, 67% against 35%, and the floor is set at a third. The healer is
the build this measurement flatters least — auto-play never heals — which is
exactly why the floor is generous rather than tight.

### What the floor hides, and the one thing it does not

The floor plays nobody's spells, which is honest and flattens the classes whose
kit *is* spells. `winRate(..., casts)` puts a number beside it with a meagre
caster — heal yourself under half, otherwise throw the biggest damaging spell
that resolves, otherwise swing:

    rafters, level 2      no-cast   casting
    wizard/evocation        54.0      92.3
    cleric/light            51.8      82.5
    paladin/devotion        65.2      64.3
    cleric/life             35.3      32.2
    fighter/champion        69.3      69.3

So the wizard's floor understated it by nearly forty points, and any conclusion
drawn from the no-cast figures about a caster was worth very little.

The exception is the finding. **The life cleric goes down when it starts
casting**, and it is the weakest build in the rafters under either policy. The
only thing `healersMercy` gives it to spend an action on is healing, and against
one enemy hitting as hard as the spider, healing loses the race — a turn traded
for hit points you are about to lose again is worse than a turn traded for
damage. That is a real property of 5e rather than a simulation artifact, and the
two policies agreeing on it while disagreeing about everything else is the
reason to believe it.

Recorded rather than acted on. Whether to soften the fight, give the style
something offensive, or accept the number because a human plays better than any
of this, is a design call and not one a measurement gets to make.

The bands are wide on purpose. Pinning 59.2% would fail on noise and teach a
reader to ignore the test; the assertions say "a close fight the party usually
takes", "not a coin flip", and — the claim that survives both numbers drifting —
that the rafters are harder than the fight before them. A change that made the
last one false would run the tutorial's difficulty curve backwards while both
individual figures still looked reasonable.

**Resistance is absent on purpose, and the reason is arithmetic.** It was the
obvious fourth working cantrip: the SRD lends 1d4 to a saving throw, the
`guideCheck` machinery for lending a die already existed, and the giant spider's
venom finally gave the game a save the *player* rolls. Reachable at last — and
measured before it was written, which is what stopped it. Over 200,000 rolls
against that save it prevents **0.07** damage for a fighter and **0.23** for a
caster, where spending the same action on an attack deals **4.43**. Generous
figures, too, since the spell is spent by the first save. Three multiplications
kill it: the spider has to hit, the d4 has to be the thing that flips the save,
and the swing is only half against full of 2d8.

The one change that would make it good would make this app teach a lie. The
save that matters is the concentration check — losing Bless mid-fight is worth
far more than half of 2d8 — but Resistance *is* concentration, so it can never
protect another concentration spell. Dropping that requirement would make it
genuinely useful and genuinely not Resistance.

It becomes worth revisiting when more than one monster forces a save. Until
then it would be a button nobody should press, which is the same reason Light
and Thaumaturgy are not on the bar.

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
