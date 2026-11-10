/**
 * Tells whether the Uigma editor is installed and how to get it: its folder, version and pinned OpenPencil commit,
 * how many agent tools it has, the origin it is served from, and the state of a running or finished install.
 *
 * Use first when a Uigma tab says the editor is missing, or before uigma.installEditor.
 */
export default async function (ctx: Context, _session: Session | null, _opts: {}): Promise<{
    installed: boolean; dir: string; version: string; commit: string; builtAt: string; tools: number;
    install: { mode: string; startedAt: number; log: string; done: boolean; code: number | null; error?: string } | null;
    howToInstall: string;
}> {
    const { join } = await import("node:path");
    const cfg = await ctx.fns.uigma.config({});
    const installed = await Bun.file(join(cfg.editorDir, "index.html")).exists();
    const meta = installed ? await Bun.file(join(cfg.editorDir, "uigma.json")).json().catch(() => ({})) as Record<string, unknown> : {};
    const tools = installed ? (await ctx.fns.uigma.tools({})).length : 0;
    const state = ((ctx.state as any).uigma ??= {}) as types.uigma.State;
    return {
        installed,
        dir: cfg.editorDir,
        version: String(meta.version ?? ""),
        commit: String(meta.commit ?? ""),
        builtAt: String(meta.builtAt ?? ""),
        tools,
        install: state.install ?? null,
        howToInstall: "await ctx.fns.uigma.installEditor({}) — downloads the prebuilt editor of this plugin's release (sha256-pinned) or, without one, builds OpenPencil with the patch (needs git and Rust; a few minutes, runs in the background — follow it with uigma.editorStatus). { mode: \"copy\", from: \"<dir>\" } takes an existing build; the setting uigma.editorDir may also point at one.",
    };
}
