// A design file in the Uigma editor (OpenPencil: Figma's model and shortcuts — pages, frames, auto layout,
// components with instances and variants, variables, vectors, text), live in a canvas tab. The tab frames the
// plugin's host page (/uigma/tab/<name>), which frames the editor (/uigma/editor/, Hyper's origin) and keeps the file.

export const hint = "a Figma-like design file the person edits by hand — args `{ name }` (letters, digits, - and _; a new name starts an empty file; `from`: a .fig file to start from); the agent works in the same open file with uigma.run({ name, calls }) and looks with uigma.shot({ name }) — read the uigma SKILL first";

export default {
    icon: "bezier-curve",
    async prepare(ctx: Context, opts: { agentId: string; args: Record<string, any> }) {
        const name = await ctx.fns.uigma.checkName({ name: String(opts.args.name ?? "").trim() || `design-${new Date().toISOString().slice(0, 10)}` });
        const from = typeof opts.args.from === "string" && opts.args.from.trim() ? opts.args.from.trim() : null;
        if (from && !/\.(fig|jam)$/i.test(from)) throw new Error("canvas uigma.file: args.from is a path to a .fig file");
        await ctx.fns.uigma.ensureDoc({ name, type: "design", source: from });
        return { args: { name }, title: `Uigma · ${name}` };
    },
    async render(ctx: Context, opts: { agentId: string; item: types.canvas.Item }) {
        return ctx.fns.uigma.tabFrame({ name: String(opts.item.args.name), title: opts.item.title, itemId: opts.item.id });
    },
    async describe(ctx: Context, opts: { item: types.canvas.Item }) {
        return ctx.fns.uigma.describeTab({ name: String(opts.item.args.name) });
    },
} satisfies types.canvas.Kind;
