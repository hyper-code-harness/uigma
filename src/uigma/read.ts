/**
 * Describes one document without the editor: its type, current revision, pages with layer counts (as of the
 * last save), the .fig/.jam file of that revision, and whether its editor is open now (uigma.run needs that).
 *
 * Use before working on a document, or to hand the file over (`path` is a Figma-compatible .fig / .jam).
 * @param opts.name Document name.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
}): Promise<(types.uigma.Doc & { kind: string; path: string | null; open: boolean }) | null> {
    const d = await ctx.fns.uigma.getDoc({ name: opts.name });
    if (!d) return null;
    const path = d.rev > 0 ? await ctx.fns.uigma.docPath({ name: d.name, type: d.type, rev: d.rev }) : null;
    return { ...d, kind: d.type === "board" ? "uigma.board" : "uigma.file", path: path && (await Bun.file(path).exists()) ? path : null, open: await ctx.fns.uigma.hubOnline({ name: d.name }) };
}
