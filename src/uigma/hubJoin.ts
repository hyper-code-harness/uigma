/**
 * Registers an open, editable editor of a document (its page opened the bridge stream) and returns the function
 * to call when it leaves; requests still waiting on it then fail with a clear reason. A person's editor joining a
 * document the studio holds closes the studio's page: one editor saves, the person's, and the agent's calls go to it.
 *
 * Use from the bridge route only.
 * @param opts.name Document name.
 * @param opts.userId The person whose page it is.
 * @param opts.studio The page is the studio's (Hyper's headless Chrome), not a person's. @default false
 * @param opts.send Delivers an event to the page: ("ask", {id, command, args}) or ("cancel", {id}).
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** The person whose page it is. */
    userId?: string | null;
    /** The page is the studio's (Hyper's headless Chrome), not a person's. @default false */
    studio?: boolean;
    /** Delivers an event to the page: ("ask", {id, command, args}) or ("cancel", {id}). */
    send: (event: string, data: unknown) => void;
}): Promise<() => void> {
    const hub = await ctx.fns.uigma.hub({});
    const client = { id: crypto.randomUUID(), name: opts.name, userId: opts.userId ?? null, studio: opts.studio === true, send: opts.send };
    hub.clients.set(client.id, client);
    for (const w of [...hub.waiters]) w(client);
    if (!client.studio && [...hub.clients.values()].some(c => c.name === client.name && c.studio)) void ctx.fns.uigma.studioClose({ name: client.name }).catch(() => undefined);
    return () => {
        hub.clients.delete(client.id);
        for (const [id, p] of hub.pending) if (p.client === client.id) { hub.pending.delete(id); p.done({ ok: false, error: "the editor was closed before it answered" }); }
    };
}
