/**
 * The Uigma page: whether the editor is installed (and how to install it), and the documents — design files and
 * boards — with their revision, pages and a link to open each one full-window.
 * @param opts.req Incoming HTTP request.
 */
export default async function (ctx: Context, _session: Session | null, _opts: { /** Incoming HTTP request. */ req: Request }) {
    const esc = (text: unknown) => ctx.fns.w.escape({ text });
    const status = await ctx.fns.uigma.editorStatus({});
    const docs = await ctx.fns.uigma.list({});
    const rows = docs.map(d => `<a href="/uigma/tab/${encodeURIComponent(d.name)}" class="block rounded-lg border border-base-300 p-3 hover:bg-base-200/50"><div class="font-medium">${esc(d.name)}</div><div class="text-xs text-subtle">${d.type === "board" ? "board" : "design"} · rev ${d.rev} · ${esc(d.summary.pages.map(p => p.name).join(", ") || "empty")}${d.open ? " · open" : ""}</div></a>`).join("");
    const editor = status.installed
        ? `<p class="text-sm text-subtle mb-4">Editor ${esc(status.version)} (OpenPencil ${esc(status.commit.slice(0, 10))}), ${status.tools} agent tools · ${esc(status.dir)}</p>`
        : `<p class="text-sm mb-4">The editor is not installed (${esc(status.dir)}). <code>${esc(status.howToInstall)}</code></p>`;
    return { title: "Uigma", main: `<main class="mx-auto max-w-4xl p-6"><h1 class="text-lg font-semibold mb-2">Uigma</h1>${editor}${status.install ? `<p class="text-xs text-subtle mb-4">Install: ${esc(status.install.mode)} · ${status.install.done ? (status.install.error ? esc(status.install.error) : "done") : "running"} · ${esc(status.install.log)}</p>` : ""}<div class="grid gap-2 sm:grid-cols-3">${rows || '<p class="text-subtle">No documents yet. Ask the agent to open one: canvas.show({ kind: "uigma.file", args: { name } }).</p>'}</div></main>` };
}
