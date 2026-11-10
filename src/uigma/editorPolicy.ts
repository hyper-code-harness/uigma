/**
 * Builds the Content-Security-Policy the editor's page and workers are served with: its own files, WebAssembly
 * and workers, and no network beyond its own origin — with `online`, the font and icon catalogues only.
 *
 * Use when serving the editor (uigma.editorServer does); the document itself never travels over the editor's
 * own requests, only through the host page's postMessage.
 * @param opts.online Allow the font catalogues and the Iconify icon API. @default false
 */
export default function (_ctx: Context, _session: Session | null, opts: {
    /** Allow the font catalogues and the Iconify icon API. @default false */
    online?: boolean;
}): string {
    const FONT_HOSTS = "https://api.fontsource.org https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com";
    const ICON_HOSTS = "https://api.iconify.design";
    const online = opts.online === true;
    return [
        "default-src 'self' data: blob:",
        "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
        `style-src 'self' 'unsafe-inline'${online ? " https://fonts.googleapis.com" : ""}`,
        "img-src 'self' data: blob:",
        `font-src 'self' data: blob:${online ? ` ${FONT_HOSTS}` : ""}`,
        `connect-src 'self' data: blob:${online ? ` ${FONT_HOSTS} ${ICON_HOSTS}` : ""}`,
        "worker-src 'self' blob:",
        "frame-src 'self' blob: data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
    ].join("; ");
}
