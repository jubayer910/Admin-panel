// Renders the demo's artwork (scripts/make-art.mjs) into public/media/demo/:
// covers, photos and avatars become WebP, as uploads do on the real site;
// logos, ribbons and icons stay SVG. Needs Google Chrome (headless).
// Writes lib/demo/files.json, the media library's list of them.

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const manifest = JSON.parse(readFileSync("scripts/art/manifest.json", "utf8"));
rmSync("public/media/demo", { recursive: true, force: true });

const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), "art-chrome-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets = [];
for (let i = 0; i < 50 && !targets.length; i++) {
  try {
    targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === "page");
  } catch {}
  await sleep(200);
}
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const waiting = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m);
    waiting.delete(m.id);
  }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

const files = [];
for (const piece of manifest) {
  const svg = readFileSync(`scripts/art/${piece.key.replace(/\//g, "__")}.svg`, "utf8");
  let key;
  if (piece.raster) {
    key = `${piece.key}.webp`;
    const res = await send("Runtime.evaluate", {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const img = new Image();
        img.src = "data:image/svg+xml;base64," + ${JSON.stringify(Buffer.from(svg).toString("base64"))};
        await img.decode();
        const c = document.createElement("canvas");
        c.width = ${piece.width}; c.height = ${piece.height};
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL("image/webp", 0.82).split(",")[1];
      })()`,
    });
    const out = `public/media/${key}`;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(res.result.result.value, "base64"));
  } else {
    key = `${piece.key}.svg`;
    mkdirSync(dirname(`public/media/${key}`), { recursive: true });
    writeFileSync(`public/media/${key}`, svg);
  }
  const { raster, ...rest } = piece;
  files.push({ ...rest, key, mime: raster ? "image/webp" : "image/svg+xml", size: statSync(`public/media/${key}`).size });
}
ws.close();
await new Promise((r) => {
  chrome.once("exit", r);
  chrome.kill();
});
try {
  rmSync(profile, { recursive: true, force: true });
} catch {
  /* Chrome's leftovers in the temp folder; the OS clears them */
}
writeFileSync("lib/demo/files.json", JSON.stringify(files, null, 1) + "\n");
console.log(`${files.length} files in public/media/demo/, ${(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(2)} MB`);
