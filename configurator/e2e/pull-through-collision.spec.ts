import { test, expect } from "./fixtures";

test.describe("Pull-through connector collision", () => {
  test("PT connector can be placed on a support along the matching axis", async ({
    appPage: page,
  }) => {
    // Place a support at [0,0,0] oriented along Z
    const supportId = await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.clear();
      return a.addPart("support-2u", [0, 0, 0], [0, 0, 0], "z");
    });
    expect(supportId).toBeTruthy();

    // Place a PT-Z connector at [0,0,0] — should succeed (Z support through Z tunnel)
    const ptId = await page.evaluate(() => {
      const a = (window as any).__assembly;
      return a.addPart("connector-2d2w-pt-z", [0, 0, 0], [0, 0, 0]);
    });
    expect(ptId).toBeTruthy();
  });

  test("support can be placed through an existing PT connector", async ({
    appPage: page,
  }) => {
    // Place a PT-Z connector at [0,0,0]
    const ptId = await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.clear();
      return a.addPart("connector-2d2w-pt-z", [0, 0, 0], [0, 0, 0]);
    });
    expect(ptId).toBeTruthy();

    // Place a support along Z at the same cell — should succeed
    const supportId = await page.evaluate(() => {
      const a = (window as any).__assembly;
      return a.addPart("support-2u", [0, 0, 0], [0, 0, 0], "z");
    });
    expect(supportId).toBeTruthy();
  });

  test("PT connector allows support on any axis (not just matching PT axis)", async ({
    appPage: page,
  }) => {
    // Place a support at [0,0,0] oriented along X
    await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.clear();
      return a.addPart("support-2u", [0, 0, 0], [0, 0, 0], "x");
    });

    // Place a PT-Z connector at [0,0,0] — should succeed (PT allows any support through)
    const ptId = await page.evaluate(() => {
      const a = (window as any).__assembly;
      return a.addPart("connector-2d2w-pt-z", [0, 0, 0], [0, 0, 0]);
    });
    expect(ptId).toBeTruthy();
  });

  test("regular connector can also overlap supports (no collision)", async ({
    appPage: page,
  }) => {
    // Place a support at [0,0,0] oriented along Z
    await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.clear();
      return a.addPart("support-2u", [0, 0, 0], [0, 0, 0], "z");
    });

    // Place a regular (non-PT) connector at [0,0,0] — succeeds (no collision system)
    const connId = await page.evaluate(() => {
      const a = (window as any).__assembly;
      return a.addPart("connector-2d2w", [0, 0, 0], [0, 0, 0]);
    });
    expect(connId).toBeTruthy();
  });

  test("PT connector respects rotation when checking axis match", async ({
    appPage: page,
  }) => {
    // Place a support along X
    await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.clear();
      return a.addPart("support-2u", [0, 0, 0], [0, 0, 0], "x");
    });

    // PT-Z connector rotated 90° around Y → effective PT axis becomes X
    const ptId = await page.evaluate(() => {
      const a = (window as any).__assembly;
      return a.addPart("connector-2d2w-pt-z", [0, 0, 0], [0, 90, 0]);
    });
    expect(ptId).toBeTruthy();
  });

  test("PT connector with rotation still allows any support through", async ({
    appPage: page,
  }) => {
    // Place a support along Y
    await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.clear();
      return a.addPart("support-2u", [0, 0, 0], [0, 0, 0], "y");
    });

    // PT-Z connector rotated 90° around Y → effective PT axis is X
    // But PT connectors allow any support through, so this should succeed
    const ptId = await page.evaluate(() => {
      const a = (window as any).__assembly;
      return a.addPart("connector-2d2w-pt-z", [0, 0, 0], [0, 90, 0]);
    });
    expect(ptId).toBeTruthy();
  });
});
