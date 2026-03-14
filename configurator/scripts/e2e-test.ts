/// E2E test: loads the UI, clicks catalog items, places parts, verifies BOM

import { join } from "path";
import puppeteer from "puppeteer";

const PROJECT_ROOT = join(import.meta.dir, "..");
const DIST_DIR = join(PROJECT_ROOT, "dist");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");
const HEADED = process.env.HEADED === "1" || process.env.HEADED === "true";

let exitCode = 0;
const results: { name: string; pass: boolean; detail?: string }[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition, detail });
  if (!condition) {
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    exitCode = 1;
  } else {
    console.log(`  PASS: ${name}`);
  }
}

// Build
console.log("=== Building ===");
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
console.log("Build OK\n");

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
console.log(`Server on ${baseUrl}\n`);

// Launch browser
const browser = await puppeteer.launch({
  headless: !HEADED,
  slowMo: HEADED ? 50 : 0,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--enable-webgl",
    ...(HEADED ? [] : ["--use-gl=angle", "--use-angle=swiftshader"]),
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const pageErrors: string[] = [];
page.on("pageerror", (err) => {
  // Ignore WebGL errors — expected in headless
  if (err.message.includes("WebGL")) return;
  pageErrors.push(err.message);
  console.error("[PAGE ERR]", err.message);
});

console.log("=== Loading page ===");
await page.goto(baseUrl, { waitUntil: "networkidle0", timeout: 15000 });
await new Promise((r) => setTimeout(r, 1500));

// ──────────────────────────────────────────────
// Test 1: Layout loads correctly
// ──────────────────────────────────────────────
console.log("\n--- Test: Layout ---");

const layout = await page.evaluate(() => {
  return {
    app: !!document.querySelector(".app"),
    sidebar: !!document.querySelector(".sidebar"),
    mainArea: !!document.querySelector(".main-area"),
    toolbar: !!document.querySelector(".toolbar"),
    viewport: !!document.querySelector(".viewport"),
    bomPanel: !!document.querySelector(".bom-panel"),
  };
});

assert("App container renders", layout.app);
assert("Sidebar renders", layout.sidebar);
assert("Main area renders", layout.mainArea);
assert("Toolbar renders", layout.toolbar);
assert("Viewport renders", layout.viewport);
assert("BOM panel renders", layout.bomPanel);

// ──────────────────────────────────────────────
// Test 2: Catalog items present
// ──────────────────────────────────────────────
console.log("\n--- Test: Catalog ---");

const catalogItems = await page.evaluate(() => {
  const items = document.querySelectorAll(".catalog-item");
  return Array.from(items).map((el) => ({
    name: el.querySelector(".catalog-item-name")?.textContent?.trim() ?? "",
    active: el.classList.contains("active"),
  }));
});

// 18 supports + 9 connectors + 7 foot connectors + 2 lock pins = 36
assert("Catalog has 36 items", catalogItems.length === 36, `got ${catalogItems.length}`);
assert("No item is active initially", catalogItems.every((i) => !i.active));

const expectedParts = [
  "Support (1u)", "Support (5u)", "Support (10u)", "Support (18u)",
  "1D 1-Way", "1D 2-Way", "2D 2-Way", "2D 3-Way", "2D 4-Way",
  "3D 3-Way", "3D 4-Way", "3D 5-Way", "3D 6-Way",
  "2D 2-Way Foot", "3D 4-Way Foot",
  "Lock Pin", "Lock Pin (No Grip)",
];
for (const name of expectedParts) {
  assert(`Catalog contains "${name}"`, catalogItems.some((i) => i.name === name));
}

// ──────────────────────────────────────────────
// Test 3: Clicking a catalog item enters placement mode
// ──────────────────────────────────────────────
console.log("\n--- Test: Placement mode ---");

// Click the "3D 6-Way" connector (4th catalog item)
const connector6WayBtn = await page.$('.catalog-item:nth-child(4)');
if (connector6WayBtn) {
  // First, find the correct button by text
  await page.evaluate(() => {
    const items = document.querySelectorAll(".catalog-item");
    for (const item of items) {
      if (item.querySelector(".catalog-item-name")?.textContent?.trim() === "3D 6-Way") {
        (item as HTMLElement).click();
        return;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 300));

  const afterClick = await page.evaluate(() => {
    const items = document.querySelectorAll(".catalog-item");
    const activeItem = Array.from(items).find((el) => el.classList.contains("active"));
    const hint = document.querySelector(".viewport-hint");
    return {
      activeName: activeItem?.querySelector(".catalog-item-name")?.textContent?.trim() ?? null,
      hintVisible: !!hint,
      hintText: hint?.textContent?.trim() ?? null,
    };
  });

  assert("3D 6-Way becomes active after click", afterClick.activeName === "3D 6-Way", `active: ${afterClick.activeName}`);
  assert("Viewport hint appears in placement mode", afterClick.hintVisible);
  assert("Hint says click to place", afterClick.hintText?.includes("Click to place") ?? false, afterClick.hintText ?? "no hint");
}

// Press Escape to exit placement mode
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 300));

const afterEscape = await page.evaluate(() => {
  const items = document.querySelectorAll(".catalog-item");
  const activeItem = Array.from(items).find((el) => el.classList.contains("active"));
  const hint = document.querySelector(".viewport-hint");
  return {
    anyActive: !!activeItem,
    hintVisible: !!hint,
  };
});

assert("Escape exits placement mode (no active item)", !afterEscape.anyActive);
assert("Viewport hint disappears after Escape", !afterEscape.hintVisible);

// ──────────────────────────────────────────────
// Test: Ghost preview matches selected catalog item
// ──────────────────────────────────────────────
console.log("\n--- Test: Ghost preview model ---");

// Click each catalog item and verify data-placing attribute matches
const partIds = await page.evaluate(() => {
  const items = document.querySelectorAll(".catalog-item");
  return Array.from(items).map((el) => {
    const name = el.querySelector(".catalog-item-name")?.textContent?.trim() ?? "";
    return name;
  });
});

const partNameToId: Record<string, string> = {
  // Connectors
  "1D 1-Way": "connector-1d1w",
  "1D 2-Way": "connector-1d2w",
  "2D 2-Way": "connector-2d2w",
  "2D 3-Way": "connector-2d3w",
  "2D 4-Way": "connector-2d4w",
  "3D 3-Way": "connector-3d3w",
  "3D 4-Way": "connector-3d4w",
  "3D 5-Way": "connector-3d5w",
  "3D 6-Way": "connector-3d6w",
  // Foot variants
  "2D 2-Way Foot": "connector-2d2w-foot",
  "3D 4-Way Foot": "connector-3d4w-foot",
  "3D 6-Way Foot": "connector-3d6w-foot",
  // Supports (spot check)
  "Support (1u)": "support-1u",
  "Support (3u)": "support-3u",
  "Support (10u)": "support-10u",
  "Support (18u)": "support-18u",
  // Lock pins
  "Lock Pin": "lockpin-standard",
  "Lock Pin (No Grip)": "lockpin-no-grip",
};

for (const partName of partIds) {
  const expectedId = partNameToId[partName];
  if (!expectedId) continue;

  // Click this catalog item
  await page.evaluate((name: string) => {
    const items = document.querySelectorAll(".catalog-item");
    for (const item of items) {
      if (item.querySelector(".catalog-item-name")?.textContent?.trim() === name) {
        (item as HTMLElement).click();
        return;
      }
    }
  }, partName);
  await new Promise((r) => setTimeout(r, 200));

  const placing = await page.evaluate(() => {
    return document.querySelector(".viewport")?.getAttribute("data-placing") ?? null;
  });

  assert(`Ghost preview for "${partName}" uses ${expectedId}`, placing === expectedId, `got: ${placing}`);
}

// Exit placement mode for next tests
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 200));

