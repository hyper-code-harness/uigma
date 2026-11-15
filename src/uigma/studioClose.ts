/**
 * Closes the studio's page of a document (or every page with no name), freeing the headless Chrome's memory; a
 * later agent call opens it again. The editor flushes its unsaved edits on pagehide before the page goes.
 * @param opts.name Document name; omitted: all the studio's pages.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name; omitted: all the studio's pages. */
    name?: string;
}): Promise<{ closed: string[] }> {
    const cfg = await ctx.fns.uigma.config({});
    const state = ((ctx.state as any).uigma ??= {}) as types.uigma.State;
    const pages = state.studio?.pages;
    if (!pages?.size) return { closed: [] };
    const names = opts.name ? [await ctx.fns.uigma.checkName({ name: opts.name })] : [...pages.keys()];
    const closed: string[] = [];
    for (const name of names) {
        const p = pages.get(name);
        if (!p) continue;
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 2000);
        await fetch(`http://127.0.0.1:${cfg.studioPort}/json/close/${p.targetId}`, { signal: ac.signal }).catch(() => undefined).finally(() => clearTimeout(t));
        pages.delete(name);
        closed.push(name);
    }
    return { closed };
}
