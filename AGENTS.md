<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Three sessions work this repo

Ownership is **vertical**. A feature includes the UI that surfaces it — a spell
is not done until something can cast it. Splitting by layer was tried and fails
on contact: shipping Shield meant editing `ReactionBanner.tsx`, and shipping the
grid tokens meant editing `monsters.ts`.

| Domain | Owns | Where |
| --- | --- | --- |
| Rules & content | `src/lib/dnd`, `src/content`, `src/stores`, `src/types`, `tests`, `README.md`, `components/{tutorial,combat,dice}` | `Campreign-rules` on `rules` |
| Interface | `src/app`, `components/ui`, `components/character`, `globals.css`, `public` | `Campreign-ui` on `interface` |
| Pure design | `globals.css`, `components/ui/{creature-icons,custom-icons}.tsx`, inline SVG artwork | `Campreign-design` on `feature/design-system` |

Design overlaps interface on `globals.css` and the two icon files. That is
deliberate and safe for the same reason the accessibility carve-out below is:
both are aesthetic edits that change no behaviour, so a genuine collision shows
up as an ordinary merge conflict rather than as two people disagreeing about
what the code should do.

**The table maps a role to a branch, not to a person.** More than one session
can hold the same role, and when that happens the table cannot tell you which
checkout is yours — so a direct statement from another session about where they
are sitting outranks this document. That is not hypothetical: a second rules
session read "rules works in `Campreign-rules`" here, took it over the plain
statement that the worktree was already occupied, and wrote its work into
somebody else's tree. The document was accurate and still caused the collision,
because it answered a question nobody should have been asking it.

If you are the second session in a role: take a branch of your own off `main`,
and say so.

`Campreign` on `main` is the integration checkout. Every session works on its
own branch in its own worktree and merges to `main`; nobody edits `main`
directly. That is not bureaucracy — the rules session lived in the `main`
checkout until a second chat began editing the same directory, and the first
symptom was a test failing on a spell that existed in one read and not the next.
A branch per session makes a second chat in the same directory an ordinary
merge instead of a file changing under you mid-command.

Separate worktrees, one `.git`, all **siblings** of each other. Commits are
shared the moment they are made; uncommitted state is not, which is the entire
point — a torn working tree is invisible to `git log` and breaks the build
anyway.

Siblings rather than nested, and that is not cosmetic. A worktree placed inside
this one was linted as part of it: 88 errors from another session's dependencies,
which would have failed *this* session's commit gate for code it does not own.
Git ignoring a directory does not make the toolchain ignore it, and nesting
reintroduces through the filesystem exactly the coupling the branches exist to
remove.

## Two carve-outs: accessibility, and pure design

Ownership by directory cannot express that two different *kinds* of change land
in the same file. A new spell needs a button — that is the rules session
surfacing a mechanic, and it is why `components/combat` sits on their side.
Accessibility, keyboard semantics, ARIA and responsive layout are a different
kind of edit entirely: the rules session will not make them, and they alter no
behaviour.

Those belong to the interface session **in any file**, provided the change adds
no import from `lib/dnd` or `content` and changes no behaviour. Colour,
typography, artwork and animation are the same kind of edit under the same
condition, and belong to the design session on those terms. The two kinds
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

## Compile-coupled pairs cannot be split across sessions

`creature-icons.tsx` declares `Record<TokenId, ReactNode>` while `TokenId` lives
in `src/types/combat.ts`. Widening the union without adding the shape reddens
the build for whoever pulls next, so the two must land together — which means
they cannot sit on opposite sides of a boundary.

The split is by *kind of change* rather than by file:

- **Adding or removing an entry** belongs to whoever owns the union — the rules
  session lands the new `TokenId` and a serviceable shape in one commit.
- **Redrawing an existing entry** is pure artwork, needs no coordination, and
  belongs to design.

This generalises. Where a type and its exhaustive consumer sit in different
domains, the domain that owns the type owns *adding the case*; the other owns
what the case looks like.

## A layer split was tried, and the numbers say why it failed

Worth recording so it is not proposed a third time. Measured over 38 consecutive
commits, **74% touched more than one layer** — five touched four or five of
them. Splitting engine from stores from components from styles would have put a
coordination step in front of three commits out of four.

Vertical ownership is not a preference. It is what the change sizes in this
repository actually are.

## The stash is shared; the working trees are not

`git stash` and `git stash pop` operate on one stack for the whole repository,
across every worktree. Stashing to test something against a clean `HEAD` will
therefore pop whatever is on top when you come back — which may be another
session's work, not yours.

Do not stash in this repository. To compare against `HEAD`, read it directly:

```sh
git show HEAD:src/content/spells.ts | grep …    # no working tree involved
git diff -- <explicit paths> > /tmp/mine.patch  # lift your own work, read-only
```

Both are read-only on every checkout, which is the property that matters when
you are not the only writer.

## A file mid-write in another worktree looks exactly like a bug

Twice now a session has started debugging a failure that was another session
saving a file. Once it was a preset referencing a spell that existed in one read
and not the next; once it was a test whose imports had not landed yet.

The tell is that the evidence does not hold still. Before hunting a failure you
cannot explain, check whether the file is changing:

```sh
md5 -q <file>; sleep 15; md5 -q <file>   # same twice = the ground is stable
```

If it moved, you are reading somebody's half-finished thought, not a defect.

## `npm test` cannot see type errors

Node's runner strips types rather than checking them, so a type error passes
383/383 while `next build` fails. Tests green is not a signal that the build is.
Gate every commit on **`typecheck`, `lint`, `test` and `build`** — all four.

Stage explicit paths. `git add -A` in a shared checkout captures whatever the
other session is halfway through writing, and has already produced a commit
whose message described work it did not contain.
