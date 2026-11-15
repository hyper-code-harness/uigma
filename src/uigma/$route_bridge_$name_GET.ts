/**
 * The open editor of a document listens here (server-sent events) for what an agent asks of it — `ask`
 * {id, command, args} and `cancel` {id} — and answers through POST /uigma/reply/<name>. Opened by the host page
 * once the editor has the file.
 * @param opts.req Incoming HTTP request.
 * @param opts.params Route parameters: the document name.
 */
export default async function (ctx: Context, session: Session | null, opts: {
    /** Incoming HTTP request. */ req: Request;
    /** Route parameters: the document name. */ params: { name: string } }) {
    let name: string;
    try { name = await ctx.fns.uigma.checkName({ name: opts.params.name }); } catch (e: any) { return new Response(e.message, { status: 400 }); }
    if (!(await ctx.fns.uigma.getDoc({ name }))) return new Response("no such document", { status: 404 });
    const enc = new TextEncoder();
    let leave: (() => void) | null = null;
    let ping: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream({
        async start(ctrl) {
            const sse = (type: string, data: unknown) => ctrl.enqueue(enc.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
            ping = setInterval(() => { try { ctrl.enqueue(enc.encode(": ping\n\n")); } catch { clearInterval(ping); } }, 20_000);
            const userId = (session as any)?.user?.id ?? null;
            leave = await ctx.fns.uigma.hubJoin({ name, userId, studio: userId === "uigma-studio", send: sse });
            sse("hello", {});
            opts.req.signal.addEventListener("abort", () => { clearInterval(ping); leave?.(); try { ctrl.close(); } catch { /* closed */ } });
        },
        cancel() { clearInterval(ping); leave?.(); },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
