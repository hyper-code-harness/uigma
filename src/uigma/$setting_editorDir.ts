// Where the built editor lives (index.html, assets/, uigma-tools.json). Empty: `<Hyper home>/uigma/editor`
// (`~/.hyper/uigma/editor`, or under HYPER_HOME). uigma.installEditor puts the build here.
export default {
    type: "string",
    default: "",
    title: "Editor folder",
    description: "Folder with the built Uigma editor (OpenPencil with the hosted-mode patch). Empty: <Hyper home>/uigma/editor. uigma.installEditor({}) fills it.",
    env: "UIGMA_EDITOR_DIR",
};
