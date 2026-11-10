// ctx.state.uigma — what lives in the process: the editor's static server, the open editors (the hub between an
// agent's call and the page that runs it), the cached tool list and a running install.
export type State = {
    /** The editor's static server, started on first use. */
    server?: { port: number; host: string; dir: string; online: boolean; stop: () => void };
    /** Open editors (one per open tab of a document) and the requests waiting for their answers. */
    hub?: {
        clients: Map<string, { id: string; name: string; userId: string | null; send: (event: string, data: unknown) => void }>;
        pending: Map<string, { name: string; client: string; done: (a: { ok: boolean; result?: unknown; error?: string }) => void }>;
        waiters: Set<(client: { id: string; name: string }) => void>;
    };
    /** The tool list read from the build, with the file's mtime it was read at. */
    tools?: { file: string; at: number; list: types.uigma.Tool[] };
    /** A background build started by uigma.installEditor. */
    install?: { mode: string; startedAt: number; log: string; done: boolean; code: number | null; error?: string };
};
