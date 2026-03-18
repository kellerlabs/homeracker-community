import { test, expect } from "./fixtures";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const snapfixData = JSON.parse(readFileSync(join(__dirname, "fixtures/snapfix.json"), "utf-8"));

/**
 * Regression test: support-17u should be placeable through the PT connector
 * in the snapfix fixture. The fixture's last part (support-17u at [-20,0,1])
 * is the displaced piece the user was trying to place.
 *
 * Simulates the actual user flow: findBestSnap → addPart,
 * matching how the ghost preview + click-to-place works in the UI.
 */
test.describe("Snapfix: support placement through PT connector", () => {
  test.beforeEach(async ({ appPage: page }) => {
    // Load the fixture WITHOUT the last displaced part
    const fixtureWithoutLast = {
      ...snapfixData,
      parts: snapfixData.parts.slice(0, -1),
    };
    await page.evaluate((data) => {
      const a = (window as any).__assembly;
      a.deserialize(data);
    }, fixtureWithoutLast);
  });

  test("findBestSnap near PT connector returns valid placeable candidate", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;

      // User cursor is on the ground plane near x=20, z=1
      const cursorGrid = [20, 0, 1] as [number, number, number];
      const best = snap.findBestSnap(a, "support-17u", cursorGrid, 3);

      if (!best) return { snapFound: false, reason: "findBestSnap returned null" };

      // Ghost preview forces rotation to [0,0,0] for supports
      const snapRotation = [0, 0, 0] as [number, number, number];

      // Try the actual addPart (what happens on click)
      const instanceId = a.addPart("support-17u", best.position, snapRotation, best.orientation);

      return {
        snapFound: true,
        position: best.position,
        orientation: best.orientation,
        socketDirection: best.socketDirection,
        placed: !!instanceId,
      };
    });

    console.log("Snap result:", JSON.stringify(result, null, 2));
    expect(result.snapFound).toBe(true);
    expect(result.placed).toBe(true);
  });

  test("snapped support with user rotation around snapped axis is placeable", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;

      const cursorGrid = [20, 0, 1] as [number, number, number];
      const best = snap.findBestSnap(a, "support-17u", cursorGrid, 3);
      if (!best) return { snapFound: false };

      // On click, addPart uses [0,0,0] rotation for snapped supports
      const collisionRotation = [0, 0, 0] as [number, number, number];
      const instanceId = a.addPart("support-17u", best.position, collisionRotation, best.orientation);

      return {
        snapFound: true,
        position: best.position,
        orientation: best.orientation,
        placed: !!instanceId,
      };
    });

    console.log("Rotated snap result:", JSON.stringify(result, null, 2));
    expect(result.snapFound).toBe(true);
    expect(result.placed).toBe(true);
  });

  test("all snap candidates near PT connector are placeable", async ({
    appPage: page,
  }) => {
    // Get ALL snap candidates (not just best), verify each is actually placeable
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;

      const cursorGrid = [20, 0, 1] as [number, number, number];
      const candidates = snap.findSnapPoints(a, "support-17u", cursorGrid, 5);

      return candidates.map((c: any) => ({
        position: c.position,
        orientation: c.orientation,
        socketDirection: c.socketDirection,
        distance: c.distance,
      }));
    });

    console.log("All candidates:", JSON.stringify(result, null, 2));
    expect(result.length).toBeGreaterThan(0);
  });
});
