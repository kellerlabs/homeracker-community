/// Dev server: builds the app and serves it with live reload
import { watch } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SRC_DIR = join(PROJECT_ROOT, "src");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");
const DIST_DIR = join(PROJECT_ROOT, "dist");

async function build() {
  const result = await Bun.build({
    entrypoints: [join(SRC_DIR, "main.tsx")],
    outdir: DIST_DIR,
    naming: "[name].[ext]",
    sourcemap: "linked",
    define: {
      "process.env.NODE_ENV": JSON.stringify("development"),
    },
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    return false;
  }
  return true;
}

// Initial build
console.log("Building...");
await build();

// Watch for changes and rebuild
const watcher = watch(SRC_DIR, { recursive: true }, async (_event, filename) => {
  console.log(`\nFile changed: ${filename}`);
  console.log("Rebuilding...");
  const ok = await build();
  if (ok) console.log("Build complete.");
});

// Serve the app
const PORT = parseInt(process.env.PORT || "3001");
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Try to serve compiled JS from dist/ (only for .ts/.tsx source files)
    if (pathname.startsWith("/src/") && /\.(tsx?|jsx?)$/.test(pathname)) {
      const distPath = join(DIST_DIR, pathname.replace("/src/", "").replace(".tsx", ".js").replace(".ts", ".js"));
      const file = Bun.file(distPath);
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "application/javascript" },
        });
      }
    }

    // Serve static assets from public/
    if (pathname !== "/" && pathname !== "/index.html") {
      // Try public/ directory
      const publicPath = join(PUBLIC_DIR, pathname);
      const publicFile = Bun.file(publicPath);
      if (await publicFile.exists()) {
        return new Response(publicFile);
      }

      // Try project root (for styles, etc.)
      const rootPath = join(PROJECT_ROOT, pathname);
      const rootFile = Bun.file(rootPath);
      if (await rootFile.exists()) {
        return new Response(rootFile);
      }

      // Try dist/ directory
      const distPath = join(DIST_DIR, pathname);
      const distFile = Bun.file(distPath);
      if (await distFile.exists()) {
        return new Response(distFile);
      }
    }

    // Fallback to index.html (SPA routing)
    const indexPath = join(PROJECT_ROOT, "index.html");
    const indexContent = await Bun.file(indexPath).text();
    // Rewrite the script src to point to the built JS
    const rewritten = indexContent.replace(
      '<script type="module" src="/src/main.tsx"></script>',
      '<script type="module" src="/src/main.js"></script>'
    );
    return new Response(rewritten, {
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log(`\nDev server running at http://localhost:${PORT}`);
console.log("Watching for changes...\n");

// Cleanup on exit
process.on("SIGINT", () => {
  watcher.close();
  server.stop();
  process.exit(0);
});
