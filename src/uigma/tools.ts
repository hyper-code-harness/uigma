/**
 * Lists the editor's own agent tools — name, description, whether it changes the file, its input schema — from
 * the uigma-tools.json the build leaves next to the editor; [] while the editor is not installed.
 *
 * Use to check a call before it goes to the open editor; uigma.help shows the same list to an agent. Re-read when
 * the build changes. `web_search` and `stock_photo` (served by OpenPencil's own app) are left out.
 */
export default async function (ctx: Context, _session: Session | null, _opts: {}): Promise<types.uigma.Tool[]> {
    const { join } = await import("node:path");
    const { stat } = await import("node:fs/promises");
    const file = join((await ctx.fns.uigma.config({})).editorDir, "uigma-tools.json");
    let at = 0;
    try { at = (await stat(file)).mtimeMs; } catch { return []; }
    const state = ((ctx.state as any).uigma ??= {}) as types.uigma.State;
    if (state.tools && state.tools.file === file && state.tools.at === at) return state.tools.list;
    const HIDDEN = new Set(["web_search", "stock_photo"]);
    let list: unknown = [];
    try { list = await Bun.file(file).json(); } catch { /* a broken list is an empty one */ }
    // the schema as an agent needs it: without the generator's marks and without inputs that only make sense for the
    // editor's own server (a path on its disk)
    const slim = (s: unknown, key = ""): unknown => {
        if (Array.isArray(s)) return s.map(x => slim(x));
        if (!s || typeof s !== "object") return s;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
            if (k === "$schema") continue;
            if (key === "properties" && k === "path" && /OPENPENCIL_MCP_ROOT/.test(String((v as any)?.description ?? ""))) continue;
            out[k] = slim(v, k);
        }
        return out;
    };
    const tools = (Array.isArray(list) ? list : [])
        .filter((t: any) => t && typeof t.name === "string" && typeof t.description === "string" && !HIDDEN.has(t.name))
        .map((t: any) => ({ name: t.name, description: t.description, mutates: t.mutates !== false, inputSchema: slim(t.inputSchema ?? {}) as types.uigma.Tool["inputSchema"] }));
    state.tools = { file, at, list: tools };
    return tools;
}
