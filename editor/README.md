# The Uigma editor

OpenPencil (https://github.com/open-pencil/open-pencil, MIT) at the commit pinned in `build.ts`, with `speca.patch`
(taken unchanged from Speca's Uigma plugin; "Speca" in it names the first host — Hyper uses the same hosted mode).

| file | what it is |
| --- | --- |
| `build.ts` | `bun editor/build.ts --out <dir>`: clone at the pinned commit, apply the patch, build (git + Rust) |
| `speca.patch` | the hosted mode (`?speca=1` in a frame) and the fixes below |
| `dump-tools.ts` | writes the editor's agent tools to `uigma-tools.json` next to the build |
| `pack.ts` | `bun editor/pack.ts <dir> <out.tgz> [url]`: the release archive and its sha256 for `release.json` |
| `release.json` | the archive `uigma.installEditor({})` downloads (empty until a release carries one) |

Working on the patch: check out the commit, `git apply speca.patch`, change it, `bun editor/build.ts --out <dir> --src
<checkout>` (after `bun install` and `bun run build:packages` there), and write it back with
`git add -N src/app/host && git diff > speca.patch`.

## What the patch does

The editor is a whole application — tabs, files on disk, accounts, sharing rooms, an AI chat of its own. In a Speca tab
it is one document that Speca keeps, so with `?speca=1` in its address and a framing window (`src/app/host/flags.ts`):

- it opens no home tab, no welcome and no tab bar; the menus and shortcuts for files and tabs (new, open, save as,
  close, next tab), the theme and the language switch are gone — Speca's theme and the person's language come in the
  address; its own AI chat, sharing (the narrow layout's button too) and update checks are off, it does not look for
  the desktop app's local server, a file dropped on it is not opened as a document;
- `src/app/host/bridge.ts` talks to the page that frames it by `postMessage` (only to that window, only to the origin
  that first spoke): it says it is ready, gets the file, hands back a copy of the document a moment after each run of
  edits (and when the pointer or the focus leaves the frame), and runs the requests of the person's agent through the
  same handler the editor's MCP server uses — tools, `eval`, export, undo and redo, nothing about files or settings.

The other side of that conversation is `src/uigma/$script_host.js`. The build is served by Hyper under
`/uigma/editor/` (`src/uigma/$middleware_editor.ts`, built with `--base /uigma/editor/`) with a policy that gives it
no network beyond Hyper's origin (fonts and icons from the internet only with the plugin's setting); it calls no
Hyper API itself — the file and the saves go through the host page.

## Fixes the patch carries

Bugs of the editor at the pinned commit, mended here until a newer commit has them (then the hunk goes away):

- `packages/core/src/editor/clipboard.ts` — Duplicate (⌘D, the menu) inside a frame with auto layout left the copy
  lying on its original until some other edit laid the frame out; the parents are now laid out after a duplicate, its
  undo and its redo, as they are after a delete.
- `packages/scene-graph/src/graph.ts` (`cloneSubtree`) — a copy of a layer read from a saved file, put elsewhere, came
  back on top of its original when the file was opened again: the copy was saved with the transform its source was
  read with. What a copy is given in place of its source's values is now marked as edited.

## What the patch adds to boards

Mechanics a board is expected to have, as in FigJam, that the editor at the pinned commit lacks:

- Quick create (`packages/core/src/editor/connectors/quick-create.ts`, drawn by
  `packages/core/src/canvas/overlays/quick-create.ts`, the pointer in
  `packages/vue/src/shared/input/connector/quick-create.ts`): the one selected block of a board — a shape, a sticky, a
  frame — shows a dot off each of its four sides. A dot under the pointer grows a plus and shows where the new block
  would go; a click puts a copy of the block there, empty, joined by a connector with an arrow, selects it and starts
  typing in it (one undo step; the next block made from the same side goes below or beside the first; the view moves
  when the block lands past the edge; a block made inside a section stays in it while it fits). A drag from a dot
  draws a connector from that side and leaves it selected. A block with dots shows no rotation stalk and no size
  badge — they sat where the dots are. No dots in a design file, on several selected layers, on locked ones, on a
  block smaller than 28 px on screen.

## Licenses

OpenPencil is MIT-licensed; its notice and the notices of what it bundles are in the build
(`THIRD-PARTY-NOTICES.md` in the editor folder). `SKILL.md` contains OpenPencil's authoring reference, under the
same license; its text is in `../LICENSE-OpenPencil`.
