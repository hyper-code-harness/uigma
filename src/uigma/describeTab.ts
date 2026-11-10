/**
 * One line for the agent's canvas block about a Uigma tab: the document, its kind, revision and pages (as of its
 * last save), whether its editor is open, and the functions to work on it with.
 *
 * Use from the canvas kinds' describe.
 * @param opts.name Document name.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
}): Promise<string> {
    const d = await ctx.fns.uigma.getDoc({ name: opts.name }).catch(() => null);
    if (!d) return `Uigma "${opts.name}" (not saved yet)`;
    const pages = d.summary.pages.map(p => `${p.name} (${p.layers})`).join(", ");
    const open = await ctx.fns.uigma.hubOnline({ name: d.name });
    return `Uigma ${d.type === "board" ? "board" : "design file"} "${d.name}", rev ${d.rev}${pages ? `, pages: ${pages}` : ""}${open ? ", editor open" : ""} — work in it with uigma.run({ name: "${d.name}", calls }), look with uigma.shot({ name: "${d.name}" })`;
}
