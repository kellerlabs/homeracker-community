import { test, expect } from "./fixtures";

test.describe("FitCamera on load", () => {
  test("camera target moves to assembly center on reload with parts", async ({
    appPage: page,
  }) => {
    // Place parts far from origin so the assembly center is clearly non-zero
    await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.clear();
      a.addPart("connector-2d2w", [0, 0, 0]);
      a.addPart("connector-2d2w", [20, 0, 0]);
      a.addPart("connector-2d2w", [0, 0, 20]);
    });

    // Reload — parts persist via localStorage, FitCamera runs on mount
    await page.reload();
    await page.waitForSelector(".app", { timeout: 10_000 });
    await page.waitForFunction(
      () => !!(window as any).__controls?.target && !!(window as any).__camera,
      { timeout: 10_000 },
    );

    const result = await page.evaluate(() => {
      const controls = (window as any).__controls;
      const camera = (window as any).__camera;
      if (!controls?.target || !camera) return null;
      return {
        targetX: controls.target.x,
        targetY: controls.target.y,
        targetZ: controls.target.z,
        camX: camera.position.x,
        camY: camera.position.y,
        camZ: camera.position.z,
      };
    });

    expect(result).not.toBeNull();

    // FitCamera should set the OrbitControls target to the assembly center.
    // Parts at grid [0,0,0], [20,0,0], [0,0,20] with BASE_UNIT=15
    // → world center is well above 0 in X and Z.
    // Without FitCamera the target stays at origin (0,0,0).
    expect(result!.targetX).toBeGreaterThan(10);
    expect(result!.targetZ).toBeGreaterThan(10);

    // Camera should be above the ground
    expect(result!.camY).toBeGreaterThan(0);
  });

  test("camera target stays at origin when no parts are placed", async ({
    appPage: page,
  }) => {
    // Clear any existing parts and reload
    await page.evaluate(() => {
      (window as any).__assembly.clear();
    });

    await page.reload();
    await page.waitForSelector(".app", { timeout: 10_000 });
    await page.waitForFunction(
      () => !!(window as any).__controls?.target,
      { timeout: 10_000 },
    );

    const result = await page.evaluate(() => {
      const controls = (window as any).__controls;
      if (!controls?.target) return null;
      return {
        targetX: controls.target.x,
        targetY: controls.target.y,
        targetZ: controls.target.z,
      };
    });

    expect(result).not.toBeNull();

    // With no parts, FitCamera should NOT run — target stays at default (0,0,0)
    expect(result!.targetX).toBeCloseTo(0, 0);
    expect(result!.targetY).toBeCloseTo(0, 0);
    expect(result!.targetZ).toBeCloseTo(0, 0);
  });
});
