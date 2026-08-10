import { expect, test } from "@playwright/test";

test("centers the Strategy trajectory on the Analysis canvas and keeps the lower rail inside its frame", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 960 });
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();

  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="strategy"]').click();
  await expect(analysis.locator(".analysis-v2-strategy-trajectory")).toBeVisible();
  await expect(analysis.locator(".analysis-v2-method")).toBeVisible();

  const geometry = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    const trajectory = host.querySelector<HTMLElement>(".analysis-v2-strategy-trajectory")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-strategy-readout")!;
    const projection = host.querySelector<HTMLElement>(".analysis-v2-strategy-projection")!;
    const method = host.querySelector<HTMLElement>(".analysis-v2-strategy-domain > .analysis-v2-method")!;
    const mainRect = main.getBoundingClientRect();
    const trajectoryRect = trajectory.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    const projectionRect = projection.getBoundingClientRect();
    const methodRect = method.getBoundingClientRect();
    return {
      main: {
        left: mainRect.left,
        top: mainRect.top,
        right: mainRect.right,
        bottom: mainRect.bottom,
        centerX: mainRect.left + mainRect.width / 2,
        centerY: mainRect.top + mainRect.height / 2,
      },
      trajectory: {
        left: trajectoryRect.left,
        right: trajectoryRect.right,
        width: trajectoryRect.width,
        centerX: trajectoryRect.left + trajectoryRect.width / 2,
        centerY: trajectoryRect.top + trajectoryRect.height / 2,
      },
      readout: {
        left: readoutRect.left,
        bottom: readoutRect.bottom,
      },
      projection: {
        left: projectionRect.left,
        bottom: projectionRect.bottom,
      },
      method: {
        left: methodRect.left,
        right: methodRect.right,
        top: methodRect.top,
        bottom: methodRect.bottom,
      },
    };
  });

  expect(geometry.trajectory.width).toBeGreaterThanOrEqual(759);
  expect(geometry.trajectory.width).toBeLessThanOrEqual(760.5);
  expect(Math.abs(geometry.trajectory.centerX - geometry.main.centerX)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.trajectory.centerY - geometry.main.centerY)).toBeLessThanOrEqual(1);

  expect(Math.abs(geometry.projection.left - geometry.trajectory.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.readout.left - geometry.trajectory.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.method.right - geometry.trajectory.right)).toBeLessThanOrEqual(1);

  const readoutFloorGap = geometry.main.bottom - geometry.readout.bottom;
  const projectionFloorGap = geometry.main.bottom - geometry.projection.bottom;
  const methodFloorGap = geometry.main.bottom - geometry.method.bottom;
  expect(readoutFloorGap).toBeGreaterThanOrEqual(29);
  expect(readoutFloorGap).toBeLessThanOrEqual(31);
  expect(Math.abs(projectionFloorGap - readoutFloorGap)).toBeLessThanOrEqual(1);
  expect(Math.abs(methodFloorGap - readoutFloorGap)).toBeLessThanOrEqual(1);

  expect(geometry.method.left).toBeGreaterThanOrEqual(geometry.trajectory.left);
  expect(geometry.method.right).toBeLessThanOrEqual(geometry.trajectory.right + 1);
  expect(geometry.method.top).toBeGreaterThanOrEqual(geometry.main.top);
  expect(geometry.method.bottom).toBeLessThanOrEqual(geometry.main.bottom);
});
