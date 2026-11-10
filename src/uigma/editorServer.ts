/**
 * Starts (once per process) the editor's own static server and returns its port: the built editor on an origin
 * apart from Hyper's, so the editor page holds no Hyper session and reaches Hyper only through the host page.
 *
 * Use before framing the editor; the tab page calls it. Restarts the server when the editor folder or the
 * `online` setting changed. Throws while the editor is not installed (see uigma.editorStatus).
 * @param opts.port Port to listen on. @default the uigma.editorPort setting
 * @param opts.dir Editor folder to serve. @default the uigma.editorDir setting
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Port to listen on. @default the uigma.editorPort setting */
    port?: number;
    /** Editor folder to serve. @default the uigma.editorDir setting */
    dir?: string;
}): Promise<{ port: number; host: string; dir: string }> {
    const { join, normalize, sep } = await import("node:path");
    const cfg = await ctx.fns.uigma.config({});
    const dir = opts.dir ?? cfg.editorDir;
    if (!(await Bun.file(join(dir, "index.html")).exists())) throw new Error(`uigma: the editor is not installed in ${dir} — run uigma.installEditor({})`);
    const state = ((ctx.state as any).uigma ??= {}) as types.uigma.State;
    const want = opts.port ?? cfg.port;
    const s = state.server;
    if (s && s.dir === dir && s.online === cfg.online && s.host === cfg.host && (opts.port === undefined || s.port === want)) return { port: s.port, host: s.host, dir };
    s?.stop();
    state.server = undefined;

    const csp = await ctx.fns.uigma.editorPolicy({ online: cfg.online });
    const root = normalize(dir) + sep;
    const fetch = async (req: Request): Promise<Response> => {
        if (req.method !== "GET" && req.method !== "HEAD") return new Response("method not allowed", { status: 405 });
        let path: string;
        try { path = decodeURIComponent(new URL(req.url).pathname); } catch { return new Response("bad request", { status: 400 }); }
        const full = normalize(join(root, path));
        const inside = full.startsWith(root) && !path.includes("\0") && !/(^|\/)\./.test(path);
        let file = inside && !path.endsWith("/") ? Bun.file(full) : null;
        // the app's own addresses (no file behind them) get its page; a missing asset stays missing
        const page = !file || !(await file.exists());
        if (page) {
            if (/\.[a-z0-9]{2,5}$/i.test(path)) return new Response("not found", { status: 404 });
            file = Bun.file(join(root, "index.html"));
        }
        const headers: Record<string, string> = {
            "content-type": file!.type || "application/octet-stream",
            "x-content-type-options": "nosniff",
            "referrer-policy": "no-referrer",
            // build file names carry a hash of their content; the page itself is always asked again
            "cache-control": !page && /^\/assets\//.test(path) ? "public, max-age=31536000, immutable" : "no-store",
            // on every file, not only the page: a worker takes its policy from its own script's answer
            "content-security-policy": csp,
        };
        return new Response(req.method === "HEAD" ? null : file, { headers });
    };
    let server: ReturnType<typeof Bun.serve>;
    try { server = Bun.serve({ hostname: cfg.host, port: want, fetch }); }
    catch (e: any) { throw new Error(`uigma: cannot serve the editor on ${cfg.host}:${want} (${e?.code ?? e?.message ?? e}) — set uigma.editorPort to a free port`); }
    state.server = { port: server.port!, host: cfg.host, dir, online: cfg.online, stop: () => { void server.stop(true); } };
    return { port: server.port!, host: cfg.host, dir };
}
