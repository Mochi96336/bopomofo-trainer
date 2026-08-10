import { expect, test, type Page } from "@playwright/test";

async function openAnalysis(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  await expect(page.locator("#analysis-v2")).toBeVisible();
  await page.waitForTimeout(340);
}

test("keeps Coordination and Semantic keyboards on the same shared frame", async ({ page }) => {
  for (const width of [1440, 700]) {
    await page.setViewportSize({ width, height: 900 });
    await openAnalysis(page);
    const analysis = page.locator("#analysis-v2");

    const coordinationWidth = await analysis.locator(".analysis-v2-speed-board")
      .evaluate((node) => (node as HTMLElement).offsetWidth);

    await analysis.locator('[data-tab="semantic"]').click();
    const semantic = await analysis.evaluate((host) => {
      const keyboard = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-primary .analysis-v2-keyboard",
      )!;
      const slot = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-primary .analysis-v2-primary-object-slot",
      )!;
      return {
        keyboardWidth: keyboard.offsetWidth,
        slotWidth: slot.clientWidth,
      };
    });

    const expectedWidth = Math.min(760, width * 0.92);
    expect(Math.abs(coordinationWidth - expectedWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(semantic.slotWidth - expectedWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(semantic.keyboardWidth - semantic.slotWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(semantic.keyboardWidth - coordinationWidth)).toBeLessThanOrEqual(1);
  }
});

test("keeps the fixed desktop composition collision-free immediately above the short-height fallback", async ({ page }) => {
  for (const height of [621, 640, 664]) {
    await page.setViewportSize({ width: 1440, height });
    await openAnalysis(page);
    const analysis = page.locator("#analysis-v2");

    const coordination = await analysis.evaluate((host) => {
      const slot = host.querySelector<HTMLElement>(
        ".analysis-v2-speed-primary .analysis-v2-primary-object-slot",
      )!;
      const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
      const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout")!;
      return {
        slotPosition: getComputedStyle(slot).position,
        readoutGap: readout.getBoundingClientRect().top - board.getBoundingClientRect().bottom,
      };
    });

    expect(coordination.slotPosition).toBe("fixed");
    expect(coordination.readoutGap).toBeGreaterThanOrEqual(-1);

    await analysis.locator('[data-tab="semantic"]').click();
    await analysis.locator('[data-action="select-key"]').first().click();

    const semantic = await analysis.evaluate((host) => {
      const slot = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-primary .analysis-v2-primary-object-slot",
      )!;
      const board = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-primary .analysis-v2-keyboard",
      )!;
      const inspector = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-stage.has-selection > .analysis-v2-inspector",
      )!;
      const rail = host.querySelector<HTMLElement>(".analysis-v2-semantic-rail")!;
      const boardRect = board.getBoundingClientRect();
      const inspectorRect = inspector.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      return {
        slotPosition: getComputedStyle(slot).position,
        inspectorGap: inspectorRect.top - boardRect.bottom,
        railGap: railRect.top - inspectorRect.bottom,
      };
    });

    expect(semantic.slotPosition).toBe("fixed");
    expect(semantic.inspectorGap).toBeGreaterThanOrEqual(-1);
    expect(semantic.railGap).toBeGreaterThanOrEqual(-1);
  }
});
