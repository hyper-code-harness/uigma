/**
 * Draws a Uigma document as a PNG with the editor itself, exactly as the person sees it, and writes it to a file:
 * `nodes` are the layers to look at (ids from uigma.run — a frame, a component, a few of them); without it every
 * top-level layer of the page at once. Returns the file's path and the picture's size.
 *
 * Use after drawing or changing something, before saying it is done — look at the file (read the image).
 * @param opts.name Document name.
 * @param opts.nodes Layer ids to draw; up to 20.
 * @param opts.page Another page than the one the person is on (its name or id).
 * @param opts.maxEdge Longest side in pixels (more for small text). @default 1600
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** Layer ids to draw; up to 20. */
    nodes?: string[];
    /** Another page than the one the person is on (its name or id). */
    page?: string;
    /** Longest side in pixels (more for small text). @default 1600 */
    maxEdge?: number;
}): Promise<{ ok: true; path: string; width: number | null; height: number | null } | { ok: false; error: string }> {
    const name = await ctx.fns.uigma.checkName({ name: opts.name });
    const r = await ctx.fns.uigma.reach({ name });
    if ("error" in r) return { ok: false, error: r.error };
    let target: Record<string, unknown> = {};
    let waitMs = r.waitMs;
    if (opts.page) {
        const s = await ctx.fns.uigma.editorCall({ name, command: "summary", waitMs });
        waitMs = 0;
        if (!s.ok) return { ok: false, error: s.error };
        const pages = ((s.value as any)?.pages ?? []) as Array<{ id: string; name: string }>;
        const found = pages.find(p => p.id === opts.page) ?? pages.find(p => String(p.name).trim().toLowerCase() === opts.page!.trim().toLowerCase());
        if (!found) return { ok: false, error: `No page "${opts.page}". Pages: ${pages.map(p => `${p.name} (${p.id})`).join(", ")}` };
        target = { page_id: found.id };
    }
    const maxEdge = Math.max(200, Math.min(4000, Math.round(opts.maxEdge ?? 1600)));
    const reply = await ctx.fns.uigma.editorCall({
        name, command: "tool", waitMs,
        args: { name: "export_image", args: { ...(opts.nodes?.length ? { ids: opts.nodes.slice(0, 20) } : {}), format: "PNG", scale: 2, maxEdge }, ...target },
    });
    if (!reply.ok) return { ok: false, error: `No picture: ${reply.error}` };
    const kept = await ctx.fns.uigma.keepImages({ value: reply.value, name });
    if (!kept.files.length) return { ok: false, error: "The editor returned no image." };
    const v = kept.value as { width?: number; height?: number };
    return { ok: true, path: kept.files[0]!, width: v.width ?? null, height: v.height ?? null };
}
