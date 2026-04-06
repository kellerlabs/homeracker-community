import { test, expect, waitForApp } from "./fixtures";

const CAMERA_MODE_STORAGE_KEY = "homeracker-camera-orthographic";

test.describe("Camera views", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.evaluate((key) => {
      localStorage.removeItem(key);
      (window as any).__assembly.clear();
    }, CAMERA_MODE_STORAGE_KEY);
    await page.reload();
    await waitForApp(page);
  });

  test("camera toggle renders with perspective as default", async ({ appPage: page }) => {
    const result = await page.evaluate(() => {
      const toggle = document.querySelector(".viewport-camera-toggle");
      const camera = (window as any).__camera as any;
      return {
        exists: !!toggle,
        label: toggle?.textContent?.trim() ?? null,
        isPerspective: !!camera?.isPerspectiveCamera,
      };
    });

    expect(result.exists).toBe(true);
    expect(result.label).toContain("PERSP");
    expect(result.isPerspective).toBe(true);
  });

  test("toggle switches to orthographic camera", async ({ appPage: page }) => {
    await page.click(".viewport-camera-toggle");

    await page.waitForFunction(() => {
      const camera = (window as any).__camera as any;
      const label = document.querySelector(".viewport-camera-toggle")?.textContent ?? "";
      return !!camera?.isOrthographicCamera && label.includes("ORTHO");
    }, { timeout: 5_000 });

    const result = await page.evaluate((key) => {
      const camera = (window as any).__camera as any;
      return {
        isOrthographic: !!camera?.isOrthographicCamera,
        persisted: localStorage.getItem(key),
      };
    }, CAMERA_MODE_STORAGE_KEY);

    expect(result.isOrthographic).toBe(true);
    expect(result.persisted).toBe("1");
  });

  test("camera mode persists after reload", async ({ appPage: page }) => {
    await page.click(".viewport-camera-toggle");
    await page.waitForFunction(() => !!(window as any).__camera?.isOrthographicCamera, { timeout: 5_000 });

    await page.reload();
    await waitForApp(page);

    await page.waitForFunction(() => {
      const camera = (window as any).__camera as any;
      const label = document.querySelector(".viewport-camera-toggle")?.textContent ?? "";
      return !!camera?.isOrthographicCamera && label.includes("ORTHO");
    }, { timeout: 5_000 });

    const persisted = await page.evaluate((key) => localStorage.getItem(key), CAMERA_MODE_STORAGE_KEY);
    expect(persisted).toBe("1");
  });

  test("toggle switches back to perspective camera", async ({ appPage: page }) => {
    await page.click(".viewport-camera-toggle");
    await page.waitForFunction(() => !!(window as any).__camera?.isOrthographicCamera, { timeout: 5_000 });

    await page.click(".viewport-camera-toggle");
    await page.waitForFunction(() => {
      const camera = (window as any).__camera as any;
      const label = document.querySelector(".viewport-camera-toggle")?.textContent ?? "";
      return !!camera?.isPerspectiveCamera && label.includes("PERSP");
    }, { timeout: 5_000 });

    const result = await page.evaluate((key) => {
      const camera = (window as any).__camera as any;
      return {
        isPerspective: !!camera?.isPerspectiveCamera,
        persisted: localStorage.getItem(key),
      };
    }, CAMERA_MODE_STORAGE_KEY);

    expect(result.isPerspective).toBe(true);
    expect(result.persisted).toBe("0");
  });
});
