// Inline src/logic.js into src/plugin.js -> code.js (Figma plugins can't import modules).
import { readFileSync, writeFileSync } from "node:fs";

const logic = readFileSync(new URL("./src/logic.js", import.meta.url), "utf8").replace(/^export /gm, "");
const plugin = readFileSync(new URL("./src/plugin.js", import.meta.url), "utf8");
writeFileSync(new URL("./code.js", import.meta.url), `// Built by build.mjs. Edit src/ instead.\n${logic}\n${plugin}`);
console.log("built code.js");
