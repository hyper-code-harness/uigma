/**
 * Lists the Uigma documents — design files and boards — newest first, with their revision, size, pages and the
 * kind to open each with.
 *
 * Use to find a document to open (canvas.show) or to work on (uigma.run) by name.
 * @param opts.type Only design files or only boards.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Only design files or only boards. */
    type?: "design" | "board";
}): Promise<Array<types.uigma.Doc & { kind: string; open: boolean }>> {
    const rows = await ctx.fns.procs.db.select({
        sql: `select name from uigma_docs ${opts.type ? "where type = ?" : ""} order by updated_at desc limit 500`,
        params: opts.type ? [opts.type] : [],
    }) as Array<{ name: string }>;
    const out = [];
    for (const r of rows) {
        const d = await ctx.fns.uigma.getDoc({ name: r.name });
        if (d) out.push({ ...d, kind: d.type === "board" ? "uigma.board" : "uigma.file", open: await ctx.fns.uigma.hubOnline({ name: d.name }) });
    }
    return out;
}
