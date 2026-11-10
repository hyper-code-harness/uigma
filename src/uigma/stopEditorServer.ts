/**
 * Stops the editor's static server if it runs; open Uigma tabs lose their editor until they are reloaded.
 *
 * Use after replacing the editor build by hand, in tests, or before the process exits.
 */
export default function (ctx: Context, _session: Session | null, _opts: {}): { stopped: boolean } {
    const state = ((ctx.state as any).uigma ??= {}) as types.uigma.State;
    const s = state.server;
    s?.stop();
    state.server = undefined;
    return { stopped: !!s };
}
