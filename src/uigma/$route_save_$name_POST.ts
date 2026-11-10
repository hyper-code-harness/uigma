/**
 * The editor saves a document (through its host page): a form with `file` (the bytes) and `summary` (JSON: the
 * pages it counted); ?base= the revision it started from — 409 with the current one when someone saved meanwhile,
 * ?force=1 saves over it. CSRF-protected by the x-csrf-token header.
 * @param opts.req Incoming HTTP request (multipart form).
 * @param opts.params Route parameters: the document name.
 */
export default async function (ctx: Context, session: Session | null, opts: {
    /** Incoming HTTP request (multipart form). */ req: Request;
    /** Route parameters: the document name. */ params: { name: string } }) {
    const req = opts.req;
    const MAX = 96 * 1024 * 1024;
    if (!await ctx.fns.auth.verifyCsrf({ req, token: req.headers.get("x-csrf-token") ?? "" })) return new Response("invalid csrf token", { status: 403 });
    let name: string;
    try { name = await ctx.fns.uigma.checkName({ name: opts.params.name }); } catch (e: any) { return new Response(e.message, { status: 400 }); }
    if (Number(req.headers.get("content-length") ?? 0) > MAX) return new Response("file too large", { status: 413 });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof Blob) || !file.size) return new Response("empty", { status: 400 });
    if (file.size > MAX) return new Response("file too large", { status: 413 });
    let summary: unknown = null;
    try { summary = JSON.parse(String(form?.get("summary") ?? "")); } catch { /* none */ }
    const u = new URL(req.url);
    if (!(await ctx.fns.uigma.getDoc({ name }))) return new Response("no such document", { status: 404 });
    const r = await ctx.fns.uigma.saveDoc({
        name, bytes: new Uint8Array(await file.arrayBuffer()), base: Number(u.searchParams.get("base")) || 0, summary,
        force: u.searchParams.get("force") === "1", userId: (session as any)?.user?.id ?? null,
    });
    return r.ok ? Response.json({ rev: r.rev }) : Response.json({ rev: r.rev }, { status: 409 });
}
