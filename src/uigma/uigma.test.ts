// Uigma's own behaviour against a booted Hyper (bun <hyper>/script/plugin-test.ts .): documents and revisions,
// the routes the host page uses, the hub between an agent's call and an open editor (a stand-in editor answers),
// the tool catalogue, the editor's static server and the three ways to install it. The real editor is exercised
// by hand / in a throwaway Hyper (README, Verification).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testCtx } from "hyper:test";
import migration from "./$migration_20261110120000_uigma_docs";

let ctx: Context;
let tmp: string;
const editorDir = () => join(tmp, "editor");
const port = 47400 + Math.floor(Math.random() * 500);

const TOOLS = [
    { name: "render", description: "Render JSX into the page. More words.", mutates: true, inputSchema: { $schema: "x", type: "object", properties: { jsx: { type: "string" }, x: { type: "number" } }, required: ["jsx"] } },
    { name: "get_page_tree", description: "Read the page tree.", mutates: false, inputSchema: { type: "object", properties: { depth: { type: "number" }, path: { type: "string", description: "Inside OPENPENCIL_MCP_ROOT only" } } } },
    { name: "export_image", description: "Export an image.", mutates: false, inputSchema: { type: "object", properties: {} } },
    { name: "search_icons", description: "Search icons.", mutates: false, inputSchema: { type: "object", properties: { query: { type: "string" } } } },
    { name: "web_search", description: "Hidden.", mutates: false, inputSchema: {} },
];

async function fakeBuild(dir: string, version = "9.9.9") {
    await mkdir(join(dir, "assets"), { recursive: true });
    await writeFile(join(dir, "index.html"), "<!doctype html><title>OpenPencil</title>");
    await writeFile(join(dir, "assets", "main-abc.js"), "console.log(1)");
    await writeFile(join(dir, "uigma-tools.json"), JSON.stringify(TOOLS));
    await writeFile(join(dir, "uigma.json"), JSON.stringify({ version, commit: "cabbffd06c192ecfaaab3951994fb2424f3bc326" }));
}

/** A stand-in for the open editor: joins the hub and answers each ask as the real bridge would. */
async function fakeEditor(name: string, answer: (command: string, args: any) => unknown) {
    const asked: Array<{ command: string; args: any }> = [];
    const leave = await ctx.fns.uigma.hubJoin({
        name, userId: null,
        send: (event: string, data: any) => {
            if (event !== "ask") return;
            asked.push({ command: data.command, args: data.args });
            queueMicrotask(async () => {
                try { await ctx.fns.uigma.hubAnswer({ name, id: data.id, ok: true, result: { ok: true, result: answer(data.command, data.args) } }); }
                catch (e: any) { await ctx.fns.uigma.hubAnswer({ name, id: data.id, ok: false, error: e.message }); }
            });
        },
    });
    return { asked, leave };
}

beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), "uigma-test-"));
    ctx = await testCtx({ env: { UIGMA_EDITOR_DIR: join(tmp, "editor"), UIGMA_DATA_DIR: join(tmp, "data"), UIGMA_EDITOR_PORT: String(port), HYPER_HOME: join(tmp, "home") } });
    await migration.up(ctx);
});
afterAll(async () => {
    ctx?.fns.uigma.stopEditorServer({});
    await rm(tmp, { recursive: true, force: true });
});

describe("the plugin is mounted", () => {
    test("functions, canvas kinds and settings are there", async () => {
        expect(typeof ctx.fns.uigma.run).toBe("function");
        const kinds = (ctx.state as any).canvas.kinds;
        expect(kinds["uigma.file"]).toBeTruthy();
        expect(kinds["uigma.board"]).toBeTruthy();
        const cfg = await ctx.fns.uigma.config({});
        expect(cfg.editorDir).toBe(editorDir());
        expect(cfg.port).toBe(port);
        expect(cfg.online).toBe(false);
    });
});

