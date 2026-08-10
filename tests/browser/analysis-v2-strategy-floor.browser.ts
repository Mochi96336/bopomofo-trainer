import { expect, test } from "@playwright/test";

test("uses the same desktop viewport anchors for Strategy and Coordination", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 960 });
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();

  const analysis = page.locator("#analysis-v2");
  await expect(analysis.locator(".analysis-v2-speed-board")).toBeVisible();

  const coordination = await analysis.evaluate((host) => {
    const slot = host.querySelector<HTMLElement>(
      ".analysis-v2-speed-primary .analysis-v2-primary-object-slot",
    )!;
    const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout")!;
    const method = host.querySelector<HTMLElement>(".analysis-v2-speed-field > .analysis-v2-method")!;
    const boardRect = board.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    const methodRect = method.getBoundingClientRect();
    return {
      slotPosition: getComputedStyle(slot).position,
      centerX: boardRect.left + boardRect.width / 2,
      centerY: boardRect.top + boardRect.height / 2,
      width: boardRect.width,
      readoutBottom: readoutRect.bottom,
      methodBottom: methodRect.bottom,
    };
  });

  await analysis.locator('[data-tab="strategy"]').click();
  await expect(analysis.locator(".analysis-v2-strategy-trajectory")).toBeVisible();
  await expect(analysis.locator(".analysis-v2-strategy-projection")).toBeVisible();
  await expect(analysis.locator(".analysis-v2-method")).toBeVisible();

  const strategy = await analysis.evaluate((host) => {
    const slot = host.querySelector<HTMLElement>(
      ".analysis-v2-strategy-stage .analysis-v2-primary-object-slot",
    )!;
    const trajectory = host.querySelector<HTMLElement>(".analysis-v2-strategy-trajectory")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-strategy-readout")!;
    const projection = host.querySelector<HTMLElement>(".analysis-v2-strategy-projection")!;
    const method = host.querySelector<HTMLElement>(".analysis-v2-strategy-domain > .analysis-v2-method")!;
    const trajectoryRect = trajectory.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    const projectionRect = projection.getBoundingClientRect();
    const methodRect = method.getBoundingClientRect();
    return {
      slotPosition: getComputedStyle(slot).position,
      centerX: trajectoryRect.left + trajectoryRect.width / 2,
      centerY: trajectoryRect.top + trajectoryRect.height / 2,
      left: trajectoryRect.left,
      right: trajectoryRect.right,
      width: trajectoryRect.width,
      readoutLeft: readoutRect.left,
      readoutBottom: readoutRect.bottom,
      projectionLeft: projectionRect.left,
      projectionBottom: projectionRect.bottom,
      methodRight: methodRect.right,
      methodBottom: methodRect.bottom,
    };
  });

  expect(coordination.slotPosition).toBe("fixed");
  expect(strategy.slotPosition).toBe("fixed");
  expect(Math.abs(strategy.centerX - coordination.centerX)).toBeLessThanOrEqual(1);
  expect(Math.abs(strategy.centerY - coordination.centerY)).toBeLessThanOrEqual(1);
  expect(Math.abs(strategy.width - coordination.width)).toBeLessThanOrEqual(1);
  expect(strategy.width).toBeGreaterThanOrEqual(759);
  expect(strategy.width).toBeLessThanOrEqual(760.5);

  expect(Math.abs(strategy.projectionLeft - strategy.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(strategy.readoutLeft - strategy.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(strategy.methodRight - strategy.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(strategy.readoutBottom - coordination.readoutBottom)).toBeLessThanOrEqual(1);
  expect(Math.abs(strategy.projectionBottom - coordination.readoutBottom)).toBeLessThanOrEqual(1);
  expect(Math.abs(strategy.methodBottom - coordination.methodBottom)).toBeLessThanOrEqual(1);

  const floorGap = window.innerHeight - strategy.readoutBottom;
  expect(floorGap).toBeGreaterThanOrEqual(29);
  expect(floorGap).toBeLessThanOrEqual(49);
});