const noGhostAfterEscape = await page.evaluate(() => {
  return document.querySelector(".viewport")?.getAttribute("data-placing") ?? null;
});
assert("No ghost preview after Escape", noGhostAfterEscape === null);

// ──────────────────────────────────────────────
// Test 4: Programmatically place parts via assembly API, verify BOM
// ──────────────────────────────────────────────
console.log("\n--- Test: Place parts + BOM ---");

// Place a 3D 6-Way connector at origin
const placed1 = await page.evaluate(() => {
  return (window as any).__assembly.addPart("connector-3d6w", [0, 0, 0]);
});
assert("Place connector-3d6w at [0,0,0] succeeds", placed1 !== null, `id: ${placed1}`);
await new Promise((r) => setTimeout(r, 500));

// Check BOM updated
const bom1 = await page.evaluate(() => {
  const rows = document.querySelectorAll(".bom-table tbody tr");
  return Array.from(rows).map((row) => ({
    name: row.querySelector("td:first-child")?.textContent?.trim() ?? "",
    qty: row.querySelector(".bom-qty")?.textContent?.trim() ?? "",
  }));
});

assert("BOM shows 1 row after placing one part", bom1.length === 1, `got ${bom1.length} rows`);
if (bom1.length > 0) {
  assert("BOM row is 3D 6-Way", bom1[0].name.includes("6-Way"), bom1[0].name);
  assert("BOM quantity is 1", bom1[0].qty === "1", bom1[0].qty);
}

// Place a second connector at a different position
const placed2 = await page.evaluate(() => {
  return (window as any).__assembly.addPart("connector-3d6w", [1, 0, 0]);
});
assert("Place connector-3d6w at [1,0,0] succeeds", placed2 !== null);
await new Promise((r) => setTimeout(r, 500));

const bom2 = await page.evaluate(() => {
  const rows = document.querySelectorAll(".bom-table tbody tr");
  return Array.from(rows).map((row) => ({
    name: row.querySelector("td:first-child")?.textContent?.trim() ?? "",
    qty: row.querySelector(".bom-qty")?.textContent?.trim() ?? "",
  }));
});

assert("BOM quantity updates to 2", bom2.some((r) => r.qty === "2"), `rows: ${JSON.stringify(bom2)}`);

// Place a support between them
const placed3 = await page.evaluate(() => {
  return (window as any).__assembly.addPart("support-3u", [0, 1, 0]);
});
assert("Place support-3u at [0,1,0] succeeds", placed3 !== null);
await new Promise((r) => setTimeout(r, 500));

const bom3 = await page.evaluate(() => {
  const rows = document.querySelectorAll(".bom-table tbody tr");
  return Array.from(rows).map((row) => ({
    name: row.querySelector("td:first-child")?.textContent?.trim() ?? "",
    qty: row.querySelector(".bom-qty")?.textContent?.trim() ?? "",
  }));
});

assert("BOM shows at least 2 rows (connector + support)", bom3.length >= 2, `got ${bom3.length}`);
assert("BOM includes support", bom3.some((r) => r.name.includes("Support")), `rows: ${JSON.stringify(bom3)}`);

// ──────────────────────────────────────────────
// Test 5: Collision detection
// ──────────────────────────────────────────────
console.log("\n--- Test: Collision detection ---");

const collision = await page.evaluate(() => {
  return (window as any).__assembly.addPart("connector-2d2w", [0, 0, 0]);
});
assert("Cannot place on occupied position [0,0,0]", collision === null);

// ──────────────────────────────────────────────
// Test 6: BOM total count
// ──────────────────────────────────────────────
console.log("\n--- Test: BOM totals ---");

const totalText = await page.evaluate(() => {
  return document.querySelector(".bom-total")?.textContent?.trim() ?? "";
});
// We placed 2 connectors + 1 support (3u spans 3 cells) = 3 parts
assert("BOM total shows parts count", totalText.includes("parts"), totalText);

// ──────────────────────────────────────────────
// Test 7: Clear all
// ──────────────────────────────────────────────
console.log("\n--- Test: Clear All ---");

// Click "Clear All" toolbar button
await page.evaluate(() => {
  const buttons = document.querySelectorAll(".toolbar-btn");
  for (const btn of buttons) {
    if (btn.textContent?.trim() === "Clear All") {
      (btn as HTMLElement).click();
      return;
    }
  }
});
await new Promise((r) => setTimeout(r, 500));

const afterClear = await page.evaluate(() => {
  const emptyMsg = document.querySelector(".bom-empty");
  const rows = document.querySelectorAll(".bom-table tbody tr");
  const partCount = (window as any).__assembly.getAllParts().length;
  return {
    emptyMsgVisible: !!emptyMsg,
    rowCount: rows.length,
    partCount,
  };
});

assert("Assembly is empty after Clear All", afterClear.partCount === 0);
assert("BOM shows empty message", afterClear.emptyMsgVisible);
assert("BOM table has no rows", afterClear.rowCount === 0);

// ──────────────────────────────────────────────
// Test 8: Place after clear (re-use positions)
// ──────────────────────────────────────────────
console.log("\n--- Test: Place after clear ---");

const replaceResult = await page.evaluate(() => {
  return (window as any).__assembly.addPart("connector-2d4w", [0, 0, 0]);
});
assert("Can place at [0,0,0] after clear", replaceResult !== null);

// ──────────────────────────────────────────────
// Test 9: Remove a part
// ──────────────────────────────────────────────
console.log("\n--- Test: Remove part ---");

