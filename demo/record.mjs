// Render demo/index.html frame-by-frame with a virtual clock, then encode to out/anxiety-demo.mp4.
// Usage: node demo/record.mjs [--fps 30] [--stills]
import http from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const fps = Number(args[args.indexOf("--fps") + 1]) || 30;
const framesDir = path.join(root, "media", "frames");
const outFile = path.join(root, "media", "stage-fright-demo.mp4");

const types = { ".html": "text/html", ".js": "text/javascript" };
const server = http.createServer(async (req, res) => {
  try {
    const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!p.startsWith(root)) throw new Error("outside root");
    const body = await readFile(p);
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/demo/index.html?record`;

await rm(framesDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(url);
await page.waitForFunction(() => window.demoReady);
const duration = await page.evaluate(() => window.DURATION);

const total = Math.round(duration * fps);
for (let i = 0; i < total; i++) {
  const s = await page.evaluate((t) => window.renderAt(t), i / fps);
  if (!args.includes("--probe")) await page.screenshot({ path: path.join(framesDir, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (i % fps === 0) console.log(`t=${(i / fps).toFixed(0)}s watchers=${s.watchers} level=${s.level.toFixed(2)}${s.panicking ? " PANIC" : ""} note=${s.note} "${s.buf}"`);
}
await browser.close();
server.close();
if (args.includes("--probe")) process.exit(0);

execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(framesDir, "f%05d.jpg"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", outFile], { stdio: "inherit" });
if (!args.includes("--keep-frames")) await rm(framesDir, { recursive: true, force: true });
console.log("wrote", outFile);
