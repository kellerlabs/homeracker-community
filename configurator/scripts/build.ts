/// Production build script
import { join } from "path";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SRC_DIR = join(PROJECT_ROOT, "src");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");
const DIST_DIR = join(PROJECT_ROOT, "dist");

// Clean dist
mkdirSync(DIST_DIR, { recursive: true });

// Build the app
console.log("Building production bundle...");
const result = await Bun.build({
  entrypoints: [join(SRC_DIR, "main.tsx")],
  outdir: DIST_DIR,
  naming: "[name]-[hash].[ext]",
  minify: true,
  sourcemap: "none",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Get the output filename
const jsOutput = result.outputs.find((o) => o.path.endsWith(".js"));
if (!jsOutput) {
  console.error("No JS output found");
  process.exit(1);
}
const jsFilename = jsOutput.path.split("/").pop()!;

// Copy index.html with updated script src
const indexContent = readFileSync(join(PROJECT_ROOT, "index.html"), "utf-8");
const rewritten = indexContent
  .replace(
    '<script type="module" src="/src/main.tsx"></script>',
    `<script type="module" src="./${jsFilename}"></script>`
  )
  .replace(
    'href="/src/styles/main.css"',
    'href="./styles/main.css"'
  );
writeFileSync(join(DIST_DIR, "index.html"), rewritten);

// Copy public/ assets to dist/
cpSync(PUBLIC_DIR, DIST_DIR, { recursive: true, force: true });

// Copy styles
cpSync(join(PROJECT_ROOT, "src", "styles"), join(DIST_DIR, "styles"), {
  recursive: true,
  force: true,
});

console.log(`Build complete! Output in ${DIST_DIR}/`);
console.log(`  JS: ${jsFilename} (${(jsOutput.size / 1024).toFixed(1)}KB)`);
