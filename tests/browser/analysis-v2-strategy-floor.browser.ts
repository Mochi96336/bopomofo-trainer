import { expect, test } from "@playwright/test";

test("keeps Strategy medium-width and settles its reading on the workspace floor", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 960 });
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();

  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="strategy"]').click();
  await expect(analysis.locator(".analysis-v2-strategy-trajectory-object")).toBeVisible();

  const geometry = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    const object = host.querySelector<HTMLElement>(".analysis-v2-strategy-trajectory-object")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-strategy-readout")!;
    const projection = host.querySelector<HTMLElement>(".analysis-v2-strategy-projection")!;
    const mainRect = main.getBoundingClientRect();
    const objectRect = object.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    const projectionRect = projection.getBoundingClientRect();
    return {
      objectWidth: objectRect.width,
      objectLeft: objectRect.left,
      readoutLeft: readoutRect.left,
      readoutFloorGap: mainRect.bottom - readoutRect.bottom,
      projectionFloorGap: mainRect.bottom - projectionRect.bottom,
    };
  });

  expect(geometry.objectWidth).toBeGreaterThanOrEqual(759);
  expect(geometry.objectWidth).toBeLessThanOrEqual(760.5);
  expect(Math.abs(geometry.objectLeft - geometry.readoutLeft)).toBeLessThanOrEqual(1);
  expect(geometry.readoutFloorGap).toBeGreaterThanOrEqual(20);
  expect(geometry.readoutFloorGap).toBeLessThanOrEqual(110);
  expect(geometry.projectionFloorGap).toBeGreaterThanOrEqual(20);
  expect(geometry.projectionFloorGap).toBeLessThanOrEqual(110);
});
