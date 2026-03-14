import { test, expect } from "./fixtures";

test.describe("Part color", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.evaluate(() => (window as any).__assembly.clear());
  });

  test("setPartColor persists on the data model", async ({ appPage: page }) => {
    const id = await page.evaluate(() =>
      (window as any).__assembly.addPart("connector-3d6w", [0, 1, 0])
    );
    expect(id).not.toBeNull();

    await page.evaluate(
      ([id]) => (window as any).__assembly.setPartColor(id, "#ff0000"),
      [id]
    );

    const color = await page.evaluate(
      ([id]) => (window as any).__assembly.getPartById(id)?.color,
      [id]
    );
    expect(color).toBe("#ff0000");
  });

  test("setPartColor undefined resets to default", async ({ appPage: page }) => {
    const id = await page.evaluate(() =>
      (window as any).__assembly.addPart("connector-3d6w", [0, 1, 0])
    );

    await page.evaluate(
      ([id]) => {
        const a = (window as any).__assembly;
        a.setPartColor(id, "#ff0000");
        a.setPartColor(id, undefined);
      },
      [id]
    );

    const color = await page.evaluate(
      ([id]) => (window as any).__assembly.getPartById(id)?.color,
      [id]
    );
    expect(color).toBeUndefined();
  });

  test("color picker hidden when nothing selected", async ({ appPage: page }) => {
    await page.evaluate(() =>
      (window as any).__assembly.addPart("connector-3d6w", [0, 1, 0])
    );
    const visible = await page.evaluate(
      () => !!document.querySelector(".color-picker")
    );
    expect(visible).toBe(false);
  });

  test("color survives serialize/deserialize roundtrip", async ({ appPage: page }) => {
    await page.evaluate(() => {
      const a = (window as any).__assembly;
      const id = a.addPart("support-3u", [0, 0, 0]);
      a.setPartColor(id, "#00ff00");
    });

    const color = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const data = a.serialize("test");
      a.clear();
      a.deserialize(data);
      const parts = a.getAllParts();
      return parts[0]?.color;
    });

    expect(color).toBe("#00ff00");
  });

  test("color preserved when added via addPart parameter", async ({ appPage: page }) => {
    const id = await page.evaluate(() =>
      (window as any).__assembly.addPart("support-3u", [0, 0, 0], [0, 0, 0], undefined, "#abcdef")
    );

    const color = await page.evaluate(
      ([id]) => (window as any).__assembly.getPartById(id)?.color,
      [id]
    );
    expect(color).toBe("#abcdef");
  });

  test("setPartsColor sets color for multiple parts", async ({ appPage: page }) => {
    const colors = await page.evaluate(() => {
      const a = (window as any).__assembly;
      const id1 = a.addPart("support-3u", [0, 0, 0]);
      const id2 = a.addPart("support-3u", [1, 0, 0]);
      a.setPartsColor([id1, id2], "#ff8c00");
      return [
        a.getPartById(id1)?.color,
        a.getPartById(id2)?.color,
      ];
    });

    expect(colors[0]).toBe("#ff8c00");
    expect(colors[1]).toBe("#ff8c00");
  });

  test("color not included in serialization when undefined", async ({ appPage: page }) => {
    const data = await page.evaluate(() => {
      const a = (window as any).__assembly;
      a.addPart("support-3u", [0, 0, 0]);
      return a.serialize("test");
    });

    expect(data.parts[0].color).toBeUndefined();
    expect("color" in data.parts[0]).toBe(false);
  });
});
