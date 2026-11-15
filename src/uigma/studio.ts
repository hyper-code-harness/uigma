// The studio: Hyper's own headless Chrome (hyperd unit `uigma-studio`) where the plugin opens a document's host
// page when no person has it on screen, so an agent can draw and look at any time. The page is the same one a
// canvas tab frames, signed in as the service user `uigma-studio` with a session only this process mints; the
// editor in it joins the hub like any other, and the hub prefers a person's open tab over the studio's.
import { existsSync } from "node:fs";

/**
 * Makes sure the studio holds a document open: starts the headless Chrome unit when needed, signs it in as the
 * service user, opens (or reuses) a page of the document's host page and waits for its editor to join the hub.
 * Answers the reason when it cannot (setting off, no Chrome, hyperd missing) instead of throwing, so a caller can
 * fall back to waiting for a person's tab.
 *
 * Use from uigma.reach when the document is not open anywhere; uigma.studioStatus lists what it holds.
 * @param opts.name Document name.
 * @param opts.waitMs How long to wait for the editor to join after opening the page. @default 45000
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** How long to wait for the editor to join after opening the page. @default 45000 */
    waitMs?: number;
}): Promise<{ ok: true; targetId: string; reused: boolean } | { ok: false; error: string }> {
    const name = await ctx.fns.uigma.checkName({ name: opts.name });
    const cfg = await ctx.fns.uigma.config({});
    if (!cfg.studio) return { ok: false, error: "the studio is off (setting uigma.studio)" };
    const state = ((ctx.state as any).uigma ??= {}) as types.uigma.State;
    const studio = (state.studio ??= { pages: new Map() });
    const doc = await ctx.fns.uigma.getDoc({ name });
    if (!doc) return { ok: false, error: `no document "${name}"` };

    // one page per document: still there and still on the host page → reuse it
    const known = studio.pages.get(name);
    if (known) {
        const alive = await cdpTargets(cfg.studioPort).then(ts => ts.some(t => t.id === known.targetId && t.url.includes(`/uigma/tab/${encodeURIComponent(name)}`))).catch(() => false);
        if (alive && await ctx.fns.uigma.hubOnline({ name })) return { ok: true, targetId: known.targetId, reused: true };
        studio.pages.delete(name);
    }

    const up = await ensureChrome(ctx, cfg.studioPort);
    if (!up.ok) return up;
    const cookie = await serviceCookie(ctx);
    const base = await hyperBase(ctx);
    const url = `${base}/uigma/tab/${encodeURIComponent(name)}`;
    let targetId = "";
    try {
        const ws = await cdpBrowser(cfg.studioPort);
        try {
            const t = await ws.send("Target.createTarget", { url: "about:blank" });
            targetId = String(t.targetId);
            const { sessionId } = await ws.send("Target.attachToTarget", { targetId, flatten: true });
            const s = (m: string, p: Record<string, unknown> = {}) => ws.send(m, p, sessionId);
            await s("Network.enable");
            await s("Network.setCookie", { name: ctx.fns.procs.auth.cookieName({}), value: cookie, url: base, path: "/", httpOnly: true, sameSite: "Lax" });
            await s("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
            await s("Page.navigate", { url });
        } finally { ws.close(); }
    } catch (e: any) {
        return { ok: false, error: `the studio's Chrome did not open the page: ${e?.message ?? e}` };
    }
    studio.pages.set(name, { targetId, openedAt: Date.now() });
    const joined = await waitOnline(ctx, name, opts.waitMs ?? 45_000);
    if (!joined) { studio.pages.delete(name); await closeTarget(cfg.studioPort, targetId).catch(() => undefined); return { ok: false, error: "the studio opened the page but its editor did not come up in time" }; }
    return { ok: true, targetId, reused: false };
}

const UNIT = "uigma-studio";
const SERVICE_USER = "uigma-studio";

async function ensureChrome(ctx: Context, port: number): Promise<{ ok: true } | { ok: false; error: string }> {
    if (await cdpTargets(port).then(() => true).catch(() => false)) return { ok: true };
    const bin = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
        .find(p => existsSync(p));
    if (!bin) return { ok: false, error: "no Chrome on this machine for the studio (install Google Chrome or Chromium)" };
    const home = await ctx.fns.memory.home({});
    const { join } = await import("node:path");
    const profile = join(home, "uigma", "studio-profile");
    const unitFile = join(home, "units", `${UNIT}.yaml`);
    const cmd = [bin, "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking", "--disable-sync", "--mute-audio",
        "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--window-size=1600,1000",
        `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"];
    const spec = { kind: "service", cmd, ready: { tcp: port, timeoutMs: 60000 }, restart: { policy: "always", backoffMs: [1000, 30000] }, stop: { signal: "SIGTERM", timeoutMs: 20000 }, autostart: true };
    const current = await Bun.file(unitFile).text().catch(() => "");
    const wanted = `# Uigma studio: Hyper's headless Chrome for agents' drawing when nobody has the document open (written by the uigma plugin).\n${JSON.stringify(spec)}\n`;
    try {
        await ctx.fns.hyperd.ensure({});
        if (current !== wanted) { await Bun.write(unitFile, wanted); await ctx.fns.hyperd.reload({}); }
        const st = await ctx.fns.hyperd.status({});
        const u = st.units.find(x => x.name === UNIT);
        if (!u) return { ok: false, error: `hyperd did not load the unit ${unitFile}` };
        if (u.state !== "running" && u.state !== "ready") await ctx.fns.hyperd.start({ name: UNIT });
    } catch (e: any) {
        return { ok: false, error: `the studio's Chrome could not be started through hyperd: ${e?.message ?? e}` };
    }
    const until = Date.now() + 30_000;
    while (Date.now() < until) {
        if (await cdpTargets(port).then(() => true).catch(() => false)) return { ok: true };
        await Bun.sleep(500);
    }
    return { ok: false, error: `the studio's Chrome did not answer on port ${port} within 30 s (hyperd.logs({ name: "${UNIT}" }))` };
}

/** A session cookie for the service user, minted here; the user exists only to own the studio's pages. */
async function serviceCookie(ctx: Context): Promise<string> {
    let user = await ctx.fns.auth.getUser({ id: SERVICE_USER });
    if (!user) {
        const now = Date.now();
        await ctx.fns.procs.db.run({
            sql: "INSERT INTO users (id, email, name, role, created_at, updated_at, configured_at) VALUES (?, ?, ?, 'member', ?, ?, ?) ON CONFLICT (id) DO NOTHING",
            params: [SERVICE_USER, "uigma-studio@hyper.local", "Uigma studio", now, now, now],
        });
        user = await ctx.fns.auth.getUser({ id: SERVICE_USER });
        if (!user) throw new Error("uigma.studio: could not create the service user");
    }
    return ctx.fns.procs.auth.sign({ sub: user.id, name: user.name, email: user.email ?? undefined, role: user.role, days: 1 });
}

async function hyperBase(ctx: Context): Promise<string> {
    const port = Number(ctx.env.PORT ?? (ctx.state as any).procs?.http?.server?.port ?? 3010);
    return `http://127.0.0.1:${port}`;
}

async function waitOnline(ctx: Context, name: string, ms: number): Promise<boolean> {
    const until = Date.now() + ms;
    while (Date.now() < until) {
        if (await ctx.fns.uigma.hubOnline({ name })) return true;
        await Bun.sleep(300);
    }
    return false;
}

async function cdpTargets(port: number): Promise<Array<{ id: string; url: string; type: string }>> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 2000);
    try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: ac.signal });
        if (!r.ok) throw new Error(`cdp ${r.status}`);
        return (await r.json()) as Array<{ id: string; url: string; type: string }>;
    } finally { clearTimeout(t); }
}

