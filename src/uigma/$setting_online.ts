// Off: the editor has no network (system and built-in fonts, no icon catalogue).
export default {
    type: "boolean",
    default: false,
    title: "Fonts and icons from the internet",
    description: "Off by default: the editor works without the network, with the computer's and the built-in fonts and without icon catalogues. On: it may load fonts (api.fontsource.org, cdn.jsdelivr.net, Google Fonts) and icons (api.iconify.design) — only the names asked for leave, never the file.",
    env: "UIGMA_ONLINE",
};
