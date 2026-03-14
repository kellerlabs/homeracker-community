import { test, expect } from "./fixtures";

test.describe("Snap point discovery", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.evaluate(() => (window as any).__assembly.clear());
  });

  test("finds snap candidates near connector", async ({ appPage: page }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;
      a.clear();
      a.addPart("connector-3d6w", [5, 1, 5]);

      const points = snap.findSnapPoints(a, "support-3u", [5, 1, 5], 5);
      const orientations = points.map((p: any) => p.orientation);
      const directions = points.map((p: any) => p.socketDirection);

      return {
        count: points.length,
        orientations: [...new Set(orientations)],
        directions: [...new Set(directions)],
        hasZSnap: points.some(
          (p: any) => p.orientation === "z" && p.socketDirection === "+z"
        ),
        hasXSnap: points.some(
          (p: any) => p.orientation === "x" && p.socketDirection === "+x"
        ),
      };
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.hasZSnap).toBe(true);
    expect(result.hasXSnap).toBe(true);
    expect(result.orientations.length).toBeGreaterThanOrEqual(2);
  });

  test("findBestSnap returns nearest candidate", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;
      a.clear();
      a.addPart("connector-3d6w", [5, 1, 5]);

      const best = snap.findBestSnap(a, "support-3u", [6, 1, 5], 3);
      return best
        ? {
            position: best.position,
            orientation: best.orientation,
            direction: best.socketDirection,
          }
        : null;
    });

    expect(result).not.toBeNull();
    expect(result!.orientation).toBe("x");
  });

  test("snap excludes occupied positions", async ({ appPage: page }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;
      a.clear();

      a.addPart("connector-3d6w", [5, 1, 5]);
      a.addPart("support-3u", [6, 1, 5], [0, 0, 0], "x");

      const points = snap.findSnapPoints(a, "support-3u", [6, 1, 5], 5);
      const hasXSnap = points.some((p: any) => p.socketDirection === "+x");

      return { hasXSnap, count: points.length };
    });

    expect(result.hasXSnap).toBe(false);
    expect(result.count).toBeGreaterThan(0);
  });
});

test.describe("2D2W L-shape connector snap", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.evaluate(() => (window as any).__assembly.clear());
  });

  test("finds both arms of L-shape connector", async ({ appPage: page }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;
      a.clear();
      a.addPart("connector-2d2w", [5, 0, 5]);

      const points = snap.findSnapPoints(a, "support-5u", [5, 0, 5], 5);
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

    expect(result.totalCandidates).toBe(2);
    expect(result.hasZSnap).toBe(true);
    expect(result.hasXSnap).toBe(true);
    expect(result.zPos[2]).toBe(6);
    expect(result.xPos[0]).toBe(6);
    expect(result.zOrient).toBe("z");
    expect(result.xOrient).toBe("x");
  });

  test("placing support at +x snap occupies correct cells", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;
      a.clear();
      a.addPart("connector-2d2w", [5, 0, 5]);

      const points = snap.findSnapPoints(a, "support-5u", [5, 0, 5], 5);
      const xSnap = points.find((p: any) => p.socketDirection === "+x");
      if (!xSnap) return { placed: false, reason: "no +x snap found" };

      const id = a.addPart(
        "support-5u",
        xSnap.position,
        [0, 0, 0],
        xSnap.orientation
      );
      if (!id) return { placed: false, reason: "addPart returned null" };

      const expectedCells: [number, number, number][] = [
        [6, 0, 5],
        [7, 0, 5],
        [8, 0, 5],
        [9, 0, 5],
        [10, 0, 5],
      ];
      const allOccupied = expectedCells.every((c) => a.isOccupied(c));
      const connectorCellStillOccupied = a.isOccupied([5, 0, 5]);

      return { placed: true, allOccupied, connectorCellStillOccupied };
    });

    expect(result.placed).toBe(true);
    expect(result.allOccupied).toBe(true);
    expect(result.connectorCellStillOccupied).toBe(true);
  });

  test("no snap candidates after both slots filled", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;
      a.clear();
      a.addPart("connector-2d2w", [5, 0, 5]);

      // Fill +x
      const points1 = snap.findSnapPoints(a, "support-5u", [5, 0, 5], 5);
      const xSnap = points1.find((p: any) => p.socketDirection === "+x");
      if (xSnap) a.addPart("support-5u", xSnap.position, [0, 0, 0], xSnap.orientation);

      // Fill +z
      a.addPart("support-5u", [5, 0, 6], [0, 0, 0], "z");

      const points2 = snap.findSnapPoints(a, "support-5u", [5, 0, 5], 5);
      return {
        totalCandidates: points2.length,
        hasZSnap: points2.some((p: any) => p.socketDirection === "+z"),
        hasXSnap: points2.some((p: any) => p.socketDirection === "+x"),
      };
    });

    expect(result.totalCandidates).toBe(0);
    expect(result.hasZSnap).toBe(false);
    expect(result.hasXSnap).toBe(false);
  });
});