const removeResult = await page.evaluate(() => {
  const assembly = (window as any).__assembly;
  const parts = assembly.getAllParts();
  if (parts.length === 0) return { removed: false, remaining: 0 };
  const removed = assembly.removePart(parts[0].instanceId);
  return { removed: !!removed, remaining: assembly.getAllParts().length };
});

assert("Part removed successfully", removeResult.removed);
assert("Assembly is empty after removal", removeResult.remaining === 0);

// ──────────────────────────────────────────────
// Test 10: Switching between catalog items
// ──────────────────────────────────────────────
console.log("\n--- Test: Catalog switching ---");

// Click Support (5u)
await page.evaluate(() => {
  const items = document.querySelectorAll(".catalog-item");
  for (const item of items) {
    if (item.querySelector(".catalog-item-name")?.textContent?.trim() === "Support (5u)") {
      (item as HTMLElement).click();
      return;
    }
  }
});
await new Promise((r) => setTimeout(r, 300));

const active1 = await page.evaluate(() => {
  const active = document.querySelector(".catalog-item.active .catalog-item-name");
  return active?.textContent?.trim() ?? null;
});
assert("Support (5u) is active", active1 === "Support (5u)", `active: ${active1}`);

// Click a different item — Lock Pin
await page.evaluate(() => {
  const items = document.querySelectorAll(".catalog-item");
  for (const item of items) {
    if (item.querySelector(".catalog-item-name")?.textContent?.trim() === "Lock Pin") {
      (item as HTMLElement).click();
      return;
    }
  }
});
await new Promise((r) => setTimeout(r, 300));

const active2 = await page.evaluate(() => {
  const active = document.querySelector(".catalog-item.active .catalog-item-name");
  return active?.textContent?.trim() ?? null;
});
assert("Lock Pin is now active (switched from Support)", active2 === "Lock Pin", `active: ${active2}`);

// ──────────────────────────────────────────────
// Test: Placed part orientation matches ghost preview
// ──────────────────────────────────────────────
console.log("\n--- Test: Placed part orientation matches ghost ---");

// Helper: get a named object's world-space bounding box from the Three.js scene
const getBBox = async (objectName: string) => {
  return page.evaluate((name: string) => {
    const scene = (window as any).__scene;
    if (!scene) return null;
    let target: any = null;
    scene.traverse((obj: any) => {
      if (obj.name === name) target = obj;
    });
    if (!target) return null;

    // Force matrix recomputation on entire subtree (R3F sets matrixAutoUpdate=false)
    const forceUpdateMatrices = (obj: any) => {
      // Walk up parent chain, force updateMatrix on each
      const chain: any[] = [];
      let p = obj;
      while (p) { chain.unshift(p); p = p.parent; }
      for (const node of chain) {
        node.updateMatrix();
      }
      // Now compute world matrices top-down
      for (let i = 0; i < chain.length; i++) {
        if (i === 0) {
          chain[i].matrixWorld.copy(chain[i].matrix);
        } else {
          chain[i].matrixWorld.multiplyMatrices(chain[i - 1].matrixWorld, chain[i].matrix);
        }
      }
    };

    // Compute world bounding box by traversing meshes
    const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    target.traverse((child: any) => {
      if (child.isMesh && child.geometry) {
        forceUpdateMatrices(child);
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        const bb = child.geometry.boundingBox;
        // Transform bounding box corners to world space
        const corners = [
          [bb.min.x, bb.min.y, bb.min.z],
          [bb.max.x, bb.min.y, bb.min.z],
          [bb.min.x, bb.max.y, bb.min.z],
          [bb.max.x, bb.max.y, bb.min.z],
          [bb.min.x, bb.min.y, bb.max.z],
          [bb.max.x, bb.min.y, bb.max.z],
          [bb.min.x, bb.max.y, bb.max.z],
          [bb.max.x, bb.max.y, bb.max.z],
        ];
        for (const c of corners) {
          const v = { x: c[0], y: c[1], z: c[2] };
          // Apply world matrix manually
          const e = child.matrixWorld.elements;
          const wx = e[0]*v.x + e[4]*v.y + e[8]*v.z + e[12];
          const wy = e[1]*v.x + e[5]*v.y + e[9]*v.z + e[13];
          const wz = e[2]*v.x + e[6]*v.y + e[10]*v.z + e[14];
          box.min[0] = Math.min(box.min[0], wx);
          box.min[1] = Math.min(box.min[1], wy);
          box.min[2] = Math.min(box.min[2], wz);
          box.max[0] = Math.max(box.max[0], wx);
          box.max[1] = Math.max(box.max[1], wy);
          box.max[2] = Math.max(box.max[2], wz);
        }
      }
    });
    if (box.min[0] === Infinity) return null;
    return {
      sizeX: Math.round((box.max[0] - box.min[0]) * 100) / 100,
      sizeY: Math.round((box.max[1] - box.min[1]) * 100) / 100,
      sizeZ: Math.round((box.max[2] - box.min[2]) * 100) / 100,
    };
  }, objectName);
};

// Clear everything first
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 300));

// Step 1: Enter placement mode for support-3u and get the ghost bbox
await page.evaluate(() => {
  const items = document.querySelectorAll(".catalog-item");
  for (const item of items) {
    if (item.querySelector(".catalog-item-name")?.textContent?.trim() === "Support (3u)") {
      (item as HTMLElement).click();
      return;
    }
  }
});
await new Promise((r) => setTimeout(r, 1000));

const ghostBBox = await getBBox("ghost-preview");
console.log(`  Ghost bbox: ${JSON.stringify(ghostBBox)}`);
assert("Ghost preview found in scene", ghostBBox !== null);

if (ghostBBox) {
  assert(
    "Ghost preview is taller in Y than X (vertical orientation)",
    ghostBBox.sizeY > ghostBBox.sizeX * 2,
    `Y=${ghostBBox.sizeY} X=${ghostBBox.sizeX}`
  );
}

// Step 2: Exit placement mode and place the part via API
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 200));

const supportId = await page.evaluate(() => {
  return (window as any).__assembly.addPart("support-3u", [0, 0, 0]);
});
assert("Support-3u placed", supportId !== null);

// Wait for GLB model to load
await new Promise((r) => setTimeout(r, 3000));

// Step 3: Find the placed part's bbox
const placedBBox = await getBBox(`placed-${supportId}`);
console.log(`  Placed bbox: ${JSON.stringify(placedBBox)}`);
assert("Placed part found in scene", placedBBox !== null);

