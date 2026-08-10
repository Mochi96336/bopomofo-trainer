import { expect, test, type Page } from "@playwright/test";

async function openAnalysis(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  await expect(page.locator("#analysis-v2")).toBeVisible();
  await page.waitForTimeout(340);
}

async function semanticSelectionGap(page: Page, height: number): Promise<number> {
  await page.setViewportSize({ width: 1440, height });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="semantic"]').click();
  await analysis.locator('[data-action="select-key"]').first().click();
  return analysis.evaluate((host) => {
    const board = host.querySelector<HTMLElement>(".analysis-v2-keyboard")!;
    const inspector = host.querySelector<HTMLElement>(
      ".analysis-v2-semantic-stage.has-selection > .analysis-v2-inspector",
    )!;
    const slot = host.querySelector<HTMLElement>(
      ".analysis-v2-semantic-primary .analysis-v2-primary-object-slot",
    )!;
    const boardRect = board.getBoundingClientRect();
    const inspectorRect = inspector.getBoundingClientRect();
    if (getComputedStyle(slot).position !== "static") {
      throw new Error("short-height semantic composition did not return to flow");
    }
    return inspectorRect.top - boardRect.bottom;
  });
}

test("returns keyboard-led views to flow before a short desktop viewport can overlap the lower reading", async ({ page }) => {
  for (const height of [560, 480, 400]) {
    const gap = await semanticSelectionGap(page, height);
    expect(gap).toBeGreaterThanOrEqual(0);
  }

  await page.setViewportSize({ width: 1440, height: 400 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  const coordinationGap = await analysis.evaluate((host) => {
    const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout")!;
    const slot = host.querySelector<HTMLElement>(
      ".analysis-v2-speed-primary .analysis-v2-primary-object-slot",
    )!;
    const boardRect = board.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    if (getComputedStyle(slot).position !== "static") {
      throw new Error("short-height coordination composition did not return to flow");
    }
    return readoutRect.top - boardRect.bottom;
  });
  expect(coordinationGap).toBeGreaterThanOrEqual(0);
});

test("uses the shared viewport-relative rail and reserves the methodology lane at 700px", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");

  const geometry = await analysis.evaluate((host) => {
    const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
    const copy = host.querySelector<HTMLElement>(".analysis-v2-speed-readout > span")!;
    const method = host.querySelector<HTMLElement>(".analysis-v2-speed-field > .analysis-v2-method")!;
    const range = document.createRange();
    range.selectNodeContents(copy);
    const textRect = range.getBoundingClientRect();
    const methodRect = method.getBoundingClientRect();
    return {
      boardWidth: board.offsetWidth,
      expectedWidth: window.innerWidth * 0.92,
      methodPosition: getComputedStyle(method).position,
      methodologyGap: methodRect.left - textRect.right,
    };
  });

  expect(Math.abs(geometry.boardWidth - geometry.expectedWidth)).toBeLessThanOrEqual(1);
  expect(geometry.methodPosition).toBe("fixed");
  expect(geometry.methodologyGap).toBeGreaterThanOrEqual(12);
});

test("keeps Movement data rules on the same viewport floor as the key-transition view", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-action="coordination-view"][data-value="movement"]').click();

  const floor = await analysis.evaluate((host) => {
    const method = host.querySelector<HTMLElement>(".analysis-v2-movement-view > .analysis-v2-method")!;
    const rect = method.getBoundingClientRect();
    return {
      position: getComputedStyle(method).position,
      bottomGap: window.innerHeight - rect.bottom,
      visibleBottom: rect.bottom <= window.innerHeight,
    };
  });

  expect(floor.position).toBe("fixed");
  expect(floor.visibleBottom).toBe(true);
  expect(floor.bottomGap).toBeGreaterThanOrEqual(29);
  expect(floor.bottomGap).toBeLessThanOrEqual(49);
});
