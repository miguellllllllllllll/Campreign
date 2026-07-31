<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Two sessions work this repo

Ownership is **vertical**. A feature includes the UI that surfaces it — a spell
is not done until something can cast it. Splitting by layer was tried and fails
on contact: shipping Shield meant editing `ReactionBanner.tsx`, and shipping the
grid tokens meant editing `monsters.ts`.

| Domain | Owns | Where |
| --- | --- | --- |
| Rules & content | `src/lib/dnd`, `src/content`, `src/stores`, `src/types`, `tests`, `README.md`, `components/{tutorial,combat,dice}` | `Campreign` on `main` |
| Interface | `src/app`, `components/ui`, `components/character`, `globals.css`, `public` | `Campreign-ui` on `interface` |

Separate worktrees, one `.git`. Commits are shared the moment they are made;
uncommitted state is not, which is the entire point — a torn working tree is
invisible to `git log` and breaks the build anyway.

## One carve-out: accessibility and layout

Ownership by directory cannot express that two different *kinds* of change land
in the same file. A new spell needs a button — that is the rules session
surfacing a mechanic, and it is why `components/combat` sits on their side.
Accessibility, keyboard semantics, ARIA and responsive layout are a different
kind of edit entirely: the rules session will not make them, and they alter no
behaviour.

Those belong to the interface session **in any file**, provided the change adds
no import from `lib/dnd` or `content` and changes no behaviour. The two kinds
are orthogonal — a roving tabindex and a Shield button do not touch the same
lines — and on separate branches a genuine overlap surfaces as an ordinary
merge conflict rather than a torn tree.

Worth knowing why this was needed: only `ActionBar.tsx` in `components/combat`
imports rules logic at all. The other five are presentation the rules session
happens to edit when a mechanic lands.

## Shared types are the seam

Both domains legitimately need `src/types/combat.ts`, and every build break so
far has happened there. The rule follows the failures rather than taste:

- **Optional** field additions are safe for either side, always. `tokenId?` and
  `cosmetics?` were added mid-flight by the other session and broke nothing.
- **Required** fields, renames and removals must land as **one atomic commit**
  carrying every call site. A required `tokenId` on `MonsterPreset` without the
  presets that set it, and `PendingReaction.kind` renamed to `options` without
  its two readers, each reddened `main`.

## `npm test` cannot see type errors

Node's runner strips types rather than checking them, so a type error passes
383/383 while `next build` fails. Tests green is not a signal that the build is.
Gate every commit on **`typecheck`, `lint`, `test` and `build`** — all four.

Stage explicit paths. `git add -A` in a shared checkout captures whatever the
other session is halfway through writing, and has already produced a commit
whose message described work it did not contain.