if (placedBBox) {
  assert(
    "Placed part is taller in Y than X (vertical, matching ghost)",
    placedBBox.sizeY > placedBBox.sizeX * 2,
    `Y=${placedBBox.sizeY} X=${placedBBox.sizeX}`
  );
  assert(
    "Placed part is taller in Y than Z (vertical, matching ghost)",
    placedBBox.sizeY > placedBBox.sizeZ * 2,
    `Y=${placedBBox.sizeY} Z=${placedBBox.sizeZ}`
  );
}

// Step 4: If both exist, compare that the tallest axis is the same
if (ghostBBox && placedBBox) {
  const ghostTallAxis = ghostBBox.sizeY > ghostBBox.sizeX && ghostBBox.sizeY > ghostBBox.sizeZ ? "Y"
    : ghostBBox.sizeX > ghostBBox.sizeZ ? "X" : "Z";
  const placedTallAxis = placedBBox.sizeY > placedBBox.sizeX && placedBBox.sizeY > placedBBox.sizeZ ? "Y"
    : placedBBox.sizeX > placedBBox.sizeZ ? "X" : "Z";
  assert(
    `Ghost and placed part share tallest axis`,
    ghostTallAxis === placedTallAxis,
    `ghost=${ghostTallAxis} placed=${placedTallAxis}`
  );
}

// Clean up for remaining tests
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 300));

// ──────────────────────────────────────────────
// Test: Orientation-aware grid occupancy
// ──────────────────────────────────────────────
console.log("\n--- Test: Orientation-aware grid occupancy ---");

// Place support-3u with orientation "x" — should occupy [0,0,0],[1,0,0],[2,0,0]
const orientedId = await page.evaluate(() => {
  const a = (window as any).__assembly;
  a.clear();
  return a.addPart("support-3u", [0, 0, 0], [0, 0, 0], "x");
});
assert("Place support-3u with orientation x", orientedId !== null);

// Cell [1,0,0] should be occupied — try placing a connector there
const collisionAtX1 = await page.evaluate(() => {
  return (window as any).__assembly.addPart("connector-3d6w", [1, 0, 0]);
});
assert("Collision at [1,0,0] with x-oriented support", collisionAtX1 === null);

// Cell [2,0,0] should also be occupied
const collisionAtX2 = await page.evaluate(() => {
  return (window as any).__assembly.addPart("connector-3d6w", [2, 0, 0]);
});
assert("Collision at [2,0,0] with x-oriented support", collisionAtX2 === null);

// Cell [0,1,0] should be free (support extends along X, not Y)
const freeAtY1 = await page.evaluate(() => {
  return (window as any).__assembly.addPart("connector-3d6w", [0, 1, 0]);
});
assert("No collision at [0,1,0] with x-oriented support", freeAtY1 !== null);

// Cell [0,0,1] should also be free
const freeAtZ1 = await page.evaluate(() => {
  return (window as any).__assembly.addPart("connector-3d6w", [0, 0, 1]);
});
assert("No collision at [0,0,1] with x-oriented support", freeAtZ1 !== null);

// Test Z orientation
await page.evaluate(() => (window as any).__assembly.clear());
const orientedZ = await page.evaluate(() => {
  return (window as any).__assembly.addPart("support-3u", [0, 0, 0], [0, 0, 0], "z");
});
assert("Place support-3u with orientation z", orientedZ !== null);

const collisionAtZ1 = await page.evaluate(() => {
  return (window as any).__assembly.addPart("connector-3d6w", [0, 0, 1]);
});
assert("Collision at [0,0,1] with z-oriented support", collisionAtZ1 === null);

const freeAtY1Z = await page.evaluate(() => {
  return (window as any).__assembly.addPart("connector-3d6w", [0, 1, 0]);
});
assert("No collision at [0,1,0] with z-oriented support", freeAtY1Z !== null);

// Clean up
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test: canPlace with orientation parameter
// ──────────────────────────────────────────────
console.log("\n--- Test: canPlace with orientation ---");

const canPlaceResults = await page.evaluate(() => {
  const a = (window as any).__assembly;
  a.clear();
  // Place a connector at [3,0,0]
  a.addPart("connector-3d6w", [3, 0, 0]);

  return {
    // A support-3u at [0,0,0] with orientation Y occupies [0,0,0],[0,1,0],[0,2,0]
    canPlaceY: a.canPlace("support-3u", [0, 0, 0], [0, 0, 0], "y"),
    // A support-3u at [0,0,0] with orientation X occupies [0,0,0],[1,0,0],[2,0,0]
    canPlaceX: a.canPlace("support-3u", [0, 0, 0], [0, 0, 0], "x"),
    // A support-3u at [1,0,0] with orientation X would need [1,0,0],[2,0,0],[3,0,0] - [3,0,0] is occupied
    cannotPlaceXBlocked: a.canPlace("support-3u", [1, 0, 0], [0, 0, 0], "x"),
  };
});

assert("canPlace Y-orientation at [0,0,0] succeeds", canPlaceResults.canPlaceY);
assert("canPlace X-orientation at [0,0,0] succeeds", canPlaceResults.canPlaceX);
assert("canPlace X-orientation at [1,0,0] fails (blocked by connector at [3,0,0])", !canPlaceResults.cannotPlaceXBlocked);

// Clean up
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test: Snap point discovery
// ──────────────────────────────────────────────
console.log("\n--- Test: Snap point discovery ---");

const snapResults = await page.evaluate(() => {
  const a = (window as any).__assembly;
  const snap = (window as any).__snap;
  a.clear();

  // Place a 3d6w connector at [5,0,5] — has sockets in all 6 directions
  a.addPart("connector-3d6w", [5, 0, 5]);

  // Find snap points for a support-3u near the connector
  const points = snap.findSnapPoints(a, "support-3u", [5, 0, 5], 5);

  // Should have snap candidates in multiple directions
  const orientations = points.map((p: any) => p.orientation);
  const directions = points.map((p: any) => p.socketDirection);

  return {
    count: points.length,
    orientations: [...new Set(orientations)],
    directions: [...new Set(directions)],
    // Check a specific snap: +z socket should produce Z-oriented support at [5,0,6]
    hasZSnap: points.some(
      (p: any) => p.orientation === "z" && p.socketDirection === "+z"
    ),
    // +x socket should produce X-oriented support
    hasXSnap: points.some(
      (p: any) => p.orientation === "x" && p.socketDirection === "+x"
    ),
  };
});

assert("Snap finds candidates near connector", snapResults.count > 0, `found ${snapResults.count}`);
assert("Snap includes Z-oriented candidate (+z socket)", snapResults.hasZSnap);
assert("Snap includes X-oriented candidate (+x socket)", snapResults.hasXSnap);
assert(
  "Snap has multiple orientations",
  snapResults.orientations.length >= 2,
  `orientations: ${JSON.stringify(snapResults.orientations)}`
);

