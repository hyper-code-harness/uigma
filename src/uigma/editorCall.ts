/**
 * Runs one editor command on a document and unwraps the editor's envelope ({ok, result} of its automation): the
 * plain result, or an error an agent can act on (not open, timed out, the tool's own error).
 *
 * Use inside uigma.run / uigma.shot; prefer those.
 * @param opts.name Document name.
 * @param opts.command Editor command: tool, summary, undo, redo, eval, export, export_jsx, selection.
 * @param opts.args Its arguments.
 * @param opts.waitMs How long to wait for the editor to connect. @default 0
 * @param opts.timeoutMs How long the command may take. @default 90000
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** Editor command: tool, summary, undo, redo, eval, export, export_jsx, selection. */
    command: string;
    /** Its arguments. */
    args?: Record<string, unknown>;
    /** How long to wait for the editor to connect. @default 0 */
    waitMs?: number;
    /** How long the command may take. @default 90000 */
    timeoutMs?: number;
}): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
    const a = await ctx.fns.uigma.hubAsk({ name: opts.name, command: opts.command, args: opts.args ?? {}, waitMs: opts.waitMs ?? 0, timeoutMs: opts.timeoutMs ?? 90_000 });
    if (a.offline) return { ok: false, error: `The document "${opts.name}" is not open in the person's browser, and the editor works only in an open tab (its tab was put on the canvas). If the person is not at Hyper now, tell them — do not retry in a loop.` };
    if (!a.ok) return { ok: false, error: a.error ?? "the editor failed" };
    const env = a.result as { ok?: unknown; result?: unknown; error?: unknown } | null;
    if (!env || env.ok !== true) return { ok: false, error: String(env?.error ?? "the editor gave no answer") };
    const r = env.result as any;
    if (r && typeof r === "object" && !Array.isArray(r) && typeof r.error === "string" && r.error) return { ok: false, error: r.error };
    return { ok: true, value: env.result };
}
