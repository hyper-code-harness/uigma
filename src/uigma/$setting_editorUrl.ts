// The editor's public origin, when Hyper is reached from another machine (a reverse proxy in front of the port).
export default {
    type: "string",
    default: "",
    title: "Editor public URL",
    description: "Origin the browser loads the editor from, e.g. https://uigma.example.com proxied to the editor port. Empty: http://127.0.0.1:<port> for a browser on this machine, http://<Hyper's host>:<port> otherwise. Must be another origin than Hyper's.",
    env: "UIGMA_EDITOR_URL",
};
