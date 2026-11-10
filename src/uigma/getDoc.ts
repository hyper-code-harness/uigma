/**
 * Reads one Uigma document's row by name: its type, current revision, size and the pages the editor counted;
 * null when no document of that name was saved or opened yet.
 *
 * Use to find whether a name is taken and by which kind (design or board) before opening or changing it.
 * @param opts.name Document name.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
}): Promise<types.uigma.Doc | null> {
    const name = await ctx.fns.uigma.checkName({ name: opts.name });
    const [row] = await ctx.fns.procs.db.select({
        sql: `select name, type, rev, size, summary, source, updated_by as "updatedBy", created_at as "createdAt", updated_at as "updatedAt" from uigma_docs where name = ?`,
        params: [name],
    }) as any[];
    if (!row) return null;
    const summary = typeof row.summary === "string" ? JSON.parse(row.summary) : row.summary ?? {};
    return { ...row, rev: Number(row.rev), size: Number(row.size), createdAt: Number(row.createdAt), updatedAt: Number(row.updatedAt), summary: { pages: Array.isArray(summary.pages) ? summary.pages : [] } };
}
