// Packs a built editor folder into the release archive uigma.installEditor downloads, and prints what goes into
// editor/release.json: bun editor/pack.ts <editor dir> <out.tgz> [url]
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const [dir, out, url] = process.argv.slice(2);
if (!dir || !out) { console.error("usage: bun editor/pack.ts <editor dir> <out.tgz> [release asset url]"); process.exit(2); }
if (!existsSync(resolve(dir, "index.html"))) { console.error(`${dir} has no index.html: build the editor first (bun editor/build.ts --out ${dir})`); process.exit(1); }
const p = Bun.spawn(["tar", "-czf", resolve(out), "-C", resolve(dir), "."], { stdout: "inherit", stderr: "inherit", env: { ...process.env, COPYFILE_DISABLE: "1" } });
if ((await p.exited) !== 0) process.exit(1);
const bytes = new Uint8Array(await Bun.file(resolve(out)).arrayBuffer());
const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const meta = await Bun.file(resolve(dir, "uigma.json")).json().catch(() => ({})) as { version?: string; commit?: string };
console.log(JSON.stringify({ url: url ?? "<the asset's download URL>", sha256, version: meta.version ?? "", commit: meta.commit ?? "", size: bytes.length }, null, 2));
