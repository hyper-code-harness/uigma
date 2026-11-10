// The editor is served on an origin of its own (this port), so its page holds no Hyper session.
export default {
    type: "number",
    default: 47320,
    min: 1024,
    max: 65535,
    title: "Editor port",
    description: "Port of the editor's own static server (an origin apart from Hyper's: the editor page holds no Hyper session and cannot call Hyper). A fixed port keeps the editor's own preferences across restarts.",
    env: "UIGMA_EDITOR_PORT",
};
