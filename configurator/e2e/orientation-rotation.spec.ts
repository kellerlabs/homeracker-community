import { test, expect, clickCatalogItem } from "./fixtures";

test.describe("Orientation-aware grid occupancy", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.evaluate(() => (window as any).__assembly.clear());
  });

  test("x-oriented support occupies cells along X axis", async ({
    appPage: page,
  }) => {
    const orientedId = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-3u", [0, 0, 0], [0, 0, 0], "x")
    );
    expect(orientedId).not.toBeNull();

    // Cell [1,0,0] should be occupied
    const occupied = await page.evaluate(() =>
      (window as any).__assembly.isOccupied([1, 0, 0])
    );
    expect(occupied).toBe(true);

    // Cell [2,0,0] should also be occupied
    const occupied2 = await page.evaluate(() =>
      (window as any).__assembly.isOccupied([2, 0, 0])
    );
    expect(occupied2).toBe(true);

    // Cell [0,1,0] should be free
    const free1 = await page.evaluate(() =>
      (window as any).__assembly.isOccupied([0, 1, 0])
    );
    expect(free1).toBe(false);

    // Cell [0,0,1] should also be free
    const free2 = await page.evaluate(() =>
      (window as any).__assembly.isOccupied([0, 0, 1])
    );
    expect(free2).toBe(false);
  });

  test("z-oriented support occupies cells along Z axis", async ({
    appPage: page,
  }) => {
    const orientedZ = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-3u", [0, 0, 0], [0, 0, 0], "z")
    );
    expect(orientedZ).not.toBeNull();

    const occupiedZ1 = await page.evaluate(() =>
      (window as any).__assembly.isOccupied([0, 0, 1])
    );
    expect(occupiedZ1).toBe(true);

    const freeY1 = await page.evaluate(() =>
      (window as any).__assembly.isOccupied([0, 1, 0])
    );
    expect(freeY1).toBe(false);
  });
});

test.describe("Placement always succeeds (no collision)", () => {
  test("parts can overlap freely", async ({
    appPage: page,
  }) => {
    const results = await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.clear();
      a.addPart("connector-3d6w", [3, 1, 0]);

      // All placements succeed — no collision system
      const id1 = a.addPart("support-3u", [0, 0, 0], [0, 0, 0], "y");
      const id2 = a.addPart("support-3u", [0, 0, 0], [0, 0, 0], "x");
      const id3 = a.addPart("support-3u", [1, 1, 0], [0, 0, 0], "x");

      return {
        placed1: id1 !== null,
        placed2: id2 !== null,
        placed3: id3 !== null,
      };
    });

    expect(results.placed1).toBe(true);
    expect(results.placed2).toBe(true);
    expect(results.placed3).toBe(true);
  });
});

test.describe("Rotation-aware grid occupancy", () => {
  test("90° X rotation moves cells from Y to Z axis", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.clear();

      // Place support-3u at [0,0,0] with 90° X rotation
      // Default gridCells: [0,0,0],[0,1,0],[0,2,0]
      // After 90° X: [x,y,z] → [x,-z,y], cells become [0,0,0],[0,0,1],[0,0,2]
      const id = a.addPart("support-3u", [0, 0, 0], [90, 0, 0]);

      const occupiedY1 = a.isOccupied([0, 1, 0]);
      const occupiedZ1 = a.isOccupied([0, 0, 1]);
      const occupiedZ2 = a.isOccupied([0, 0, 2]);

      return {
        placed: id !== null,
        occupiedY1,
        occupiedZ1,
        occupiedZ2,
      };
    });

    expect(result.placed).toBe(true);
    expect(result.occupiedZ1).toBe(true);
    expect(result.occupiedZ2).toBe(true);
    expect(result.occupiedY1).toBe(false);
  });
});

test.describe("Auto-lift: rotation pushes part above ground", () => {
  test("computeGroundLift returns correct offset for rotated support", async ({
    appPage: page,
  }) => {
    const results = await page.evaluate(() => {
      const lift = (window as any).__computeGroundLift;

      // Get support-3u definition (gridCells: [0,0,0],[0,1,0],[0,2,0])
      const def = { gridCells: [[0,0,0],[0,1,0],[0,2,0]], connectionPoints: [], category: "support" };

      return {
        // No rotation → minY = 0 → lift = 0
        noRot: lift(def, [0, 0, 0], "y"),
        // 90° X → cells become [0,0,0],[0,0,1],[0,0,2] → minY = 0 → lift = 0
        rot90x: lift(def, [90, 0, 0], "y"),
        // 180° X → cells become [0,0,0],[0,-1,0],[0,-2,0] → minY = -2 → lift = 2
        rot180x: lift(def, [180, 0, 0], "y"),
        // 270° X → cells become [0,0,0],[0,0,-1],[0,0,-2] → minY = 0 → lift = 0
        rot270x: lift(def, [270, 0, 0], "y"),
        // 90° Z → [x,y,z] → [-y,x,z] → cells [0,0,0],[-1,0,0],[-2,0,0] → minY = 0 → lift = 0
        rot90z: lift(def, [0, 0, 90], "y"),
      };
    });

    expect(results.noRot).toBe(0);
    expect(results.rot90x).toBe(0);
    expect(results.rot180x).toBe(2);
    expect(results.rot270x).toBe(0);
    expect(results.rot90z).toBe(0);
  });

  test("computeGroundLift accounts for connector arm directions", async ({
    appPage: page,
  }) => {
    const results = await page.evaluate(() => {
      const lift = (window as any).__computeGroundLift;

      // Simulate a connector with a -y arm (like 3d6w)
      const def = {
        gridCells: [[0, 0, 0]],
        connectionPoints: [
          { offset: [0, 0, 0], direction: "+y" },
          { offset: [0, 0, 0], direction: "-y" },
          { offset: [0, 0, 0], direction: "+x" },
        ],
        category: "connector",
      };

      return {
        // No rotation: -y arm → adjacent [0,-1,0] → lift = 1
        noRot: lift(def, [0, 0, 0], "y"),
        // 90° X rotation: -y becomes +z, so no arm below ground → lift = 0
        rot90x: lift(def, [90, 0, 0], "y"),
      };
    });

    expect(results.noRot).toBe(1);
    expect(results.rot90x).toBe(0);
  });

  test("support with 180° X rotation can be placed at lifted Y", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.clear();

      // Actually place it at the lifted position — always succeeds now
      const placedId = a.addPart("support-3u", [0, 2, 0], [180, 0, 0]);

      return { placed: placedId !== null };
    });

    expect(result.placed).toBe(true);
  });
});

test.describe("Orientation keyboard hint", () => {
  test("support hint mentions orientation, connector mentions rotate", async ({
    appPage: page,
  }) => {
    await clickCatalogItem(page, "Support (3u)");
    const supportHint = await page.evaluate(
      () => document.querySelector(".viewport-hint")?.textContent?.trim() ?? ""
    );
    expect(supportHint).toContain("orientation");

    await clickCatalogItem(page, "3D 6-Way");
    const connectorHint = await page.evaluate(
      () => document.querySelector(".viewport-hint")?.textContent?.trim() ?? ""
    );
    expect(connectorHint).toContain("rotate");
    expect(connectorHint).not.toContain("orientation");

    await page.keyboard.press("Escape");
  });
});
