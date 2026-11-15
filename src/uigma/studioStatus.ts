/**
 * Reports the studio: whether it is on, whether its headless Chrome answers on its port, which documents it holds
 * open and which open editors the hub sees (a person's or the studio's). Use to understand why an agent's call
 * found no editor, before telling the person to open a tab.
 */
export default async function (ctx: Context, _session: Session | null, _opts: {}): Promise<{
    enabled: boolean; port: number; chrome: boolean; unit: string; pages: Array<{ name: string; targetId: string; openedAt: number }>;
    editors: Array<{ name: string; userId: string | null; studio: boolean }>;
}> {
    const cfg = await ctx.fns.uigma.config({});
    const state = ((ctx.state as any).uigma ??= {}) as types.uigma.State;
    const hub = await ctx.fns.uigma.hub({});
    let chrome = false;
    if (cfg.studio) {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 1500);
        chrome = await fetch(`http://127.0.0.1:${cfg.studioPort}/json/version`, { signal: ac.signal }).then(r => r.ok, () => false).finally(() => clearTimeout(t));
    }
    return {
        enabled: cfg.studio, port: cfg.studioPort, chrome, unit: "uigma-studio",
        pages: [...(state.studio?.pages ?? new Map()).entries()].map(([name, p]) => ({ name, targetId: p.targetId, openedAt: p.openedAt })),
        editors: [...hub.clients.values()].map(c => ({ name: c.name, userId: c.userId, studio: c.studio })),
    };
}
