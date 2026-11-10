/**
 * The file a Uigma document opens with, for its host page to hand to the editor: the current revision's bytes and
 * the revision they are (x-uigma-rev; the editor names it back when it saves). New and empty: 204. ?rev=N: an
 * earlier revision while it is kept (410 when not).
 * @param opts.req Incoming HTTP request.
 * @param opts.params Route parameters: the document name.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Incoming HTTP request. */ req: Request;
    /** Route parameters: the document name. */ params: { name: string } }) {
    let name: string;
    try { name = await ctx.fns.uigma.checkName({ name: opts.params.name }); } catch (e: any) { return new Response(e.message, { status: 400 }); }
    const past = Number(new URL(opts.req.url).searchParams.get("rev")) || 0;
    const r = await ctx.fns.uigma.readBytes({ name, ...(past > 0 ? { rev: past } : {}) });
    if (!r) return new Response(past > 0 ? "this revision is not kept any more" : "no such document", { status: past > 0 ? 410 : 404 });
    const headers = { "x-uigma-rev": String(r.rev), "cache-control": "no-store" };
    if (!r.bytes) return new Response(null, { status: 204, headers });
    return new Response(r.bytes as Uint8Array<ArrayBuffer>, { headers: { ...headers, "content-type": "application/octet-stream" } });
}
