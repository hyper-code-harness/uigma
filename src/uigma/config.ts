/**
 * Resolves Uigma's settings into concrete values: where the editor build and the documents live, where the
 * editor's own server listens and the origin the browser loads it from, and whether it may use the internet.
 *
 * Use before touching the editor folder or the documents; every other uigma function reads its paths here.
 */
export default async function (ctx: Context, _session: Session | null, _opts: {}): Promise<{
    editorDir: string; dataDir: string; port: number; host: string; url: string; online: boolean;
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
    const port = Math.round(Number(await get("editorPort")) || 47320);
    return {
        editorDir: path(await get("editorDir"), join(home, "uigma", "editor")),
        dataDir,
        port: port >= 1024 && port <= 65535 ? port : 47320,
        host: String((await get("editorHost")) ?? "").trim() || "127.0.0.1",
        url: String((await get("editorUrl")) ?? "").trim().replace(/\/+$/, ""),
        online: (await get("online")) === true,
    };
}
