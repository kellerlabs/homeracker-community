import { test, expect, clickCatalogItem } from "./fixtures";

test.describe("Layout", () => {
  test("app container and panels render", async ({ appPage: page }) => {
    const layout = await page.evaluate(() => ({
      app: !!document.querySelector(".app"),
      sidebar: !!document.querySelector(".sidebar"),
      mainArea: !!document.querySelector(".main-area"),
      toolbar: !!document.querySelector(".toolbar"),
      viewport: !!document.querySelector(".viewport"),
      bomPanel: !!document.querySelector(".bom-panel"),
    }));

    expect(layout.app).toBe(true);
    expect(layout.sidebar).toBe(true);
    expect(layout.mainArea).toBe(true);
    expect(layout.toolbar).toBe(true);
    expect(layout.viewport).toBe(true);
    expect(layout.bomPanel).toBe(true);
  });
});

test.describe("Catalog", () => {
  test("has 36 items and none active initially", async ({
    appPage: page,
  }) => {
    const catalogItems = await page.evaluate(() => {
      const items = document.querySelectorAll(".catalog-item");
      return Array.from(items).map((el) => ({
        name:
          el.querySelector(".catalog-item-name")?.textContent?.trim() ?? "",
        active: el.classList.contains("active"),
      }));
    });

    expect(catalogItems.length).toBe(79);
    expect(catalogItems.every((i) => !i.active)).toBe(true);
  });

  test("contains expected part names", async ({ appPage: page }) => {
    const catalogNames = await page.evaluate(() => {
      const items = document.querySelectorAll(".catalog-item");
      return Array.from(items).map(
        (el) =>
          el.querySelector(".catalog-item-name")?.textContent?.trim() ?? ""
      );
    });

    const expectedParts = [
      "Support (1u)",
      "Support (5u)",
      "Support (10u)",
      "Support (18u)",
      "1D 1-Way",
      "1D 2-Way",
      "2D 2-Way",
      "2D 3-Way",
      "2D 4-Way",
      "3D 3-Way",
      "3D 4-Way",
      "3D 5-Way",
      "3D 6-Way",
      "2D 2-Way Foot",
      "3D 4-Way Foot",
      "Lock Pin",
      "Lock Pin (No Grip)",
    ];
    for (const name of expectedParts) {
      expect(catalogNames).toContain(name);
    }
  });
});

test.describe("Placement mode", () => {
  test("clicking catalog item enters placement mode", async ({
    appPage: page,
  }) => {
    await clickCatalogItem(page, "3D 6-Way");

    const afterClick = await page.evaluate(() => {
      const items = document.querySelectorAll(".catalog-item");
      const activeItem = Array.from(items).find((el) =>
        el.classList.contains("active")
      );
      const hint = document.querySelector(".viewport-hint");
      return {
        activeName:
          activeItem
            ?.querySelector(".catalog-item-name")
            ?.textContent?.trim() ?? null,
        hintVisible: !!hint,
        hintText: hint?.textContent?.trim() ?? null,
      };
    });

    expect(afterClick.activeName).toBe("3D 6-Way");
    expect(afterClick.hintVisible).toBe(true);
    expect(afterClick.hintText).toContain("Click to place");
  });

  test("Escape exits placement mode", async ({ appPage: page }) => {
    await clickCatalogItem(page, "3D 6-Way");
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector(".catalog-item.active"),
      { timeout: 3_000 },
    );

    const afterEscape = await page.evaluate(() => {
      const items = document.querySelectorAll(".catalog-item");
      const activeItem = Array.from(items).find((el) =>
        el.classList.contains("active")
      );
      const hint = document.querySelector(".viewport-hint");
      return {
        anyActive: !!activeItem,
        hintVisible: !!hint,
      };
    });

    expect(afterEscape.anyActive).toBe(false);
    expect(afterEscape.hintVisible).toBe(false);
  });

  test("switching between catalog items", async ({ appPage: page }) => {
    await clickCatalogItem(page, "Support (5u)");
    const active1 = await page.evaluate(() => {
      const active = document.querySelector(
        ".catalog-item.active .catalog-item-name"
      );
      return active?.textContent?.trim() ?? null;
    });
    expect(active1).toBe("Support (5u)");

    await clickCatalogItem(page, "Lock Pin");
    const active2 = await page.evaluate(() => {
      const active = document.querySelector(
        ".catalog-item.active .catalog-item-name"
      );
      return active?.textContent?.trim() ?? null;
    });
    expect(active2).toBe("Lock Pin");
  });
});

test.describe("Ghost preview", () => {
  test("data-placing attribute matches selected part", async ({
    appPage: page,
  }) => {
    const partNameToId: Record<string, string> = {
      "1D 1-Way": "connector-1d1w",
      "1D 2-Way": "connector-1d2w",
      "2D 2-Way": "connector-2d2w",
      "2D 3-Way": "connector-2d3w",
      "2D 4-Way": "connector-2d4w",
      "3D 3-Way": "connector-3d3w",
      "3D 4-Way": "connector-3d4w",
      "3D 5-Way": "connector-3d5w",
      "3D 6-Way": "connector-3d6w",
      "2D 2-Way Foot": "connector-2d2w-foot",
      "3D 4-Way Foot": "connector-3d4w-foot",
      "3D 6-Way Foot": "connector-3d6w-foot",
      "Support (1u)": "support-1u",
      "Support (3u)": "support-3u",
      "Support (10u)": "support-10u",
      "Support (18u)": "support-18u",
      "Lock Pin": "lockpin-standard",
      "Lock Pin (No Grip)": "lockpin-no-grip",
    };

    for (const [partName, expectedId] of Object.entries(partNameToId)) {
      await clickCatalogItem(page, partName);
      const placing = await page.evaluate(
        () =>
          document.querySelector(".viewport")?.getAttribute("data-placing") ??
          null
      );
      expect(placing, `Ghost for "${partName}"`).toBe(expectedId);
    }

    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !document.querySelector(".viewport")?.getAttribute("data-placing"),
      { timeout: 3_000 },
    );
    const noGhost = await page.evaluate(
      () =>
        document.querySelector(".viewport")?.getAttribute("data-placing") ??
        null
    );
    expect(noGhost).toBeNull();
  });
});
