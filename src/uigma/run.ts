/**
 * Works in a Uigma design file or board with the editor's own tools, live in the tab the person has open: `calls`
 * run in order ({tool, args}) and stop at the first that fails; every change shows on their canvas as it is made and
 * is saved with the file like their own edits.
 *
 * Draw and redraw with `render` (JSX: Frame, Text, Component, Instance…; the reference is in this plugin's
 * SKILL.md), read with `get_page_tree`, `get_node`, `get_jsx`, `find_nodes`, `query_nodes`, change with
 * `update_node`, `batch_update`, `set_fill`, `set_text`, `set_layout`…, components with `create_component`,
 * `node_to_component`, `combine_as_variants`, `create_instance`, variables with `create_collection`,
 * `create_variable`, `bind_variable`, boards with `create_shape`, `create_connector`, `import_mermaid`, pictures with
 * `set_image_fill` (`image_data`: a path to a PNG/JPEG/WEBP file), anything else with `eval` (Figma's Plugin API);
 * `undo` / `redo` take back or bring back the agent's newest change. uigma.help lists every tool and its inputs.
 * When the document is not open, its tab is brought onto the canvas and the call waits up to 30 s for it.
 * Pictures in results are written to files (`file` in the result, `files` in the answer).
 * @param opts.name Document name (as opened with canvas.show kind uigma.file / uigma.board).
 * @param opts.calls Editor tool calls, run in order: [{ tool: "render", args: { jsx: "<Frame …/>" } }]; up to 30.
 * @param opts.page The page to work on (its name or id) when it is not the one the person is on.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name (as opened with canvas.show kind uigma.file / uigma.board). */
    name: string;
    /** Editor tool calls, run in order: [{ tool: "render", args: { jsx: "<Frame …/>" } }]; up to 30. */
    calls: Array<{ tool: string; args?: Record<string, unknown> }>;
    /** The page to work on (its name or id) when it is not the one the person is on. */
    page?: string;
}): Promise<{ ok: boolean; results: Array<{ tool: string; ok: boolean; result?: unknown; error?: string }>; files: string[]; text: string }> {
    const HISTORY = new Set(["undo", "redo"]);
    const NEEDS_NETWORK = new Set(["search_icons", "fetch_icons", "insert_icon"]);
    const calls = Array.isArray(opts.calls) ? opts.calls : [];
    if (!calls.length || calls.length > 30) throw new Error("uigma.run: calls is a list of 1–30 { tool, args }");
    const fail = (text: string) => ({ ok: false, results: [], files: [], text });
    const name = await ctx.fns.uigma.checkName({ name: opts.name });
    const tools = await ctx.fns.uigma.tools({});
    const byName = new Map(tools.map(t => [t.name, t]));
    if (tools.length) {
        const unknown = calls.map(c => String(c?.tool ?? "")).filter(n => !HISTORY.has(n) && !byName.has(n));
        if (unknown.length) return fail(`No such editor tool: ${unknown.join(", ")}. uigma.help({}) lists them (uigma.help({ query }) searches).`);
        const net = calls.map(c => c.tool).filter(n => NEEDS_NETWORK.has(n));
        if (net.length && !(await ctx.fns.uigma.config({})).online) return fail(`${net.join(", ")} need the icon catalogue on the internet, which is off here (setting uigma.online). Without it draw the icon as a Vector or put in its SVG with import_svg.`);
    }
    const r = await ctx.fns.uigma.reach({ name });
    if ("error" in r) return fail(r.error);
    let waitMs = r.waitMs;
    let target: Record<string, unknown> = {};
    if (opts.page) {
        const s = await ctx.fns.uigma.editorCall({ name, command: "summary", waitMs });
        waitMs = 0;
        if (!s.ok) return fail(s.error);
        const pages = (((s.value as any)?.pages ?? []) as Array<{ id: string; name: string }>).filter(p => p && typeof p.id === "string");
        const want = opts.page.trim().toLowerCase();
        const found = pages.find(p => p.id === opts.page) ?? pages.find(p => String(p.name).trim().toLowerCase() === want);
        if (!found) return fail(`No page "${opts.page}" in "${name}". Pages: ${pages.map(p => `${p.name} (${p.id})`).join(", ") || "none"}.`);
        target = { page_id: found.id };
    }
    let agentId = "hyper";
    try { agentId = (await ctx.fns.agent.current({})).id; } catch { /* called outside an agent */ }
    const agent = { session: `hyper:${agentId}`.slice(0, 128), kind: "mcp", client: "Hyper" };
    const results: Array<{ tool: string; ok: boolean; result?: unknown; error?: string }> = [];
    const files: string[] = [];
    const lines: string[] = [];
    const max = Math.max(2000, Math.floor(24_000 / calls.length));
    const show = (v: unknown) => { const s = typeof v === "string" ? v : v == null ? "ok" : JSON.stringify(v); return s.length > max ? `${s.slice(0, max)}… [cut: ${s.length - max} more characters — ask for less at once]` : s; };
    for (const [i, c] of calls.entries()) {
        let args: Record<string, unknown> = { ...(c.args ?? {}) };
        // a picture named by its path goes to the editor as its bytes: an agent never carries base64 in its words
        if (typeof args.image_data === "string" && !/^data:/.test(args.image_data)) {
            const p = args.image_data.trim().replace(/^~(?=\/)/, String(ctx.env.HOME ?? ""));
            const f = Bun.file(p);
            const mime = f.type.split(";")[0]!;
            if (!(await f.exists())) { results.push({ tool: c.tool, ok: false, error: `no file ${p}` }); lines.push(`${i + 1}. ${c.tool} — failed: no file ${p}`); break; }
            if (!/^image\/(png|jpeg|webp)$/.test(mime) || f.size > 8 * 1024 * 1024) { results.push({ tool: c.tool, ok: false, error: `${p}: an image fill takes PNG, JPEG or WEBP up to 8 MB` }); lines.push(`${i + 1}. ${c.tool} — failed: not a PNG/JPEG/WEBP up to 8 MB`); break; }
            args = { ...args, image_data: `data:${mime};base64,${Buffer.from(await f.arrayBuffer()).toString("base64")}` };
        }
        const reply = HISTORY.has(c.tool)
            ? await ctx.fns.uigma.editorCall({ name, command: c.tool, args: { ...target }, waitMs })
            : await ctx.fns.uigma.editorCall({ name, command: "tool", args: { name: c.tool, args, agent, ...target }, waitMs });
        waitMs = 0;
        if (!reply.ok) {
            results.push({ tool: c.tool, ok: false, error: reply.error });
            lines.push(`${i + 1}. ${c.tool} — failed: ${reply.error}`);
            if (i + 1 < calls.length) lines.push(`Stopped here: calls ${i + 2}–${calls.length} were not run; what the earlier calls changed stays (undo takes it back).`);
            break;
        }
        const kept = await ctx.fns.uigma.keepImages({ value: reply.value, name: `${name}-${c.tool}` });
        files.push(...kept.files);
        results.push({ tool: c.tool, ok: true, result: kept.value });
        lines.push(`${i + 1}. ${c.tool} → ${show(kept.value)}`);
    }
    return { ok: results.every(x => x.ok), results, files, text: lines.join("\n") };
}
