/**
 * Asks the open editor of a document to run one command of its automation ("tool" {name, args, agent}, "summary",
 * "undo", "redo", "eval", "export"…) and waits for its answer. Goes to the newest open editor of that document —
 * a person's tab before the studio's page, so the person sees the agent's work; with none open it waits `waitMs`
 * for one to connect, then answers {ok: false, error}.
 *
 * Use through uigma.run and uigma.shot; call directly only for a command they do not cover.
 * @param opts.name Document name.
 * @param opts.command Editor command.
 * @param opts.args Its arguments.
 * @param opts.waitMs How long to wait for an editor to connect. @default 0
 * @param opts.timeoutMs How long the command may take. @default 60000
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** Editor command. */
    command: string;
    /** Its arguments. */
    args?: Record<string, unknown>;
    /** How long to wait for an editor to connect. @default 0 */
    waitMs?: number;
    /** How long the command may take. @default 60000 */
    timeoutMs?: number;
}): Promise<{ ok: boolean; result?: unknown; error?: string; offline?: boolean }> {
    const hub = await ctx.fns.uigma.hub({});
    const pick = () => {
        let found: null | { id: string; studio: boolean; send: (e: string, d: unknown) => void } = null;
        for (const c of hub.clients.values()) if (c.name === opts.name && (!found || found.studio || !c.studio)) found = c;
        return found;
    };
    let client = pick();
    if (!client && (opts.waitMs ?? 0) > 0) {
        client = await new Promise(resolve => {
            const seen = (c: { id: string; name: string }) => { if (c.name === opts.name) { clearTimeout(timer); hub.waiters.delete(seen); resolve(hub.clients.get(c.id) as any ?? null); } };
            const timer = setTimeout(() => { hub.waiters.delete(seen); resolve(null); }, opts.waitMs);
            hub.waiters.add(seen);
        });
    }
    if (!client) return { ok: false, offline: true, error: "the document is not open in anyone's browser" };
    const id = crypto.randomUUID();
    const c = client;
    return new Promise(resolve => {
        const finish = (a: { ok: boolean; result?: unknown; error?: string }) => { clearTimeout(timer); hub.pending.delete(id); resolve(a); };
        const timer = setTimeout(() => { try { c.send("cancel", { id }); } catch { /* gone */ } finish({ ok: false, error: "the editor did not answer in time (it draws only while its tab is on screen)" }); }, opts.timeoutMs ?? 60_000);
        hub.pending.set(id, { name: opts.name, client: c.id, done: finish });
        try { c.send("ask", { id, command: opts.command, args: opts.args ?? {} }); }
        catch { finish({ ok: false, error: "the editor is not reachable" }); }
    });
}
