// web-ifc loads its WASM at runtime from /wasm/. Keep public/wasm in sync with node_modules.
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const files = ["web-ifc.wasm", "web-ifc-mt.wasm"];
const from = "node_modules/web-ifc";
const to = "public/wasm";

if (!existsSync(from)) process.exit(0);
await mkdir(to, { recursive: true });
for (const f of files) {
  if (existsSync(`${from}/${f}`)) await copyFile(`${from}/${f}`, `${to}/${f}`);
}
console.log("[copy-wasm] web-ifc wasm copied to public/wasm");
