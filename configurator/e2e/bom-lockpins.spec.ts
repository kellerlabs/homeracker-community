import { test, expect } from "./fixtures";
import cuberack from "./fixtures/cuberack.json" with { type: "json" };

test.describe("BOM lock pin calculation with cuberack fixture", () => {
  test("cuberack has 24 lock pins needed (+ spare)", async ({
    appPage: page,
  }) => {
    // Load the cuberack fixture (skip custom-stl-1 which won't resolve)
    await page.evaluate((data) => {
      const a = (window as any).__assembly;
      a.clear();
      const filtered = {
        ...data,
        parts: data.parts.filter((p: any) => p.type !== "custom-stl-1"),
      };
      a.deserialize(filtered);
    }, cuberack);

    // Get BOM via assembly API
    const bom = await page.evaluate(() => {
      const a = (window as any).__assembly;
      return a.getBOM();
    });

    const lockPinEntry = bom.find(
      (e: any) => e.category === "lockpin"
    );

    expect(lockPinEntry).toBeTruthy();
    // 8 connectors × 3 arms each = 24 arms, all adjacent to supports
    // with 10% spare = ceil(24 * 1.1) = 27
    expect(lockPinEntry.name).toContain("auto: 24");
    expect(lockPinEntry.quantity).toBe(Math.ceil(24 * 1.1));
  });
});