describe("documents", () => {
    test("a name is checked", async () => {
        expect(() => ctx.fns.uigma.checkName({ name: "../x" })).toThrow();
        expect(await ctx.fns.uigma.checkName({ name: " flow-1 " })).toBe("flow-1");
    });

    test("a board is opened, saved in revisions, and a stale save is a conflict", async () => {
        const kind = (ctx.state as any).canvas.kinds["uigma.board"];
        const p = await kind.prepare(ctx, { agentId: "a1", args: { name: "map" } });
        expect(p).toEqual({ args: { name: "map" }, title: "Uigma board · map" });
        await expect(ctx.fns.uigma.ensureDoc({ name: "map", type: "design" })).rejects.toThrow(/board/);
        expect((await ctx.fns.uigma.readBytes({ name: "map" }))).toEqual({ bytes: null, rev: 0, type: "board" });

        const one = await ctx.fns.uigma.saveDoc({ name: "map", bytes: new Uint8Array([1, 2, 3]), base: 0, summary: { pages: [{ name: "Page 1", layers: 4 }] } });
        expect(one).toEqual({ ok: true, rev: 1 });
        expect(await ctx.fns.uigma.saveDoc({ name: "map", bytes: new Uint8Array([9]), base: 0 })).toEqual({ ok: false, conflict: true, rev: 1 });
        expect(await ctx.fns.uigma.saveDoc({ name: "map", bytes: new Uint8Array([4, 5]), base: 0, force: true })).toEqual({ ok: true, rev: 2 });
        const r = await ctx.fns.uigma.read({ name: "map" });
        expect(r?.rev).toBe(2);
        expect(r?.path?.endsWith("/docs/map/2.jam")).toBe(true);
        expect([...(await ctx.fns.uigma.readBytes({ name: "map", rev: 1 }))!.bytes!]).toEqual([1, 2, 3]);
        expect((await ctx.fns.uigma.list({ type: "board" })).map(d => d.name)).toEqual(["map"]);
        expect(await ctx.fns.uigma.describeTab({ name: "map" })).toContain("board \"map\", rev 2");
    });

    test("a design file starts from a .fig file", async () => {
        const src = join(tmp, "start.fig");
        await writeFile(src, new Uint8Array([7, 7]));
        const kind = (ctx.state as any).canvas.kinds["uigma.file"];
        await kind.prepare(ctx, { agentId: "a1", args: { name: "home", from: src } });
        const b = await ctx.fns.uigma.readBytes({ name: "home" });
        expect(b?.rev).toBe(0);
        expect([...b!.bytes!]).toEqual([7, 7]);
        const html = await kind.render(ctx, { agentId: "a1", item: { id: 5, args: { name: "home" }, title: "Uigma · home" } });
        expect(html).toContain('src="/uigma/tab/home"');
        expect(html).toContain('data-canvas-frame="5"');
    });
});

describe("routes", () => {
    test("doc, save (CSRF) and the tab page", async () => {
        const res = await ctx.fns.procs.http.dispatch({ url: "/uigma/doc/map" });
        expect(res.status).toBe(200);
        expect(res.headers.get("x-uigma-rev")).toBe("2");

        const form = new FormData();
        form.append("summary", JSON.stringify({ pages: [{ name: "P", layers: 1 }] }));
        form.append("file", new Blob([new Uint8Array([1])]), "board.jam");
        expect((await ctx.fns.procs.http.dispatch({ method: "POST", url: "/uigma/save/map?base=2", body: form })).status).toBe(403);

        const csrf = await ctx.fns.auth.csrfToken({ req: new Request("http://localhost/uigma/tab/map") });
        const form2 = new FormData();
        form2.append("summary", JSON.stringify({ pages: [{ name: "P", layers: 1 }] }));
        form2.append("file", new Blob([new Uint8Array([1])]), "board.jam");
        const saved = await ctx.fns.procs.http.dispatch({ method: "POST", url: "/uigma/save/map?base=2", body: form2, headers: { "x-csrf-token": csrf } });
        expect(saved.status).toBe(200);
        expect(await saved.json()).toEqual({ rev: 3 });

        // the editor is not installed yet: the tab says how to get it and loads no script
        const page = await ctx.fns.procs.http.dispatch({ url: "/uigma/tab/map" });
        const html = await page.text();
        expect(page.status).toBe(200);
        expect(html).toContain("uigma.installEditor");
        expect(html).not.toContain("/uigma/host.js");
        expect((await ctx.fns.procs.http.dispatch({ url: "/uigma/tab/nope" })).status).toBe(404);
    });

    test("the host script is served", async () => {
        const res = await ctx.fns.procs.http.dispatch({ url: "/uigma/host.js" });
        expect(res.status).toBe(200);
        const js = await res.text();
        expect(js).toContain("uigma");
        expect(js).not.toMatch(/https?:\/\/(?!127)/);
    });
});

