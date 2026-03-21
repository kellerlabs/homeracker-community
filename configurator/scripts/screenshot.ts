/// Take a screenshot of the configurator page

import { join } from "path";
import puppeteer from "puppeteer";

const PROJECT_ROOT = join(import.meta.dir, "..");
const DIST_DIR = join(PROJECT_ROOT, "dist");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");

// Build
console.log("Building...");
const buildResult = await Bun.build({
  entrypoints: [join(PROJECT_ROOT, "src", "main.tsx")],
  outdir: DIST_DIR,
  naming: "[name].[ext]",
  sourcemap: "linked",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
});
if (!buildResult.success) {
  for (const log of buildResult.logs) console.error(log);
  process.exit(1);
}

// Serve
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (pathname.startsWith("/src/") && /\.(tsx?|jsx?)$/.test(pathname)) {
      const mapped = pathname.replace("/src/", "").replace(".tsx", ".js").replace(".ts", ".js");
      const file = Bun.file(join(DIST_DIR, mapped));
      if (await file.exists()) return new Response(file, { headers: { "Content-Type": "application/javascript" } });
    }

    if (pathname !== "/" && pathname !== "/index.html") {
      for (const dir of [PUBLIC_DIR, PROJECT_ROOT, DIST_DIR]) {
        const file = Bun.file(join(dir, pathname));
        if (await file.exists()) {
          const headers: Record<string, string> = {};
          if (pathname.endsWith(".css")) headers["Content-Type"] = "text/css";
          else if (pathname.endsWith(".js")) headers["Content-Type"] = "application/javascript";
          return new Response(file, { headers });
        }
      }
    }

    const html = await Bun.file(join(PROJECT_ROOT, "index.html")).text();
    return new Response(
      html.replace('src="/src/main.tsx"', 'src="/src/main.js"'),
      { headers: { "Content-Type": "text/html" } }
    );
  },
});

const baseUrl = `http://localhost:${server.port}`;
console.log(`Server on ${baseUrl}`);

// Screenshot
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

page.on("console", (msg) => {
  if (msg.type() === "error") console.error("[ERR]", msg.text());
});
page.on("pageerror", (err) => console.error("[PAGE ERR]", err.message));

await page.goto(baseUrl, { waitUntil: "networkidle0", timeout: 15000 });
//await new Promise((r) => setTimeout(r, 2000));

// Build a small assembly so the screenshot isn't empty
await page.evaluate(() => {
  const asm = (window as any).__assembly;
  if (!asm) return;
  asm.clear();

  // Bottom layer: 4 foot connectors at corners (rotate arms toward adjacent supports)
  asm.addPart("connector-3d3w-foot", [0, 0, 0], [0, 0, 0]);     // arms: +x, +y, +z
  asm.addPart("connector-3d3w-foot", [5, 0, 0], [0, 270, 0]);   // arms: -x, +y, +z
  asm.addPart("connector-3d3w-foot", [0, 0, 5], [0, 90, 0]);    // arms: +x, +y, -z
  asm.addPart("connector-3d3w-foot", [5, 0, 5], [0, 180, 0]);   // arms: -x, +y, -z

  // Vertical supports on each corner
  asm.addPart("support-5u", [0, 1, 0], [0, 0, 0], "y");
  asm.addPart("support-5u", [5, 1, 0], [0, 0, 0], "y");
  asm.addPart("support-5u", [0, 1, 5], [0, 0, 0], "y");
  asm.addPart("support-5u", [5, 1, 5], [0, 0, 0], "y");

  // Bottom horizontal supports along X axis (front and back)
  asm.addPart("support-4u", [1, 0, 0], [0, 0, 0], "x");
  asm.addPart("support-4u", [1, 0, 5], [0, 0, 0], "x");

  // Bottom horizontal supports along Z axis (left and right)
  asm.addPart("support-4u", [0, 0, 1], [0, 0, 0], "z");
  asm.addPart("support-4u", [5, 0, 1], [0, 0, 0], "z");

  // Top connectors (arms face down toward vertical supports + out toward horizontal)
  asm.addPart("connector-3d3w", [0, 6, 0], [90, 0, 0]);       // arms: +x, -y, +z
  asm.addPart("connector-3d3w", [5, 6, 0], [90, 270, 0]);     // arms: -x, -y, +z
  asm.addPart("connector-3d3w", [0, 6, 5], [180, 0, 0]);      // arms: +x, -y, -z
  asm.addPart("connector-3d3w", [5, 6, 5], [180, 270, 0]);    // arms: -x, -y, -z

  // Top horizontal supports along X axis (front and back)
  asm.addPart("support-4u", [1, 6, 0], [0, 0, 0], "x");
  asm.addPart("support-4u", [1, 6, 5], [0, 0, 0], "x");

  // Top horizontal supports along Z axis (left and right)
  asm.addPart("support-4u", [0, 6, 1], [0, 0, 0], "z");
  asm.addPart("support-4u", [5, 6, 1], [0, 0, 0], "z");
});
await new Promise((r) => setTimeout(r, 300));

const screenshotPath = join(PROJECT_ROOT, "screenshot.png");
await page.screenshot({ path: screenshotPath, fullPage: false });
console.log(`Screenshot saved to ${screenshotPath}`);

// Also dump computed styles of key elements
const layoutInfo = await page.evaluate(() => {
  const getRect = (sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      selector: sel,
      x: r.x, y: r.y, width: r.width, height: r.height,
      display: cs.display, flexDirection: cs.flexDirection,
      overflow: cs.overflow, position: cs.position,
    };
  };
  return {
    app: getRect(".app"),
    sidebar: getRect(".sidebar"),
    mainArea: getRect(".main-area"),
    toolbar: getRect(".toolbar"),
    viewport: getRect(".viewport"),
    canvas: getRect(".viewport canvas"),
    bom: getRect(".bom-panel"),
    body: getRect("body"),
    root: getRect("#root"),
  };
});

console.log("\n=== Layout Info ===");
for (const [key, val] of Object.entries(layoutInfo)) {
  if (val) {
    console.log(`${key}: ${val.width}x${val.height} at (${val.x},${val.y}) display=${val.display} flex=${val.flexDirection}`);
  } else {
    console.log(`${key}: NOT FOUND`);
  }
}

await browser.close();
server.stop();