// Test findBestSnap returns the nearest one
const bestSnapResult = await page.evaluate(() => {
  const a = (window as any).__assembly;
  const snap = (window as any).__snap;

  // Cursor near the +x socket of the connector at [5,0,5]
  const best = snap.findBestSnap(a, "support-3u", [6, 0, 5], 3);
  return best
    ? { position: best.position, orientation: best.orientation, direction: best.socketDirection }
    : null;
});

assert("findBestSnap returns a result near [6,0,5]", bestSnapResult !== null);
if (bestSnapResult) {
  assert(
    "Best snap is X-oriented (nearest to cursor at [6,0,5])",
    bestSnapResult.orientation === "x",
    `got orientation: ${bestSnapResult.orientation}`
  );
}

// Clean up
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test: Snap does not propose occupied positions
// ──────────────────────────────────────────────
console.log("\n--- Test: Snap avoids occupied positions ---");

const snapOccupied = await page.evaluate(() => {
  const a = (window as any).__assembly;
  const snap = (window as any).__snap;
  a.clear();

  // Place connector and a support that blocks the +x direction
  a.addPart("connector-3d6w", [5, 0, 5]);
  a.addPart("support-3u", [6, 0, 5], [0, 0, 0], "x"); // Occupies [6,0,5],[7,0,5],[8,0,5]

  // Now find snap points — +x socket should be excluded (blocked)
  const points = snap.findSnapPoints(a, "support-3u", [6, 0, 5], 5);
  const hasXSnap = points.some((p: any) => p.socketDirection === "+x");

  return { hasXSnap, count: points.length };
});

assert("Snap excludes +x socket (blocked by existing support)", !snapOccupied.hasXSnap);
assert("Snap still finds other candidates", snapOccupied.count > 0);

// Clean up
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test: BOM lock pins with oriented supports
// ──────────────────────────────────────────────
console.log("\n--- Test: BOM lock pins with oriented supports ---");

await page.evaluate(() => {
  const a = (window as any).__assembly;
  a.clear();
  // Connector at origin
  a.addPart("connector-3d6w", [0, 0, 0]);
  // Support along +x axis: origin at [1,0,0], occupies [1,0,0],[2,0,0],[3,0,0]
  a.addPart("support-3u", [1, 0, 0], [0, 0, 0], "x");
});
await new Promise((r) => setTimeout(r, 500));

const bomOriented = await page.evaluate(() => {
  const rows = document.querySelectorAll(".bom-table tbody tr");
  return Array.from(rows).map((row) => ({
    name: row.querySelector("td:first-child")?.textContent?.trim() ?? "",
    qty: row.querySelector(".bom-qty")?.textContent?.trim() ?? "",
  }));
});

assert(
  "BOM includes lock pins for x-oriented support adjacent to connector",
  bomOriented.some((r) => r.name.includes("Lock Pin")),
  `BOM rows: ${JSON.stringify(bomOriented)}`
);

// Clean up
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test: Orientation keyboard cycling hint
// ──────────────────────────────────────────────
console.log("\n--- Test: Orientation keyboard hint ---");

// Select a support
await page.evaluate(() => {
  const items = document.querySelectorAll(".catalog-item");
  for (const item of items) {
    if (item.querySelector(".catalog-item-name")?.textContent?.trim() === "Support (3u)") {
      (item as HTMLElement).click();
      return;
    }
  }
});
await new Promise((r) => setTimeout(r, 300));

const supportHint = await page.evaluate(() => {
  return document.querySelector(".viewport-hint")?.textContent?.trim() ?? "";
});
assert(
  "Support placement hint mentions orientation cycling",
  supportHint.includes("orientation"),
  `hint: ${supportHint}`
);

// Now switch to a connector and check the hint changes
await page.evaluate(() => {
  const items = document.querySelectorAll(".catalog-item");
  for (const item of items) {
    if (item.querySelector(".catalog-item-name")?.textContent?.trim() === "3D 6-Way") {
      (item as HTMLElement).click();
      return;
    }
  }
});
await new Promise((r) => setTimeout(r, 300));

const connectorHint = await page.evaluate(() => {
  return document.querySelector(".viewport-hint")?.textContent?.trim() ?? "";
});
assert(
  "Connector placement hint mentions rotate (not orientation)",
  connectorHint.includes("rotate") && !connectorHint.includes("orientation"),
  `hint: ${connectorHint}`
);

// Exit placement mode
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 200));

// Clean up for remaining tests
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test: Rotation-aware grid collision
// ──────────────────────────────────────────────
console.log("\n--- Test: Rotation-aware grid collision ---");

const rotationCollision = await page.evaluate(() => {
  const a = (window as any).__assembly;
  a.clear();

  // Place support-3u at [0,0,0] with 90° X rotation
  // Default gridCells for support-3u: [0,0,0],[0,1,0],[0,2,0] (extends along Y)
  // After 90° X rotation: [x,y,z] → [x,-z,y], so cells become [0,0,0],[0,0,1],[0,0,2] (extends along Z)
  const id = a.addPart("support-3u", [0, 0, 0], [90, 0, 0]);

  // Check which cells are occupied
  const occupiedY1 = a.isOccupied([0, 1, 0]); // Should be FREE (rotation moved cells to Z)
  const occupiedZ1 = a.isOccupied([0, 0, 1]); // Should be OCCUPIED
  const occupiedZ2 = a.isOccupied([0, 0, 2]); // Should be OCCUPIED

  // Try placing at rotated cell — should fail
  const collidesZ1 = a.addPart("connector-3d6w", [0, 0, 1]);

  // Try placing at the old (unrotated) cell — should succeed
  const freeY1 = a.addPart("connector-3d6w", [0, 1, 0]);

  return {
    placed: id !== null,
    occupiedY1,
    occupiedZ1,
    occupiedZ2,
    collidesZ1: collidesZ1 === null,
    freeY1: freeY1 !== null,
  };
});

assert("Support placed with 90° X rotation", rotationCollision.placed);
assert("Rotated cell [0,0,1] is occupied", rotationCollision.occupiedZ1);
assert("Rotated cell [0,0,2] is occupied", rotationCollision.occupiedZ2);
assert("Old cell [0,1,0] is free after rotation", !rotationCollision.occupiedY1);
assert("Cannot place at rotated occupied cell [0,0,1]", rotationCollision.collidesZ1);
assert("Can place at old free cell [0,1,0]", rotationCollision.freeY1);

// Clean up
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test: Rotation blocks below-ground placement
// ──────────────────────────────────────────────
console.log("\n--- Test: Rotation blocks below-ground ---");

