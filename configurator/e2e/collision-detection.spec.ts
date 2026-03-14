import { test, expect } from "./fixtures";

test.describe("Collision detection", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.evaluate(() => (window as any).__assembly.clear());
  });

  // --- Grid-level collision (fast, synchronous) ---

  test("two connectors at the same position are detected as colliding (grid)", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const id1 = a.addPart("connector-2d2w", [0, 0, 0]);
      const id2 = a.addPart("connector-2d2w", [0, 0, 0]);
      const { detectCollidingPartIds } = (window as any).__collision;
      const colliding = detectCollidingPartIds(a);
      return { id1, id2, has1: colliding.has(id1), has2: colliding.has(id2), size: colliding.size };
    });
    expect(result.has1).toBe(true);
    expect(result.has2).toBe(true);
  });

  test("two connectors far apart do NOT collide (grid)", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.addPart("connector-2d2w", [0, 0, 0]);
      a.addPart("connector-2d2w", [10, 0, 0]);
      const { detectCollidingPartIds } = (window as any).__collision;
      const colliding = detectCollidingPartIds(a);
      return colliding.size;
    });
    expect(result).toBe(0);
  });

  test("PT connector and support at same cell are NOT colliding (grid PT exemption)", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      // Support along Y; PT-Z connector rotated 90deg around X so effective PT axis = Y
      a.addPart("support-3u", [0, 0, 0], [0, 0, 0], "y");
      a.addPart("connector-2d2w-pt-z", [0, 1, 0], [90, 0, 0]);
      const { detectCollidingPartIds } = (window as any).__collision;
      const colliding = detectCollidingPartIds(a);
      return colliding.size;
    });
    expect(result).toBe(0);
  });

  test("two connectors overlapping at one cell with a support are still colliding (grid)", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.addPart("support-3u", [0, 0, 0], [0, 0, 0], "y");
      const c1 = a.addPart("connector-2d2w", [0, 1, 0], [0, 0, 0]);
      const c2 = a.addPart("connector-2d2w", [0, 1, 0], [0, 0, 0]);
      const { detectCollidingPartIds } = (window as any).__collision;
      const colliding = detectCollidingPartIds(a);
      return { hasC1: colliding.has(c1), hasC2: colliding.has(c2) };
    });
    expect(result.hasC1).toBe(true);
    expect(result.hasC2).toBe(true);
  });

  test("adjacent parts (no shared cells) do NOT collide (grid)", async ({
    appPage: page,
  }) => {
    // support-1u at [0,0,0] occupies cell [0,0,0]
    // support-1u at [0,1,0] occupies cell [0,1,0]
    // They are adjacent but not overlapping
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.addPart("support-1u", [0, 0, 0], [0, 0, 0], "y");
      a.addPart("support-1u", [0, 1, 0], [0, 0, 0], "y");
      const { detectCollidingPartIds } = (window as any).__collision;
      return detectCollidingPartIds(a).size;
    });
    expect(result).toBe(0);
  });

  test("connector nudged 0.2 into a support shares grid cell (grid is conservative)", async ({
    appPage: page,
  }) => {
    // Grid-level detection is conservative: shared cell = flagged
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.addPart("support-3u", [0, 0, 0], [0, 0, 0], "y");
      a.addPart("connector-2d2w", [0.2, 0, 0]);
      const { detectCollidingPartIds } = (window as any).__collision;
      return detectCollidingPartIds(a).size;
    });
    expect(result).toBe(2);
  });

  // --- Fine mesh collision (async, BVH-based) ---

  test("two connectors at the same position are detected as colliding (mesh)", async ({
    appPage: page,
  }) => {
    // Place parts and wait for GLB geometries to register
    const ids = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const id1 = a.addPart("connector-2d2w", [0, 0, 0]);
      const id2 = a.addPart("connector-2d2w", [0, 0, 0]);
      return { id1, id2 };
    });

    // Wait for geometry registration (GLBs load async via Suspense)
    await page.waitForFunction(
      () => {
        const scene = (window as any).__scene;
        if (!scene) return false;
        let count = 0;
        scene.traverse((obj: any) => {
          if (obj.name?.startsWith("placed-") && obj.children?.length > 0) count++;
        });
        return count >= 2;
      },
      { timeout: 10_000 },
    );

    const result = await page.evaluate(async (ids: { id1: string; id2: string }) => {
      const a = (window as any).__assembly;
      const { detectCollidingPartIdsMesh } = (window as any).__collision;
      const colliding = await detectCollidingPartIdsMesh(a);
      return { has1: colliding.has(ids.id1), has2: colliding.has(ids.id2), size: colliding.size };
    }, ids);

    expect(result.has1).toBe(true);
    expect(result.has2).toBe(true);
  });

  test("two connectors far apart do NOT collide (mesh)", async ({
    appPage: page,
  }) => {
    await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.addPart("connector-2d2w", [0, 0, 0]);
      a.addPart("connector-2d2w", [10, 0, 0]);
    });

    await page.waitForFunction(
      () => {
        const scene = (window as any).__scene;
        if (!scene) return false;
        let count = 0;
        scene.traverse((obj: any) => {
          if (obj.name?.startsWith("placed-") && obj.children?.length > 0) count++;
        });
        return count >= 2;
      },
      { timeout: 10_000 },
    );

    const result = await page.evaluate(async () => {
      const a = (window as any).__assembly;
      const { detectCollidingPartIdsMesh } = (window as any).__collision;
      const colliding = await detectCollidingPartIdsMesh(a);
      return colliding.size;
    });
    expect(result).toBe(0);
  });

  test("PT connector + support along matching axis do NOT collide (mesh)", async ({
    appPage: page,
  }) => {
    await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.addPart("support-3u", [0, 0, 0], [0, 0, 0], "z");
      a.addPart("connector-2d2w-pt-z", [0, 0, 0], [0, 0, 0]);
    });

    await page.waitForFunction(
      () => {
        const scene = (window as any).__scene;
        if (!scene) return false;
        let count = 0;
        scene.traverse((obj: any) => {
          if (obj.name?.startsWith("placed-") && obj.children?.length > 0) count++;
        });
        return count >= 2;
      },
      { timeout: 10_000 },
    );

    const result = await page.evaluate(async () => {
      const a = (window as any).__assembly;
      const { detectCollidingPartIdsMesh } = (window as any).__collision;
      const colliding = await detectCollidingPartIdsMesh(a);
      return colliding.size;
    });
    expect(result).toBe(0);
  });

  test("adjacent parts with small gap do NOT collide (mesh)", async ({
    appPage: page,
  }) => {
    // Place two supports side by side with 1 grid cell gap
    await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.addPart("support-3u", [0, 0, 0], [0, 0, 0], "y");
      a.addPart("support-3u", [1, 0, 0], [0, 0, 0], "y");
    });

    await page.waitForFunction(
      () => {
        const scene = (window as any).__scene;
        if (!scene) return false;
        let count = 0;
        scene.traverse((obj: any) => {
          if (obj.name?.startsWith("placed-") && obj.children?.length > 0) count++;
        });
        return count >= 2;
      },
      { timeout: 10_000 },
    );

    const result = await page.evaluate(async () => {
      const a = (window as any).__assembly;
      const { detectCollidingPartIdsMesh } = (window as any).__collision;
      const colliding = await detectCollidingPartIdsMesh(a);
      return colliding.size;
    });
    expect(result).toBe(0);
  });

  test("connector-3d5w adjacent to support-14u along z should NOT collide", async ({
    appPage: page,
  }) => {
    // From user save: support-14u at [-1.6, 0, 3.7] oriented "z", connector-3d5w at [-1.6, 0, 2.7]
    const ids = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const suppId = a.addPart("support-14u", [-1.6, 0, 3.7], [0, 0, 0], "z");
      const connId = a.addPart("connector-3d5w", [-1.6, 0, 2.7], [0, 0, 0]);
      return { connId, suppId };
    });

    // Check grid-level collision
    const gridResult = await page.evaluate((ids: { connId: string; suppId: string }) => {
      const a = (window as any).__assembly;
      const { detectCollidingPartIds } = (window as any).__collision;
      const colliding = detectCollidingPartIds(a);
      return {
        size: colliding.size,
        hasConn: colliding.has(ids.connId),
        hasSupp: colliding.has(ids.suppId),
      };
    }, ids);

    console.log("Grid collision:", gridResult);

    // Wait for GLB geometries to load
    await page.waitForFunction(
      () => {
        const scene = (window as any).__scene;
        if (!scene) return false;
        let count = 0;
        scene.traverse((obj: any) => {
          if (obj.name?.startsWith("placed-") && obj.children?.length > 0) count++;
        });
        return count >= 2;
      },
      { timeout: 10_000 },
    );

    // Check mesh-level collision
    const meshResult = await page.evaluate(async (ids: { connId: string; suppId: string }) => {
      const a = (window as any).__assembly;
      const { detectCollidingPartIdsMesh } = (window as any).__collision;
      const colliding = await detectCollidingPartIdsMesh(a);
      return {
        size: colliding.size,
        hasConn: colliding.has(ids.connId),
        hasSupp: colliding.has(ids.suppId),
      };
    }, ids);

    console.log("Mesh collision:", meshResult);

    // These parts are adjacent, not overlapping — no collision expected
    expect(meshResult.size).toBe(0);
  });

  test("mesh collision can be cancelled via AbortSignal", async ({
    appPage: page,
  }) => {
    await page.evaluate(() => {
      const a = (window as any).__assembly;
      // Place overlapping parts so there's real work to do
      a.addPart("connector-2d2w", [0, 0, 0]);
      a.addPart("connector-2d2w", [0, 0, 0]);
    });

    const result = await page.evaluate(async () => {
      const a = (window as any).__assembly;
      const { detectCollidingPartIdsMesh } = (window as any).__collision;
      const controller = new AbortController();
      // Abort immediately
      controller.abort();
      const colliding = await detectCollidingPartIdsMesh(a, controller.signal);
      return colliding.size;
    });
    // Aborted detection returns empty set
    expect(result).toBe(0);
  });

  test("PT connector offset from support SHOULD collide (misaligned PT)", async ({
    appPage: page,
  }) => {
    // PT-Z connector at [-1,0,4] and support-14u at [-1.6,0,3.7] oriented "z"
    // The connector is offset 0.6 grid units in x — support doesn't pass through the hole
    const ids = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const connId = a.addPart("connector-1d2w-pt-z", [-1, 0, 4], [0, 0, 0]);
      const suppId = a.addPart("support-14u", [-1.6, 0, 3.7], [0, 0, 0], "z");
      return { connId, suppId };
    });

    // Wait for GLB geometries to load
    await page.waitForFunction(
      () => {
        const scene = (window as any).__scene;
        if (!scene) return false;
        let count = 0;
        scene.traverse((obj: any) => {
          if (obj.name?.startsWith("placed-") && obj.children?.length > 0) count++;
        });
        return count >= 2;
      },
      { timeout: 10_000 },
    );

    const result = await page.evaluate(async (ids: { connId: string; suppId: string }) => {
      const a = (window as any).__assembly;
      const { detectCollidingPartIdsMesh } = (window as any).__collision;
      const colliding = await detectCollidingPartIdsMesh(a);
      return {
        size: colliding.size,
        hasConn: colliding.has(ids.connId),
        hasSupp: colliding.has(ids.suppId),
      };
    }, ids);

    // Misaligned PT — should be detected as collision
    expect(result.hasConn).toBe(true);
    expect(result.hasSupp).toBe(true);
  });
});
