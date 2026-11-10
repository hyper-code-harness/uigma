/**
 * Delivers an editor's answer to the request it was asked; false when no such request of this document waits.
 *
 * Use from the reply route only.
 * @param opts.name Document name.
 * @param opts.id Request id the editor answers.
 * @param opts.ok Whether the command ran.
 * @param opts.result What it returned.
 * @param opts.error Why it failed.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** Request id the editor answers. */
    id: string;
    /** Whether the command ran. */
    ok: boolean;
    /** What it returned. */
    result?: unknown;
    /** Why it failed. */
    error?: string;
}): Promise<boolean> {
    const hub = await ctx.fns.uigma.hub({});
    const p = hub.pending.get(opts.id);
    if (!p || p.name !== opts.name) return false;
    p.done(opts.ok ? { ok: true, result: opts.result } : { ok: false, error: String(opts.error ?? "failed").slice(0, 4000) });
    return true;
}
