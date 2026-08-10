import { expect, test, type Page } from "@playwright/test";

async function openStrategy(page: Page) {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  const analysis = page.locator("#analysis-v2");
  await expect(analysis).toBeVisible();
  await page.waitForTimeout(340);
  await analysis.locator('[data-tab="strategy"]').click();
  return analysis;
}

async function expectMobileStrategyFlow(
  page: Page,
  bodySize: "2" | "3",
): Promise<void> {
  const analysis = page.locator("#analysis-v2");
  await analysis.locator(`[data-action="strategy-size"][data-value="${bodySize}"]`).click();

  const geometry = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    const stage = host.querySelector<HTMLElement>(".analysis-v2-strategy-stage")!;
    const slot = stage.querySelector<HTMLElement>(".analysis-v2-primary-object-slot")!;
    const object = host.querySelector<HTMLElement>(".analysis-v2-strategy-trajectory-object")!;
    const projection = host.querySelector<HTMLElement>(".analysis-v2-strategy-projection")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-strategy-readout")!;
    const slotRect = slot.getBoundingClientRect();
    const objectRect = object.getBoundingClientRect();
    const projectionRect = projection.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    return {
      slotHeight: slotRect.height,
      objectHeight: objectRect.height,
      projectionBottom: projectionRect.bottom,
      objectBottom: objectRect.bottom,
      readoutTop: readoutRect.top,
      mainClientWidth: main.clientWidth,
      mainScrollWidth: main.scrollWidth,
    };
  });

  expect(geometry.slotHeight).toBeGreaterThanOrEqual(geometry.objectHeight - 1);
  expect(geometry.objectBottom).toBeGreaterThanOrEqual(geometry.projectionBottom - 1);
  expect(geometry.readoutTop).toBeGreaterThanOrEqual(geometry.objectBottom - 1);
  expect(geometry.mainScrollWidth).toBeLessThanOrEqual(geometry.mainClientWidth + 1);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 640, height: 800 },
]) {
  test(`lets mobile Strategy grow with projection at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openStrategy(page);
    await expectMobileStrategyFlow(page, "3");
    await expectMobileStrategyFlow(page, "2");
  });
}
