/**
 * Returns the in-process hub between agents' calls and open editors: the connected editors by id, the requests
 * waiting for an answer, and the waiters for an editor to connect. Created on first use in ctx.state.uigma.
 *
 * Use only inside the hub functions (hubJoin, hubAsk, hubAnswer, hubOnline).
 */
export default function (ctx: Context, _session: Session | null, _opts: {}): NonNullable<types.uigma.State["hub"]> {
    const state = ((ctx.state as any).uigma ??= {}) as types.uigma.State;
    return (state.hub ??= { clients: new Map(), pending: new Map(), waiters: new Set() });
}
