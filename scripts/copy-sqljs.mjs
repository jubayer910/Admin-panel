// Copies sql.js's WebAssembly file into public/, where the browser loads it
// (lib/db.ts). Runs before `dev` and `build`; the copy is not committed.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("sql.js/dist/sql-wasm-browser.wasm"));
mkdirSync("public/sqljs", { recursive: true });
copyFileSync(join(dist, "sql-wasm-browser.wasm"), "public/sqljs/sql-wasm-browser.wasm");
console.log("sql.js wasm copied to public/sqljs/");
