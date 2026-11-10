// Where documents are kept: <dir>/docs/<name>/<rev>.fig|jam, and the agent's pictures in <dir>/shots.
export default {
    type: "string",
    default: "",
    title: "Data folder",
    description: "Folder for Uigma documents (one file per revision, the last 30 kept) and the agent's screenshots. Empty: <Hyper home>/uigma.",
    env: "UIGMA_DATA_DIR",
};
