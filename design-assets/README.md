# Design asset library

Source packs kept whole, for picking from later. **Nothing in here is served or
built.** It is not `public/`, and it is not imported by anything — putting the
packs here rather than in `public/` is the whole point, because `public/` ships
every byte it holds to every visitor whether a page references it or not.

Anything actually used gets copied out to `public/ui/` and named for its role,
one file per role. See NOTICE for the licences of the files that ship.

## What is here

| File | Contents |
| --- | --- |
| `kenney_fantasy-ui-borders.zip` | 280 PNGs + a 1080×1080 vector sheet |
| `kenney_ui-pack-rpg-expansion.zip` | 87 PNGs, spritesheet, vector |

Both are Kenney's, both CC0 — the licence text is extracted alongside so it can
be read without unzipping. CC0 waives copyright, so no credit is owed; NOTICE
records them anyway, because its job is to name everything somebody else made.

```sh
unzip design-assets/kenney_fantasy-ui-borders.zip -d /tmp/borders
```

## What is already taken from them

- `public/ui/divider-fantasy.png` — section-break ornament (`rule-ornament`)
- `public/ui/frame-corner.png` — card corner filigree (`corner-filigree`)
- `public/ui/frame-panel.png` — full 9-sliced frame (`frame-ornate`)

## Before taking anything else, two things worth knowing

**The packs are catalogues of alternatives, not libraries of components.** The
280 borders are six roles — Border, Panel, Divider, Divider Fade, Transparent
border, Transparent center — at roughly 32 style variants each. You want one
per role. Shipping more than that is shipping the same ornament thirty times.

**Only the borders pack can be themed, and that decides everything.** Its art is
white on transparent, so it works as a CSS `mask`: a mask has no colour of its
own and takes whatever `background-color` the element carries, which keeps
`currentColor` and the palette working. The RPG pack is baked-in colour —
`panel_brown` is `#97714a` against a surface of `#4e3018`, its bars are
`#fa8132` and `#88e060` against `blood` and `moss`. Dropping those in adds a
second palette that no retune reaches and no contrast check covers, and
`#97714a` as a surface is light enough that every accent on it fails AA.
Masking them instead throws away the shading that made them worth having.

That is why the RPG pack is stored and not used, and why its bar *look* was
rebuilt in CSS on the tokens instead — see `bar-well` in `globals.css`.

Twenty-nine of its 87 files are also arrows, ticks, crosses and cursors, which
Lucide already provides in seventeen files here, themeable and consistent.
