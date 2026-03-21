import { test, expect } from "./fixtures";

/**
 * Create a minimal binary STL with two triangles separated by a gap.
 * Triangle 1 is fully inside grid cell [0,0,0] (x: 2-12mm).
 * Triangle 2 is fully inside grid cell [2,0,0] (x: 32-42mm).
 * Cell [1,0,0] (x: 15-30mm) has NO geometry.
 * Bounding box spans 3 cells (40mm x 10mm x 10mm → 3x1x1 grid).
 */
function createSparseSTL(): ArrayBuffer {
  const triCount = 2;
  const bufLen = 80 + 4 + triCount * 50;
  const buf = new ArrayBuffer(bufLen);
  const view = new DataView(buf);
  let offset = 80; // skip header
  view.setUint32(offset, triCount, true);
  offset += 4;

  // Helper to write a triangle (normal + 3 vertices + attribute)
  function writeTri(
    nx: number, ny: number, nz: number,
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
  ) {
    for (const v of [nx, ny, nz, x0, y0, z0, x1, y1, z1, x2, y2, z2]) {
      view.setFloat32(offset, v, true);
      offset += 4;
    }
    view.setUint16(offset, 0, true); // attribute byte count
    offset += 2;
  }

  // Triangle 1: inside cell [0,0,0] (BASE_UNIT=15, so x: 0-14.99 is cell 0)
  writeTri(0, 0, 1, 2, 2, 2, 12, 2, 2, 2, 12, 12);
  // Triangle 2: inside cell [2,0,0] (x: 30-44.99 is cell 2)
  writeTri(0, 0, 1, 32, 2, 2, 42, 2, 2, 32, 12, 12);

  return buf;
}

test.describe("Sparse collision: perpendicular supports can cross", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.evaluate(() => (window as any).__assembly.clear());
  });

  test("vertical and horizontal supports can share a cell", async ({
    appPage: page,
  }) => {
    // Place a vertical support (y-oriented) spanning cells [0,0,0] to [0,4,0]
    const verticalId = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-5u", [0, 0, 0], [0, 0, 0], "y")
    );
    expect(verticalId).not.toBeNull();

    // Place a horizontal support (x-oriented) at [0,2,0] spanning [-2..2, 2, 0]
    // This crosses the vertical support at cell [0,2,0]
    const horizontalId = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-5u", [-2, 2, 0], [0, 0, 0], "x")
    );

    // Currently fails because cell [0,2,0] is occupied by the vertical support.
    // After the fix, this should succeed because supports on different axes
    // are thin bars that don't physically collide.
    expect(horizontalId).not.toBeNull();
  });

  test("three perpendicular supports can all share one cell", async ({
    appPage: page,
  }) => {
    // Place Y-axis support spanning [0,0,0] to [0,2,0]
    const yId = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-3u", [0, 0, 0], [0, 0, 0], "y")
    );
    expect(yId).not.toBeNull();

    // Place X-axis support crossing at [0,1,0]
    const xId = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-3u", [-1, 1, 0], [0, 0, 0], "x")
    );
    expect(xId).not.toBeNull();

    // Place Z-axis support also crossing at [0,1,0]
    const zId = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-3u", [0, 1, -1], [0, 0, 0], "z")
    );
    expect(zId).not.toBeNull();
  });

  test("same-axis supports can overlap (no collision)", async ({
    appPage: page,
  }) => {
    // Place a vertical support at [0,0,0]
    const id1 = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-5u", [0, 0, 0], [0, 0, 0], "y")
    );
    expect(id1).not.toBeNull();

    // Place another vertical support overlapping at [0,0,0] — succeeds (no collision system)
    const id2 = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-3u", [0, 0, 0], [0, 0, 0], "y")
    );
    expect(id2).not.toBeNull();
  });

  test("connector and support can overlap (no collision)", async ({
    appPage: page,
  }) => {
    // Connector at [0,1,0]
    const connId = await page.evaluate(() =>
      (window as any).__assembly.addPart("connector-3d6w", [0, 1, 0])
    );
    expect(connId).not.toBeNull();

    // Support crossing through the connector cell — succeeds (no collision system)
    const supportId = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-3u", [-1, 1, 0], [0, 0, 0], "x")
    );
    expect(supportId).not.toBeNull();
  });

  test("custom part with hollow interior allows placement inside", async ({
    appPage: page,
  }) => {
    // Import a sparse STL: geometry in cells [0,0,0] and [2,0,0],
    // but cell [1,0,0] is empty (hollow interior).
    // Bounding box spans 3 cells, but only 2 have actual triangles.
    const stlBuffer = createSparseSTL();
    const stlBytes = new Uint8Array(stlBuffer);

    const customId = await page.evaluate(async (bytes: number[]) => {
      const buffer = new Uint8Array(bytes).buffer;
      const file = new File([buffer], "sparse-frame.stl");
      const defs = await (window as any).__importSTL(file);
      return defs[0].id as string;
    }, Array.from(stlBytes));

    expect(customId).toBeTruthy();

    // Place the custom part at [0,0,0]
    const placed = await page.evaluate((id: string) =>
      (window as any).__assembly.addPart(id, [0, 0, 0]),
      customId
    );
    expect(placed).not.toBeNull();

    // The hollow interior (cell [1,0,0]) should NOT be occupied.
    // A support along Y-axis at [1,0,0] should be placeable.
    const supportId = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-1u", [1, 0, 0], [0, 0, 0], "y")
    );

    // This FAILS with the current code because importSTL fills the entire
    // bounding box, marking cell [1,0,0] as occupied by the custom part.
    // After the fix (voxelization), cell [1,0,0] will be empty.
    expect(supportId).not.toBeNull();
  });
});
