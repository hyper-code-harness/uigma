// Builds the Uigma editor: OpenPencil (MIT, https://github.com/open-pencil/open-pencil) at a pinned commit with
// speca.patch on top — the "hosted" mode in which the editor lives in a frame of a host page (one document, kept by
// the host; the agent's requests relayed to it by postMessage). Run by uigma.installEditor({ mode: "build" }) or by hand:
//
//   bun editor/build.ts --out <dir>        build into <dir> (replaced whole when the build succeeds)
//   bun editor/build.ts --out <dir> --src <checkout>   build an existing checkout as it is (no clone, no patch)
//   --work <dir>                            where the checkout and the editor's own Bun go (default: $TMPDIR/hyper-uigma-editor)
//
// Needs git and Rust (cargo) on this machine; the Bun version the editor is built with is fetched by the script and
// the Bun running Hyper stays as it is. Takes a few minutes and about 45 MB in <dir>.
import { cp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const REPO = "https://github.com/open-pencil/open-pencil.git";
export const COMMIT = "cabbffd06c192ecfaaab3951994fb2424f3bc326";
const BUN = "1.4.4";
const HERE = import.meta.dir;
// parts of the standalone web app a canvas tab never uses (its offline worker, its sign-in pages, its sample file)
const DROP = ["sw.js", "oauth", "updater.html", "_redirects", "demo.fig", "manifest.webmanifest"];

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };

async function run(cmd: string[], cwd: string, env: Record<string, string> = {}) {
    console.log(`\n$ ${cmd.join(" ")}`);
    const p = Bun.spawn(cmd, { cwd, env: { ...process.env, ...env }, stdout: "inherit", stderr: "inherit" });
    if ((await p.exited) !== 0) throw new Error(`${cmd[0]} ${cmd[1] ?? ""} failed`);
}

function cargoDir(): string | null {
    if (Bun.which("cargo")) return "";
    for (const d of [join(homedir(), ".cargo", "bin"), "/opt/homebrew/opt/rustup/bin", "/usr/local/opt/rustup/bin"]) if (existsSync(join(d, "cargo"))) return d;
    return null;
}

if (import.meta.main) {
    const outArg = arg("--out");
    if (!outArg) { console.error("usage: bun editor/build.ts --out <dir> [--src <checkout>] [--work <dir>]"); process.exit(2); }
    const DIST = resolve(outArg);
    const WORK = resolve(arg("--work") ?? join(tmpdir(), "hyper-uigma-editor"));
    if (!Bun.which("git")) { console.error("git is needed to fetch OpenPencil."); process.exit(1); }
    const cargo = cargoDir();
    if (cargo === null) { console.error("Rust is needed to build the editor (its text and vector parts compile to WebAssembly): install it from https://rustup.rs and run this again."); process.exit(1); }

    // the Bun the editor's own build expects, next to the work folder
    const tools = join(WORK, "tools");
    await mkdir(tools, { recursive: true });
    if (!existsSync(join(tools, "node_modules", ".bin", "bun"))) {
        await writeFile(join(tools, "package.json"), JSON.stringify({ name: "uigma-editor-tools", private: true }));
        await run(["bun", "add", `bun@${BUN}`], tools);
    }
    const PATH = [join(tools, "node_modules", ".bin"), cargo, process.env.PATH].filter(Boolean).join(":");

    let src = arg("--src");
    if (!src) {
        src = join(WORK, "src");
        await rm(src, { recursive: true, force: true });
        await mkdir(src, { recursive: true });
        await run(["git", "init", "-q"], src);
        await run(["git", "fetch", "-q", "--depth", "1", REPO, COMMIT], src);
        await run(["git", "checkout", "-q", "FETCH_HEAD"], src);
        await run(["git", "apply", "--whitespace=nowarn", join(HERE, "speca.patch")], src);
        await run(["bun", "install", "--frozen-lockfile"], src, { PATH });
        await run(["bun", "run", "build:packages"], src, { PATH });
    }
    // no cloud: the standalone app's accounts and sharing stay out of the build
    await run(["bunx", "vite", "build"], src, { PATH, VITE_OPENPENCIL_CLOUD: "off" });

    const version = ((await Bun.file(join(src, "package.json")).json()) as { version?: string }).version ?? "";
    const next = `${DIST}.next`;
    await mkdir(dirname(DIST), { recursive: true });
    await rm(next, { recursive: true, force: true });
    await cp(join(src, "dist"), next, { recursive: true });
    for (const f of DROP) await rm(join(next, f), { recursive: true, force: true });
    for (const f of new Bun.Glob("workbox-*.js").scanSync(next)) await rm(join(next, f), { force: true });
    // what the editor's agent tools are, for uigma.help and uigma.run to describe and check without an open editor
    await run(["bun", join(HERE, "dump-tools.ts"), src, join(next, "uigma-tools.json")], HERE, { PATH });
    // the editor's authoring reference of this very version, next to the build (uigma.authoring reads it)
    const ref = join(src, "skills", "open-pencil", "references", "design-authoring.md");
    if (existsSync(ref)) await cp(ref, join(next, "authoring-reference.md"));
    await writeFile(join(next, "uigma.json"), JSON.stringify({ version, commit: COMMIT, builtAt: new Date().toISOString(), by: "hyper-uigma" }));
    await rm(DIST, { recursive: true, force: true });
    await rename(next, DIST);
    console.log(`\nThe Uigma editor ${version} is in ${DIST}. Open a Uigma tab to see it (an open one: reload it).`);
}
