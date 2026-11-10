/**
 * Describes the editor's tools that uigma.run runs, from the list the build left (no open editor needed): without
 * options every tool in one line (its inputs, required ones bare, and what it does); `tools` gives the full
 * description and input schema of those; `query` keeps the tools whose name or description has all these words.
 *
 * Use before a tool you have not used yet; the JSX of `render` is described in this plugin's SKILL.md.
 * @param opts.tools Tool names to describe in full.
 * @param opts.query Words to search names and descriptions for.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Tool names to describe in full. */
    tools?: string[];
    /** Words to search names and descriptions for. */
    query?: string;
}): Promise<string> {
    const all = await ctx.fns.uigma.tools({});
    if (!all.length) return `The Uigma editor is not installed. ${(await ctx.fns.uigma.editorStatus({})).howToInstall}`;
    const NEEDS_NETWORK = new Set(["search_icons", "fetch_icons", "insert_icon"]);
    const offline = !(await ctx.fns.uigma.config({})).online;
    const note = (n: string) => (offline && NEEDS_NETWORK.has(n) ? " [off here: needs the setting uigma.online]" : "");
    if (opts.tools?.length) {
        return opts.tools.slice(0, 20).map(n => {
            if (n === "undo" || n === "redo") return `## ${n}\nNo inputs. ${n === "undo" ? "Takes back" : "Brings back"} the agent's newest change in this file; the person's own edits are never touched.`;
            const t = all.find(x => x.name === n);
            return t ? `## ${t.name}${t.mutates ? "" : " (reads only)"}${note(t.name)}\n${t.description}\nInputs: ${JSON.stringify(t.inputSchema)}` : `## ${n}\nNo such tool.`;
        }).join("\n\n");
    }
    const line = (t: types.uigma.Tool) => {
        const req = new Set(t.inputSchema.required ?? []);
        const args = Object.keys(t.inputSchema.properties ?? {}).map(k => (req.has(k) ? k : `${k}?`)).join(", ");
        const first = t.description.split(/(?<=[.!?])\s/)[0] ?? t.description;
        return `${t.name}(${args}) — ${first.length > 160 ? `${first.slice(0, 157)}…` : first}${note(t.name)}`;
    };
    const words = String(opts.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const found = words.length ? all.filter(t => words.every(w => `${t.name} ${t.description}`.toLowerCase().includes(w))) : all;
    if (!found.length) return `Nothing for "${opts.query}". Try one word, or uigma.help({}) for the whole list.`;
    const lines = found.map(line);
    if (!words.length) lines.push("undo() — Takes back your newest change.", "redo() — Brings it back.");
    return `${found.length} tool(s) of the editor, run with uigma.run({ name, calls: [{ tool, args }] }); uigma.help({ tools: [...] }) gives full inputs.\n${lines.join("\n")}`;
}