describe("the editor", () => {
    test("not installed: status says how, help and run say so", async () => {
        const s = await ctx.fns.uigma.editorStatus({});
        expect(s.installed).toBe(false);
        expect(s.howToInstall).toContain("installEditor");
        expect(await ctx.fns.uigma.help({})).toContain("not installed");
        const r = await ctx.fns.uigma.run({ name: "map", calls: [{ tool: "get_page_tree" }] });
        expect(r.ok).toBe(false);
        expect(r.text).toContain("not installed");
    });

    test("install by copy, then the catalogue and the server", async () => {
        const build = join(tmp, "built");
        await fakeBuild(build);
        const r = await ctx.fns.uigma.installEditor({ mode: "copy", from: build });
        expect(r.ok).toBe(true);
        expect(r.version).toBe("9.9.9");
        const tools = await ctx.fns.uigma.tools({});
        expect(tools.map(t => t.name)).toEqual(["render", "get_page_tree", "export_image", "search_icons"]);
        expect(JSON.stringify(tools)).not.toContain("$schema");
        expect(tools[1]!.inputSchema.properties).not.toHaveProperty("path");
        const help = await ctx.fns.uigma.help({});
        expect(help).toContain("render(jsx, x?) — Render JSX into the page.");
        expect(help).toContain("needs the setting uigma.online");
        expect(await ctx.fns.uigma.help({ tools: ["get_page_tree"] })).toContain("(reads only)");

        const srv = await ctx.fns.uigma.editorServer({});
        expect(srv.port).toBe(port);
        const page = await fetch(`http://127.0.0.1:${port}/some/app/route`);
        expect(page.status).toBe(200);
        expect(page.headers.get("content-security-policy")).toContain("connect-src 'self' data: blob:;");
        expect(await page.text()).toContain("OpenPencil");
        expect((await fetch(`http://127.0.0.1:${port}/assets/main-abc.js`)).headers.get("cache-control")).toContain("immutable");
        expect((await fetch(`http://127.0.0.1:${port}/assets/missing.js`)).status).toBe(404);
        expect((await fetch(`http://127.0.0.1:${port}/uigma.json`, { method: "POST" })).status).toBe(405);

        const tab = await (await ctx.fns.procs.http.dispatch({ url: "/uigma/tab/map", headers: { host: "localhost:3010" } })).text();
        expect(tab).toContain(`data-editor="http://127.0.0.1:${port}/?speca=1&amp;type=board&amp;lang=en"`);
        expect(tab).toContain('<script src="/uigma/host.js"></script>');
        expect(tab).not.toMatch(/<(script|link)[^>]+(src|href)="https?:/);
    });

    test("download checks the pinned sha256", async () => {
        const build = join(tmp, "built2");
        await fakeBuild(build, "1.2.3");
        const tgz = join(tmp, "editor.tgz");
        expect(await Bun.spawn(["tar", "-czf", tgz, "-C", build, "."]).exited).toBe(0);
        const bytes = await Bun.file(tgz).arrayBuffer();
        const sha = new Bun.CryptoHasher("sha256").update(new Uint8Array(bytes)).digest("hex");
        const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response(bytes) });
        try {
            const url = `http://127.0.0.1:${server.port}/editor.tgz`;
            await expect(ctx.fns.uigma.installEditor({ mode: "download", url, sha256: "0".repeat(64) })).rejects.toThrow(/sha256/);
            expect((await ctx.fns.uigma.editorStatus({})).version).toBe("9.9.9");
            const r = await ctx.fns.uigma.installEditor({ mode: "download", url, sha256: sha });
            expect(r.version).toBe("1.2.3");
            expect(existsSync(join(editorDir(), "index.html"))).toBe(true);
        } finally { server.stop(true); }
    });
});