const belowGround = await page.evaluate(() => {
  const a = (window as any).__assembly;
  a.clear();

  // support-3u default gridCells: [0,0,0],[0,1,0],[0,2,0]
  // With 90° X rotation: cells become [0,0,0],[0,0,1],[0,0,2] — all Y >= 0, should succeed
  const validRot = a.canPlace("support-3u", [0, 0, 0], [90, 0, 0]);

  // With 270° X rotation (or equivalently -90°): [x,y,z] → [x,z,-y]
  // [0,0,0] → [0,0,0], [0,1,0] → [0,0,-1], [0,2,0] → [0,0,-2]
  // Cell [0,0,-1] has Y=0 which is fine, but Z=-1 — wait, Y is the ground check
  // Actually [0,0,-1] means y=0 (second element), so Y >= 0 is true. But the Z is -1.
  // The ground check is worldCell[1] < 0, which is the Y component.
  // With 270° X: [0,y,z] → [0,z,-y], so [0,1,0] → [0,0,-1], [0,2,0] → [0,0,-2]
  // worldCell[1] = 0 for all... Y is still >= 0.
  // Let's use a position + rotation combo that actually goes below ground:
  // 90° Z rotation: [x,y,z] → [-y,x,z], so [0,1,0] → [-1,0,0], [0,2,0] → [-2,0,0]
  // worldCell[1] = 0 still OK. Need to offset position to make Y < 0.
  // Actually, origin at [0,0,0] with 90° Z: cells [0,0,0],[-1,0,0],[-2,0,0] — all Y=0, fine.

  // The simplest case: position at [0,0,0], 180° X rotation:
  // [0,y,z] → [0,-y,-z]: [0,0,0]→[0,0,0], [0,1,0]→[0,-1,0], [0,2,0]→[0,-2,0]
  // worldCell = [0+0, 0+(-1), 0+0] = [0,-1,0] — Y < 0! Should be blocked.
  const blockedRot = a.canPlace("support-3u", [0, 0, 0], [180, 0, 0]);

  return { validRot, blockedRot };
});

assert("90° X rotation at ground level is valid", belowGround.validRot);
assert("180° X rotation at ground level is blocked (cells go below Y=0)", !belowGround.blockedRot);

// ──────────────────────────────────────────────
// Test: canPlaceIgnoring (for drag-to-move)
// ──────────────────────────────────────────────
console.log("\n--- Test: canPlaceIgnoring ---");

const ignoreResult = await page.evaluate(() => {
  const a = (window as any).__assembly;
  a.clear();

  // Place two connectors
  const id1 = a.addPart("connector-3d6w", [0, 0, 0]);
  const id2 = a.addPart("connector-3d6w", [2, 0, 0]);

  // canPlaceIgnoring at [0,0,0] ignoring id1 should return true (ignores self)
  const canIgnoreSelf = a.canPlaceIgnoring("connector-3d6w", [0, 0, 0], [0, 0, 0], id1);

  // canPlaceIgnoring at [2,0,0] ignoring id1 should return false (id2 blocks it)
  const blockedByOther = a.canPlaceIgnoring("connector-3d6w", [2, 0, 0], [0, 0, 0], id1);

  // canPlaceIgnoring at [1,0,0] ignoring id1 should return true (empty cell)
  const freeCell = a.canPlaceIgnoring("connector-3d6w", [1, 0, 0], [0, 0, 0], id1);

  return { canIgnoreSelf, blockedByOther, freeCell };
});

assert("canPlaceIgnoring ignores self at same position", ignoreResult.canIgnoreSelf);
assert("canPlaceIgnoring still blocked by other parts", !ignoreResult.blockedByOther);
assert("canPlaceIgnoring allows empty cell", ignoreResult.freeCell);

// ──────────────────────────────────────────────
// Test: Move part (programmatic)
// ──────────────────────────────────────────────
console.log("\n--- Test: Move part programmatic ---");

const moveResult = await page.evaluate(() => {
  const a = (window as any).__assembly;
  a.clear();

  // Place connector at [0,0,0]
  const id = a.addPart("connector-3d6w", [0, 0, 0]);
  if (!id) return { success: false, reason: "failed to place" };

  // Simulate move: remove from old position, add at new position
  const part = a.getPartById(id);
  if (!part) return { success: false, reason: "part not found" };

  a.removePart(id);
  const newId = a.addPart(part.definitionId, [3, 0, 3], part.rotation, part.orientation);

  // Verify old position is free
  const oldFree = !a.isOccupied([0, 0, 0]);
  // Verify new position is occupied
  const newOccupied = a.isOccupied([3, 0, 3]);

  return {
    success: newId !== null,
    oldFree,
    newOccupied,
    newId,
  };
});

assert("Move part succeeds", moveResult.success);
assert("Old position [0,0,0] is free after move", moveResult.oldFree);
assert("New position [3,0,3] is occupied after move", moveResult.newOccupied);

// Clean up
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test: 2D2W L-shape connector snap (both arms)
// ──────────────────────────────────────────────
console.log("\n--- Test: 2D2W L-shape snap ---");

// 2D2W has arms: +z and +x (flat on XZ ground plane, an L-shape)
// Place at [5,0,5]. Support-5u should snap to both arms.
const lShapeSnap = await page.evaluate(() => {
  const a = (window as any).__assembly;
  const snap = (window as any).__snap;
  a.clear();

  // Place 2D2W connector at [5,0,5]
  a.addPart("connector-2d2w", [5, 0, 5]);

  // Find snap points for support-5u near the connector
  const points = snap.findSnapPoints(a, "support-5u", [5, 0, 5], 5);

  // Should find exactly 2 snap candidates: one for +z and one for +x
  const zSnap = points.find((p: any) => p.socketDirection === "+z");
  const xSnap = points.find((p: any) => p.socketDirection === "+x");

  return {
    totalCandidates: points.length,
    hasZSnap: !!zSnap,
    hasXSnap: !!xSnap,
    zPos: zSnap?.position,
    xPos: xSnap?.position,
    zOrient: zSnap?.orientation,
    xOrient: xSnap?.orientation,
  };
});

assert("2D2W has exactly 2 snap candidates", lShapeSnap.totalCandidates === 2, `got ${lShapeSnap.totalCandidates}`);
assert("2D2W has +z snap (depth)", lShapeSnap.hasZSnap);
assert("2D2W has +x snap (horizontal)", lShapeSnap.hasXSnap);
assert(
  "+z snap position is in front of connector",
  lShapeSnap.zPos && lShapeSnap.zPos[2] === 6,
  `pos: ${JSON.stringify(lShapeSnap.zPos)}`
);
assert(
  "+x snap position is right of connector",
  lShapeSnap.xPos && lShapeSnap.xPos[0] === 6,
  `pos: ${JSON.stringify(lShapeSnap.xPos)}`
);
assert("+z snap has Z orientation", lShapeSnap.zOrient === "z");
assert("+x snap has X orientation", lShapeSnap.xOrient === "x");

