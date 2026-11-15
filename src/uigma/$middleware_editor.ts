// `/uigma/editor/*` — the editor build on Hyper's own origin. A middleware, not a route: the build is a folder of
// arbitrary depth (`assets/…`, `brand/…`) and routes match a fixed number of segments. It runs after the auth
// middleware, so the editor is behind the same sign-in as the host page that frames it.
import { join, normalize, sep } from "node:path";

/**
 * Serves the Uigma editor (OpenPencil built with `--base /uigma/editor/`) from Hyper's origin, each file under the
 * editor's Content-Security-Policy; the app's own addresses answer its page. Use nothing else to reach the editor:
 * the host page frames `/uigma/editor/?speca=1…` and, being same-origin, inherits Hyper's https secure context.
 * @param opts.req Incoming GET or HEAD request below `/uigma/editor`.
 */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    if (opts.req.method !== "GET" && opts.req.method !== "HEAD") return;
    const url = new URL(opts.req.url);
    const prefix = "/uigma/editor";
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + "/")) return;
    const cfg = await ctx.fns.uigma.config({});
    const status = await ctx.fns.uigma.editorStatus({});
    if (!status.installed) return new Response("the Uigma editor is not installed — uigma.installEditor({})", { status: 503 });
    let path: string;
    try { path = decodeURIComponent(url.pathname.slice(prefix.length)) || "/"; } catch { return new Response("bad request", { status: 400 }); }
    const root = normalize(cfg.editorDir) + sep;
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
        "content-security-policy": await ctx.fns.uigma.editorPolicy({ online: cfg.online }),
    };
    return new Response(opts.req.method === "HEAD" ? null : file, { headers });
}