describe("an agent's calls reach the open editor", () => {
    test("run sends tools in order, unwraps results and keeps pictures as files", async () => {
        const png = Buffer.from("89504e470d0a1a0a", "hex").toString("base64");
        const ed = await fakeEditor("map", (command, args) => {
            if (command === "summary") return { pages: [{ id: "0:1", name: "Page 1", layers: 3 }, { id: "0:9", name: "Flows", layers: 0 }] };
            if (args?.name === "render") return { id: "1:2", name: "Card" };
            if (args?.name === "export_image") return { width: 10, height: 20, scale: 2, mimeType: "image/png", base64: png };
            if (args?.name === "get_page_tree") return { error: "no such node" };
            return "ok";
        });
        try {
            expect(await ctx.fns.uigma.hubOnline({ name: "map" })).toBe(true);
            const r = await ctx.fns.uigma.run({ name: "map", page: "flows", calls: [{ tool: "render", args: { jsx: "<Frame/>" } }, { tool: "undo" }] });
            expect(r.ok).toBe(true);
            expect(r.results.map(x => x.result)).toEqual([{ id: "1:2", name: "Card" }, "ok"]);
            expect(ed.asked.map(a => a.command)).toEqual(["summary", "tool", "undo"]);
            expect(ed.asked[1]!.args).toMatchObject({ name: "render", args: { jsx: "<Frame/>" }, page_id: "0:9", agent: { kind: "mcp", client: "Hyper" } });

            const stop = await ctx.fns.uigma.run({ name: "map", calls: [{ tool: "get_page_tree" }, { tool: "render", args: { jsx: "<Frame/>" } }] });
            expect(stop.ok).toBe(false);
            expect(stop.text).toContain("failed: no such node");
            expect(stop.text).toContain("Stopped here");

            expect((await ctx.fns.uigma.run({ name: "map", calls: [{ tool: "nope" }] })).text).toContain("No such editor tool: nope");
            expect((await ctx.fns.uigma.run({ name: "map", calls: [{ tool: "search_icons", args: { query: "x" } }] })).text).toContain("uigma.online");

            const shot = await ctx.fns.uigma.shot({ name: "map", nodes: ["1:2"] });
            expect(shot.ok).toBe(true);
            if (shot.ok) {
                expect(shot.width).toBe(10);
                expect(existsSync(shot.path)).toBe(true);
                expect(new Uint8Array(await Bun.file(shot.path).arrayBuffer())[1]).toBe(0x50);
            }
            expect(ed.asked.at(-1)!.args).toMatchObject({ name: "export_image", args: { ids: ["1:2"], format: "PNG", maxEdge: 1600 } });
        } finally { ed.leave(); }
        expect(await ctx.fns.uigma.hubOnline({ name: "map" })).toBe(false);
    });

    test("a picture named by its path goes in as bytes", async () => {
        const img = join(tmp, "pic.png");
        await writeFile(img, Buffer.from("89504e470d0a1a0a", "hex"));
        const ed = await fakeEditor("map", () => ({ ok: 1 }));
        try {
            const r = await ctx.fns.uigma.run({ name: "map", calls: [{ tool: "render", args: { image_data: img } }] });
            expect(r.ok).toBe(true);
            expect(String(ed.asked[0]!.args.args.image_data)).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
        } finally { ed.leave(); }
    });

    test("an editor that leaves fails its waiting request; an answer for another document is refused", async () => {
        const leaveHolder: { leave?: () => void } = {};
        const pending = new Promise<any>(async resolve => {
            leaveHolder.leave = await ctx.fns.uigma.hubJoin({ name: "map", send: () => { queueMicrotask(() => leaveHolder.leave?.()); } });
            resolve(await ctx.fns.uigma.hubAsk({ name: "map", command: "summary" }));
        });
        expect((await pending).error).toContain("closed");
        expect(await ctx.fns.uigma.hubAnswer({ name: "other", id: "x", ok: true })).toBe(false);
        const none = await ctx.fns.uigma.hubAsk({ name: "map", command: "summary" });
        expect(none.offline).toBe(true);
    });
});