// Now actually PLACE a support at the +x snap position and verify grid occupancy
const lShapePlaceX = await page.evaluate(() => {
  const a = (window as any).__assembly;
  const snap = (window as any).__snap;

  // Find snap candidates again
  const points = snap.findSnapPoints(a, "support-5u", [5, 0, 5], 5);
  const xSnap = points.find((p: any) => p.socketDirection === "+x");
  if (!xSnap) return { placed: false, reason: "no +x snap found" };

  // Place the support at the snap position with the snap orientation
  const id = a.addPart("support-5u", xSnap.position, [0, 0, 0], xSnap.orientation);
  if (!id) return { placed: false, reason: "addPart returned null", pos: xSnap.position, orient: xSnap.orientation };

  // Verify the support occupies the correct cells (extending in +x from [6,0,5])
  const expectedCells: [number, number, number][] = [[6,0,5],[7,0,5],[8,0,5],[9,0,5],[10,0,5]];
  const occupancy = expectedCells.map((c) => ({
    cell: c,
    occupied: a.isOccupied(c),
  }));
  const allOccupied = occupancy.every((o: any) => o.occupied);

  // Verify connector cell is NOT occupied by the support
  const connectorCellStillConnector = a.isOccupied([5, 0, 5]);

  return { placed: true, allOccupied, occupancy, connectorCellStillConnector };
});

assert("Support placed at +x snap position", lShapePlaceX.placed === true, JSON.stringify(lShapePlaceX));
assert("X-oriented support occupies cells [6..10, 0, 5]", lShapePlaceX.allOccupied === true,
  JSON.stringify(lShapePlaceX.occupancy));
assert("Connector cell [5,0,5] still occupied", lShapePlaceX.connectorCellStillConnector === true);

// Now place a support in the +z slot and verify the snap only offers nothing (both filled)
const lShapeOpen = await page.evaluate(() => {
  const a = (window as any).__assembly;
  const snap = (window as any).__snap;

  // Place support-5u in the +z slot (Z-oriented, starting at [5,0,6])
  a.addPart("support-5u", [5, 0, 6], [0, 0, 0], "z");

  // Check snap points again — both should be gone (occupied)
  const points = snap.findSnapPoints(a, "support-5u", [5, 0, 5], 5);
  const hasZSnap = points.some((p: any) => p.socketDirection === "+z");
  const hasXSnap = points.some((p: any) => p.socketDirection === "+x");

  return { totalCandidates: points.length, hasZSnap, hasXSnap };
});

assert("After filling both slots, 0 snap candidates remain", lShapeOpen.totalCandidates === 0, `got ${lShapeOpen.totalCandidates}`);
assert("Filled +z slot is no longer offered", !lShapeOpen.hasZSnap);
assert("Filled +x slot is no longer offered", !lShapeOpen.hasXSnap);

// Clean up
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test: Connector snaps to top of vertical support
// ──────────────────────────────────────────────
console.log("\n--- Test: Connector snap to vertical support top ---");

const connectorSnapTop = await page.evaluate(() => {
  const a = (window as any).__assembly;
  const snap = (window as any).__snap;
  a.clear();

  // Place a support-5u vertically at [5,0,5] — extends Y from 0 to 4
  a.addPart("support-5u", [5, 0, 5], [0, 0, 0], "y");

  // Find connector snap points near cursor at [5,0,5] (ground level)
  // The support top is at [5,4,5], outward direction +y, connector at [5,5,5]
  const points = snap.findConnectorSnapPoints(a, "connector-3d6w", [5, 0, 5], 3);
  const topSnap = points.find((p: any) => p.socketDirection === "+y");
  const bottomSnap = points.find((p: any) => p.socketDirection === "-y");

  return {
    count: points.length,
    hasTopSnap: !!topSnap,
    topPos: topSnap?.position,
    // Bottom snap at [5,-1,5] should be excluded (below ground)
    hasBottomSnap: !!bottomSnap,
  };
});

assert("Connector snap finds support top", connectorSnapTop.hasTopSnap,
  `count=${connectorSnapTop.count}`);
assert("Connector snap top is at [5,5,5]",
  connectorSnapTop.topPos && connectorSnapTop.topPos[0] === 5 && connectorSnapTop.topPos[1] === 5 && connectorSnapTop.topPos[2] === 5,
  `pos: ${JSON.stringify(connectorSnapTop.topPos)}`);
assert("Bottom snap excluded (below ground)", !connectorSnapTop.hasBottomSnap);

// Also test with support-10u (top at y=9, connector at y=10)
const connectorSnapTall = await page.evaluate(() => {
  const a = (window as any).__assembly;
  const snap = (window as any).__snap;
  a.clear();

  a.addPart("support-10u", [5, 0, 5], [0, 0, 0], "y");
  const points = snap.findConnectorSnapPoints(a, "connector-2d2w", [5, 0, 5], 3);
  const topSnap = points.find((p: any) => p.socketDirection === "+y");

  return {
    hasTopSnap: !!topSnap,
    topPos: topSnap?.position,
  };
});

assert("Connector snap finds top of tall (10u) support",
  connectorSnapTall.hasTopSnap,
  `pos: ${JSON.stringify(connectorSnapTall.topPos)}`);
assert("Connector at top of 10u support is at [5,10,5]",
  connectorSnapTall.topPos && connectorSnapTall.topPos[1] === 10,
  `pos: ${JSON.stringify(connectorSnapTall.topPos)}`);

// Clean up
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test: Ray-based snap proximity
// ──────────────────────────────────────────────
console.log("\n--- Test: Ray-based snap proximity ---");

const raySnap = await page.evaluate(() => {
  const a = (window as any).__assembly;
  const snap = (window as any).__snap;
  a.clear();

  // Place a support-10u vertically at [5,0,5] — top at y=9, connector snap at [5,10,5]
  a.addPart("support-10u", [5, 0, 5], [0, 0, 0], "y");

  // Cursor on ground at [5,0,10] — XZ distance to [5,10,5] is 5, beyond maxDistance=3
  // Without ray, this should NOT find the top snap
  const withoutRay = snap.findConnectorSnapPoints(a, "connector-3d6w", [5, 0, 10], 3);
  const topWithoutRay = withoutRay.find((p: any) => p.socketDirection === "+y");

  // With a ray pointing from above toward the support top, ray passes close to [5,10,5]
  // Simulate a camera at [5, 20, 15] looking toward [5, 10, 5]
  const rayOrigin = [5, 20, 15] as [number, number, number]; // in grid units
  const rawDir = [5 - 5, 10 - 20, 5 - 15] as [number, number, number]; // [0, -10, -10]
  const len = Math.sqrt(rawDir[0] ** 2 + rawDir[1] ** 2 + rawDir[2] ** 2);
  const rayDir = [rawDir[0] / len, rawDir[1] / len, rawDir[2] / len] as [number, number, number];
  const ray = { origin: rayOrigin, direction: rayDir };

  const withRay = snap.findConnectorSnapPoints(a, "connector-3d6w", [5, 0, 10], 3, ray);
  const topWithRay = withRay.find((p: any) => p.socketDirection === "+y");

  return {
    hasTopWithoutRay: !!topWithoutRay,
    hasTopWithRay: !!topWithRay,
    topPos: topWithRay?.position,
  };
});

