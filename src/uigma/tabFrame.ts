/**
 * Returns the body of a Uigma canvas tab: a frame of the plugin's host page for this document, which frames the
 * editor and keeps the file. The tab is never re-rendered by its own saves (its state does not change), so the
 * live editor keeps running while the canvas around it refreshes.
 *
 * Use from the uigma.file and uigma.board canvas kinds.
 * @param opts.name Document name.
 * @param opts.title Tab title, for the frame's accessible name.
 * @param opts.itemId Canvas tab id.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** Tab title, for the frame's accessible name. */
    title?: string;
    /** Canvas tab id. */
    itemId: number;
}): Promise<string> {
    const esc = (text: string) => ctx.fns.w.escape({ text });
    const name = await ctx.fns.uigma.checkName({ name: opts.name });
    return `<iframe data-canvas-frame="${esc(String(opts.itemId))}" src="/uigma/tab/${encodeURIComponent(name)}" title="${esc(opts.title ?? `Uigma · ${name}`)}" allow="clipboard-read; clipboard-write; local-fonts; fullscreen" class="block h-full w-full border-0 bg-base-100"></iframe>`;
}
