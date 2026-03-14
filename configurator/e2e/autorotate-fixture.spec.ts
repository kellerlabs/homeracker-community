import { test, expect } from "./fixtures";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureData = JSON.parse(readFileSync(join(__dirname, "fixtures/autorotate.json"), "utf-8"));

/**
 * Regression test: connector snap at a junction should land at the correct Y
 * and auto-rotate to face the converging supports.
 *
 * The fixture has a rack with 4 supports converging at [0, 15, -3] but no
 * connector placed there yet. A connector-3d4w should snap to that position
 * (Y=15), NOT jump to a higher Y.
 */
test.describe("Autorotate fixture: connector snap Y-height", () => {
  test.beforeEach(async ({ appPage: page }) => {
    // Load fixture, filtering out custom parts that won't exist in test env
    const filteredFixture = {
      ...fixtureData,
      parts: fixtureData.parts.filter(
        (p: { type: string }) => !p.type.startsWith("custom-")
      ),
    };
    await page.evaluate((data) => {
      const a = (window as any).__assembly;
      a.deserialize(data);
    }, filteredFixture);
  });

  test("connector snaps to correct Y at junction [0,15,-3]", async ({
    appPage: page,
  }) => {
    // The junction at [0, 15, -3] has 4 support endpoints converging:
    // - support-13u at [0,2,-3] y-oriented: top endpoint [0,14,-3], outward +y
    // - support-18u at [0,15,-2] z-oriented: first endpoint [0,15,-2], outward -z
    // - support-17u at [1,15,-3] x-oriented: first endpoint [1,15,-3], outward -x
    // - support-6u at [0,16,-3] y-oriented: first endpoint [0,16,-3], outward -y
    //
    // Connector should snap to [0, 15, -3], NOT to a higher Y like [0, 22, -3]
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;

      // Simulate cursor near the junction on the ground plane
      const cursorGrid = [0, 0, -3] as [number, number, number];
      const best = snap.findBestConnectorSnap(a, "connector-3d4w", cursorGrid, 3);

      if (!best) return { snapFound: false };
      return {
        snapFound: true,
        position: best.position,
        autoRotation: best.autoRotation,
      };
    });

    expect(result.snapFound).toBe(true);
    // The snap should land at Y=15, not jump to a higher position
    expect(result.position[1]).toBe(15);
    expect(result.position).toEqual([0, 15, -3]);
  });

  test("auto-rotation covers all 4 needed directions at junction", async ({
    appPage: page,
  }) => {
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;

      const cursorGrid = [0, 0, -3] as [number, number, number];
      const best = snap.findBestConnectorSnap(a, "connector-3d4w", cursorGrid, 3);

      if (!best) return { snapFound: false, neededDirs: [], autoRotation: null };

      // Manually verify the auto-rotation covers the needed directions
      // by checking which arms the rotation produces
      return {
        snapFound: true,
        position: best.position,
        autoRotation: best.autoRotation,
        socketDirection: best.socketDirection,
      };
    });

    expect(result.snapFound).toBe(true);
    expect(result.autoRotation).not.toBeNull();

    // Verify that the auto-rotation, when applied to connector-3d4w arms,
    // covers the 4 needed directions: -y, +z, +x, +y
    // connector-3d4w base arms: [+z, -z, +x, +y]
    const armsCovered = await page.evaluate((rotation: number[]) => {
      // Use rotateDirection to check where each arm points after rotation
      const gridUtils = (window as any).__gridUtils;
      if (!gridUtils) return null;

      const baseArms = ["+z", "-z", "+x", "+y"];
      return baseArms.map((arm: string) =>
        gridUtils.rotateDirection(arm, rotation)
      );
    }, result.autoRotation);

    if (armsCovered) {
      // The needed directions at this junction are: -y, +z, +x, +y
      const needed = ["-y", "+z", "+x", "+y"];
      const covered = needed.filter((d) => armsCovered.includes(d));
      expect(covered.length).toBe(4);
    }
  });

  test("snap position is not affected by ground lift", async ({
    appPage: page,
  }) => {
    // This test ensures the snap Y doesn't get inflated by computeGroundLift
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;

      // Try multiple cursor positions — snap should consistently land at Y=15
      const positions = [
        [0, 0, -3],
        [1, 0, -3],
        [-1, 0, -3],
        [0, 0, -2],
      ] as [number, number, number][];

      const results = positions.map((cursor) => {
        const best = snap.findBestConnectorSnap(a, "connector-3d4w", cursor, 3);
        return best ? { pos: best.position, y: best.position[1] } : null;
      });

      return results;
    });

    // All snaps that find the junction should have Y=15
    for (const r of result) {
      if (r && r.pos[0] === 0 && r.pos[2] === -3) {
        expect(r.y).toBe(15);
      }
    }
  });

  test("diagnostic: all snap candidates with positions and distances", async ({
    appPage: page,
  }) => {
    // Diagnostic test: dump all snap candidates to understand what positions
    // are available and which one might win with different cursor/ray combos
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;

      // Use larger radius to see ALL possible snap positions
      const cursorGrid = [0, 0, -3] as [number, number, number];
      const candidates = snap.findConnectorSnapPoints(
        a, "connector-3d4w", cursorGrid, 50
      );

      // Collect unique positions with their distances
      const posMap = new Map<string, { pos: number[]; distance: number; count: number; socketDirs: string[] }>();
      for (const c of candidates) {
        const key = c.position.join(",");
        const existing = posMap.get(key);
        if (existing) {
          existing.count++;
          existing.socketDirs.push(c.socketDirection);
        } else {
          posMap.set(key, {
            pos: c.position,
            distance: c.distance,
            count: 1,
            socketDirs: [c.socketDirection],
          });
        }
      }

      return {
        totalCandidates: candidates.length,
        uniquePositions: [...posMap.values()].sort((a, b) => a.distance - b.distance),
      };
    });

    console.log("Total candidates:", result.totalCandidates);
    console.log("Unique snap positions (sorted by distance):");
    for (const p of result.uniquePositions) {
      console.log(`  [${p.pos}] dist=${p.distance.toFixed(3)} supports=${p.count} dirs=[${p.socketDirs}]`);
    }

    // The closest position should be [0, 15, -3]
    expect(result.uniquePositions.length).toBeGreaterThan(0);
    expect(result.uniquePositions[0].pos).toEqual([0, 15, -3]);
  });

  test("snap with ray from above selects correct Y position", async ({
    appPage: page,
  }) => {
    // Simulate a camera ray looking downward at the junction
    // Camera is above and slightly behind, looking down at the junction
    const result = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const snap = (window as any).__snap;

      const cursorGrid = [0, 0, -3] as [number, number, number];
      // Simulate a ray from above pointing down (camera above the scene)
      const ray = {
        origin: [0, 40, -3] as [number, number, number],  // above the scene
        direction: [0, -1, 0] as [number, number, number],  // looking straight down
      };

      const best = snap.findBestConnectorSnap(a, "connector-3d4w", cursorGrid, 3, ray);
      if (!best) return { snapFound: false };

      return {
        snapFound: true,
        position: best.position,
        autoRotation: best.autoRotation,
      };
    });

    expect(result.snapFound).toBe(true);
    // Even with a ray from above, snap should pick Y=15, not Y=22
    expect(result.position[1]).toBe(15);
  });
});