assert("No top snap without ray (cursor XZ too far)", !raySnap.hasTopWithoutRay);
assert("Top snap found with ray proximity", raySnap.hasTopWithRay,
  `pos: ${JSON.stringify(raySnap.topPos)}`);
assert("Ray snap position is [5,10,5]",
  raySnap.topPos && raySnap.topPos[0] === 5 && raySnap.topPos[1] === 10 && raySnap.topPos[2] === 5,
  `pos: ${JSON.stringify(raySnap.topPos)}`);

// Clean up
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test: Snap enable/disable toggle
// ──────────────────────────────────────────────
console.log("\n--- Test: Snap enable/disable ---");

// Snap should be enabled by default
const snapDefault = await page.evaluate(() => {
  const a = (window as any).__assembly;
  return a.snapEnabled;
});
assert("Snap is enabled by default", snapDefault === true);

// Verify snap toggle button exists in toolbar
const snapBtnExists = await page.evaluate(() => {
  const buttons = document.querySelectorAll(".toolbar-btn");
  for (const btn of buttons) {
    if (btn.textContent?.trim().startsWith("Snap:")) return true;
  }
  return false;
});
assert("Snap toggle button exists in toolbar", snapBtnExists);

// Verify button shows "Snap: On" initially
const snapBtnText1 = await page.evaluate(() => {
  const buttons = document.querySelectorAll(".toolbar-btn");
  for (const btn of buttons) {
    if (btn.textContent?.trim().startsWith("Snap:")) return btn.textContent?.trim() ?? "";
  }
  return "";
});
assert("Snap button says 'Snap: On' initially", snapBtnText1 === "Snap: On", `got: ${snapBtnText1}`);

// Disable snap via the assembly API
await page.evaluate(() => {
  (window as any).__assembly.setSnapEnabled(false);
});
await new Promise((r) => setTimeout(r, 300));

const snapDisabled = await page.evaluate(() => {
  return (window as any).__assembly.snapEnabled;
});
assert("Snap disabled after setSnapEnabled(false)", snapDisabled === false);

// Verify button text updated to "Snap: Off"
const snapBtnText2 = await page.evaluate(() => {
  const buttons = document.querySelectorAll(".toolbar-btn");
  for (const btn of buttons) {
    if (btn.textContent?.trim().startsWith("Snap:")) return btn.textContent?.trim() ?? "";
  }
  return "";
});
assert("Snap button says 'Snap: Off' after disable", snapBtnText2 === "Snap: Off", `got: ${snapBtnText2}`);

// Verify button has active class when snap is OFF (indicating toggle is activated)
const snapBtnActive = await page.evaluate(() => {
  const buttons = document.querySelectorAll(".toolbar-btn");
  for (const btn of buttons) {
    if (btn.textContent?.trim().startsWith("Snap:")) return btn.classList.contains("toolbar-btn-active");
  }
  return false;
});
assert("Snap button has active class when snap is off", snapBtnActive);

// Snap functions are still callable when snap is disabled (toggle is UI-only guard)
const snapStillCallable = await page.evaluate(() => {
  const a = (window as any).__assembly;
  const snap = (window as any).__snap;
  // Verify the functions exist and don't throw when snapEnabled is false
  try {
    a.clear();
    a.addPart("connector-3d6w", [5, 0, 5]);
    snap.findSnapPoints(a, "support-3u", [5, 0, 5], 5);
    snap.findBestSnap(a, "support-3u", [5, 0, 5], 3);
    snap.findConnectorSnapPoints(a, "connector-3d6w", [5, 0, 5], 3);
    snap.findBestConnectorSnap(a, "connector-3d6w", [5, 0, 5], 3);
    return true;
  } catch {
    return false;
  }
});
assert("Snap functions callable when snap toggle is off (UI-only guard)", snapStillCallable);

// Click the toolbar button to re-enable snap
await page.evaluate(() => {
  const buttons = document.querySelectorAll(".toolbar-btn");
  for (const btn of buttons) {
    if (btn.textContent?.trim().startsWith("Snap:")) {
      (btn as HTMLElement).click();
      return;
    }
  }
});
await new Promise((r) => setTimeout(r, 300));

const snapReEnabled = await page.evaluate(() => {
  return (window as any).__assembly.snapEnabled;
});
assert("Snap re-enabled after clicking toolbar button", snapReEnabled === true);

const snapBtnText3 = await page.evaluate(() => {
  const buttons = document.querySelectorAll(".toolbar-btn");
  for (const btn of buttons) {
    if (btn.textContent?.trim().startsWith("Snap:")) return btn.textContent?.trim() ?? "";
  }
  return "";
});
assert("Snap button says 'Snap: On' after re-enable", snapBtnText3 === "Snap: On", `got: ${snapBtnText3}`);

// Verify snap setting persists to localStorage
const snapPersisted = await page.evaluate(() => {
  const raw = localStorage.getItem("homeracker-settings");
  if (!raw) return null;
  return JSON.parse(raw).snapEnabled;
});
assert("Snap setting persisted to localStorage", snapPersisted === true, `got: ${snapPersisted}`);

// Clean up
await page.evaluate(() => (window as any).__assembly.clear());
await new Promise((r) => setTimeout(r, 200));

// ──────────────────────────────────────────────
// Test 11: No unexpected page errors
// ──────────────────────────────────────────────
console.log("\n--- Test: No page errors ---");
assert("No unexpected page errors", pageErrors.length === 0, pageErrors.join("; "));

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
await browser.close();
server.stop();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;

console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${results.length} total`);
if (failed > 0) {
  console.log("\nFailed tests:");
  for (const r of results.filter((r) => !r.pass)) {
    console.log(`  - ${r.name}${r.detail ? `: ${r.detail}` : ""}`);
  }
}
console.log(`${"=".repeat(40)}`);

process.exit(exitCode);
