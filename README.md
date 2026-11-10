# Uigma for Hyper

A full Figma-like design editor and FigJam-like boards as canvas tabs of [Hyper](https://github.com/niquola/hyper-code2):
pages, frames with auto layout, components with instances and variants, variables with modes, vectors, text — and
boards with stickies, shapes with text, connectors and sections. `.fig` / `.jam` files in and out. The person edits by
hand with Figma's shortcuts; the agent edits the same open file through `ctx.fns.uigma.run` and watches the result
with `ctx.fns.uigma.shot`.

Ported from Speca's Uigma plugin. The editor is **[OpenPencil](https://github.com/open-pencil/open-pencil)** (MIT
License, © Danila Poyarkov and OpenPencil contributors — see `LICENSE-OpenPencil`) at a pinned commit with one patch
(`editor/speca.patch`): its "hosted" mode for living in a host page's frame. This plugin does not fork OpenPencil.
`SKILL.md` contains OpenPencil's authoring reference under the same license. The plugin's own code is MIT (`LICENSE`).

## What is in it

| | |
| --- | --- |
| canvas kinds | `uigma.file` (design) and `uigma.board` (board), args `{ name, from? }` |
| agent API | `uigma.run`, `uigma.shot`, `uigma.help`, `uigma.list`, `uigma.read`, `uigma.authoring`, `uigma.editorStatus`, `uigma.installEditor` (plain documented functions — see the Functions tab of `/plugins/uigma`) |
| routes | `/uigma` (documents, editor status), `/uigma/tab/:name` (the host page a tab frames), `/uigma/doc/:name`, `POST /uigma/save/:name`, `/uigma/bridge/:name` (SSE), `POST /uigma/reply/:name`, `/uigma/host.js` |
| table | `uigma_docs` (`$migration_20261110120000_uigma_docs.ts`) |
| settings | `uigma.editorDir`, `uigma.dataDir`, `uigma.editorPort`, `uigma.editorHost`, `uigma.editorUrl`, `uigma.online` |
| editor | `editor/build.ts` (build), `editor/speca.patch`, `editor/dump-tools.ts`, `editor/pack.ts` (release archive), `editor/release.json` (pinned archive) |

How it fits together:

```
canvas tab (Hyper page) ─iframe→ /uigma/tab/<name>  (host page, Hyper origin: CSRF, file, saves)
                                   └─iframe→ http://127.0.0.1:47320/?speca=1&type=…  (editor, its own origin)
agent: uigma.run ─→ hub (ctx.state.uigma) ─SSE /uigma/bridge→ host page ─postMessage→ editor
                    ←────────── POST /uigma/reply ←──────────── host page ←─────────── result
editor ─postMessage {save}→ host page ─POST /uigma/save?base=rev→ <dataDir>/docs/<name>/<rev>.fig + uigma_docs
```

The editor's page is served by the plugin's own static server on another origin than Hyper's, with a CSP that gives
it no network (fonts and icons only with `uigma.online`): it holds no Hyper session and gets the file only from the
host page by `postMessage`. The host protocol is the patch's, unchanged (`src/app/host/bridge.ts` in the patch):

```
host → editor   {uigma:'init', doc, name, type, canEdit, theme} · {uigma:'call', id, command, args} · {uigma:'cancel', id}
                {uigma:'flush'} · {uigma:'theme', theme}
editor → host   {uigma:'ready', version} · {uigma:'loaded', summary} · {uigma:'dirty'} · {uigma:'clean'}
                {uigma:'save', seq, bytes, summary} · {uigma:'result', id, ok, result|error} · {uigma:'failed', error}
```

**The `?speca=1` flag.** Hosted mode is switched on by `speca` in the editor's address (`src/app/host/flags.ts` of
the patch). It is kept as is, so one build serves Speca and Hyper alike (the Speca build was used to verify this
plugin). Renaming it (e.g. to `?hosted=1`) is a one-line change in `flags.ts` (`params.has('speca')`) plus the
address in `$route_tab_$name_GET.ts`; do it only together with a new release archive.

## Install

