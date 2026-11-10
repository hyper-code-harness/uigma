/**
 * Checks a document name and returns it trimmed; throws on a name that is not 1–80 letters, digits, - or _.
 *
 * Use on every name that comes from a tab's args, a route or an agent before it reaches a path or the database.
 * @param opts.name Document name to check.
 */
export default function (_ctx: Context, _session: Session | null, opts: {
    /** Document name to check. */
    name: unknown;
}): string {
    const name = String(opts.name ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(name)) throw new Error(`uigma: a document name is 1–80 letters, digits, - and _ (got ${JSON.stringify(String(opts.name ?? "")).slice(0, 90)})`);
    return name;
}
