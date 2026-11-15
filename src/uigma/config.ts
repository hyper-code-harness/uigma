/**
 * Resolves Uigma's settings into concrete values: where the editor build and the documents live, whether the
 * editor may use the internet, and whether and where the studio (Hyper's headless Chrome for agents) runs. The editor is served by Hyper itself under /uigma/editor/, on Hyper's origin.
 *
 * Use before touching the editor folder or the documents; every other uigma function reads its paths here.
 */
export default async function (ctx: Context, _session: Session | null, _opts: {}): Promise<{
    editorDir: string; dataDir: string; online: boolean; studio: boolean; studioPort: number;
}> {
    const { join, resolve } = await import("node:path");
    const get = (key: string) => ctx.fns.settings.get({ module: "uigma", scopeType: "global", key });
    const home = await ctx.fns.memory.home({});
    const path = (v: unknown, fallback: string) => {
        const s = String(v ?? "").trim();
        if (!s) return fallback;
        return resolve(s.startsWith("~/") ? join(String(ctx.env.HOME ?? ""), s.slice(2)) : s);
    };
    const dataDir = path(await get("dataDir"), join(home, "uigma"));
    const studioPort = await get("studioPort");
    return {
        editorDir: path(await get("editorDir"), join(home, "uigma", "editor")),
        dataDir,
        online: (await get("online")) === true,
        studio: (await get("studio")) !== false,
        studioPort: (() => { const p = Math.round(Number(studioPort) || 39017); return p >= 1024 && p <= 65535 ? p : 39017; })(),
    };
}
