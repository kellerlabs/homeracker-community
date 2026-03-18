/// Headless browser test: builds, serves, loads the page in Chrome,
/// and captures all console messages and errors.

import { join } from "path";
import puppeteer from "puppeteer";

const PROJECT_ROOT = join(import.meta.dir, "..");
const DIST_DIR = join(PROJECT_ROOT, "dist");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");

// 1. Build
console.log("=== Building ===");
const buildResult = await Bun.build({
  entrypoints: [join(PROJECT_ROOT, "src", "main.tsx")],
  outdir: DIST_DIR,
  naming: "[name].[ext]",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
});

if (!buildResult.success) {
  console.error("BUILD FAILED:");
  for (const log of buildResult.logs) console.error(log);
  process.exit(1);
}
console.log("Build OK\n");

// 2. Serve
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (pathname.startsWith("/src/")) {
      const mapped = pathname.replace("/src/", "").replace(".tsx", ".js").replace(".ts", ".js");
      const file = Bun.file(join(DIST_DIR, mapped));
      if (await file.exists()) return new Response(file, { headers: { "Content-Type": "application/javascript" } });
    }

    if (pathname !== "/" && pathname !== "/index.html") {
      for (const dir of [PUBLIC_DIR, PROJECT_ROOT, DIST_DIR]) {
        const file = Bun.file(join(dir, pathname));
        if (await file.exists()) return new Response(file);
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
console.log(`=== Server on ${baseUrl} ===\n`);

// 3. Launch headless Chrome
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
});

const page = await browser.newPage();

const consoleMessages: { type: string; text: string }[] = [];
const pageErrors: string[] = [];
const failedRequests: string[] = [];

page.on("console", (msg) => {
  const entry = { type: msg.type(), text: msg.text() };
  consoleMessages.push(entry);
  const prefix = `[${entry.type.toUpperCase()}]`;
  if (entry.type === "error") {
    console.error(prefix, entry.text);
  } else if (entry.type === "warning") {
    console.warn(prefix, entry.text);
  } else {
    console.log(prefix, entry.text);
  }
});

page.on("pageerror", (err) => {
  pageErrors.push(err.message);
  console.error("[PAGE ERROR]", err.message);
});

page.on("requestfailed", (req) => {
  const msg = `${req.url()} - ${req.failure()?.errorText}`;
  failedRequests.push(msg);
  console.error("[REQUEST FAILED]", msg);
});

console.log("=== Loading page ===\n");

try {
  await page.goto(baseUrl, { waitUntil: "networkidle0", timeout: 15000 });
} catch (e: any) {
  console.error("[NAVIGATION ERROR]", e.message);
}

// Wait for React to mount and any async errors
await new Promise((r) => setTimeout(r, 3000));

// 4. Inspect the DOM
const rootState = await page.evaluate(() => {
  const root = document.getElementById("root");
  return {
    exists: !!root,
    childCount: root?.childElementCount ?? 0,
    innerHTMLPreview: root?.innerHTML.substring(0, 1000) ?? "N/A",
  };
});

console.log("\n=== DOM State ===");
console.log("Root exists:", rootState.exists);
console.log("Root children:", rootState.childCount);
console.log("Root HTML preview:", rootState.innerHTMLPreview.substring(0, 300));

// 5. Summary
console.log("\n=== Summary ===");
console.log(`Console messages: ${consoleMessages.length}`);
console.log(`Page errors: ${pageErrors.length}`);
console.log(`Failed requests: ${failedRequests.length}`);

if (pageErrors.length > 0) {
  console.log("\nPage errors:");
  pageErrors.forEach((e) => console.error("  ", e));
}

if (failedRequests.length > 0) {
  console.log("\nFailed requests:");
  failedRequests.forEach((r) => console.error("  ", r));
}

const errorMessages = consoleMessages.filter((m) => m.type === "error");
if (errorMessages.length > 0) {
  console.log("\nConsole errors:");
  errorMessages.forEach((m) => console.error("  ", m.text));
}

await browser.close();
server.stop();

const hasErrors = pageErrors.length > 0 || errorMessages.length > 0;
process.exit(hasErrors ? 1 : 0);
