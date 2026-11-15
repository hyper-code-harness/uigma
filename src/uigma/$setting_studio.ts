// The studio: a headless Chrome of Hyper's own that keeps documents open for agents when no person has them on
// screen. Off: an agent can draw only in a tab somebody opened.
export default {
    type: "boolean",
    default: true,
    title: "Studio (headless editor for agents)",
    description: "On: a headless Chrome on the Hyper machine (hyperd unit uigma-studio, CDP on uigma.studioPort) opens a document's host page when an agent draws in or looks at it and nobody has its tab open. Off: agents' calls wait for a person's tab only.",
    env: "UIGMA_STUDIO",
};
