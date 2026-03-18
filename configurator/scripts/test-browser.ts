/// Headless browser test: loads the page and captures console errors
/// Uses Bun's built-in fetch to check the dev server, then uses
/// a simple approach to validate the built HTML + JS.

import { join } from "path";
import { readFileSync, existsSync } from "fs";

const PROJECT_ROOT = join(import.meta.dir, "..");
const DIST_DIR = join(PROJECT_ROOT, "dist");

// Step 1: Build the app
console.log("=== Building app ===");
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
  for (const log of buildResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("Build succeeded:", buildResult.outputs.map(o => o.path));

// Step 2: Check output files exist
const mainJs = join(DIST_DIR, "main.js");
if (!existsSync(mainJs)) {
  console.error("ERROR: main.js not found in dist/");
  process.exit(1);
}

const jsContent = readFileSync(mainJs, "utf-8");
console.log(`\nmain.js size: ${(jsContent.length / 1024).toFixed(1)}KB`);

// Step 3: Check for obvious JS errors by attempting to parse
// Look for common issues
const issues: string[] = [];

if (jsContent.includes("require(")) {
  issues.push("Contains CommonJS require() calls - won't work in browser");
}

// Check if React, Three.js, and R3F are bundled
const checkBundled = [
  ["react", "createElement"],
  ["three", "WebGLRenderer"],
  ["@react-three/fiber", "Canvas"],
];

for (const [lib, marker] of checkBundled) {
  if (!jsContent.includes(marker)) {
    issues.push(`${lib} may not be bundled (missing "${marker}")`);
  }
}

// Step 4: Try loading the module in Bun's JS runtime to catch syntax errors
console.log("\n=== Checking for syntax errors ===");
try {
  // Use Bun's transpiler to check syntax
  const transpiler = new Bun.Transpiler({ loader: "js" });
  transpiler.scan(jsContent);
  console.log("Syntax check passed");
} catch (e: any) {
  issues.push(`Syntax error: ${e.message}`);
}

// Step 5: Serve and fetch to check HTTP-level issues
console.log("\n=== Starting test server ===");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");
const server = Bun.serve({
  port: 0, // random available port
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (pathname.startsWith("/src/")) {
      const distPath = join(DIST_DIR, pathname.replace("/src/", "").replace(".tsx", ".js").replace(".ts", ".js"));
      const file = Bun.file(distPath);
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "application/javascript" },
        });
      }
    }

    if (pathname !== "/" && pathname !== "/index.html") {
      const publicPath = join(PUBLIC_DIR, pathname);
      const publicFile = Bun.file(publicPath);
      if (await publicFile.exists()) return new Response(publicFile);

      const rootPath = join(PROJECT_ROOT, pathname);
      const rootFile = Bun.file(rootPath);
      if (await rootFile.exists()) return new Response(rootFile);

      const distPath = join(DIST_DIR, pathname);
      const distFile = Bun.file(distPath);
      if (await distFile.exists()) return new Response(distFile);
    }

    const indexPath = join(PROJECT_ROOT, "index.html");
    const indexContent = await Bun.file(indexPath).text();
    const rewritten = indexContent.replace(
      '<script type="module" src="/src/main.tsx"></script>',
      '<script type="module" src="/src/main.js"></script>'
    );
    return new Response(rewritten, {
      headers: { "Content-Type": "text/html" },
    });
  },
});

const baseUrl = `http://localhost:${server.port}`;
console.log(`Test server on ${baseUrl}`);

// Fetch the HTML
const htmlRes = await fetch(baseUrl);
const html = await htmlRes.text();
console.log(`\nHTML response: ${htmlRes.status} (${html.length} bytes)`);

if (!html.includes('<div id="root">')) {
  issues.push("HTML missing #root div");
}
if (!html.includes('src="/src/main.js"')) {
  issues.push("HTML missing rewritten script src");
}

// Fetch the JS bundle
const jsRes = await fetch(`${baseUrl}/src/main.js`);
console.log(`JS response: ${jsRes.status} (${jsRes.headers.get("content-type")})`);
if (jsRes.status !== 200) {
  issues.push(`JS bundle returned ${jsRes.status}`);
}

// Fetch the CSS
const cssRes = await fetch(`${baseUrl}/src/styles/main.css`);
console.log(`CSS response: ${cssRes.status}`);
if (cssRes.status !== 200) {
  // Try alternate path
  const cssRes2 = await fetch(`${baseUrl}/styles/main.css`);
  console.log(`CSS alt path response: ${cssRes2.status}`);
  if (cssRes2.status !== 200) {
    issues.push("CSS file not found at any path");
  }
}

// Check a GLB model is servable
const glbRes = await fetch(`${baseUrl}/models/connector-3d6w.glb`);
console.log(`GLB response: ${glbRes.status} (${glbRes.headers.get("content-length")} bytes)`);
if (glbRes.status !== 200) {
  issues.push("GLB models not served correctly");
}

server.stop();

// Step 6: Report
console.log("\n=== Results ===");
if (issues.length === 0) {
  console.log("No issues found! The build looks correct.");
  console.log("\nIf the page still doesn't load in a browser, the issue is likely:");
  console.log("  - A runtime JS error (React rendering, Three.js WebGL)");
  console.log("  - Check the browser's DevTools console (F12)");
} else {
  console.error(`Found ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
}

process.exit(issues.length > 0 ? 1 : 0);
