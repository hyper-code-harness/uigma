/**
 * Reads the bytes a document opens with: its current (or an earlier, still kept) revision, or — before its first
 * save — the .fig/.jam file it was started from. Returns the bytes and the revision they are (0 for a source file),
 * or null bytes for a new empty document.
 *
 * Use for the editor's open (the tab's doc route) and to export a document.
 * @param opts.name Document name.
 * @param opts.rev An earlier revision. @default the current one
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** An earlier revision. @default the current one */
    rev?: number;
}): Promise<{ bytes: Uint8Array | null; rev: number; type: "design" | "board" } | null> {
    const doc = await ctx.fns.uigma.getDoc({ name: opts.name });
    if (!doc) return null;
    const rev = opts.rev ?? doc.rev;
    if (!Number.isInteger(rev) || rev < 0 || rev > doc.rev) return null;
    if (rev > 0) {
        const f = Bun.file(await ctx.fns.uigma.docPath({ name: doc.name, type: doc.type, rev }));
        if (!(await f.exists())) return null;
        return { bytes: new Uint8Array(await f.arrayBuffer()), rev, type: doc.type };
    }
    if (doc.source) {
        const f = Bun.file(doc.source);
        if (await f.exists()) return { bytes: new Uint8Array(await f.arrayBuffer()), rev: 0, type: doc.type };
    }
    return { bytes: null, rev: 0, type: doc.type };
}
