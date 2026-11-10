// Writes down the editor's own agent tools — name, what it does, whether it changes the file, its inputs as JSON
// Schema — from an OpenPencil checkout, for uigma_help and uigma_run: bun dump-tools.ts <checkout> <out.json>.
// Run by build.ts with the editor's Bun.
import { join } from "node:path";

const [src, out] = [process.argv[2]!, process.argv[3]!];
const { ALL_TOOLS, isToolExposed } = await import(join(src, "packages/core/src/tools/index.ts"));
const { toJsonSchema } = await import(Bun.resolveSync("@valibot/to-json-schema", src));
type Def = { name: string; description: string; mutates?: boolean; input: unknown };
const tools = (ALL_TOOLS as Def[]).filter((t) => isToolExposed(t, "mcp")).map((t) => ({
  name: t.name,
  description: t.description,
  mutates: t.mutates === true,
  inputSchema: toJsonSchema(t.input, { typeMode: "input", errorMode: "ignore" }),
}));
await Bun.write(out, JSON.stringify(tools));
console.log(`${tools.length} tools written to ${out}`);