async function closeTarget(port: number, targetId: string): Promise<void> {
    const ws = await cdpBrowser(port);
    try { await ws.send("Target.closeTarget", { targetId }); } finally { ws.close(); }
}

/** A short-lived browser-level CDP connection: send(method, params, sessionId?) → result. */
async function cdpBrowser(port: number): Promise<{ send: (method: string, params?: Record<string, unknown>, sessionId?: string) => Promise<any>; close: () => void }> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 2000);
    const v = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: ac.signal }).then(r => r.json() as Promise<{ webSocketDebuggerUrl: string }>).finally(() => clearTimeout(t));
    const ws = new WebSocket(v.webSocketDebuggerUrl);
    await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error("cdp socket failed")); });
    let id = 0;
    const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();
    ws.onmessage = (m) => {
        const d = JSON.parse(String(m.data));
        const p = typeof d.id === "number" ? pending.get(d.id) : undefined;
        if (!p) return;
        pending.delete(d.id);
        d.error ? p.rej(new Error(d.error.message ?? JSON.stringify(d.error))) : p.res(d.result);
    };
    return {
        send: (method, params = {}, sessionId) => new Promise((res, rej) => {
            const i = ++id;
            pending.set(i, { res, rej });
            ws.send(JSON.stringify({ id: i, method, params, sessionId }));
            setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error(`cdp ${method}: no answer in 20 s`)); } }, 20_000);
        }),
        close: () => { try { ws.close(); } catch { /* closed */ } },
    };
}