```js
await ctx.fns.plugins.install({ name: "uigma" })                       // preview, then confirmed: true, expectedDigest
```

or as a user plugin: clone this repository into a direct child of `USER_PLUGINS`. Migrations: `procs.migrate.up({})`
(the catalog install runs them).

### The editor

The build (≈45 MB, a 8.9 MB WebAssembly file, 3.7 MB scripts) is over the 2 MB / 20 MB package limits, so it is
installed separately into `uigma.editorDir` (default `<Hyper home>/uigma/editor`):

```js
await ctx.fns.uigma.editorStatus({})                                  // installed? how?
await ctx.fns.uigma.installEditor({})                                 // download the release archive, sha256-checked
await ctx.fns.uigma.installEditor({ mode: "build" })                  // or build OpenPencil + patch (git, Rust; minutes, background)
await ctx.fns.uigma.installEditor({ mode: "copy", from: "/path/to/build" })
```

By hand: `bun editor/build.ts --out ~/.hyper/uigma/editor`. Until the editor is there a Uigma tab says so and how to
install it. Hyper on another machine than the browser: put the editor port behind a reverse proxy on its own host
name and set `uigma.editorUrl` (https when Hyper is https); `uigma.editorHost` sets the listen address.

## Listing

`hyper-code-harness/plugins` → `plugins/uigma.json`:

```json
{
  "name": "uigma",
  "label": "Uigma",
  "icon": "ph-bezier-curve",
  "description": "Design files and boards in a full Figma-like editor on the canvas (OpenPencil): frames, auto layout, components with variants, variables, stickies, connectors; .fig files; the agent edits the same open file.",
  "source": "github:<owner>/uigma"
}
```

## Releasing

1. Bump `version` in `package.json`, commit, `git tag vX.Y.Z`, push the tag.
2. The editor archive (when the pinned commit or the patch changed, or for the first release):
   `bun editor/build.ts --out .editor && bun editor/pack.ts .editor uigma-editor-<version>.tgz <asset url>`;
   attach the `.tgz` to the GitHub release of the tag, put the printed `url` and `sha256` into `editor/release.json`,
   commit and tag again (a patch release). `installEditor({})` then downloads exactly that archive.

## Tests

```bash
bun <hyper-code>/script/plugin-test.ts .
```

needs Hyper's test Postgres (`TEST_DATABASE_URL`, `hyper-db-test` on 127.0.0.1:54399). They cover documents and
revisions with conflicts, the routes (CSRF on saves), the hub between an agent's call and an open editor (a stand-in
editor answers), the tool catalogue, the editor's static server and its CSP, and install by copy and by download with
a sha256 check. The real editor was checked by hand in a throwaway Hyper (a board opened in a canvas tab, drawn with
`uigma.run`, saved as revision 2 with 21 layers, `uigma.shot` returned a 1600×925 PNG); `.shots/` keeps such pictures
locally (gitignored).

## Limits

- The editor works only while a tab of the document is open in someone's browser (it is a live page); agents' calls
  wait 30 s for it, then answer "not open".
- One editor answers for a document: the newest open, editable one. Two people editing the same document at once get
  the conflict choice ("open the fresh version" / "save mine over it") — there is no real-time co-editing.
- Every signed-in person may open and change every document (as with Excalidraw drawings); there is no per-document
  sharing or view-only role, and no saved-version view of a tab (Speca's "past revision" view is dropped).
- The editor's own server is reached directly by the browser: by default only a browser on the Hyper machine;
  otherwise a reverse proxy and `uigma.editorUrl`.
- Documents up to 96 MB; the last 30 revisions are kept on disk.
- Dropped from the Speca plugin: per-user file storage and the person's Files (pictures go by path; screenshots are
  files under `<dataDir>/shots`), audit events, the preview-proxy tickets, the authoring skill's generation at build
  time (the build copies OpenPencil's reference to `authoring-reference.md`; `uigma.authoring({})` reads it).
- Icons and web fonts need `uigma.online`; `web_search` and `stock_photo` of OpenPencil's app are hidden.
