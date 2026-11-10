/**
 * Registers an open, editable editor of a document (its page opened the bridge stream) and returns the function
 * to call when it leaves; requests still waiting on it then fail with a clear reason.
 *
 * Use from the bridge route only.
 * @param opts.name Document name.
 * @param opts.userId The person whose page it is.
 * @param opts.send Delivers an event to the page: ("ask", {id, command, args}) or ("cancel", {id}).
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** The person whose page it is. */
    userId?: string | null;
    /** Delivers an event to the page: ("ask", {id, command, args}) or ("cancel", {id}). */
    send: (event: string, data: unknown) => void;
}): Promise<() => void> {
    const hub = await ctx.fns.uigma.hub({});
    const client = { id: crypto.randomUUID(), name: opts.name, userId: opts.userId ?? null, send: opts.send };
    hub.clients.set(client.id, client);
    for (const w of [...hub.waiters]) w(client);
    return () => {
        hub.clients.delete(client.id);
        for (const [id, p] of hub.pending) if (p.client === client.id) { hub.pending.delete(id); p.done({ ok: false, error: "the editor was closed before it answered" }); }
    };
}
