/** One of the editor's own agent tools, as the build lists them in uigma-tools.json. */
export type Tool = {
    /** Tool name, e.g. render, get_page_tree. */
    name: string;
    /** What it does, in the editor makers' words. */
    description: string;
    /** It changes the document (false: reads only). */
    mutates: boolean;
    /** Its inputs as JSON Schema. */
    inputSchema: { properties?: Record<string, { description?: string; type?: unknown }>; required?: string[] } & Record<string, unknown>;
};
