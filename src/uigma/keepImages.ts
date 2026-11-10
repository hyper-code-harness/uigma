/**
 * Takes the pictures out of an editor result (objects with base64 + an image mimeType) and writes them as files
 * under <data folder>/shots; the result keeps their sizes and gets `file: <path>` in place of the bytes.
 *
 * Use on every editor result before it reaches an agent, so no base64 ever enters a transcript.
 * @param opts.value The editor's result.
 * @param opts.name Base of the file names.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** The editor's result. */
    value: unknown;
    /** Base of the file names. */
    name: string;
}): Promise<{ value: unknown; files: string[] }> {
    const { mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join((await ctx.fns.uigma.config({})).dataDir, "shots");
    const files: string[] = [];
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const walk = async (v: unknown, depth: number): Promise<unknown> => {
        if (!v || typeof v !== "object" || depth > 4) return v;
        if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await walk(x, depth + 1)); return out; }
        const o = v as Record<string, unknown>;
        if (typeof o.base64 === "string" && typeof o.mimeType === "string" && /^image\/(png|jpeg|webp)$/.test(o.mimeType) && files.length < 8) {
            const ext = o.mimeType === "image/png" ? "png" : o.mimeType === "image/jpeg" ? "jpg" : "webp";
            await mkdir(dir, { recursive: true });
            const path = join(dir, `${opts.name.replace(/[^A-Za-z0-9_-]+/g, "-")}-${stamp}${files.length ? `-${files.length + 1}` : ""}.${ext}`);
            await Bun.write(path, Buffer.from(o.base64, "base64"));
            files.push(path);
            const { base64: _bytes, ...rest } = o;
            return { ...rest, file: path };
        }
        const out: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(o)) out[k] = await walk(x, depth + 1);
        return out;
    };
    return { value: await walk(opts.value, 0), files };
}