test.describe("Connector snap to vertical support top", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.evaluate(() => (window as any).__assembly.clear());
  });

  test("connector snaps to top of 5u support", async ({ appPage: page }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;
      a.clear();
      a.addPart("support-5u", [5, 0, 5], [0, 0, 0], "y");

      const points = snap.findConnectorSnapPoints(
        a,
        "connector-3d6w",
        [5, 0, 5],
        3
      );
      const topSnap = points.find((p: any) => p.socketDirection === "+y");
      const bottomSnap = points.find((p: any) => p.socketDirection === "-y");

      return {
        count: points.length,
        hasTopSnap: !!topSnap,
        topPos: topSnap?.position,
        hasBottomSnap: !!bottomSnap,
      };
    });

    expect(result.hasTopSnap).toBe(true);
    expect(result.topPos).toEqual([5, 5, 5]);
    expect(result.hasBottomSnap).toBe(false);
  });

  test("connector snaps to top of 10u support", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;
      a.clear();
      a.addPart("support-10u", [5, 0, 5], [0, 0, 0], "y");

      const points = snap.findConnectorSnapPoints(
        a,
        "connector-2d2w",
        [5, 0, 5],
        3
      );
      const topSnap = points.find((p: any) => p.socketDirection === "+y");

      return {
        hasTopSnap: !!topSnap,
        topPos: topSnap?.position,
      };
    });

    expect(result.hasTopSnap).toBe(true);
    expect(result.topPos?.[1]).toBe(10);
  });
});

test.describe("Ray-based snap proximity", () => {
  test("ray enables snap to elevated points", async ({ appPage: page }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;
      a.clear();

      a.addPart("support-10u", [5, 0, 5], [0, 0, 0], "y");

      // Without ray — cursor too far on XZ plane
      const withoutRay = snap.findConnectorSnapPoints(
        a,
        "connector-3d6w",
        [5, 0, 10],
        3
      );
      const topWithoutRay = withoutRay.find(
        (p: any) => p.socketDirection === "+y"
      );

      // With ray pointing toward support top
      const rayOrigin = [5, 20, 15] as [number, number, number];
      const rawDir = [0, -10, -10] as [number, number, number];
      const len = Math.sqrt(
        rawDir[0] ** 2 + rawDir[1] ** 2 + rawDir[2] ** 2
      );
      const rayDir = [
        rawDir[0] / len,
        rawDir[1] / len,
        rawDir[2] / len,
      ] as [number, number, number];
      const ray = { origin: rayOrigin, direction: rayDir };

      const withRay = snap.findConnectorSnapPoints(
        a,
        "connector-3d6w",
        [5, 0, 10],
        3,
        ray
      );
      const topWithRay = withRay.find(
        (p: any) => p.socketDirection === "+y"
      );

      return {
        hasTopWithoutRay: !!topWithoutRay,
        hasTopWithRay: !!topWithRay,
        topPos: topWithRay?.position,
      };
    });

    expect(result.hasTopWithoutRay).toBe(false);
    expect(result.hasTopWithRay).toBe(true);
    expect(result.topPos).toEqual([5, 10, 5]);
  });
});

test.describe("Move part (programmatic)", () => {
  test("move frees old position and occupies new", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.clear();

      const id = a.addPart("connector-3d6w", [0, 1, 0]);
      if (!id) return { success: false, reason: "failed to place" };

      const part = a.getPartById(id);
      if (!part) return { success: false, reason: "part not found" };

      a.removePart(id);
      const newId = a.addPart(
        part.definitionId,
        [3, 1, 3],
        part.rotation,
        part.orientation
      );

      return {
        success: newId !== null,
        oldFree: !a.isOccupied([0, 1, 0]),
        newOccupied: a.isOccupied([3, 1, 3]),
      };
    });

    expect(result.success).toBe(true);
    expect(result.oldFree).toBe(true);
    expect(result.newOccupied).toBe(true);
  });
});

test.describe("No page errors", () => {
  test("no unexpected page errors during test run", async ({
    appPage: page,
  }) => {
    // Page errors are collected by the appPage fixture
    // This test just validates the page loaded without issues
    const hasApp = await page.evaluate(() => !!document.querySelector(".app"));
    expect(hasApp).toBe(true);
  });
});
