import { expect, test } from "@playwright/test";

test("opens Analysis V2 without reviving the legacy transition network", async ({ page }) => {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  await expect(page.locator(".analysis-v2-modal")).toBeVisible();
  await expect(page.locator("#analysis-v2")).toBeVisible();

  const tabs = page.locator('#analysis-v2 [role="tab"]');
  await expect(tabs).toHaveText(["語意", "協調", "策略"]);
  await expect(page.locator('[data-action="toggle-network"]')).toHaveCount(0);
  await expect(page.locator(".diagnostic-relationship-svg")).toHaveCount(0);

  await page.locator('[data-action="select-tab"][data-tab="coordination"]').click();
  await expect(page.locator("#analysis-v2-coordination-title")).toHaveText("動作協調");
  await expect(page.getByText("不是偵測實際使用的手")).toBeVisible();

  await page.locator('[data-action="select-tab"][data-tab="strategy"]').click();
  await expect(page.locator("#analysis-v2-strategy-title")).toHaveText("輸入策略");
  await expect(page.getByText(/canonical 位置只是注音結構的參考座標/)).toBeVisible();
  await expect(page.locator(".strategy-matrix")).toHaveCount(3);
});

test("contains Analysis V2 at a narrow phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();

  const modal = page.locator(".analysis-v2-modal");
  const analysis = page.locator("#analysis-v2");
  await expect(modal).toBeVisible();
  await expect(analysis).toBeVisible();

  const viewportContainment = await modal.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportHeight: window.innerHeight,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
    };
  });
  expect(viewportContainment.documentWidth).toBeLessThanOrEqual(viewportContainment.viewportWidth);
  expect(viewportContainment.left).toBeGreaterThanOrEqual(0);
  expect(viewportContainment.top).toBeGreaterThanOrEqual(0);
  expect(viewportContainment.right).toBeLessThanOrEqual(viewportContainment.viewportWidth);
  expect(viewportContainment.bottom).toBeLessThanOrEqual(viewportContainment.viewportHeight);

  await analysis.locator('[data-action="select-tab"][data-tab="coordination"]').click();
  const speedCard = analysis.locator(".analysis-v2-speed-card");
  await expect(speedCard).toBeVisible();
  const overflow = await speedCard.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeGreaterThanOrEqual(overflow.clientWidth);

  await expect(analysis.locator('[role="tab"]')).toHaveCount(3);
  await expect(analysis.locator(".analysis-v2-close")).toBeVisible();
});
