/**
 * The host page of one Uigma document, framed by its canvas tab: the editor in a sandboxed frame on Hyper's own
 * origin (/uigma/editor/), with the file, saving and the agent's line (see uigma.hostPage). Not installed: a page
 * that says how to install it.
 * @param opts.req Incoming HTTP request.
 * @param opts.params Route parameters: the document name.
 */
export default async function (ctx: Context, session: Session | null, opts: {
    /** Incoming HTTP request. */ req: Request;
    /** Route parameters: the document name. */ params: { name: string } }) {
    let name: string;
    try { name = await ctx.fns.uigma.checkName({ name: opts.params.name }); } catch (e: any) { return new Response(e.message, { status: 400 }); }
    const doc = await ctx.fns.uigma.getDoc({ name });
    if (!doc) return new Response("no such Uigma document — open it from the canvas", { status: 404 });
    // a fresh install: the pinned prebuilt editor is fetched on the first tab (~14 MB, sha256 checked)
    const ready = await ctx.fns.uigma.ensureEditor({});
    const status = await ctx.fns.uigma.editorStatus({});
    const cfg = await ctx.fns.uigma.config({});
    const lang = /^ru\b/i.test(opts.req.headers.get("accept-language") ?? "") ? "ru" : "en";
    // the editor's hosted mode (editor/speca.patch, src/app/host/flags.ts): `speca` turns it on — the flag keeps the
    // name of the host it was written for, so one build serves both; the theme is added by the page itself. The
    // address is relative: the editor is served by this very Hyper (the /uigma/editor middleware), on its origin.
    const editorUrl = status.installed ? `/uigma/editor/?speca=1&type=${doc.type}&lang=${lang}${cfg.online ? "&fonts=1" : ""}` : "";
    const csrf = await ctx.fns.auth.csrfToken({ req: opts.req });
    const html = await ctx.fns.uigma.hostPage({ name, type: doc.type, csrf, editorUrl, lang, canEdit: true, ...(ready.error ? { installError: ready.error } : {}) });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "SAMEORIGIN", "referrer-policy": "no-referrer" } });
}
