import { test as base, type Page } from "@playwright/test";

/**
 * Wait for the app to finish loading and the Three.js scene to be ready.
 */
export async function waitForApp(page: Page) {
  await page.waitForSelector(".app", { timeout: 10_000 });
  // Wait for R3F to mount and expose the scene object
  await page.waitForFunction(() => !!(window as any).__scene, { timeout: 10_000 });
}

/**
 * Click a catalog item by its display name.
 */
export async function clickCatalogItem(page: Page, name: string) {
  await page.evaluate((n) => {
    const items = document.querySelectorAll(".catalog-item");
    for (const item of items) {
      if (
        item.querySelector(".catalog-item-name")?.textContent?.trim() === n
      ) {
        (item as HTMLElement).click();
        return;
      }
    }
  }, name);
  // Wait for React to process the click
  await page.waitForFunction(
    (n) => !!document.querySelector(".catalog-item.active .catalog-item-name")
      || document.querySelector(".viewport")?.getAttribute("data-placing") != null,
    name,
    { timeout: 3_000 },
  );
}

/**
 * Wait for a Three.js mesh to be loaded and have geometry (replaces GLB load timeouts).
 */
export async function waitForMesh(page: Page, objectName: string, timeout = 10_000) {
  await page.waitForFunction(
    (name: string) => {
      const scene = (window as any).__scene;
      if (!scene) return false;
      let found = false;
      scene.traverse((obj: any) => {
        if (obj.name === name && obj.children?.length > 0) found = true;
        if (obj.name === name && obj.isMesh) found = true;
      });
      return found;
    },
    objectName,
    { timeout },
  );
}

/**
 * Wait for the BOM table to have at least `minRows` rows.
 */
export async function waitForBOM(page: Page, minRows = 1) {
  await page.waitForFunction(
    (min: number) => document.querySelectorAll(".bom-table tbody tr").length >= min,
    minRows,
    { timeout: 5_000 },
  );
}

/**
 * Get the world-space bounding box of a named Three.js object.
 */
export async function getBBox(page: Page, objectName: string) {
  return page.evaluate((name: string) => {
    const scene = (window as any).__scene;
    if (!scene) return null;
    let target: any = null;
    scene.traverse((obj: any) => {
      if (obj.name === name) target = obj;
    });
    if (!target) return null;

    const forceUpdateMatrices = (obj: any) => {
      const chain: any[] = [];
      let p = obj;
      while (p) {
        chain.unshift(p);
        p = p.parent;
      }
      for (const node of chain) node.updateMatrix();
      for (let i = 0; i < chain.length; i++) {
        if (i === 0) {
          chain[i].matrixWorld.copy(chain[i].matrix);
        } else {
          chain[i].matrixWorld.multiplyMatrices(
            chain[i - 1].matrixWorld,
            chain[i].matrix
          );
        }
      }
    };

    const box = {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    };
    target.traverse((child: any) => {
      if (child.isMesh && child.geometry) {
        forceUpdateMatrices(child);
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        const bb = child.geometry.boundingBox;
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
          const e = child.matrixWorld.elements;
          const wx = e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12];
          const wy = e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13];
          const wz = e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14];
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
      minY: Math.round(box.min[1] * 100) / 100,
      maxY: Math.round(box.max[1] * 100) / 100,
    };
  }, objectName);
}

/** Extended test fixture that loads the app before each test */
export const test = base.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    // Collect page errors (ignore WebGL warnings)
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      if (err.message.includes("WebGL")) return;
      pageErrors.push(err.message);
    });

    await page.goto("/");
    await waitForApp(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";
