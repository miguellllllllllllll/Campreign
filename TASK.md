# Agent 4 — Pure design, visual system and graphic assets

Branch `feature/design-system`, worktree `/Users/miguelvinluan/Campreign-design`.
The authoritative contract is `AGENTS.md` on `main`; this is the working brief.

## What you own

- `src/app/globals.css` — Tailwind v4 `@theme` tokens, palette, typography scale
- `src/components/ui/creature-icons.tsx` — the silhouettes on the battle map
- `src/components/ui/custom-icons.tsx` — line-work action icons
- Any inline SVG artwork, aura and glow treatments, micro-animation

There is no `src/styles/` and no Tailwind config file. This project uses
Tailwind v4, where the theme is declared **inline in `globals.css`** with
`@theme` and `@utility`. Looking for a `tailwind.config.js` is a dead end.

## The one rule

**Change how it looks, never what it does.** Concretely, a change of yours must
not add an import from `lib/dnd` or `content`, and must not alter behaviour.
Within that limit you may touch *any* file — the same carve-out `AGENTS.md`
already grants for accessibility work, and for the same reason: a colour and a
Shield button do not touch the same lines, and on separate branches a genuine
overlap surfaces as an ordinary merge conflict rather than a torn tree.

## The boundary that actually bites: `TokenId`

`creature-icons.tsx` declares `SHAPES: Record<TokenId, ReactNode>`, and
`TokenId` lives in `src/types/combat.ts`, which you do not own. That coupling is
compile-time, so it splits cleanly along one line:

- **Adding or removing an entry** is the rules session's, because widening the
  union without the shape reddens the build for whoever pulls next. They land
  the union member and a serviceable shape in one commit.
- **Redrawing an existing entry** is yours, and needs nothing from anybody — it
  is `d="…"` and nothing else.

The five creature tokens currently on `main` were drawn by the rules session to
be legible rather than good. Redrawing them is squarely your work.

## Verifying art

The browser preview works. This file used to say the pane reports a 0×0
viewport and screenshots come back blank; that was a preview belonging to
*another* session, running a dev server in this same folder, which this
session's browser tools cannot reach. Start your own and it is fine:

```
preview_start name "hero-step-design"    # 5193, then screenshot as normal
```

Take that route for anything about the app — layout, spacing, a colour in
context, whether a token reads against the square it sits in.

For the drawings themselves, `qlmanage` is still the better instrument, and not
because screenshots are broken. It rasterises an SVG at an exact pixel size, so
you can put every shape on one sheet at the size it actually ships at:

```sh
qlmanage -t -s 400 -o /tmp/out mydrawing.svg   # writes /tmp/out/mydrawing.svg.png
```

That is the check that earns its keep. **Render the shapes exactly as they
appear in the committed file** — parse the file, do not re-type the draft you
drew from — and lay them out *together, at shipping size*. Four things it has
caught that eyeballing the markup would not:

- a silhouette that read as a completely different animal;
- a path whose transcription into the file's shorthand had broken;
- the dummy token, which was perfectly legible on its own and identical to the
  cleric next to it — visible only on a sheet of all of them at once;
- every icon in `custom-icons.tsx`, drawn on a 24 grid and shipped at 12–18,
  which is a failure you cannot see at any size but the real one.

Legible is not the same as distinct, and neither is visible at the wrong size.

## Design rules already learned

Both icon files open with them, including the failures that produced them —
busts reading as the generic contact-avatar, an even-armed cross reading as an
"add" button, a spear-and-buckler reading as an arrow, a boot reading as a lab
flask. Read those comments before drawing. Add to them when something fails;
those files are the record, and most of what is in them was only learnable by
getting it wrong.

The short version, and the two halves pull opposite ways:

- **Tokens** (`creature-icons.tsx`) are filled shapes, never thin strokes.
  `QuestionStep` asks for 26, `MonsterPlate` for 30, `PracticeArena` for 58,
  and `CombatGrid` for 68% of a square, which is the small end of that range.
  A 1.5px stroke disappears at any of them. Each shape fills its frame and is
  nothing but its own emblem.
- **Action icons** (`custom-icons.tsx`) are line work at 12–18px, which is
  *smaller* than the tokens despite the 24 grid the viewBox implies. Check the
  call sites before drawing; nothing asks for 24. The budget is roughly two
  marks, and interior detail is what dies first.

Both come back to the same thing: draw for the size it ships at, and judge it
next to its neighbours rather than on its own.

## Running it

`node_modules` is not shared between worktrees and is not in git, so a fresh
worktree needs its own install. That has already been done here.

```sh
npm install                     # only if node_modules has gone missing
npm run dev -- --port 5193      # 5190 and 5192 are taken by the other sessions
```

There is a `hero-step-design` entry in the central `~/.claude/launch.json`
pointing at this worktree on 5193.

## Before every commit

Gate on **all four**: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build`. Node's test runner strips types rather than checking them, so a
type error passes the tests and fails the build.

Stage explicit paths. Never `git add -A` — this is a shared checkout and that
has already produced a commit whose message described work it did not contain.
