// The interface the editor's server listens on.
export default {
    type: "string",
    default: "127.0.0.1",
    title: "Editor listen address",
    description: "Interface of the editor's static server. 127.0.0.1 serves only a browser on this machine; behind a reverse proxy keep it and set uigma.editorUrl.",
    env: "UIGMA_EDITOR_HOST",
};
