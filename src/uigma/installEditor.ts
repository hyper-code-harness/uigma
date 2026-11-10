/**
 * Installs the Uigma editor (OpenPencil with this plugin's hosted-mode patch) into the uigma.editorDir folder. The
 * build is 45 MB with an 8.9 MB WebAssembly file, so it cannot ship inside the plugin; three ways to get it:
 *
 * - `download` (default when editor/release.json names an archive): fetches the prebuilt archive of this plugin's
 *   GitHub release, checks its sha256 against the pinned one, unpacks it in place of the old build;
 * - `build` (default without a release archive): clones OpenPencil at the pinned commit, applies editor/speca.patch
 *   and builds it — needs git and Rust (cargo); runs in the background for a few minutes, follow it with
 *   uigma.editorStatus({}) (its `install.log`);
 * - `copy`: takes an existing build folder (`from`), e.g. one built on another machine.
 *
 * An open Uigma tab picks a new build up when it is reloaded. Ask the person before running it: it downloads or
 * builds code that runs in their browser.
 * @param opts.mode download, build or copy. @default download when a release archive is pinned, else build
 * @param opts.from For copy: the folder with index.html of a built editor.
 * @param opts.url For download: an archive (.tgz) other than the pinned one; needs `sha256`.
 * @param opts.sha256 For download with `url`: the archive's sha256 (hex).
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** download, build or copy. @default download when a release archive is pinned, else build */
    mode?: "download" | "build" | "copy";
    /** For copy: the folder with index.html of a built editor. */
    from?: string;
    /** For download: an archive (.tgz) other than the pinned one; needs `sha256`. */
    url?: string;
    /** For download with `url`: the archive's sha256 (hex). */
    sha256?: string;
}): Promise<{ ok: boolean; mode: string; dir: string; version?: string; started?: boolean; log?: string; message: string }> {
    const { cp, mkdir, rename, rm } = await import("node:fs/promises");
    const { existsSync } = await import("node:fs");
    const { dirname, join, resolve } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const cfg = await ctx.fns.uigma.config({});
    const dir = cfg.editorDir;
    const pluginRoot = resolve(import.meta.dir, "..", "..");
    const release = await Bun.file(join(pluginRoot, "editor", "release.json")).json().catch(() => ({})) as { url?: string; sha256?: string };
    const mode = opts.mode ?? (opts.url || release.url ? "download" : "build");
    const state = ((ctx.state as any).uigma ??= {}) as types.uigma.State;
    if (state.install && !state.install.done) return { ok: false, mode, dir, started: false, log: state.install.log, message: `an install (${state.install.mode}) is already running — follow it with uigma.editorStatus({})` };

    // the new build goes next to the old one and takes its place whole, so a failure leaves the old one working
    const swapIn = async (next: string) => {
        if (!existsSync(join(next, "index.html"))) { await rm(next, { recursive: true, force: true }); throw new Error("uigma.installEditor: the build has no index.html"); }
        await rm(dir, { recursive: true, force: true });
        await rename(next, dir);
        await ctx.fns.uigma.stopEditorServer({});
        const meta = await Bun.file(join(dir, "uigma.json")).json().catch(() => ({})) as { version?: string };
        return meta.version ?? "";
    };
    await mkdir(dirname(dir), { recursive: true });
    const next = `${dir}.next`;

    if (mode === "copy") {
        const from = resolve(String(opts.from ?? "").replace(/^~(?=\/)/, String(ctx.env.HOME ?? "")));
        if (!opts.from || !existsSync(join(from, "index.html"))) throw new Error(`uigma.installEditor: ${opts.from ?? "from"} is not a built editor (no index.html)`);
        if (resolve(from) === resolve(dir)) return { ok: true, mode, dir, message: "the editor is already there" };
        await rm(next, { recursive: true, force: true });
        await cp(from, next, { recursive: true });
        const version = await swapIn(next);
        return { ok: true, mode, dir, version, message: `the editor ${version} is installed in ${dir}` };
    }

    if (mode === "download") {
        const url = opts.url ?? release.url;
        const sha = (opts.url ? opts.sha256 : release.sha256 ?? opts.sha256)?.toLowerCase();
        if (!url) throw new Error("uigma.installEditor: no release archive is pinned in editor/release.json yet — use { mode: \"build\" } or { mode: \"copy\", from }");
        if (!sha || !/^[0-9a-f]{64}$/.test(sha)) throw new Error("uigma.installEditor: a download needs its sha256 (64 hex characters)");
        const res = await fetch(url, { redirect: "follow" });
        if (!res.ok) throw new Error(`uigma.installEditor: ${url} answered ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const got = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
        if (got !== sha) throw new Error(`uigma.installEditor: the archive's sha256 is ${got}, expected ${sha} — nothing was installed`);
        const tgz = join(tmpdir(), `uigma-editor-${Date.now()}.tgz`);
        await Bun.write(tgz, bytes);
        await rm(next, { recursive: true, force: true });
        await mkdir(next, { recursive: true });
        const p = Bun.spawn(["tar", "-xzf", tgz, "-C", next], { stdout: "ignore", stderr: "pipe" });
        const code = await p.exited;
        await rm(tgz, { force: true });
        if (code !== 0) { await rm(next, { recursive: true, force: true }); throw new Error(`uigma.installEditor: could not unpack the archive: ${(await new Response(p.stderr).text()).slice(0, 300)}`); }
        const version = await swapIn(next);
        return { ok: true, mode, dir, version, message: `the editor ${version} is installed in ${dir} (sha256 checked)` };
    }

    if (mode !== "build") throw new Error(`uigma.installEditor: mode is download, build or copy (got ${mode})`);
    if (!Bun.which("git")) throw new Error("uigma.installEditor: building needs git on this machine");
    await mkdir(cfg.dataDir, { recursive: true });
    const log = join(cfg.dataDir, "install-editor.log");
    const install: NonNullable<types.uigma.State["install"]> = { mode, startedAt: Date.now(), log, done: false, code: null };
    state.install = install;
    // one log for both streams; the build replaces the editor folder only when it succeeds
    const p = Bun.spawn(["sh", "-c", 'exec "$0" "$1" --out "$2" --work "$3" >"$4" 2>&1', process.execPath, join(pluginRoot, "editor", "build.ts"), dir, join(cfg.dataDir, "build"), log], {
        cwd: pluginRoot, stdout: "ignore", stderr: "ignore", env: { ...process.env },
    });
    p.exited.then(async code => {
        install.code = code; install.done = true;
        if (code === 0) await ctx.fns.uigma.stopEditorServer({});
        else install.error = `the build failed (exit ${code}) — see ${log}`;
    }, e => { install.done = true; install.error = String(e); });
    return { ok: true, mode, dir, started: true, log, message: `building OpenPencil with the patch into ${dir} — a few minutes; uigma.editorStatus({}) says when it is done, ${log} shows the build` };
}
