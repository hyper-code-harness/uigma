// A board in the Uigma editor (FigJam's model: stickies, shapes with text, connectors that follow what they join,
// sections around groups, free drawing), live in a canvas tab. Kept like a design file.

export const hint = "a FigJam-like board the person moves things around on — args `{ name }` (a new name starts an empty board; `from`: a .jam file); for flows, maps, schemes and brainstorms; the agent draws with uigma.run({ name, calls }) (Sticky, Shape, Connector, Section; import_mermaid) and looks with uigma.shot({ name })";

export default {
    icon: "flow-arrow",
    async prepare(ctx: Context, opts: { agentId: string; args: Record<string, any> }) {
        const name = await ctx.fns.uigma.checkName({ name: String(opts.args.name ?? "").trim() || `board-${new Date().toISOString().slice(0, 10)}` });
        const from = typeof opts.args.from === "string" && opts.args.from.trim() ? opts.args.from.trim() : null;
        if (from && !/\.(fig|jam)$/i.test(from)) throw new Error("canvas uigma.board: args.from is a path to a .jam file");
        await ctx.fns.uigma.ensureDoc({ name, type: "board", source: from });
        return { args: { name }, title: `Uigma board · ${name}` };
    },
    async render(ctx: Context, opts: { agentId: string; item: types.canvas.Item }) {
        return ctx.fns.uigma.tabFrame({ name: String(opts.item.args.name), title: opts.item.title, itemId: opts.item.id });
    },
    async describe(ctx: Context, opts: { item: types.canvas.Item }) {
        return ctx.fns.uigma.describeTab({ name: String(opts.item.args.name) });
    },
} satisfies types.canvas.Kind;
