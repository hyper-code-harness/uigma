/**
 * The editor's answer to what an agent asked through the bridge: JSON {id, ok, result | error}. CSRF-protected by
 * the x-csrf-token header; 404 when no such request of this document waits.
 * @param opts.req Incoming HTTP request.
 * @param opts.params Route parameters: the document name.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Incoming HTTP request. */ req: Request;
    /** Route parameters: the document name. */ params: { name: string } }) {
    const req = opts.req;
    if (!await ctx.fns.auth.verifyCsrf({ req, token: req.headers.get("x-csrf-token") ?? "" })) return new Response("invalid csrf token", { status: 403 });
    let name: string;
    try { name = await ctx.fns.uigma.checkName({ name: opts.params.name }); } catch (e: any) { return new Response(e.message, { status: 400 }); }
    const b = await req.json().catch(() => null) as { id?: unknown; ok?: unknown; result?: unknown; error?: unknown } | null;
    if (!b || typeof b.id !== "string") return new Response("bad request", { status: 400 });
    const taken = await ctx.fns.uigma.hubAnswer({ name, id: b.id, ok: b.ok === true, result: b.result, error: b.error == null ? undefined : String(b.error) });
    return taken ? Response.json({ ok: true }) : new Response("no such request", { status: 404 });
}
