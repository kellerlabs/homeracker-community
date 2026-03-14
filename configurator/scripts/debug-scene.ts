import puppeteer from "puppeteer";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const DIST_DIR = join(PROJECT_ROOT, "dist");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");

await Bun.build({
  entrypoints: [join(PROJECT_ROOT, "src", "main.tsx")],
  outdir: DIST_DIR, naming: "[name].[ext]", sourcemap: "linked",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
});

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
    return new Response(html.replace('src="/src/main.tsx"', 'src="/src/main.js"'), { headers: { "Content-Type": "text/html" } });
  },
});

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto("http://localhost:" + server.port, { waitUntil: "networkidle0", timeout: 15000 });
await new Promise(r => setTimeout(r, 2000));

await page.evaluate(() => (window as any).__assembly.addPart("support-3u", [0, 0, 0]));
await new Promise(r => setTimeout(r, 2000));

const debug = await page.evaluate(() => {
  const scene = (window as any).__scene;
  if (!scene) return { error: "no scene" };

  // Find the placed part group
  let placedGroup: any = null;
  scene.traverse((obj: any) => {
    if (obj.name && obj.name.startsWith("placed-")) placedGroup = obj;
  });
  if (!placedGroup) return { error: "no placed group found" };

  // Dump hierarchy with rotations and world matrices
  const hierarchy: any[] = [];
  placedGroup.traverse((obj: any) => {
    obj.updateWorldMatrix(true, false);
    const rot = obj.rotation;
    const wm = obj.matrixWorld.elements;
    hierarchy.push({
      name: obj.name || "(unnamed)",
      type: obj.type,
      rotation: [rot.x.toFixed(3), rot.y.toFixed(3), rot.z.toFixed(3)],
      worldMatrix_row0: [wm[0].toFixed(3), wm[4].toFixed(3), wm[8].toFixed(3), wm[12].toFixed(3)],
      worldMatrix_row1: [wm[1].toFixed(3), wm[5].toFixed(3), wm[9].toFixed(3), wm[13].toFixed(3)],
      worldMatrix_row2: [wm[2].toFixed(3), wm[6].toFixed(3), wm[10].toFixed(3), wm[14].toFixed(3)],
      isMesh: !!obj.isMesh,
    });
  });
  return { hierarchy };
});

console.log(JSON.stringify(debug, null, 2));
await browser.close();
server.stop();
