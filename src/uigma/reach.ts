/**
 * Gets a document ready for an agent's call: checks the editor is installed and the document exists, and when no
 * editor of it is open brings its tab onto the current agent's canvas (canvas.show), so the editor starts and the
 * person sees the work. Returns the document and how long to wait for the editor to connect, or why it cannot work.
 *
 * Use at the start of uigma.run and uigma.shot.
 * @param opts.name Document name.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
}): Promise<{ doc: types.uigma.Doc; waitMs: number; studioError?: string } | { error: string }> {
    const status = await ctx.fns.uigma.editorStatus({});
    if (!status.installed) return { error: `The Uigma editor is not installed (${status.dir}). ${status.howToInstall}` };
    const doc = await ctx.fns.uigma.getDoc({ name: opts.name });
    if (!doc) return { error: `No Uigma document "${opts.name}". Open one first: await ctx.fns.canvas.show({ kind: "uigma.file", args: { name: "${opts.name}" } }) (a board: kind "uigma.board"); uigma.list({}) lists them.` };
    if (await ctx.fns.uigma.hubOnline({ name: doc.name })) return { doc, waitMs: 0 };
    // not open anywhere: the studio (Hyper's own headless Chrome) opens it for the agent
    const s = await ctx.fns.uigma.studio({ name: doc.name });
    if (s.ok) return { doc, waitMs: 0 };
    // no studio: put its tab in front of the person (the editor starts there) and wait for it to load
    try { await ctx.fns.canvas.show({ kind: doc.type === "board" ? "uigma.board" : "uigma.file", args: { name: doc.name } }); }
    catch { /* no agent canvas in this call: wait for a tab someone opens */ }
    return { doc, waitMs: 30_000, studioError: s.error };
}
