/**
 * Makes sure a document of this name exists as the given type (a row at revision 0), and refuses a name already
 * taken by the other type. Returns the row.
 *
 * Use when a tab is opened (the canvas kinds' prepare) so the agent and the person agree on what the name is.
 * @param opts.name Document name.
 * @param opts.type design (a Figma-like file) or board (FigJam-like).
 * @param opts.source A .fig/.jam file to start from when the document is new.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** design (a Figma-like file) or board (FigJam-like). */
    type: "design" | "board";
    /** A .fig/.jam file to start from when the document is new. */
    source?: string | null;
}): Promise<types.uigma.Doc> {
    const name = await ctx.fns.uigma.checkName({ name: opts.name });
    const type = opts.type === "board" ? "board" : "design";
    const now = Date.now();
    await ctx.fns.procs.db.run({
        sql: `insert into uigma_docs (name, type, rev, size, summary, source, created_at, updated_at) values (?, ?, 0, 0, '{}'::jsonb, ?, ?, ?) on conflict (name) do nothing`,
        params: [name, type, opts.source ?? null, now, now],
    });
    const doc = (await ctx.fns.uigma.getDoc({ name }))!;
    if (doc.type !== type) throw new Error(`uigma: "${name}" is a ${doc.type === "board" ? "board (uigma.board)" : "design file (uigma.file)"}, not a ${type}`);
    if (opts.source && doc.rev === 0 && doc.source !== opts.source) {
        await ctx.fns.procs.db.run({ sql: `update uigma_docs set source = ? where name = ? and rev = 0`, params: [opts.source, name] });
        doc.source = opts.source;
    }
    return doc;
}
