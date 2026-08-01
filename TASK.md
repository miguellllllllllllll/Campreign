# Agent 4 — Pure design, visual system and graphic assets

Branch `feature/design-system`, worktree `.worktrees/agent-4-design`.
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

## Verifying art without a screenshot

The browser preview pane reports a 0×0 viewport in this environment, so
screenshots come back blank. `qlmanage` rasterises SVG and the result can be
opened as an image:

```sh
qlmanage -t -s 400 -o /tmp/out mydrawing.svg   # writes /tmp/out/mydrawing.svg.png
```

Two things this caught that eyeballing the markup would not have: a silhouette
that read as a completely different animal, and a path whose transcription into
the file's shorthand had broken. **Render the paths exactly as they appear in
the committed file**, not the draft you wrote them from.

## Design rules already learned

`creature-icons.tsx` opens with them, including the failures that produced them
— busts reading as the generic contact-avatar, an even-armed cross reading as an
"add" button, a spear-and-buckler reading as an arrow. Read that comment before
drawing. Add to it when something fails; that file is the record.

The short version: filled shapes, never thin strokes — a token renders at about
forty pixels and a 1.5px stroke disappears. Each shape fills its frame and is
nothing but its own emblem.

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
