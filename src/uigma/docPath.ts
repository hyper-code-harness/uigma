/**
 * Returns the file that holds a document's revision on disk: <data folder>/docs/<name>/<rev>.fig (or .jam for a
 * board). The file exists only for saved revisions still kept (the last 30).
 *
 * Use to hand a document over as a .fig file (it opens in OpenPencil and Figma-compatible tools).
 * @param opts.name Document name.
 * @param opts.type design or board.
 * @param opts.rev Revision.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** design or board. */
    type: "design" | "board";
    /** Revision. */
    rev: number;
}): Promise<string> {
    const { join } = await import("node:path");
    const name = await ctx.fns.uigma.checkName({ name: opts.name });
    return join((await ctx.fns.uigma.config({})).dataDir, "docs", name, `${Math.max(0, Math.floor(opts.rev))}.${opts.type === "board" ? "jam" : "fig"}`);
}
