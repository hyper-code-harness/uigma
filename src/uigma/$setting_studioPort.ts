// The studio Chrome's DevTools port on loopback; the plugin drives it over CDP.
export default {
    type: "number",
    default: 39017,
    min: 1024,
    max: 65535,
    title: "Studio Chrome port",
    description: "Loopback port the studio's headless Chrome listens on for DevTools (CDP). Change it when the port is taken or a firewall allows another range.",
    env: "UIGMA_STUDIO_PORT",
};
