/**
 * Keeps a new revision of a document from the editor: the bytes on disk first (written whole, then renamed), then
 * the row that makes them current; the last 30 revisions stay. `base` is the revision the editor started from — a
 * different current one means someone saved meanwhile and the save is refused with `conflict` unless `force`.
 *
 * Use from the tab's save route; agents change documents through uigma.run, never by writing bytes.
 * @param opts.name Document name.
 * @param opts.bytes The document as the editor saved it (.fig / .jam).
 * @param opts.base The revision the editor's copy started from.
 * @param opts.summary Pages as the editor counted them: {pages: [{name, layers}]}.
 * @param opts.force Save over a newer revision. @default false
 * @param opts.userId Who saved.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Document name. */
    name: string;
    /** The document as the editor saved it (.fig / .jam). */
    bytes: Uint8Array;
    /** The revision the editor's copy started from. */
    base: number;
    /** Pages as the editor counted them: {pages: [{name, layers}]}. */
    summary?: unknown;
    /** Save over a newer revision. @default false */
    force?: boolean;
    /** Who saved. */
    userId?: string | null;
}): Promise<{ ok: true; rev: number } | { ok: false; conflict: true; rev: number }> {
    const { mkdir, rename, readdir, unlink, writeFile } = await import("node:fs/promises");
    const { dirname, join } = await import("node:path");
    const MAX = 96 * 1024 * 1024, KEEP = 30;
    if (!opts.bytes?.length) throw new Error("uigma: empty file");
    if (opts.bytes.length > MAX) throw new Error("uigma: file too large");
    const doc = await ctx.fns.uigma.getDoc({ name: opts.name });
    if (!doc) throw new Error(`uigma: no document "${opts.name}" — open it in a tab first`);
    if (doc.rev !== Number(opts.base) && !opts.force) return { ok: false, conflict: true, rev: doc.rev };
    const s = opts.summary as any;
    const pages = (Array.isArray(s?.pages) ? s.pages : []).slice(0, 200).map((p: any) => ({
        name: String(p?.name ?? "").slice(0, 120),
        layers: Math.max(0, Math.min(10_000_000, Math.round(Number(p?.layers) || 0))),
    }));
    const next = doc.rev + 1;
    const path = await ctx.fns.uigma.docPath({ name: doc.name, type: doc.type, rev: next });
    await mkdir(dirname(path), { recursive: true });
    await writeFile(`${path}.part`, opts.bytes);
    await rename(`${path}.part`, path);
    const r = await ctx.fns.procs.db.run({
        sql: `update uigma_docs set rev = ?, size = ?, summary = ?::jsonb, updated_by = ?, updated_at = ? where name = ? and rev = ? returning rev`,
        params: [next, opts.bytes.length, JSON.stringify({ pages }), opts.userId ?? null, Date.now(), doc.name, doc.rev],
    });
    if (!r.rows?.length) return { ok: false, conflict: true, rev: next };
    try {
        for (const f of await readdir(dirname(path))) {
            const n = Number(f.split(".")[0]);
            if (!f.endsWith(".part") && Number.isInteger(n) && n <= next - KEEP) await unlink(join(dirname(path), f)).catch(() => {});
        }
    } catch { /* nothing to prune */ }
    return { ok: true, rev: next };
}
