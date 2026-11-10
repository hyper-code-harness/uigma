/**
 * Returns the editor makers' own authoring reference for the `render` tool's JSX (Frame, Text, Component,
 * Instance, Icon, Sticky, Shape, Connector; layout, paints, text, variables with modes, component properties) —
 * the copy the installed build carries, else the one in this plugin's SKILL.md.
 *
 * Use before the first `render` in a task, or when a JSX attribute is unclear.
 */
export default async function (_ctx: Context, _session: Session | null, _opts: {}): Promise<string> {
    const { join, resolve } = await import("node:path");
    const cfg = await _ctx.fns.uigma.config({});
    const built = Bun.file(join(cfg.editorDir, "authoring-reference.md"));
    if (await built.exists()) return (await built.text()).replace(/^<!--[\s\S]*?-->\s*/, "");
    const skill = await Bun.file(resolve(import.meta.dir, "..", "..", "SKILL.md")).text();
    const at = skill.indexOf("## The editor's authoring reference");
    return at >= 0 ? skill.slice(at) : skill;
}
