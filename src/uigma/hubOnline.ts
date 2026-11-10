/**
 * Tells whether an editable editor of this document is open in someone's browser now (uigma.run works only then).
 *
 * Use before asking the editor, to decide whether to bring its tab into view first.
 * @param opts.name Document name.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
}): Promise<boolean> {
    const hub = await ctx.fns.uigma.hub({});
    for (const c of hub.clients.values()) if (c.name === opts.name) return true;
    return false;
}
