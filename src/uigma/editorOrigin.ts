/**
 * Returns the origin a browser loads the editor from for this request: the uigma.editorUrl setting when set,
 * else http://127.0.0.1:<port> for a browser on this machine and http://<Hyper's host name>:<port> otherwise.
 *
 * Use when writing the address of the editor's frame; it starts the editor's server on the way.
 * @param opts.req The request of the page that frames the editor.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** The request of the page that frames the editor. */
    req: Request;
}): Promise<string> {
    const cfg = await ctx.fns.uigma.config({});
    const { port } = await ctx.fns.uigma.editorServer({});
    if (cfg.url) return new URL(cfg.url).origin;
    const host = (opts.req.headers.get("x-forwarded-host") ?? opts.req.headers.get("host") ?? new URL(opts.req.url).host).split(",")[0]!.trim();
    const name = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0]!;
    const local = name === "localhost" || name === "127.0.0.1" || name === "[::1]" || name === "";
    return `http://${local ? "127.0.0.1" : name}:${port}`;
}
