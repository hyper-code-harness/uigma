/**
 * Makes sure the Uigma editor build is installed before a tab or an agent's call needs it: when it is missing and
 * editor/release.json pins a prebuilt archive, downloads it (sha256 checked, ~14 MB, one download at a time —
 * concurrent callers share it); without a pinned archive answers how to install instead of building on its own.
 *
 * Use from uigma.reach and the tab page; call directly to warm a fresh install.
 */
export default async function (ctx: Context, _session: Session | null, _opts: {}): Promise<{ installed: boolean; version?: string; fetched: boolean; error?: string }> {
    const status = await ctx.fns.uigma.editorStatus({});
    if (status.installed) return { installed: true, version: status.version, fetched: false };
    const state = ((ctx.state as any).uigma ??= {}) as types.uigma.State & { ensuring?: Promise<{ installed: boolean; version?: string; fetched: boolean; error?: string }> };
    if (state.ensuring) return state.ensuring;
    const { resolve } = await import("node:path");
    const release = await Bun.file(resolve(import.meta.dir, "..", "..", "editor", "release.json")).json().catch(() => ({})) as { url?: string; sha256?: string };
    if (!release.url || !release.sha256) return { installed: false, fetched: false, error: `no prebuilt editor is pinned for this plugin version. ${status.howToInstall}` };
    state.ensuring = (async () => {
        try {
            const r = await ctx.fns.uigma.installEditor({ mode: "download" });
            return { installed: r.ok, version: r.version, fetched: true, ...(r.ok ? {} : { error: r.message }) };
        } catch (e: any) {
            return { installed: false, fetched: true, error: String(e?.message ?? e) };
        } finally { delete state.ensuring; }
    })();
    return state.ensuring;
}
