// The first tab (or agent call) on a Hyper without the editor downloads the pinned prebuilt archive by itself.
export default {
    type: "boolean",
    default: true,
    title: "Download the editor on first use",
    description: "On: a Uigma tab or an agent's call on a Hyper without the editor downloads the prebuilt build pinned in editor/release.json (~14 MB from this plugin's GitHub release, sha256 checked) into uigma.editorDir. Off: install it on request with uigma.installEditor.",
    env: "UIGMA_AUTO_INSTALL",
};
